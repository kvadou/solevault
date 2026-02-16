"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBag,
  Gift,
  Flame,
  CalendarDays,
  Vault,
  Plus,
  PieChart,
  ShoppingCart,
  Eye,
  Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MARKETPLACE_ITEMS = [
  { href: "/marketplace", label: "Browse All", icon: ShoppingBag },
  { href: "/packs", label: "Packs", icon: Gift },
  { href: "/drops", label: "Drops", icon: Flame },
  { href: "/releases", label: "Releases", icon: CalendarDays },
];

const VAULT_ITEMS = [
  { href: "/vault", label: "My Items", icon: Vault },
  { href: "/vault/submit", label: "Vault a Pair", icon: Plus },
  { href: "/vault/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/bids", label: "My Bids", icon: Gavel },
];

interface AppSidebarProps {
  section: "marketplace" | "vault";
}

export function AppSidebar({ section }: AppSidebarProps) {
  const pathname = usePathname();
  const items = section === "marketplace" ? MARKETPLACE_ITEMS : VAULT_ITEMS;
  const sectionLabel = section === "marketplace" ? "Marketplace" : "My Vault";

  return (
    <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--muted)] p-4 gap-1">
      <div className="mb-4 px-2">
        <span className="text-sm font-semibold">{sectionLabel}</span>
      </div>
      {items.map((item) => {
        const isActive =
          item.href === "/vault"
            ? pathname === "/vault"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-[var(--background)] font-medium shadow-sm"
                : "hover:bg-[var(--background)]/50 text-[var(--muted-foreground)]"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
