"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";

const MARKETPLACE_PATHS = ["/marketplace", "/packs", "/drops", "/releases"];
const VAULT_PATHS = ["/vault", "/orders", "/watchlist", "/bids"];

function getSection(pathname: string): "marketplace" | "vault" | null {
  if (pathname.startsWith("/admin")) return null;
  if (MARKETPLACE_PATHS.some((p) => pathname.startsWith(p))) return "marketplace";
  if (VAULT_PATHS.some((p) => pathname.startsWith(p))) return "vault";
  return null;
}

export function SectionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = getSection(pathname);

  if (!section) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <AppSidebar section={section} />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
