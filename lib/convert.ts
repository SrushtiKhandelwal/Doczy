import { readFile, writeFile } from "fs/promises";
import path from "path";
import type { ConversionType } from "./conversions";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import puppeteer from "puppeteer";
import { marked } from "marked";
import JSZip from "jszip";
import { withRenderSlot, ServerBusyError } from "./concurrency";

export interface ConversionResult {
  outputPath: string;
}

export class ConversionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "ConversionError";
  }
}

export async function convertFile(
  inputPaths: string[],
  outputDir: string,
  type: ConversionType
): Promise<ConversionResult> {
  const baseName = path.basename(inputPaths[0], path.extname(inputPaths[0]));

  try {
    switch (type) {
      case "image-to-pdf":
        return await convertImageToPdf(inputPaths, outputDir, baseName);
      case "pdf-to-image":
        return await convertPdfToImage(inputPaths[0], outputDir, baseName);
      case "docx-to-pdf":
        return await convertDocxToPdf(inputPaths[0], outputDir, baseName);
      case "markdown-to-pdf":
        return await convertMarkdownToPdf(inputPaths[0], outputDir, baseName);
      case "html-to-pdf":
        return await convertHtmlToPdf(inputPaths[0], outputDir, baseName);
      case "pdf-merge":
        return await convertMergePdfs(inputPaths, outputDir, baseName);
      case "pdf-split":
        return await convertSplitPdf(inputPaths[0], outputDir, baseName);
      default:
        throw new Error(`Unsupported conversion type: ${type}`);
    }
  } catch (err: unknown) {
    if (err instanceof ServerBusyError) throw err;
    console.error("[convert] Internal error during pure JS conversion:", err);
    const message = err instanceof Error ? err.message : String(err);
    throw new ConversionError(
      `Conversion failed: ${message}`,
      "CONVERSION_FAILED"
    );
  }
}

async function convertImageToPdf(
  inputPaths: string[],
  outputDir: string,
  baseName: string
): Promise<ConversionResult> {
  const pdfDoc = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const imageBytes = await readFile(inputPath);
    let image;
    const ext = path.extname(inputPath).toLowerCase();
    if (ext === ".png") {
      image = await pdfDoc.embedPng(imageBytes);
    } else if (ext === ".jpg" || ext === ".jpeg") {
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      throw new Error("Unsupported image format for PDF conversion. Only JPG/PNG supported.");
    }

    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(outputDir, `${baseName}.pdf`);
  await writeFile(outputPath, pdfBytes);
  return { outputPath };
}

// pdf.js's browser-ready build files, read once and reused across requests —
// self-hosted from the already-installed pdfjs-dist package instead of
// fetching from a CDN, so this conversion has no third-party network
// dependency and always matches the pinned pdfjs-dist version.
let pdfjsAssets: Promise<{ pdfjsSource: string; workerSource: string }> | undefined;
function getPdfjsAssets() {
  if (!pdfjsAssets) {
    const buildDir = path.join(process.cwd(), "node_modules", "pdfjs-dist", "build");
    pdfjsAssets = Promise.all([
      readFile(path.join(buildDir, "pdf.min.mjs"), "utf-8"),
      readFile(path.join(buildDir, "pdf.worker.min.mjs"), "utf-8"),
    ]).then(([pdfjsSource, workerSource]) => ({ pdfjsSource, workerSource }));
  }
  return pdfjsAssets;
}

/**
 * PDF → Image using Puppeteer + pdfjs-dist in the browser.
 *
 * Loads pdf.js inside headless Chromium (its native environment), renders
 * every page to a &lt;canvas&gt;, and screenshots each one. This completely
 * avoids Node.js/canvas polyfill compatibility issues. One page can produce
 * one image, so — same as `pdf-split` — multiple pages come back as a
 * `.zip` of one JPEG per page.
 */
async function convertPdfToImage(
  inputPath: string,
  outputDir: string,
  baseName: string
): Promise<ConversionResult> {
  const pdfBytes = await readFile(inputPath);
  const pdfBase64 = pdfBytes.toString("base64");
  const { pdfjsSource, workerSource } = await getPdfjsAssets();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; }
    body { background: white; display: flex; justify-content: center; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="pdf-canvas"></canvas>
</body>
</html>`;

  return withRenderSlot(async () => {
    const browser = await puppeteer.launch({
      // "shell" is the old headless-only Chrome binary — unlike `true`
      // (Puppeteer's "new" headless mode, which is the full browser UI just
      // normally hidden), it never has a window to flash on-screen on Windows.
      headless: "shell",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load", timeout: 30_000 });

      // Load pdf.js and its worker from local source text via blob URLs —
      // no network fetch, so this works offline / behind a firewall. Renders
      // every page in-browser and returns one JPEG data URL per page.
      const pageDataUrls = await page.evaluate(
        async (pdfjsSrc: string, workerSrc: string, pdfBase64: string) => {
          const pdfjsLib = await import(
            /* webpackIgnore: true */ URL.createObjectURL(
              new Blob([pdfjsSrc], { type: "text/javascript" })
            )
          );
          pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
            new Blob([workerSrc], { type: "text/javascript" })
          );

          const pdfData = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
          const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
          const canvas = document.getElementById("pdf-canvas") as HTMLCanvasElement;
          const ctx = canvas.getContext("2d")!;
          const scale = 2.5; // High-res rendering

          const urls: string[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const pdfPage = await pdf.getPage(i);
            const viewport = pdfPage.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await pdfPage.render({ canvasContext: ctx, viewport }).promise;
            urls.push(canvas.toDataURL("image/jpeg", 0.92));
          }
          return urls;
        },
        pdfjsSource,
        workerSource,
        pdfBase64
      );

      const toBuffer = (dataUrl: string) =>
        Buffer.from(dataUrl.replace(/^data:image\/jpeg;base64,/, ""), "base64");

      // One JPEG per page, packaged as a zip — same pattern as `pdf-split`,
      // and unconditional (even a single-page PDF still zips), so the
      // output extension is always `.zip` regardless of page count.
      const zip = new JSZip();
      pageDataUrls.forEach((dataUrl, i) => {
        zip.file(`${baseName}_page_${i + 1}.jpg`, toBuffer(dataUrl));
      });
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      const outputPath = path.join(outputDir, `${baseName}.zip`);
      await writeFile(outputPath, zipBuffer);
      return { outputPath };
    } finally {
      await browser.close();
    }
  });
}

/** Wraps a plain HTML fragment in the shared document style template. */
function wrapHtmlDocument(bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: sans-serif; line-height: 1.5; margin: 40px; }
          img { max-width: 100%; height: auto; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
    </html>
  `;
}

/**
 * Renders HTML to a PDF file via headless Chromium.
 *
 * This handles both trusted HTML we generated ourselves (from docx/Markdown)
 * and raw, user-uploaded HTML (html-to-pdf) — so it's hardened against both:
 * JavaScript is disabled (kills `<script>` execution) and all network
 * requests except `data:` URIs are aborted (blocks remote images/fonts/CSS).
 * Combined with the `--no-sandbox` launch flag, an uploaded HTML file that
 * could still run scripts and reach the network would be able to make
 * outbound requests from the host during rendering (e.g. to the AWS
 * instance-metadata endpoint) and exfiltrate the response by drawing it into
 * the rendered PDF — this closes that off entirely, at the cost of not
 * rendering remote assets.
 */
async function htmlToPdf(html: string, outputPath: string): Promise<void> {
  return withRenderSlot(async () => {
    const browser = await puppeteer.launch({
      // "shell" is the old headless-only Chrome binary — unlike `true`
      // (Puppeteer's "new" headless mode, which is the full browser UI just
      // normally hidden), it never has a window to flash on-screen on Windows.
      headless: "shell",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (req.url().startsWith("data:")) {
          req.continue();
        } else {
          req.abort();
        }
      });

      await page.setContent(html, { waitUntil: "domcontentloaded" });
      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
      });
    } finally {
      await browser.close();
    }
  });
}

async function convertDocxToPdf(
  inputPath: string,
  outputDir: string,
  baseName: string
): Promise<ConversionResult> {
  const { value: html } = await mammoth.convertToHtml({ path: inputPath });

  const outputPath = path.join(outputDir, `${baseName}.pdf`);
  await htmlToPdf(wrapHtmlDocument(html), outputPath);
  return { outputPath };
}

async function convertMarkdownToPdf(
  inputPath: string,
  outputDir: string,
  baseName: string
): Promise<ConversionResult> {
  const markdown = await readFile(inputPath, "utf-8");
  const html = await marked.parse(markdown);

  const outputPath = path.join(outputDir, `${baseName}.pdf`);
  await htmlToPdf(wrapHtmlDocument(html), outputPath);
  return { outputPath };
}

async function convertHtmlToPdf(
  inputPath: string,
  outputDir: string,
  baseName: string
): Promise<ConversionResult> {
  const html = await readFile(inputPath, "utf-8");

  const outputPath = path.join(outputDir, `${baseName}.pdf`);
  await htmlToPdf(html, outputPath);
  return { outputPath };
}

async function convertMergePdfs(
  inputPaths: string[],
  outputDir: string,
  baseName: string
): Promise<ConversionResult> {
  const merged = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const bytes = await readFile(inputPath);
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }

  const mergedBytes = await merged.save();
  const outputPath = path.join(outputDir, `${baseName}.pdf`);
  await writeFile(outputPath, mergedBytes);
  return { outputPath };
}

async function convertSplitPdf(
  inputPath: string,
  outputDir: string,
  baseName: string
): Promise<ConversionResult> {
  const bytes = await readFile(inputPath);
  const src = await PDFDocument.load(bytes);
  const zip = new JSZip();

  for (const pageIndex of src.getPageIndices()) {
    const single = await PDFDocument.create();
    const [copiedPage] = await single.copyPages(src, [pageIndex]);
    single.addPage(copiedPage);
    const pageBytes = await single.save();
    zip.file(`${baseName}_page_${pageIndex + 1}.pdf`, pageBytes);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const outputPath = path.join(outputDir, `${baseName}.zip`);
  await writeFile(outputPath, zipBuffer);
  return { outputPath };
}
