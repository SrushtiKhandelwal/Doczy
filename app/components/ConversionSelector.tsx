"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CONVERSION_LIST, type ConversionType } from "@/lib/conversions";
import {
  FileText,
  FileImage,
  FileCode,
  Presentation,
  ArrowRight,
  Image,
  Combine,
  SplitSquareHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ReactNode> = {
  "docx-to-pdf": (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <FileText size={14} />
      <ArrowRight size={10} style={{ opacity: 0.5 }} />
      <FileText size={14} />
    </span>
  ),
  "pdf-to-docx": (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <FileText size={14} />
      <ArrowRight size={10} style={{ opacity: 0.5 }} />
      <FileText size={14} />
    </span>
  ),
  "pptx-to-pdf": (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Presentation size={14} />
      <ArrowRight size={10} style={{ opacity: 0.5 }} />
      <FileText size={14} />
    </span>
  ),
  "image-to-pdf": (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Image size={14} />
      <ArrowRight size={10} style={{ opacity: 0.5 }} />
      <FileText size={14} />
    </span>
  ),
  "pdf-to-image": (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <FileText size={14} />
      <ArrowRight size={10} style={{ opacity: 0.5 }} />
      <FileImage size={14} />
    </span>
  ),
  "markdown-to-pdf": (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <FileCode size={14} />
      <ArrowRight size={10} style={{ opacity: 0.5 }} />
      <FileText size={14} />
    </span>
  ),
  "html-to-pdf": (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <FileCode size={14} />
      <ArrowRight size={10} style={{ opacity: 0.5 }} />
      <FileText size={14} />
    </span>
  ),
  "pdf-merge": (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Combine size={14} />
    </span>
  ),
  "pdf-split": (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <SplitSquareHorizontal size={14} />
    </span>
  ),
};

interface ConversionSelectorProps {
  value: ConversionType;
  onChange: (type: ConversionType) => void;
}

export default function ConversionSelector({
  value,
  onChange,
}: ConversionSelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Conversion type"
      style={{
        display: "flex",
        gap: "4px",
        padding: "4px",
        background: "var(--surface-2)",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-subtle)",
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {CONVERSION_LIST.map((conv) => {
        const isActive = conv.id === value;
        return (
          <button
            key={conv.id}
            role="tab"
            aria-selected={isActive}
            id={`tab-${conv.id}`}
            onClick={() => onChange(conv.id)}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--radius-lg)",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: isActive ? 600 : 500,
              fontFamily: "inherit",
              color: isActive ? "var(--text)" : "var(--text-muted)",
              background: "transparent",
              transition:
                "color 200ms var(--ease-out), background 200ms var(--ease-out)",
              whiteSpace: "nowrap",
              minHeight: "40px",
              letterSpacing: "-0.01em",
              zIndex: 1,
            }}
          >
            {/* Animated background pill */}
            {isActive && (
              <motion.span
                layoutId="conversion-pill"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "var(--radius-lg)",
                  background: "var(--surface-3)",
                  boxShadow: "var(--shadow-sm)",
                  zIndex: -1,
                }}
                transition={{ type: "spring", duration: 0.35, bounce: 0 }}
              />
            )}
            {ICONS[conv.id]}
            <span>{conv.label}</span>
          </button>
        );
      })}
    </div>
  );
}
