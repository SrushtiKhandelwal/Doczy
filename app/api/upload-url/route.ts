import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import path from "path";

import { CONVERSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/conversions";
import { getSignedUploadUrl } from "@/lib/s3";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: message, code }, { status });
}

interface RequestedFile {
  name: string;
  size: number;
}

/**
 * Issues presigned S3 PUT URLs so the browser can upload files directly,
 * bypassing Vercel's 4.5 MB serverless request body limit.
 *
 * The size check here is based on client-declared sizes, so it's a fast-fail
 * UX check only — NOT the real enforcement. /api/convert re-checks the actual
 * downloaded bytes, and validates real content via magic bytes, before
 * anything is converted.
 */
export async function POST(req: NextRequest) {
  let body: { conversionType?: string; files?: RequestedFile[] };
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Could not parse request body.", 400);
  }

  const { conversionType, files } = body;

  if (!conversionType || !Array.isArray(files) || files.length === 0) {
    return errorResponse(
      "INVALID_REQUEST",
      "Missing required fields: conversionType and at least one file.",
      400
    );
  }

  const conversion = CONVERSIONS[conversionType as keyof typeof CONVERSIONS];
  if (!conversion) {
    return errorResponse(
      "INVALID_CONVERSION_TYPE",
      `Unsupported conversion type: ${conversionType}.`,
      400
    );
  }

  const totalSize = files.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
  if (totalSize > MAX_FILE_SIZE_BYTES) {
    return errorResponse(
      "FILE_TOO_LARGE",
      `Total file size exceeds the ${process.env.MAX_FILE_SIZE_MB ?? 20} MB limit.`,
      413
    );
  }

  try {
    const uploads = await Promise.all(
      files.map(async (file) => {
        const ext =
          path.extname(file.name || "") ||
          `.${conversion.acceptedExtensions[0].replace(".", "")}`;
        const key = `uploads/${randomUUID()}${ext}`;
        const url = await getSignedUploadUrl(key, "application/octet-stream");
        return { key, url };
      })
    );

    return Response.json({ uploads });
  } catch (err) {
    console.error("[upload-url] Failed to presign:", err);
    return errorResponse(
      "S3_UPLOAD_FAILED",
      "Could not prepare the upload. Please try again.",
      500
    );
  }
}
