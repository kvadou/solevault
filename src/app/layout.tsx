import type { Metadata } from "next";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoleVault — Vault. Trade. Instantly.",
  description: "The first sneaker vault marketplace. Authenticate, vault, and trade sneakers instantly without shipping.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <SessionProvider>
          <Navbar />
          <main className="min-h-[calc(100vh-64px)]">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
