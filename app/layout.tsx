import type { Metadata } from "next";
import { Space_Mono, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StakeGuard — Restaking Attack Surface Visualizer",
  description:
    "A DeFi security tool that models Byzantine AVS failures, cascading slashing events, and stake exposure across EigenLayer restaking networks.",
  keywords: ["EigenLayer", "restaking", "DeFi security", "AVS", "Byzantine", "slashing", "MEV"],
  openGraph: {
    title: "StakeGuard",
    description: "Visualize cascading slashing attacks on restaking networks.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceMono.variable}`}>
      <body className="bg-bg text-text font-sans antialiased">{children}</body>
    </html>
  );
}
