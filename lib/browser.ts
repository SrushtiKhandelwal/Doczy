import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

/**
 * Launches headless Chromium, picking the right binary for the environment.
 *
 * Local dev and a normal server can use the full Chromium that the
 * `puppeteer` package downloads on install. Serverless platforms (Vercel,
 * AWS Lambda) can't — that binary is too large and isn't built for the
 * Lambda runtime — so there we use `@sparticuz/chromium`, a build packaged
 * specifically for it.
 *
 * `puppeteer-core` is the driver in both cases (it's the same API as
 * `puppeteer`, just without the bundled browser download), so the calling
 * code is identical either way.
 */
export async function launchBrowser(): Promise<Browser> {
  // Vercel sets this on every deployment; absent when running locally.
  const isServerless = !!process.env.VERCEL;

  if (isServerless) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local: reuse the Chromium that the `puppeteer` package installed.
  const { default: fullPuppeteer } = await import("puppeteer");
  return puppeteer.launch({
    // "shell" is the old headless-only Chrome binary — unlike `true`
    // (Puppeteer's "new" headless mode, which is the full browser UI just
    // normally hidden), it never has a window to flash on-screen on Windows.
    headless: "shell",
    executablePath: await fullPuppeteer.executablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}
