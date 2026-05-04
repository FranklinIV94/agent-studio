import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/lib/web3-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Studio — Agentic Finance on Base",
  description: "Multi-agent AI pipeline for on-chain transactions on Base, powered by Coinbase Wallet SDK and AWS.",
  openGraph: {
    title: "Agent Studio — EasyA Consensus Miami 2026",
    description: "AI agents that reason, act, and show their work. Coinbase + AWS Agentic Track.",
    images: ['/og-image.jpg'],
  },
  icons: { icon: '/icon.jpg' },
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
      <body className="min-h-full flex flex-col">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}