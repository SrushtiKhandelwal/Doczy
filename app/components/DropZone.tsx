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
    <div className="flex flex-col gap-2.5">
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
        className={cn(
          "flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-sm border border-dashed p-4 transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : error
              ? "border-destructive/50 bg-secondary/50"
              : "border-border bg-secondary/50",
          disabled
            ? "cursor-not-allowed opacity-50"
            : files.length > 0 && !conversion.allowMultiple
              ? "cursor-default"
              : "cursor-pointer"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          multiple={conversion.allowMultiple}
          onChange={handleChange}
          className="hidden"
          aria-hidden="true"
          id="file-input"
        />

        <AnimatePresence mode="wait" initial={false}>
          {files.length > 0 ? (
            /* ─ File selected state ─ */
            <motion.div
              key="file-selected"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              className="flex w-full flex-col gap-1.5"
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
                <div className="mt-1 px-1 font-mono text-[11px] text-muted-foreground/70">
                  Drop another {conversion.fromLabel}, or click to add more —
                  max {MAX_FILE_SIZE_MB} MB total
                </div>
              )}
            </motion.div>
          ) : (
            /* ─ Empty state ─ */
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span className="flex size-11 items-center justify-center rounded-sm border border-border text-muted-foreground">
                <Upload className="size-5" />
              </span>

              <div>
                <p className="text-[14px] font-medium">
                  {isDragging
                    ? "Drop your files here"
                    : "Drop your files here, or click to browse"}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {conversion.acceptedExtensions.join(", ")} · Max{" "}
                  {MAX_FILE_SIZE_MB} MB
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
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="alert"
            className="flex items-center gap-2 rounded-sm border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive"
          >
            <AlertCircle className="size-3.5 shrink-0" />
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
  // Opens the already-selected File in a new tab via a blob URL — purely
  // client-side, no upload/server round-trip needed. Browsers natively
  // render HTML/PDF/images opened this way. Deliberately not revoking the
  // object URL: the new tab needs it to stay valid for as long as it's open,
  // and we have no way to know when that tab gets closed.
  const handlePreview = () => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-border bg-card p-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {dragHandle}
        <button
          type="button"
          onClick={handlePreview}
          aria-label={`Preview ${file.name} in a new tab`}
          className="flex min-w-0 items-center gap-2.5 rounded-sm text-left transition-opacity hover:opacity-70"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
            <FileIcon className="size-4" />
          </span>
          <span className="min-w-0">
            <p className="truncate text-[13.5px] font-medium">{file.name}</p>
            <p className="tabular-nums font-mono text-[11px] text-muted-foreground">
              {formatBytes(file.size)}
            </p>
          </span>
        </button>
      </div>

      <button
        onClick={onRemove}
        aria-label="Remove selected file"
        className="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-3.5" />
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
            className="flex shrink-0 cursor-grab items-center text-muted-foreground/60 touch-none"
          >
            <GripVertical className="size-3.5" />
          </span>
        }
      />
    </div>
  );
}
