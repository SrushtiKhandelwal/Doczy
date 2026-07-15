"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import ConversionSelector from "./ConversionSelector";
import DropZone from "./DropZone";
import StatusPanel, { type ConversionStatus } from "./StatusPanel";
import { CONVERSIONS, type ConversionType } from "@/lib/conversions";
import Button from "./ui/Button";

const ERROR_CODE_MAP: Record<string, ConversionStatus> = {
  FILE_TOO_LARGE: "error-too-large",
  INVALID_FILE_TYPE: "error-bad-type",
  VIRUS_DETECTED: "error-virus",
  CONVERSION_FAILED: "error-conversion",
  UNAUTHORIZED: "error-auth",
  SERVER_BUSY: "error-busy",
};

export default function ConverterCard() {
  const [conversionType, setConversionType] =
    useState<ConversionType>("docx-to-pdf");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<ConversionStatus>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>();
  const [outputFileName, setOutputFileName] = useState<string | undefined>();

  const conversion = CONVERSIONS[conversionType];

  const handleConversionTypeChange = (type: ConversionType) => {
    setConversionType(type);
    setFiles([]);
    setStatus("idle");
    setDownloadUrl(undefined);
  };

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;

    setStatus("loading");
    setDownloadUrl(undefined);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append("file", f));
      formData.append("conversionType", conversionType);

      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", duration: 0.5, bounce: 0, delay: 0.2 }}
      style={{
        width: "100%",
        maxWidth: "580px",
        margin: "0 auto",
        borderRadius: "var(--radius-2xl)",
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "20px 24px 0",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "20px",
        }}
      >
        <ConversionSelector
          value={conversionType}
          onChange={handleConversionTypeChange}
        />
      </div>

      {/* Card body */}
      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <DropZone
          conversion={conversion}
          files={files}
          onFiles={setFiles}
          disabled={status === "loading"}
        />

        <StatusPanel
          status={status}
          downloadUrl={downloadUrl}
          outputFileName={outputFileName}
        />

        {status !== "success" && (
          <Button
            id="convert-btn"
            variant="brand"
            size="lg"
            disabled={files.length === 0 || status === "loading"}
            loading={status === "loading"}
            static={status === "loading"}
            onClick={handleConvert}
            style={{ width: "100%" }}
          >
            <Sparkles size={16} />
            {status === "loading" ? "Converting…" : `Convert to ${conversion.toLabel}`}
          </Button>
        )}

        {status === "success" && (
          <Button
            id="convert-again-btn"
            variant="ghost"
            size="lg"
            onClick={handleReset}
            style={{ width: "100%" }}
          >
            Convert another file
          </Button>
        )}
      </div>
    </motion.div>
  );
}
