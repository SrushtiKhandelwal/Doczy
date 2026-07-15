"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  FileX,
  ServerCrash,
  Loader2,
  Clock,
} from "lucide-react";
import Button from "./ui/Button";

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
}

const ERROR_CONFIG: Record<
  string,
  { icon: React.ReactNode; title: string; body: string }
> = {
  "error-too-large": {
    icon: <FileX size={20} />,
    title: "File too large",
    body: "Your file exceeds the 20 MB limit. Please use a smaller file.",
  },
  "error-bad-type": {
    icon: <FileX size={20} />,
    title: "Unsupported file type",
    body: "The file type doesn't match the selected conversion. Please check the format and try again.",
  },
  "error-virus": {
    icon: <ShieldAlert size={20} />,
    title: "Virus detected",
    body: "Our scanner found a potential threat in your file. The file has been rejected and deleted.",
  },
  "error-conversion": {
    icon: <ServerCrash size={20} />,
    title: "Conversion failed",
    body: "The converter couldn't process your file. Check that it isn't password-protected or corrupted.",
  },
  "error-auth": {
    icon: <AlertTriangle size={20} />,
    title: "Not signed in",
    body: "You need to be signed in to convert files.",
  },
  "error-busy": {
    icon: <Clock size={20} />,
    title: "Server is busy",
    body: "We're processing a lot of conversions right now. Please try again in a moment.",
  },
  "error-generic": {
    icon: <AlertTriangle size={20} />,
    title: "Something went wrong",
    body: "An unexpected error occurred. Please try again.",
  },
};

export default function StatusPanel({
  status,
  downloadUrl,
  outputFileName,
}: StatusPanelProps) {
  if (status === "idle") return null;

  const isError = status.startsWith("error-");
  const errConfig = isError ? ERROR_CONFIG[status] : null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
        transition={{ type: "spring", duration: 0.35, bounce: 0 }}
      >
        {/* ─ Loading ─ */}
        {status === "loading" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              padding: "28px 24px",
              borderRadius: "var(--radius-xl)",
              background: "var(--surface-2)",
              border: "1px solid var(--border-subtle)",
              textAlign: "center",
            }}
          >
            {/* Indeterminate ring */}
            <div style={{ position: "relative", width: "48px", height: "48px" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid var(--border)",
                  borderTopColor: "var(--brand)",
                }}
              />
            </div>
            <div>
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--text)",
                }}
              >
                Converting your file…
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                  maxWidth: "280px",
                }}
              >
                This may take up to a minute for larger files. Please don't close this page.
              </p>
            </div>
          </div>
        )}

        {/* ─ Success ─ */}
        {status === "success" && downloadUrl && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              padding: "28px 24px",
              borderRadius: "var(--radius-xl)",
              background: "var(--success-bg)",
              border: "1px solid rgba(34,197,94,0.2)",
              textAlign: "center",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-lg)",
                background: "rgba(34,197,94,0.12)",
                color: "var(--success)",
                outline: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <CheckCircle size={22} />
            </span>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)" }}>
                File converted successfully!
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                Your download link expires in 1 hour.
              </p>
            </div>
            <a
              href={downloadUrl}
              download={outputFileName}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-brand btn-lg btn-static"
              style={{ gap: "8px" }}
            >
              <Download size={16} />
              Download file
            </a>
          </div>
        )}

        {/* ─ Error ─ */}
        {isError && errConfig && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              padding: "24px",
              borderRadius: "var(--radius-xl)",
              background: "var(--error-bg)",
              border: "1px solid rgba(239,68,68,0.2)",
              textAlign: "center",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-lg)",
                background: "rgba(239,68,68,0.12)",
                color: "var(--error)",
              }}
            >
              {errConfig.icon}
            </span>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--error)" }}>
                {errConfig.title}
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                  maxWidth: "300px",
                }}
              >
                {errConfig.body}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
