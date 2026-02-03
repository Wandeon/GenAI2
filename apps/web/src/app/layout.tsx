import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GenAI Observatory",
  description: "World State AI Observatory - Real-time intelligence on AI developments",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hr" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* TODO: Add tRPC provider, session provider */}
        {children}
      </body>
    </html>
  );
}
