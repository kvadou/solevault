"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, Package, ShoppingCart, Database, Loader2, Gift, Flame, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/submissions", label: "Submissions", icon: Inbox },
  { href: "/admin/inventory", label: "Inventory", icon: Package },
  { href: "/admin/packs", label: "Packs", icon: Gift },
  { href: "/admin/drops", label: "Drops", icon: Flame },
  { href: "/admin/releases", label: "Releases", icon: CalendarDays },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  useEffect(() => {
    if (status === "authenticated" && !isAdmin) router.push("/");
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, isAdmin, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-[var(--border)] bg-[var(--muted)] p-4 gap-1">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Database className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold">Admin Panel</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-[var(--background)] font-medium shadow-sm"
                : "hover:bg-[var(--background)]/50 text-[var(--muted-foreground)]"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--background)] flex">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors",
              pathname === item.href ? "text-[var(--accent)] font-medium" : "text-[var(--muted-foreground)]"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 md:p-8 pb-20 md:pb-8">{children}</div>
    </div>
  );
}
