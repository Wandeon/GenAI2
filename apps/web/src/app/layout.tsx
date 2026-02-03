import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenAI2 Observatory",
  description: "World State AI Observatory - GenAI2 monorepo scaffold",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* TODO: Add tRPC provider, session provider */}
        {children}
      </body>
    </html>
  );
}
