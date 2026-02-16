"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  X,
  Vault,
  ShoppingBag,
  Gift,
  Flame,
  CalendarDays,
  PieChart,
  ShoppingCart,
  Eye,
  Gavel,
  Bell,
  Wallet,
  LogOut,
  LayoutDashboard,
  User,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Notification, timeAgo } from "@/lib/notifications";
import { AvatarDropdown } from "./AvatarDropdown";

const MARKETPLACE_PATHS = ["/marketplace", "/packs", "/drops", "/releases"];
const VAULT_PATHS = ["/vault", "/orders", "/watchlist", "/bids"];

function getActiveSection(pathname: string): "marketplace" | "vault" | null {
  if (MARKETPLACE_PATHS.some((p) => pathname.startsWith(p))) return "marketplace";
  if (VAULT_PATHS.some((p) => pathname.startsWith(p))) return "vault";
  return null;
}

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const activeSection = getActiveSection(pathname);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/wallet")
        .then((res) => res.json())
        .then((data) => setBalanceCents(data.balanceCents ?? 0))
        .catch(() => {});
    }
  }, [session]);

  const fetchNotifications = useCallback(() => {
    if (session?.user) {
      fetch("/api/notifications")
        .then((res) => {
          if (!res.ok) throw new Error("Failed");
          return res.json();
        })
        .then((data) => setNotifications(data))
        .catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, session]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  async function markAsRead(id: string) {
    const res = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => null);
    if (res?.ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  }

  async function markAllAsRead() {
    await fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleNotificationClick(notif: Notification) {
    if (!notif.read) markAsRead(notif.id);
    setNotifOpen(false);
    if (notif.link) router.push(notif.link);
  }

  // Shared notification dropdown content (used in both desktop and mobile)
  const notificationDropdown = (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg overflow-hidden z-[60]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <span className="text-sm font-semibold">Notifications</span>
        {unreadCount > 0 && (
          <span className="text-xs text-[var(--muted-foreground)]">
            {unreadCount} unread
          </span>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
            No notifications yet
          </div>
        ) : (
          notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`w-full text-left px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)] transition-colors ${
                !notif.read ? "bg-[var(--accent)]/5" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                {!notif.read && (
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)]" />
                )}
                <div className={!notif.read ? "" : "ml-4"}>
                  <p className="text-sm font-medium">{notif.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                    {notif.message}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {timeAgo(notif.createdAt)}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
      {notifications.length > 0 && unreadCount > 0 && (
        <div className="border-t border-[var(--border)] px-4 py-2">
          <button
            onClick={markAllAsRead}
            className="w-full text-center text-xs font-medium text-[var(--accent)] hover:underline py-1"
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Vault className="h-6 w-6 text-[var(--accent)]" />
            SoleVault
          </Link>

          {/* Desktop: Section tabs */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/marketplace"
              className={cn(
                "relative px-4 py-5 text-sm font-medium transition-colors",
                activeSection === "marketplace"
                  ? "text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              Marketplace
              {activeSection === "marketplace" && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[var(--accent)] rounded-full" />
              )}
            </Link>
            {session && (
              <Link
                href="/vault"
                className={cn(
                  "relative px-4 py-5 text-sm font-medium transition-colors",
                  activeSection === "vault"
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                My Vault
                {activeSection === "vault" && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[var(--accent)] rounded-full" />
                )}
              </Link>
            )}
          </div>

          {/* Desktop: Utility cluster */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <>
                {/* Notification Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="relative p-2 rounded-md hover:bg-[var(--muted)] transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4.5 w-4.5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && notificationDropdown}
                </div>

                {/* Wallet chip */}
                <Link
                  href="/wallet"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--muted)] px-2.5 py-1.5 text-sm font-medium hover:bg-[var(--border)] transition-colors"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {balanceCents !== null ? formatPrice(balanceCents) : "\u2014"}
                </Link>

                {/* Avatar dropdown */}
                <AvatarDropdown
                  name={session.user?.name}
                  email={session.user?.email}
                  isAdmin={isAdmin}
                />
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile: Bell + Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            {session && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative p-2"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && notificationDropdown}
              </div>
            )}
            <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--background)] px-4 py-4 space-y-1">
          {/* Browse section */}
          <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Browse
          </p>
          <Link href="/marketplace" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", pathname.startsWith("/marketplace") ? "bg-[var(--muted)] font-medium" : "")} onClick={() => setMobileOpen(false)}>
            <ShoppingBag className="h-4 w-4" /> Browse All
          </Link>
          <Link href="/packs" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", pathname.startsWith("/packs") ? "bg-[var(--muted)] font-medium" : "")} onClick={() => setMobileOpen(false)}>
            <Gift className="h-4 w-4" /> Packs
          </Link>
          <Link href="/drops" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", pathname.startsWith("/drops") ? "bg-[var(--muted)] font-medium" : "")} onClick={() => setMobileOpen(false)}>
            <Flame className="h-4 w-4" /> Drops
          </Link>
          <Link href="/releases" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", pathname.startsWith("/releases") ? "bg-[var(--muted)] font-medium" : "")} onClick={() => setMobileOpen(false)}>
            <CalendarDays className="h-4 w-4" /> Releases
          </Link>

          {session && (
            <>
              {/* My Vault section */}
              <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                My Vault
              </p>
              <Link href="/vault" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", pathname === "/vault" ? "bg-[var(--muted)] font-medium" : "")} onClick={() => setMobileOpen(false)}>
                <Vault className="h-4 w-4" /> My Items
              </Link>
              <Link href="/vault/portfolio" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", pathname.startsWith("/vault/portfolio") ? "bg-[var(--muted)] font-medium" : "")} onClick={() => setMobileOpen(false)}>
                <PieChart className="h-4 w-4" /> Portfolio
              </Link>
              <Link href="/orders" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", pathname.startsWith("/orders") ? "bg-[var(--muted)] font-medium" : "")} onClick={() => setMobileOpen(false)}>
                <ShoppingCart className="h-4 w-4" /> Orders
              </Link>
              <Link href="/watchlist" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", pathname.startsWith("/watchlist") ? "bg-[var(--muted)] font-medium" : "")} onClick={() => setMobileOpen(false)}>
                <Eye className="h-4 w-4" /> Watchlist
              </Link>
              <Link href="/bids" className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", pathname.startsWith("/bids") ? "bg-[var(--muted)] font-medium" : "")} onClick={() => setMobileOpen(false)}>
                <Gavel className="h-4 w-4" /> My Bids
              </Link>

              {/* Utility section */}
              <div className="border-t border-[var(--border)] mt-3 pt-3 space-y-1">
                <Link href="/wallet" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm" onClick={() => setMobileOpen(false)}>
                  <Wallet className="h-4 w-4" /> Wallet
                  {balanceCents !== null && (
                    <span className="ml-auto text-[var(--accent)] font-medium">{formatPrice(balanceCents)}</span>
                  )}
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--accent)]" onClick={() => setMobileOpen(false)}>
                    <LayoutDashboard className="h-4 w-4" /> Admin Panel
                  </Link>
                )}
                <button
                  onClick={() => { signOut(); setMobileOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </>
          )}

          {!session && (
            <div className="border-t border-[var(--border)] mt-3 pt-3">
              <Link href="/auth/signin" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm" onClick={() => setMobileOpen(false)}>
                <User className="h-4 w-4" /> Sign In
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
