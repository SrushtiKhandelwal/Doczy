export type ConversionType =
  | "docx-to-pdf"
  | "image-to-pdf"
  | "pdf-to-image"
  | "markdown-to-pdf"
  | "html-to-pdf"
  | "pdf-merge"
  | "pdf-split";

export interface ConversionDefinition {
  id: ConversionType;
  label: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  acceptedMimes: string[];
  acceptedExtensions: string[];
  outputExtension: string;
  description: string;
  allowMultiple?: boolean;
}

export const CONVERSIONS: Record<ConversionType, ConversionDefinition> = {
  "docx-to-pdf": {
    id: "docx-to-pdf",
    label: "Word → PDF",
    from: "Word",
    to: "PDF",
    fromLabel: "DOCX",
    toLabel: "PDF",
    acceptedMimes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ],
    acceptedExtensions: [".docx", ".doc"],
    outputExtension: "pdf",
    description: "Convert Word documents to PDF",
  },
  "image-to-pdf": {
    id: "image-to-pdf",
    label: "Image → PDF",
    from: "Image",
    to: "PDF",
    fromLabel: "JPG/PNG",
    toLabel: "PDF",
    acceptedMimes: ["image/jpeg", "image/png", "image/webp"],
    acceptedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
    outputExtension: "pdf",
    description: "Convert images to PDF documents",
    allowMultiple: true,
  },
  "pdf-to-image": {
    id: "pdf-to-image",
    label: "PDF → Image",
    from: "PDF",
    to: "Image",
    fromLabel: "PDF",
    toLabel: "JPG/PNG",
    acceptedMimes: ["application/pdf"],
    acceptedExtensions: [".pdf"],
    outputExtension: "jpg",
    description: "Convert PDF pages to image files",
  },
  "markdown-to-pdf": {
    id: "markdown-to-pdf",
    label: "Markdown → PDF",
    from: "Markdown",
    to: "PDF",
    fromLabel: "MD",
    toLabel: "PDF",
    acceptedMimes: ["text/markdown", "text/plain"],
    acceptedExtensions: [".md", ".markdown"],
    outputExtension: "pdf",
    description: "Convert Markdown files to PDF",
  },
  "html-to-pdf": {
    id: "html-to-pdf",
    label: "HTML → PDF",
    from: "HTML",
    to: "PDF",
    fromLabel: "HTML",
    toLabel: "PDF",
    acceptedMimes: ["text/html"],
    acceptedExtensions: [".html", ".htm"],
    outputExtension: "pdf",
    description: "Convert HTML files to PDF",
  },
  "pdf-merge": {
    id: "pdf-merge",
    label: "Merge PDFs",
    from: "PDF",
    to: "PDF",
    fromLabel: "PDF",
    toLabel: "PDF",
    acceptedMimes: ["application/pdf"],
    acceptedExtensions: [".pdf"],
    outputExtension: "pdf",
    description: "Combine multiple PDFs into one document",
    allowMultiple: true,
  },
  "pdf-split": {
    id: "pdf-split",
    label: "Split PDF",
    from: "PDF",
    to: "ZIP",
    fromLabel: "PDF",
    toLabel: "ZIP",
    acceptedMimes: ["application/pdf"],
    acceptedExtensions: [".pdf"],
    outputExtension: "zip",
    description: "Split a PDF into one file per page",
  },
};

export const CONVERSION_LIST = Object.values(CONVERSIONS);

export const MAX_FILE_SIZE_MB = parseInt(
  process.env.MAX_FILE_SIZE_MB ?? "20",
  10
);
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
