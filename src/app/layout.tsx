import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { PageTransition } from "@/components/page-transition";
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
  title: {
    default: "vc billingsley",
    template: "%s — vc billingsley",
  },
  description: "vc billingsley — design engineer, san francisco.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg">
        {/* Floating content card pattern: p-2 shell on app bg, hard-bordered content card inside */}
        <div className="min-h-screen p-2">
          <div className="double-stroke relative min-h-[calc(100vh-1rem)] rounded-[2px] bg-content">
            {/* Top-leftmost wordmark, anchored to the content card */}
            <Link
              href="/"
              aria-label="portfolio.md home"
              className="absolute left-6 top-6 z-10 inline-flex h-6 w-7 items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/portfolio.svg" alt="" className="h-full w-full" />
            </Link>
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </body>
    </html>
  );
}
