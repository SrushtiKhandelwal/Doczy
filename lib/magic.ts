/**
 * Magic-byte MIME type validation.
 * We validate the actual file header bytes — never trust the client-supplied
 * MIME type or the file extension alone.
 */

interface MagicResult {
  valid: boolean;
  detectedMime?: string;
}

// Map of magic byte signatures to MIME types
const SIGNATURES: Array<{
  bytes: number[];
  offset: number;
  mime: string;
}> = [
  // PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mime: "application/pdf" },
  // ZIP-based formats (docx, xlsx, pptx are all ZIP)
  { bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0, mime: "application/zip" },
  // Old MS Office (doc, xls, ppt) — OLE2 compound document
  {
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    offset: 0,
    mime: "application/vnd.ms-office",
  },
  // JPEG
  { bytes: [0xff, 0xd8, 0xff], offset: 0, mime: "image/jpeg" },
  // PNG
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
    mime: "image/png",
  },
  // WebP (RIFF....WEBP)
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mime: "image/webp-riff" },
];

/**
 * Resolves a ZIP-based MIME type to the actual Office format
 * by looking for the `[Content_Types].xml` signature in the archive.
 */
function resolveZipMime(buf: Buffer): string {
  const str = buf.toString("latin1", 0, Math.min(buf.length, 2000));
  if (str.includes("word/")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (str.includes("ppt/") || str.includes("presentation")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (str.includes("xl/") || str.includes("workbook")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "application/zip";
}

export function validateMagicBytes(
  buf: Buffer,
  allowedMimes: string[]
): MagicResult {
  let detectedMime: string | undefined;

  for (const sig of SIGNATURES) {
    const slice = buf.slice(sig.offset, sig.offset + sig.bytes.length);
    if (sig.bytes.every((b, i) => slice[i] === b)) {
      if (sig.mime === "application/zip") {
        detectedMime = resolveZipMime(buf);
      } else if (sig.mime === "image/webp-riff") {
        // Confirm WEBP marker at offset 8
        const webp = buf.toString("ascii", 8, 12);
        detectedMime = webp === "WEBP" ? "image/webp" : "image/unknown";
      } else {
        detectedMime = sig.mime;
      }
      break;
    }
  }

  if (!detectedMime) {
    return { valid: false };
  }

  // Expand allowed list: old .doc/.ppt/.xls all show as vnd.ms-office
  const expanded = [...allowedMimes];
  if (
    allowedMimes.some(
      (m) =>
        m.includes("wordprocessingml") ||
        m.includes("presentationml") ||
        m.includes("spreadsheetml") ||
        m.includes("msword") ||
        m.includes("ms-powerpoint") ||
        m.includes("ms-excel")
    )
  ) {
    expanded.push("application/vnd.ms-office");
  }

  const valid = expanded.includes(detectedMime);
  return { valid, detectedMime };
}

/**
 * Plain-text formats (Markdown, HTML) have no magic number to check.
 * Fall back to the standard binary-vs-text heuristic: real text files don't
 * contain NUL bytes, whereas a renamed binary/executable almost always will
 * within the first few KB. This still defeats the actual threat magic-byte
 * checks guard against (extension spoofing), just via a different signal.
 */
export function isLikelyTextFile(buf: Buffer): boolean {
  if (buf.length === 0) return false;
  const sample = buf.subarray(0, 8000);
  return !sample.includes(0);
}
