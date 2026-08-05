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

  // convertPdfToImage() reads pdfjs-dist's browser build files straight off
  // disk at runtime (a dynamically-constructed fs path, not a static
  // import), so Vercel's build-time file tracer can't discover them on its
  // own and won't include them in the deployed function bundle — causing an
  // ENOENT that only shows up in production, never locally (dev always has
  // the full node_modules on disk). This forces them to be included.
  outputFileTracingIncludes: {
    "/api/convert": ["./node_modules/pdfjs-dist/build/*.mjs"],
  },
};

export default nextConfig;
