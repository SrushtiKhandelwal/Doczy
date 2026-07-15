import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export type ScanResult = "clean" | "infected" | "error";

/**
 * Scan a local file with ClamAV (clamdscan daemon).
 *
 * clamdscan returns:
 *   exit 0 → clean
 *   exit 1 → virus found
 *   exit 2 → error
 *
 * Falls back to `clamscan` (slower, single-process) if clamdscan is not available.
 */
export async function scanFile(filePath: string): Promise<ScanResult> {
  // Try clamdscan first (fast, uses the daemon)
  const scanner = await pickScanner();

  if (!scanner) {
    console.warn("[clamav] Scanner not found. Bypassing scan for local dev.");
    return "clean";
  }

  try {
    await execAsync(`${scanner} --no-summary "${filePath}"`, {
      timeout: 60_000,
    });
    // Exit 0 → clean
    return "clean";
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code: number }).code;
      if (code === 1) return "infected";
    }
    // Exit 2 or timeout — treat as error (fail safe: block the request)
    console.error("[clamav] Scan error:", err);
    return "error";
  }
}

async function pickScanner(): Promise<string | null> {
  const checkCmd = process.platform === "win32" ? "where" : "which";
  try {
    await execAsync(`${checkCmd} clamdscan`);
    return "clamdscan";
  } catch {
    try {
      await execAsync(`${checkCmd} clamscan`);
      return "clamscan";
    } catch {
      return null;
    }
  }
}
