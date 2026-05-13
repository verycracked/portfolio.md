import type { Metadata } from "next";
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
  title: "portfolio.md",
  description: "A portfolio.",
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
          <div className="double-stroke min-h-[calc(100vh-1rem)] rounded-[2px] bg-content">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </body>
    </html>
  );
}
