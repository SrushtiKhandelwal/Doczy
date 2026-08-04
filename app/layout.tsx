import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Doczy — Document Converter",
  description:
    "Convert documents between PDF, Word, PowerPoint, and image formats instantly. Free, secure, and private.",
  keywords: ["PDF converter", "Word to PDF", "document converter", "file converter"],
  openGraph: {
    title: "Doczy — Document Converter",
    description: "Convert documents between PDF, Word, PowerPoint, and image formats.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(plexSans.variable, plexMono.variable, "font-sans")}
    >
      <body>{children}</body>
    </html>
  );
}
