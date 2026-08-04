# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (Turbopack)
npm run build    # production build (also type-checks — no separate `tsc` script exists)
npm run start    # run production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```

There is no test suite in this repo (no test runner installed, no `*.test.*`/`*.spec.*` files). Don't assume Jest/Vitest conventions apply.

## Important: this is Next.js 16, not the Next.js in your training data

Breaking changes to be aware of before writing code:
- Middleware would be `proxy.ts` at the project root, not `middleware.ts` — but this project has no middleware at all right now (see Auth below).
- Full API docs are vendored at `node_modules/next/dist/docs/` (verified genuine — matches installed version 16.2.10). Check there before assuming an API from an older Next.js version still works the same way.

## Architecture

This is a **document conversion webapp**. The implementation diverges from the PRD below in two major ways worth flagging up front:
1. **There is no LibreOffice and no ClamAV daemon dependency in the actual code.** Conversions are done in pure JS/Node libraries, and the virus scan step silently no-ops when `clamdscan`/`clamscan` aren't on PATH. Don't add LibreOffice `child_process` calls expecting them to match existing patterns — there aren't any.
2. **There is no authentication at all.** The PRD's "auth required, no anonymous usage" requirement was deliberately reversed — no comparable file-converter tool (iLovePDF, Smallpdf, etc.) gates basic conversion behind login, and Doczy had no feature that actually depended on identity (no saved history, no per-account tier). `/api/convert` is fully public. If auth ever comes back, it should be because a real feature needs it (saved conversion history, usage tiers), not as a bare gate.

### Request flow — single synchronous API route

Everything happens inside one handler: [app/api/convert/route.ts](app/api/convert/route.ts). There is no job queue. In order:

1. Parse `multipart/form-data`: `file` (one or more) + `conversionType`.
2. Look up the conversion definition in `CONVERSIONS` ([lib/conversions.ts](lib/conversions.ts)) — this is the single source of truth for supported conversions, accepted MIME types/extensions, and output extension.
3. Enforce `MAX_FILE_SIZE_BYTES` (env `MAX_FILE_SIZE_MB`, default 20).
4. Validate real file content via magic bytes ([lib/magic.ts](lib/magic.ts)) — never trusts client-supplied MIME/extension. It sniffs ZIP-based Office formats by grepping for `word/`/`ppt/`/`xl/` inside the archive bytes, and old OLE2 Office files all collapse to one `vnd.ms-office` signature.
5. Upload the raw input to S3 (`uploads/{uuid}.{ext}`), write it to a local temp dir under `os.tmpdir()`.
6. Virus scan via `clamdscan`/`clamscan` ([lib/scan.ts](lib/scan.ts)) — falls back to `"clean"` with a console warning if no scanner binary is found (the local-dev bypass; scanning doesn't actually happen outside a box with ClamAV installed).
7. Convert via [lib/convert.ts](lib/convert.ts) (see below) → upload result to S3 (`converted/{uuid}.{ext}`) → delete the raw upload from S3 → return a 1-hour signed download URL.
8. Local temp dir is always cleaned up in a `finally`.

Every failure path returns a distinct `{ error, code }` JSON body with an appropriate HTTP status — follow this pattern (not a generic 500) when adding new failure modes.

### Conversion engine — pure JS, not LibreOffice ([lib/convert.ts](lib/convert.ts))

Seven conversions are implemented (`ConversionType` in [lib/conversions.ts](lib/conversions.ts)): `docx-to-pdf`, `image-to-pdf`, `pdf-to-image`, `markdown-to-pdf`, `html-to-pdf`, `pdf-merge`, `pdf-split`. pptx→pdf, pdf→docx, and xlsx→pdf from the PRD's scope are **not implemented yet** — pure-JS options for those are much weaker than for the formats above.

- `image-to-pdf`: `pdf-lib` embeds JPG/PNG directly onto pages sized to the image — no LibreOffice needed.
- `docx-to-pdf` / `markdown-to-pdf` / `html-to-pdf`: all funnel through the shared `htmlToPdf()` helper — `mammoth` (docx) / `marked` (Markdown) produce an HTML fragment wrapped via `wrapHtmlDocument()`; raw `html-to-pdf` uploads pass straight through unwrapped. `htmlToPdf()` disables JavaScript and blocks all non-`data:` network requests before rendering — required because `html-to-pdf` renders **untrusted, user-uploaded** HTML, and unrestricted script/network access combined with the `--no-sandbox` launch flag would let an uploaded file make outbound requests from the host during rendering (e.g. to the AWS instance-metadata endpoint) and exfiltrate the response into the PDF.
- `pdf-to-image`: renders **inside headless Chromium** via Puppeteer + pdf.js, page 1 only. pdf.js's browser build (`pdf.min.mjs`/`pdf.worker.min.mjs`) is read directly from the installed `pdfjs-dist` package and injected into the page as `Blob` URLs (dynamic `import()` for the lib, `GlobalWorkerOptions.workerSrc` for the worker) — **not** fetched from a CDN, so this has no third-party network dependency and always matches the pinned `pdfjs-dist` version. This sidesteps Node-side `canvas` native-binding issues (rendering happens in the browser environment, not Node).
- `pdf-merge` / `pdf-split`: pure `pdf-lib` (copy pages into one doc / one doc per page), no Puppeteer. `pdf-split` packages the per-page PDFs into a `.zip` via `jszip`.

Both Puppeteer paths launch with `--no-sandbox --disable-setuid-sandbox`, close the browser in a `finally`, and are wrapped in `withRenderSlot()` (see below).

### Concurrency guard ([lib/concurrency.ts](lib/concurrency.ts))

There's no job queue (per the PRD), so unbounded concurrent Puppeteer launches on a single EC2 instance can exhaust memory. `withRenderSlot()` is an in-process counting semaphore (`MAX_CONCURRENT_RENDERS` env var, default `2`) that the two Puppeteer call sites (`htmlToPdf`, `convertPdfToImage`) go through — callers past the limit wait in-memory for a free slot (default 60s) before throwing `ServerBusyError`. This is bounded and in-memory, not a persistent queue. `convertFile`'s catch-all lets `ServerBusyError` pass through unwrapped so `route.ts` can return a distinct `503 SERVER_BUSY` instead of folding it into the generic `CONVERSION_FAILED` path.

### Auth — none

Doczy briefly used Clerk for auth-gated access; it was removed entirely (see the divergence note above) — no `proxy.ts`/middleware, no session check in `/api/convert`, no sign-in UI. Every route and page is fully public. Don't reintroduce a Clerk-shaped "must be signed in" gate without a real feature driving it.

### S3 ([lib/s3.ts](lib/s3.ts))

Thin wrapper over `@aws-sdk/client-s3` + `s3-request-presigner`: upload, delete (best-effort, swallows errors since a 24h lifecycle rule is the backstop), download-to-local-path, and signed GET URLs with an optional `Content-Disposition` filename override.

### Path aliases

`@/*` maps to the repo root (`tsconfig.json`), e.g. `@/lib/conversions`.

---

# Doczy — Product Requirements Document

## 1. Overview

**Doczy** is a web-based document conversion tool, similar to iLovePDF, that lets users convert between different document formats (PDF, Word, PowerPoint, Excel, Images) through a clean, modern UI.

**Goal for this phase:** Ship a functional MVP with core conversions, basic auth, and a simple, safe upload → convert → download flow. Optimize for correctness and simplicity over scale — this is a v1, hosted on a single EC2 instance.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend + Backend | Next.js (App Router), single project, API routes handle backend logic |
| Auth | Clerk |
| File storage | AWS S3 |
| Conversion engine | LibreOffice (headless) via child process |
| Virus scanning | ClamAV (daemon on EC2, scan before conversion) |
| Hosting | AWS EC2 (single instance, basic setup — no auto-scaling for now) |
| Job processing | None — conversions run synchronously inside the API route |

**Explicitly not using in this phase:** job queues (BullMQ/Celery/Redis), serverless functions, microservices, payment/billing.

---

## 3. Core User Flow

1. User signs in via Clerk (auth required to use the converter — no anonymous usage for v1).
2. User lands on the conversion page, picks a conversion type (e.g. "Word to PDF"), and drags/drops or selects a file.
3. Frontend validates file type and size client-side, then uploads it.
4. Backend flow (single API route call, synchronous):
   - Verify Clerk session.
   - Validate file type via magic bytes (not just extension).
   - Enforce file size limit (start with 20MB).
   - Upload raw file to S3 (`uploads/` prefix).
   - Run ClamAV scan on the file. If infected → reject, delete from S3, return error.
   - Run LibreOffice headless conversion, output to a temp directory.
   - Upload converted file to S3 (`converted/` prefix).
   - Generate a signed, time-limited S3 URL for the converted file.
   - Clean up local temp files.
   - Return signed URL to frontend.
5. Frontend shows a loading state during the request (this call may take several seconds to ~1-2 minutes for larger files), then shows a download button once complete.
6. Converted files auto-expire from S3 after 24 hours (lifecycle rule), and originals are deleted immediately after conversion completes.

---

## 4. Conversion Types (v1 scope)

Prioritize these, in order of implementation:

**Phase 1 (MVP — must have):**
- Word (docx) → PDF
- PDF → Word (docx)
- PowerPoint (pptx) → PDF
- Image (jpg/png) → PDF
- PDF → Image (jpg/png)

**Phase 2 (nice to have, after MVP works end-to-end):**
- Excel (xlsx) → PDF
- PDF → PowerPoint
- PDF merge (combine multiple PDFs into one)
- PDF compress

Do not build Phase 2 features until Phase 1 flow is fully working and tested.

---

## 5. Frontend Requirements

- Clean, minimal, professional UI — no excessive color, no flashy/gratuitous animations.
- Single-page conversion interface:
  - Conversion type selector (dropdown or tabs, e.g. "Word → PDF")
  - Drag-and-drop upload zone (also support click-to-browse)
  - Show selected file name + size before submitting
  - Clear loading/progress state while conversion is in progress (since there's no queue, this is a single long request — show an indeterminate progress indicator, not a fake percentage bar)
  - Success state with a download button
  - Error states: file too large, unsupported file type, virus detected, conversion failed — each with a clear, human-readable message
- Must be responsive (mobile + desktop).
- Auth gating: unauthenticated users see a sign-in prompt instead of the upload zone.

---

## 6. Backend Requirements

### API route: `/api/convert`
- **Method:** POST
- **Auth:** Clerk middleware, reject unauthenticated requests with 401
- **Input:** multipart/form-data — file + conversion type
- **Validation:**
  - File type check via magic bytes/MIME sniffing, not file extension
  - File size limit (20MB for v1, configurable via env var)
  - Conversion type must be in the supported list for Phase 1
- **Processing steps (in order):**
  1. Upload raw file to S3 under `uploads/{userId}/{uuid}.{ext}`
  2. Run ClamAV scan on the file (via clamdscan or similar) — reject and clean up if infected
  3. Download file to local `/tmp` for processing
  4. Run LibreOffice headless command to convert, using a unique `UserInstallation` profile path per request to avoid lock-file conflicts under concurrent requests
  5. Upload converted output to S3 under `converted/{userId}/{uuid}.{ext}`
  6. Delete local temp files (input and output)
  7. Delete raw uploaded file from S3 (no longer needed post-conversion)
  8. Generate a signed S3 URL for the converted file (expiry: 1 hour)
- **Response:** JSON with signed download URL, or a structured error object with a clear error code/message
- **Timeout:** set route/server timeout generously (e.g. 120s) to accommodate larger files, since there's no background queue

### S3 structure
- Bucket with two prefixes: `uploads/` and `converted/`
- Lifecycle rule: auto-delete all objects after 24 hours
- Signed URLs only — no public bucket access

### Error handling
- Every failure mode (bad file type, oversized file, virus detected, LibreOffice conversion error, S3 upload/download failure) should return a distinct, clearly-worded error — no generic "something went wrong."

---

## 7. Infra Requirements (EC2)

- Single EC2 instance (basic tier to start, e.g. t3.medium — LibreOffice conversions are CPU/memory-heavy, so avoid the smallest tier)
- Installed on the instance:
  - Node.js (matching Next.js requirements)
  - LibreOffice (headless mode, no GUI packages needed)
  - ClamAV (`clamav`, `clamav-daemon`) with virus definitions kept up to date via `freshclam`
- Next.js running as a persistent Node process (not serverless) — use a process manager like PM2 to keep it alive and auto-restart on crash
- Security group: only expose 443 (and 80 for redirect), SSH restricted to known IP
- Environment variables (`.env`) for: S3 bucket name/region, AWS credentials, Clerk keys, file size limits
- No load balancer/auto-scaling for this phase — single instance is acceptable

---

## 8. Security & Privacy Requirements

- All uploaded and converted files are private (S3 signed URLs only, never public)
- Files auto-expire from S3 within 24 hours
- Raw uploaded files deleted immediately after successful conversion
- Virus scan runs before any file is processed by LibreOffice
- File type validated by content (magic bytes), not trusted from extension or client-supplied MIME type
- No file should ever be processed or stored without a valid authenticated Clerk session tied to it

---

## 9. Explicitly Out of Scope for This Phase

- Job queues / background workers
- Payment or subscription tiers
- Anonymous/guest usage
- Batch conversion (multiple files at once)
- OCR or scanned-document text extraction
- Mobile app (web only)
- Auto-scaling / multi-instance infra

---

## 10. Open Questions to Resolve Before/During Build

- Exact file size limit for v1 (default assumption: 20MB — confirm or adjust)
- Whether converted files should be tied to the user's account for later re-download, or are download-once-then-gone
- Whether to show conversion history per user (would require a small DB — not in scope unless confirmed)