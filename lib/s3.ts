import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { writeFile } from "fs/promises";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;

/**
 * Upload a local file buffer to S3.
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Delete an object from S3.
 */
export async function deleteFromS3(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // Non-fatal — lifecycle rule will clean up regardless
    console.warn(`[s3] Failed to delete ${key}`);
  }
}

/**
 * Download an S3 object to a local file path.
 */
export async function downloadFromS3(key: string, destPath: string): Promise<void> {
  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!response.Body) throw new Error(`S3 object ${key} has no body`);
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  await writeFile(destPath, Buffer.concat(chunks));
}

/**
 * Generate a short-lived signed PUT URL so the browser can upload a file
 * directly to S3.
 *
 * This exists because Vercel hard-caps serverless function request bodies at
 * 4.5 MB — routing uploads through /api/convert would reject anything larger
 * at their edge, before our own code (and its 20 MB limit) ever runs.
 * Uploading browser → S3 sidesteps that entirely.
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a short-lived signed GET URL for a converted file.
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
  downloadFilename?: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(downloadFilename && {
      ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
    }),
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
