"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, Vault, ShoppingBag, LayoutDashboard, LogOut, User, Wallet, Gift, Flame, Eye, Bell, PieChart, Gavel, Calendar } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Notification, timeAgo } from "@/lib/notifications";

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  const unreadCount = notifications.filter((n) => !n.read).length;

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
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

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Vault className="h-6 w-6 text-[var(--accent)]" />
            SoleVault
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/marketplace" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
              Marketplace
            </Link>
            <Link href="/packs" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
              Packs
            </Link>
            <Link href="/drops" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
              Drops
            </Link>
            <Link href="/releases" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
              Releases
            </Link>
            {session && (
              <>
                <Link href="/vault" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
                  My Vault
                </Link>
                <Link href="/vault/portfolio" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
                  Portfolio
                </Link>
                <Link href="/orders" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
                  Orders
                </Link>
                <Link href="/watchlist" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
                  Watchlist
                </Link>
                <Link href="/bids" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
                  My Bids
                </Link>
                {/* Notification Bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="relative p-1 hover:text-[var(--accent)] transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4.5 w-4.5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
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
                  )}
                </div>
                <Link href="/wallet" className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-[var(--accent)] transition-colors">
                  <Wallet className="h-3.5 w-3.5" />
                  {balanceCents !== null ? formatPrice(balanceCents) : "\u2014"}
                </Link>
              </>
            )}
            {isAdmin && (
              <Link href="/admin" className="text-sm font-medium text-[var(--accent)] hover:underline">
                Admin
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--muted-foreground)]">{session.user?.name || session.user?.email}</span>
                <button
                  onClick={() => signOut()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--muted)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--border)] transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--background)] px-4 py-4 space-y-3">
          <Link href="/marketplace" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
            <ShoppingBag className="h-4 w-4" /> Marketplace
          </Link>
          <Link href="/packs" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
            <Gift className="h-4 w-4" /> Packs
          </Link>
          <Link href="/drops" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
            <Flame className="h-4 w-4" /> Drops
          </Link>
          <Link href="/releases" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
            <Calendar className="h-4 w-4" /> Releases
          </Link>
          {session && (
            <>
              <Link href="/vault" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <Vault className="h-4 w-4" /> My Vault
              </Link>
              <Link href="/vault/portfolio" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <PieChart className="h-4 w-4" /> Portfolio
              </Link>
              <Link href="/orders" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <ShoppingBag className="h-4 w-4" /> Orders
              </Link>
              <Link href="/watchlist" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <Eye className="h-4 w-4" /> Watchlist
              </Link>
              <Link href="/bids" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <Gavel className="h-4 w-4" /> My Bids
              </Link>
              <Link href="/notifications" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <Bell className="h-4 w-4" /> Notifications
                {unreadCount > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/wallet" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <Wallet className="h-4 w-4" /> Wallet {balanceCents !== null && <span className="ml-auto text-[var(--accent)] font-medium">{formatPrice(balanceCents)}</span>}
              </Link>
            </>
          )}
          {isAdmin && (
            <Link href="/admin" className="flex items-center gap-2 text-sm py-2 text-[var(--accent)]" onClick={() => setMobileOpen(false)}>
              <LayoutDashboard className="h-4 w-4" /> Admin
            </Link>
          )}
          <div className="border-t border-[var(--border)] pt-3">
            {session ? (
              <button onClick={() => { signOut(); setMobileOpen(false); }} className="flex items-center gap-2 text-sm py-2">
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            ) : (
              <Link href="/auth/signin" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <User className="h-4 w-4" /> Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
