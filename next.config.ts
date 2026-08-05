import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  // Keep AWS SDK and Node.js built-ins on the server. @sparticuz/chromium
  // ships an actual Chromium binary that must not be bundled/transpiled.
  serverExternalPackages: [
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "puppeteer",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],

  // Increase server action body size limit (not used here, but future-proof)
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },

  // Two sets of files are read from disk at runtime via dynamically-built
  // paths rather than static imports, so Vercel's build-time file tracer
  // can't discover them on its own and won't include them in the deployed
  // function bundle — causing errors that only appear in production, never
  // locally (dev always has the full node_modules on disk):
  //   1. pdfjs-dist's browser build, read by convertPdfToImage().
  //   2. @sparticuz/chromium's brotli-compressed Chromium binary (bin/*.br),
  //      which it decompresses at runtime in executablePath().
  outputFileTracingIncludes: {
    "/api/convert": [
      "./node_modules/pdfjs-dist/build/*.mjs",
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
};

export default nextConfig;
