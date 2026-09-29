import type { Metadata, Viewport } from "next";
import { Figtree, Unbounded } from "next/font/google";
import { brand } from "@peerstock/shared";
import "./globals.css";

const unbounded = Unbounded({ subsets: ["latin"], variable: "--font-unbounded" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
};

export const viewport: Viewport = {
  themeColor: brand.colors.background,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${unbounded.variable} ${figtree.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
