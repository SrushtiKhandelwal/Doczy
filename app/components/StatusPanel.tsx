"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  FileX,
  ServerCrash,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConversionStatus =
  | "idle"
  | "loading"
  | "success"
  | "error-too-large"
  | "error-bad-type"
  | "error-virus"
  | "error-conversion"
  | "error-auth"
  | "error-busy"
  | "error-generic";

interface StatusPanelProps {
  status: ConversionStatus;
  downloadUrl?: string;
  outputFileName?: string;
  onFileNameChange?: (name: string) => void;
}

const ERROR_CONFIG: Record<
  string,
  { icon: React.ReactNode; title: string; body: string }
> = {
  "error-too-large": {
    icon: <FileX className="size-5" />,
    title: "File too large",
    body: "Your file exceeds the 20 MB limit. Please use a smaller file.",
  },
  "error-bad-type": {
    icon: <FileX className="size-5" />,
    title: "Unsupported file type",
    body: "The file type doesn't match the selected conversion. Please check the format and try again.",
  },
  "error-virus": {
    icon: <ShieldAlert className="size-5" />,
    title: "Virus detected",
    body: "Our scanner found a potential threat in your file. The file has been rejected and deleted.",
  },
  "error-conversion": {
    icon: <ServerCrash className="size-5" />,
    title: "Conversion failed",
    body: "The converter couldn't process your file. Check that it isn't password-protected or corrupted.",
  },
  "error-auth": {
    icon: <AlertTriangle className="size-5" />,
    title: "Not signed in",
    body: "You need to be signed in to convert files.",
  },
  "error-busy": {
    icon: <Clock className="size-5" />,
    title: "Server is busy",
    body: "We're processing a lot of conversions right now. Please try again in a moment.",
  },
  "error-generic": {
    icon: <AlertTriangle className="size-5" />,
    title: "Something went wrong",
    body: "An unexpected error occurred. Please try again.",
  },
};

export default function StatusPanel({
  status,
  downloadUrl,
  outputFileName,
  onFileNameChange,
}: StatusPanelProps) {
  if (status === "idle") return null;

  const isError = status.startsWith("error-");
  const errConfig = isError ? ERROR_CONFIG[status] : null;

  // Split off the extension so renaming can't accidentally change the
  // actual output format (the `download` attribute just needs a filename;
  // the file's real content/type is unaffected either way, but keeping the
  // extension fixed avoids a confusing "renamed to .png but it's still a
  // .pdf" mismatch).
  const dotIndex = outputFileName?.lastIndexOf(".") ?? -1;
  const baseName = dotIndex > -1 ? outputFileName!.slice(0, dotIndex) : outputFileName ?? "";
  const extension = dotIndex > -1 ? outputFileName!.slice(dotIndex) : "";

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      >
        {/* ─ Loading ─ */}
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 rounded-sm border border-border bg-secondary/50 px-6 py-7 text-center">
            <div className="relative size-11">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-border border-t-primary" />
            </div>
            <div>
              <p className="text-[14px] font-medium">Converting your file…</p>
              <p className="mt-1 max-w-70 text-[13px] text-muted-foreground">
                This may take up to a minute for larger files. Please don&apos;t
                close this page.
              </p>
            </div>
          </div>
        )}

        {/* ─ Success ─ */}
        {status === "success" && downloadUrl && (
          <div className="flex flex-col items-center gap-4 rounded-sm border border-success/25 bg-success/10 px-6 py-7 text-center">
            <span className="flex size-11 items-center justify-center rounded-sm border border-success/25 text-success">
              <CheckCircle className="size-5" />
            </span>
            <div>
              <p className="text-[14px] font-medium">
                File converted successfully!
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Your download link expires in 1 hour.
              </p>
            </div>

            {onFileNameChange && (
              <label className="flex w-full max-w-64 flex-col gap-1 text-left">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  File name
                </span>
                <span className="flex items-center overflow-hidden rounded-sm border border-border bg-card">
                  <input
                    type="text"
                    value={baseName}
                    onChange={(e) => onFileNameChange(`${e.target.value}${extension}`)}
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-[13px] outline-none"
                    aria-label="File name (without extension)"
                  />
                  <span className="shrink-0 pr-2.5 text-[13px] text-muted-foreground">
                    {extension}
                  </span>
                </span>
              </label>
            )}

            <Button
              className="gap-2 text-white"
              nativeButton={false}
              render={
                <a
                  href={downloadUrl}
                  download={outputFileName}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Download className="size-4" />
              Download file
            </Button>
          </div>
        )}

        {/* ─ Error ─ */}
        {isError && errConfig && (
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-sm border px-6 py-6 text-center",
              "border-destructive/25 bg-destructive/10"
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-sm border border-destructive/25 text-destructive">
              {errConfig.icon}
            </span>
            <div>
              <p className="text-[14px] font-semibold text-destructive">
                {errConfig.title}
              </p>
              <p className="mt-1 max-w-75 text-[13px] text-muted-foreground">
                {errConfig.body}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
