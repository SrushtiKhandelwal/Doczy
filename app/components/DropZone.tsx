"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, File as FileIcon, X, AlertCircle, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/utils";
import type { ConversionDefinition } from "@/lib/conversions";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/conversions";

interface DropZoneProps {
  conversion: ConversionDefinition;
  files: File[];
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

// File objects are immutable, so this is stable across reorders/re-renders
// without needing any component state to track identity.
function getFileId(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export default function DropZone({
  conversion,
  files,
  onFiles,
  disabled = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = files.findIndex((f) => getFileId(f) === active.id);
      const newIndex = files.findIndex((f) => getFileId(f) === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      onFiles(arrayMove(files, oldIndex, newIndex));
    },
    [files, onFiles]
  );

  const validateAndSet = useCallback(
    (newFiles: File[]) => {
      setError(null);

      const toAdd: File[] = [];
      let sizeError = false;
      let extError = false;

      // if multiple is not allowed, take only the first
      const fileList = conversion.allowMultiple ? newFiles : newFiles.slice(0, 1);

      for (const f of fileList) {
        if (f.size > MAX_FILE_SIZE_BYTES) {
          sizeError = true;
          continue;
        }
        const ext = "." + f.name.split(".").pop()?.toLowerCase();
        const validExt = conversion.acceptedExtensions.includes(ext);
        if (!validExt) {
          extError = true;
          continue;
        }
        toAdd.push(f);
      }

      if (sizeError) {
        setError(`Some files were too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
      } else if (extError) {
        setError(`Some files had wrong types. Expected: ${conversion.acceptedExtensions.join(", ")}`);
      }

      if (toAdd.length > 0) {
        onFiles(conversion.allowMultiple ? [...files, ...toAdd] : toAdd);
      }
    },
    [conversion, files, onFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) validateAndSet(droppedFiles);
    },
    [disabled, validateAndSet]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) validateAndSet(selectedFiles);
      e.target.value = "";
    },
    [validateAndSet]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const removeFile = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onFiles(newFiles);
    setError(null);
  };

  const acceptAttr = conversion.acceptedExtensions.join(",");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload file drop zone"
        aria-disabled={disabled}
        onClick={() => !disabled && (!files.length || conversion.allowMultiple) && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled && (!files.length || conversion.allowMultiple)) {
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          position: "relative",
          minHeight: "180px",
          borderRadius: "var(--radius-xl)",
          border: `2px dashed ${
            isDragging
              ? "var(--brand)"
              : error
              ? "var(--error)"
              : files.length > 0
              ? "var(--border)"
              : "var(--border)"
          }`,
          background: isDragging
            ? "var(--brand-subtle)"
            : "var(--surface-2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "24px",
          cursor: disabled ? "not-allowed" : files.length > 0 && !conversion.allowMultiple ? "default" : "pointer",
          transition:
            "border-color 200ms var(--ease-out), background 200ms var(--ease-out), box-shadow 200ms var(--ease-out)",
          boxShadow: isDragging ? "var(--shadow-brand)" : "none",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          multiple={conversion.allowMultiple}
          onChange={handleChange}
          style={{ display: "none" }}
          aria-hidden="true"
          id="file-input"
        />

        <AnimatePresence mode="wait" initial={false}>
          {files.length > 0 ? (
            /* ─ File selected state ─ */
            <motion.div
              key="file-selected"
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                width: "100%",
              }}
            >
              {conversion.allowMultiple && files.length > 1 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={files.map(getFileId)}
                    strategy={verticalListSortingStrategy}
                  >
                    {files.map((file, i) => (
                      <SortableFileRow
                        key={getFileId(file)}
                        id={getFileId(file)}
                        file={file}
                        onRemove={(e) => removeFile(i, e)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                files.map((file, i) => (
                  <FileRow
                    key={getFileId(file)}
                    file={file}
                    onRemove={(e) => removeFile(i, e)}
                  />
                ))
              )}

              {conversion.allowMultiple && (
                <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
                  Click or drag to add more {conversion.fromLabel} files
                </div>
              )}
            </motion.div>
          ) : (
            /* ─ Empty state ─ */
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                textAlign: "center",
              }}
            >
              <motion.span
                animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "52px",
                  height: "52px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--surface-3)",
                  color: "var(--text-muted)",
                  outline: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <Upload size={22} />
              </motion.span>

              <div>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)" }}>
                  {isDragging
                    ? "Drop your files here"
                    : "Drop your files here, or click to browse"}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {conversion.acceptedExtensions.join(", ")} · Max {MAX_FILE_SIZE_MB} MB
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "var(--error-bg)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "var(--error)",
              fontSize: "13px",
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FileRowProps {
  file: File;
  onRemove: (e: React.MouseEvent) => void;
  dragHandle?: React.ReactNode;
}

function FileRow({ file, onRemove, dragHandle }: FileRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "12px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-3)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden" }}>
        {dragHandle}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-sm)",
            background: "var(--brand-subtle)",
            color: "var(--brand)",
            flexShrink: 0,
          }}
        >
          <FileIcon size={18} />
        </span>
        <div style={{ overflow: "hidden" }}>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {file.name}
          </p>
          <p
            className="tabular-nums"
            style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}
          >
            {formatBytes(file.size)}
          </p>
        </div>
      </div>

      <button
        onClick={onRemove}
        aria-label="Remove selected file"
        className="btn btn-ghost btn-sm"
        style={{ flexShrink: 0, padding: "8px" }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

function SortableFileRow({
  id,
  file,
  onRemove,
}: FileRowProps & { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <FileRow
        file={file}
        onRemove={onRemove}
        dragHandle={
          <span
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            style={{
              display: "flex",
              alignItems: "center",
              color: "var(--text-muted)",
              cursor: "grab",
              touchAction: "none",
              flexShrink: 0,
            }}
          >
            <GripVertical size={16} />
          </span>
        }
      />
    </div>
  );
}
