import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="hr">
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* TODO: Add tRPC provider, session provider */}
        {children}
      </body>
    </html>
  );
}
