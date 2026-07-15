import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    <ClerkProvider>
      <html lang="en" className={`dark ${inter.variable}`}>
        <body className="bg-mesh">{children}</body>
      </html>
    </ClerkProvider>
  );
}
