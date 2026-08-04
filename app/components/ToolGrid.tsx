import Link from "next/link";
import type { IconifyIcon } from "@iconify/types";
import { Icon } from "@iconify/react/offline";
import { CONVERSIONS, type ConversionType } from "@/lib/conversions";
import { Combine, SplitSquareHorizontal, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { FILE_ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";

export const FROM_ICON: Record<string, IconifyIcon> = {
  "docx-to-pdf": FILE_ICON.docx,
  "image-to-pdf": FILE_ICON.image,
  "pdf-to-image": FILE_ICON.pdf,
  "markdown-to-pdf": FILE_ICON.markdown,
  "html-to-pdf": FILE_ICON.html,
};

export const TO_ICON: Record<string, IconifyIcon> = {
  "docx-to-pdf": FILE_ICON.pdf,
  "image-to-pdf": FILE_ICON.pdf,
  "pdf-to-image": FILE_ICON.image,
  "markdown-to-pdf": FILE_ICON.pdf,
  "html-to-pdf": FILE_ICON.pdf,
};

// Merge/split are operations, not file formats — no natural brand icon for
// those, so they stay as plain lucide glyphs.
export const SOLO_ICONS: Partial<Record<string, LucideIcon>> = {
  "pdf-merge": Combine,
  "pdf-split": SplitSquareHorizontal,
};

// The three most commonly needed conversions get bigger, front-and-center cards.
const FEATURED: ConversionType[] = ["image-to-pdf", "pdf-merge", "docx-to-pdf"];
const SECONDARY: ConversionType[] = [
  "pdf-to-image",
  "markdown-to-pdf",
  "html-to-pdf",
  "pdf-split",
];

export function ToolIcon({ id, size = 20 }: { id: string; size?: number }) {
  const SoloIcon = SOLO_ICONS[id];
  if (SoloIcon) return <SoloIcon className="text-muted-foreground" width={size} height={size} />;

  const arrowSize = Math.max(12, Math.round(size * 0.45));
  return (
    <>
      {/* A stable, deterministic `id` (rather than Iconify's default
          auto-incrementing counter) keeps internal <defs>/gradient IDs
          identical between server and client render — icons with a
          gradient (e.g. the Word icon) would otherwise hydration-mismatch,
          since the counter's value depends on render order/count, which
          isn't guaranteed to line up between the two environments. */}
      <Icon icon={FROM_ICON[id]} width={size} height={size} id={`tool-icon-${id}-from`} />
      <ArrowRight
        className="shrink-0 opacity-50"
        style={{ width: arrowSize, height: arrowSize }}
      />
      <Icon icon={TO_ICON[id]} width={size} height={size} id={`tool-icon-${id}-to`} />
    </>
  );
}

export default function ToolGrid() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURED.map((id) => {
          const conv = CONVERSIONS[id];
          return (
            <Link
              key={conv.id}
              href={`/convert/${conv.id}`}
              className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
            >
              <ArrowUpRight className="absolute right-5 top-5 size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" />

              <span className="flex items-center gap-1.5">
                <ToolIcon id={conv.id} size={40} />
              </span>

              <div>
                <h3 className="text-[15.5px] font-semibold tracking-tight">
                  {conv.label}
                </h3>
                <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">
                  {conv.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
        {SECONDARY.map((id) => {
          const conv = CONVERSIONS[id];
          return (
            <Link
              key={conv.id}
              href={`/convert/${conv.id}`}
              className={cn(
                "group relative flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4",
                "transition-colors hover:border-primary/50"
              )}
            >
              <ArrowUpRight className="absolute right-3.5 top-3.5 size-3.5 text-muted-foreground/50 transition-colors group-hover:text-primary" />

              <span className="flex items-center gap-1">
                <ToolIcon id={conv.id} size={28} />
              </span>

              <div>
                <h3 className="text-[13.5px] font-semibold tracking-tight">
                  {conv.label}
                </h3>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                  {conv.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
