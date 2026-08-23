import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://veta-smoky.vercel.app"),
  title: "VETA | Verify before execution",
  description: "A local-first verification layer for autonomous onchain transactions.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "VETA | Verify before execution",
    description: "Interpret with AI. Verify with evidence. Trust with code.",
    url: "/",
    siteName: "VETA",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
