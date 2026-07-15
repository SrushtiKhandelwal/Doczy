import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { writeFile, readFile, rm, mkdir } from "fs/promises";
import path from "path";
import os from "os";

import { CONVERSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/conversions";
import { validateMagicBytes, isLikelyTextFile } from "@/lib/magic";
import { uploadToS3, deleteFromS3, downloadFromS3, getSignedDownloadUrl } from "@/lib/s3";
import { convertFile, ConversionError } from "@/lib/convert";
import { scanFile } from "@/lib/scan";
import { ServerBusyError } from "@/lib/concurrency";

// Set max duration for this route (EC2 — runs synchronously, can be slow)
export const maxDuration = 120;

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: message, code }, { status });
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return errorResponse("UNAUTHORIZED", "You must be signed in to convert files.", 401);
  }

  // ── 2. Parse multipart form data ─────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("INVALID_REQUEST", "Could not parse form data.", 400);
  }

  const conversionType = formData.get("conversionType") as string | null;
  const fileEntries = formData.getAll("file");
  
  if (!conversionType || fileEntries.length === 0 || !fileEntries.every(f => f instanceof File)) {
    return errorResponse(
      "INVALID_REQUEST",
      "Missing required fields: file (at least one) and conversionType.",
      400
    );
  }

  const files = fileEntries as File[];

  // ── 3. Validate conversion type ──────────────────────────────────────────
  const conversion = CONVERSIONS[conversionType as keyof typeof CONVERSIONS];
  if (!conversion) {
    return errorResponse(
      "INVALID_CONVERSION_TYPE",
      `Unsupported conversion type: ${conversionType}.`,
      400
    );
  }

  // ── 4. File size check ───────────────────────────────────────────────────
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  if (totalSize > MAX_FILE_SIZE_BYTES) {
    return errorResponse(
      "FILE_TOO_LARGE",
      `Total file size exceeds the ${process.env.MAX_FILE_SIZE_MB ?? 20} MB limit.`,
      413
    );
  }

  // ── 5. Read file bytes ───────────────────────────────────────────────────
  const fileBuffers = await Promise.all(files.map(f => f.arrayBuffer().then(ab => Buffer.from(ab))));

  // ── 6. Magic-byte MIME validation ────────────────────────────────────────
  // Plain-text formats (Markdown, HTML) have no magic number, so they're
  // validated via a text-vs-binary heuristic instead of a byte signature.
  const isTextConversion = conversion.acceptedMimes.every((m) => m.startsWith("text/"));
  let primaryMime: string | undefined;
  for (let i = 0; i < fileBuffers.length; i++) {
    if (isTextConversion) {
      if (!isLikelyTextFile(fileBuffers[i])) {
        return errorResponse(
          "INVALID_FILE_TYPE",
          `File ${files[i].name} doesn't look like a text file. Expected: ${conversion.label}.`,
          415
        );
      }
      if (i === 0) primaryMime = conversion.acceptedMimes[0];
      continue;
    }

    const { valid, detectedMime } = validateMagicBytes(fileBuffers[i], conversion.acceptedMimes);
    if (!valid) {
      return errorResponse(
        "INVALID_FILE_TYPE",
        `File ${files[i].name} doesn't match the expected type for ${conversion.label}. Detected: ${detectedMime ?? "unknown"}.`,
        415
      );
    }
    if (i === 0) primaryMime = detectedMime;
  }

  // ── 7. Upload raw files to S3 (optional, doing first file for now to keep history) ─────────────────────────────────────────────
  const uuid = randomUUID();
  const firstInputExt = path.extname(files[0].name) || `.${conversion.acceptedExtensions[0].replace(".", "")}`;
  const s3InputKey = `uploads/${userId}/${uuid}${firstInputExt}`;
  const s3OutputKey = `converted/${userId}/${uuid}.${conversion.outputExtension}`;

  try {
    await uploadToS3(s3InputKey, fileBuffers[0], primaryMime ?? "application/octet-stream");
  } catch (err) {
    console.error("[convert] S3 upload failed:", err);
    return errorResponse("S3_UPLOAD_FAILED", "Failed to upload file. Please try again.", 500);
  }

  // ── 8. Create local temp dir ─────────────────────────────────────────────
  const tmpDir = path.join(os.tmpdir(), `doczy-${uuid}`);
  const localInputPaths: string[] = [];

  try {
    await mkdir(tmpDir, { recursive: true });
    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i].name) || `.${conversion.acceptedExtensions[0].replace(".", "")}`;
      const localPath = path.join(tmpDir, `input-${i}${ext}`);
      await writeFile(localPath, fileBuffers[i]);
      localInputPaths.push(localPath);
    }
  } catch (err) {
    await deleteFromS3(s3InputKey).catch(() => {});
    console.error("[convert] Temp write failed:", err);
    return errorResponse("SERVER_ERROR", "Failed to prepare files for processing.", 500);
  }

  try {
    // ── 9. ClamAV virus scan ───────────────────────────────────────────────
    for (const localPath of localInputPaths) {
      const scanResult = await scanFile(localPath);
      if (scanResult === "infected") {
        await deleteFromS3(s3InputKey).catch(() => {});
        return errorResponse(
          "VIRUS_DETECTED",
          "Our virus scanner detected a potential threat in one of your files. The request has been rejected.",
          422
        );
      }
      if (scanResult === "error") {
        await deleteFromS3(s3InputKey).catch(() => {});
        return errorResponse(
          "SCAN_FAILED",
          "Virus scan could not complete. Please try again.",
          500
        );
      }
    }

    // ── 10. Conversion ─────────────────────────────────────────
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

    // ── 11. Upload converted file to S3 ────────────────────────────────────
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

    // ── 12. Delete raw S3 upload (no longer needed) ────────────────────────
    await deleteFromS3(s3InputKey);

    // ── 13. Generate signed download URL (1 hour) ──────────────────────────
    let baseName = files[0].name.replace(/\.[^/.]+$/, "");
    if (files.length > 1) {
      baseName += `_and_${files.length - 1}_others`;
    }
    const downloadFilename = `${baseName}.${conversion.outputExtension}`;
    const url = await getSignedDownloadUrl(s3OutputKey, 3600, downloadFilename);

    return Response.json({ url });
  } finally {
    // ── 14. Always clean up local temp files ───────────────────────────────
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
