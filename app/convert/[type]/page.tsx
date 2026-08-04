import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import ConverterCard from "@/app/components/ConverterCard";
import { CONVERSIONS, type ConversionType } from "@/lib/conversions";
import { ToolIcon } from "@/app/components/ToolGrid";

export default async function ConvertTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const conversion = CONVERSIONS[type as ConversionType];

  if (!conversion) {
    notFound();
  }

  return (
    <>
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-20 pt-10 lg:px-10">
        <div className="w-full max-w-2xl">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-secondary/50"
          >
            <ArrowLeft className="size-3.5" />
            All tools
          </Link>

          <div className="mt-5 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <ToolIcon id={conversion.id} size={36} />
            </span>
            <div>
              <h1 className="text-[20px] font-semibold tracking-tight">
                {conversion.label}
              </h1>
              <p className="text-[13px] text-muted-foreground">
                {conversion.description}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 w-full max-w-2xl">
          <ConverterCard conversionType={conversion.id} />
        </div>
      </main>
    </>
  );
}
