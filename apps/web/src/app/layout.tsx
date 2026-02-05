import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/trpc";

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
    <html lang="hr" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
