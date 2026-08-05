"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import DropZone from "./DropZone";
import StatusPanel, { type ConversionStatus } from "./StatusPanel";
import { CONVERSIONS, type ConversionType } from "@/lib/conversions";
import { Button } from "@/components/ui/button";

const ERROR_CODE_MAP: Record<string, ConversionStatus> = {
  FILE_TOO_LARGE: "error-too-large",
  INVALID_FILE_TYPE: "error-bad-type",
  VIRUS_DETECTED: "error-virus",
  CONVERSION_FAILED: "error-conversion",
  UNAUTHORIZED: "error-auth",
  SERVER_BUSY: "error-busy",
};

interface ConverterCardProps {
  conversionType: ConversionType;
}

export default function ConverterCard({ conversionType }: ConverterCardProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<ConversionStatus>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>();
  const [outputFileName, setOutputFileName] = useState<string | undefined>();

  const conversion = CONVERSIONS[conversionType];

  // Changing the file selection after a completed (or failed) attempt must
  // invalidate that attempt's result — otherwise the stale success panel
  // (with the *previous* file's download link) stays visible and clickable
  // even though it no longer corresponds to what's in the drop zone.
  const handleFilesChange = useCallback(
    (newFiles: File[]) => {
      setFiles(newFiles);
      if (status !== "idle" && status !== "loading") {
        setStatus("idle");
        setDownloadUrl(undefined);
        setOutputFileName(undefined);
      }
    },
    [status]
  );

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;

    setStatus("loading");
    setDownloadUrl(undefined);

    try {
      // Files go browser → S3 directly, never through /api/convert, because
      // Vercel hard-caps serverless request bodies at 4.5 MB. Array order is
      // preserved across all three steps — merge/image-to-pdf depend on it.

      // 1. Ask the server for presigned S3 upload URLs.
      const presignRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversionType,
          files: files.map((f) => ({ name: f.name, size: f.size })),
        }),
      });
      const presignData = await presignRes.json();

      if (!presignRes.ok) {
        const errCode = presignData?.code as string | undefined;
        setStatus(ERROR_CODE_MAP[errCode ?? ""] ?? "error-generic");
        return;
      }

      const uploads = presignData.uploads as { key: string; url: string }[];

      // 2. Upload each file straight to S3.
      await Promise.all(
        uploads.map(async (upload, i) => {
          const putRes = await fetch(upload.url, {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: files[i],
          });
          if (!putRes.ok) {
            throw new Error(`Upload failed for ${files[i].name}`);
          }
        })
      );

      // 3. Convert, passing only the S3 keys.
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversionType,
          files: uploads.map((u, i) => ({ key: u.key, name: files[i].name })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errCode = data?.code as string | undefined;
        setStatus(ERROR_CODE_MAP[errCode ?? ""] ?? "error-generic");
        return;
      }

      let baseName = files[0].name.replace(/\.[^/.]+$/, "");
      if (files.length > 1) {
        baseName += `_and_${files.length - 1}_others`;
      }
      setOutputFileName(`${baseName}.${conversion.outputExtension}`);
      setDownloadUrl(data.url);
      setStatus("success");
    } catch {
      setStatus("error-generic");
    }
  }, [files, conversionType, conversion.outputExtension]);

  const handleReset = () => {
    setFiles([]);
    setStatus("idle");
    setDownloadUrl(undefined);
    setOutputFileName(undefined);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.4, bounce: 0 }}
      className="mx-auto w-full overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="flex flex-col gap-4 p-5">
        <DropZone
          conversion={conversion}
          files={files}
          onFiles={handleFilesChange}
          disabled={status === "loading"}
        />

        <StatusPanel
          status={status}
          downloadUrl={downloadUrl}
          outputFileName={outputFileName}
          onFileNameChange={setOutputFileName}
        />

        {status !== "success" && (
          <Button
            id="convert-btn"
            size="lg"
            className="w-full"
            disabled={files.length === 0 || status === "loading"}
            onClick={handleConvert}
          >
            {status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {status === "loading" ? "Converting…" : `Convert to ${conversion.toLabel}`}
          </Button>
        )}

        {status === "success" && (
          <Button
            id="convert-again-btn"
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={handleReset}
          >
            Convert another file
          </Button>
        )}
      </div>
    </motion.div>
  );
}
