import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { readFile, rm, mkdir, stat } from "fs/promises";
import path from "path";
import os from "os";

import { CONVERSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/conversions";
import { validateMagicBytes, isLikelyTextFile } from "@/lib/magic";
import { uploadToS3, deleteFromS3, downloadFromS3, getSignedDownloadUrl } from "@/lib/s3";
import { convertFile, ConversionError } from "@/lib/convert";
import { scanFile } from "@/lib/scan";
import { ServerBusyError } from "@/lib/concurrency";

// Conversions run synchronously and can be slow for larger files.
export const maxDuration = 120;

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: message, code }, { status });
}

interface InputFile {
  /** S3 key the browser already uploaded to (via /api/upload-url). */
  key: string;
  /** Original filename, used for the extension and output naming. */
  name: string;
}

/**
 * Converts files the browser has already uploaded directly to S3.
 *
 * The raw bytes never pass through this route — only S3 keys do. That's
 * deliberate: Vercel hard-caps serverless request bodies at 4.5 MB, so
 * sending files here would break anything larger before our code even runs.
 */
export async function POST(req: NextRequest) {
  // ── 1. Parse the (small) JSON body ───────────────────────────────────────
  let body: { conversionType?: string; files?: InputFile[] };
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Could not parse request body.", 400);
  }

  const { conversionType, files } = body;

  if (!conversionType || !Array.isArray(files) || files.length === 0) {
    return errorResponse(
      "INVALID_REQUEST",
      "Missing required fields: conversionType and at least one uploaded file.",
      400
    );
  }

  if (!files.every((f) => typeof f?.key === "string" && f.key.startsWith("uploads/"))) {
    return errorResponse("INVALID_REQUEST", "Invalid upload reference.", 400);
  }

  // ── 2. Validate conversion type ──────────────────────────────────────────
  const conversion = CONVERSIONS[conversionType as keyof typeof CONVERSIONS];
  if (!conversion) {
    return errorResponse(
      "INVALID_CONVERSION_TYPE",
      `Unsupported conversion type: ${conversionType}.`,
      400
    );
  }

  const uuid = randomUUID();
  const tmpDir = path.join(os.tmpdir(), `doczy-${uuid}`);
  const s3InputKeys = files.map((f) => f.key);
  const s3OutputKey = `converted/${uuid}.${conversion.outputExtension}`;

  const cleanupInputs = () =>
    Promise.all(s3InputKeys.map((k) => deleteFromS3(k).catch(() => {})));

  try {
    // ── 3. Download the browser-uploaded files from S3 ─────────────────────
    const localInputPaths: string[] = [];
    try {
      await mkdir(tmpDir, { recursive: true });
      for (let i = 0; i < files.length; i++) {
        const ext =
          path.extname(files[i].name || "") ||
          `.${conversion.acceptedExtensions[0].replace(".", "")}`;
        const localPath = path.join(tmpDir, `input-${i}${ext}`);
        await downloadFromS3(files[i].key, localPath);
        localInputPaths.push(localPath);
      }
    } catch (err) {
      await cleanupInputs();
      console.error("[convert] S3 download failed:", err);
      return errorResponse(
        "S3_UPLOAD_FAILED",
        "Could not retrieve the uploaded file. Please try again.",
        500
      );
    }

    // ── 4. Authoritative size check on the REAL bytes ──────────────────────
    // /api/upload-url also checks size, but only against client-declared
    // values — this is the check that actually enforces the limit.
    let totalSize = 0;
    for (const localPath of localInputPaths) {
      totalSize += (await stat(localPath)).size;
    }
    if (totalSize > MAX_FILE_SIZE_BYTES) {
      await cleanupInputs();
      return errorResponse(
        "FILE_TOO_LARGE",
        `Total file size exceeds the ${process.env.MAX_FILE_SIZE_MB ?? 20} MB limit.`,
        413
      );
    }

    // ── 5. Magic-byte MIME validation on real content ──────────────────────
    // Plain-text formats (Markdown, HTML) have no magic number, so they're
    // validated via a text-vs-binary heuristic instead of a byte signature.
    const isTextConversion = conversion.acceptedMimes.every((m) => m.startsWith("text/"));
    for (let i = 0; i < localInputPaths.length; i++) {
      const buf = await readFile(localInputPaths[i]);

      if (isTextConversion) {
        if (!isLikelyTextFile(buf)) {
          await cleanupInputs();
          return errorResponse(
            "INVALID_FILE_TYPE",
            `File ${files[i].name} doesn't look like a text file. Expected: ${conversion.label}.`,
            415
          );
        }
        continue;
      }

      const { valid, detectedMime } = validateMagicBytes(buf, conversion.acceptedMimes);
      if (!valid) {
        await cleanupInputs();
        return errorResponse(
          "INVALID_FILE_TYPE",
          `File ${files[i].name} doesn't match the expected type for ${conversion.label}. Detected: ${detectedMime ?? "unknown"}.`,
          415
        );
      }
    }

    // ── 6. ClamAV virus scan ───────────────────────────────────────────────
    for (const localPath of localInputPaths) {
      const scanResult = await scanFile(localPath);
      if (scanResult === "infected") {
        await cleanupInputs();
        return errorResponse(
          "VIRUS_DETECTED",
          "Our virus scanner detected a potential threat in one of your files. The request has been rejected.",
          422
        );
      }
      if (scanResult === "error") {
        await cleanupInputs();
        return errorResponse(
          "SCAN_FAILED",
          "Virus scan could not complete. Please try again.",
          500
        );
      }
    }

    // ── 7. Conversion ──────────────────────────────────────────────────────
    let outputPath: string;
    try {
      const result = await convertFile(localInputPaths, tmpDir, conversion.id);
      outputPath = result.outputPath;
    } catch (err) {
      if (err instanceof ServerBusyError) {
        return errorResponse("SERVER_BUSY", err.message, 503);
      }
      if (err instanceof ConversionError) {
        return errorResponse("CONVERSION_FAILED", err.message, 422);
      }
      throw err;
    }

    // ── 8. Upload converted file to S3 ─────────────────────────────────────
    const outputBuffer = await readFile(outputPath);
    const outputMime =
      conversion.outputExtension === "pdf"
        ? "application/pdf"
        : conversion.outputExtension === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : conversion.outputExtension === "zip"
        ? "application/zip"
        : "image/jpeg";

    await uploadToS3(s3OutputKey, outputBuffer, outputMime);

    // ── 9. Delete raw S3 uploads (no longer needed) ────────────────────────
    await cleanupInputs();

    // ── 10. Generate signed download URL (1 hour) ──────────────────────────
    let baseName = files[0].name.replace(/\.[^/.]+$/, "");
    if (files.length > 1) {
      baseName += `_and_${files.length - 1}_others`;
    }
    const downloadFilename = `${baseName}.${conversion.outputExtension}`;
    const url = await getSignedDownloadUrl(s3OutputKey, 3600, downloadFilename);

    return Response.json({ url });
  } finally {
    // ── 11. Always clean up local temp files ───────────────────────────────
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
