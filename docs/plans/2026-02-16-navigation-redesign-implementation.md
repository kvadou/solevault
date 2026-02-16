# Navigation Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate the logged-in top navbar from 14 items to 6, adding context-aware left sidebars for Marketplace and My Vault sections.

**Architecture:** A `SectionLayout` client component wraps page content, using `usePathname()` to detect the current section and conditionally render an `AppSidebar`. The `Navbar` is simplified to two section tabs plus a utility cluster with avatar dropdown. No route groups or file moves needed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 (CSS variables), Lucide React icons.

**Design doc:** `docs/plans/2026-02-16-navigation-redesign-design.md`

---

## Context for Implementer

### Project conventions
- Path alias: `@/*` maps to `./src/*`
- CSS variables: `var(--background)`, `var(--foreground)`, `var(--muted)`, `var(--muted-foreground)`, `var(--border)`, `var(--accent)`, `var(--primary)`, etc.
- Utility function: `cn()` from `@/lib/utils` for conditional Tailwind classes
- Auth: `useSession()` from `next-auth/react`, admin check: `(session?.user as { role?: string })?.role === "admin"`
- Icons: `lucide-react` — always `h-4 w-4` in sidebars, `h-3.5 w-3.5` or `h-4.5 w-4.5` for inline
- No test framework exists — verify with `npx next build` (TypeScript + compilation check)

### Admin sidebar reference (match this style exactly)
File: `src/app/admin/layout.tsx`
- Sidebar: `w-56`, `border-r border-[var(--border)]`, `bg-[var(--muted)]`, `p-4`, `gap-1`
- Active link: `bg-[var(--background)] font-medium shadow-sm`
- Inactive link: `hover:bg-[var(--background)]/50 text-[var(--muted-foreground)]`
- Each link: `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors`
- Layout wrapper: `flex min-h-[calc(100vh-64px)]`

### Current Navbar
File: `src/components/layout/Navbar.tsx` (304 lines)
- Contains all navigation links, notification bell popover, wallet balance fetch, mobile hamburger
- Notification logic (fetch, mark read, dropdown) stays — just moves location within the component

### Root Layout
File: `src/app/layout.tsx`
- `<Navbar />` then `<main className="min-h-[calc(100vh-64px)]">{children}</main>`

---

## Task 1: Create AppSidebar Component

**Files:**
- Create: `src/components/layout/AppSidebar.tsx`

**Step 1: Create the sidebar component**

```tsx
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
```

Note: The `/vault` active check uses exact match (`pathname === "/vault"`) because `/vault/submit` and `/vault/portfolio` are separate items. All others use `startsWith`.

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds (component is created but not yet imported anywhere)

**Step 3: Commit**

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "feat: create AppSidebar component for context-aware section navigation"
```

---

## Task 2: Create SectionLayout Component

**Files:**
- Create: `src/components/layout/SectionLayout.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create SectionLayout**

This component wraps page content. It detects the current route and renders the appropriate sidebar (or none).

```tsx
"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";

const MARKETPLACE_PATHS = ["/marketplace", "/packs", "/drops", "/releases"];
const VAULT_PATHS = ["/vault", "/orders", "/watchlist", "/bids"];

function getSection(pathname: string): "marketplace" | "vault" | null {
  // Admin has its own sidebar — don't add ours
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
```

**Step 2: Integrate into root layout**

Modify `src/app/layout.tsx`. Change the `<main>` wrapper:

Before:
```tsx
<main className="min-h-[calc(100vh-64px)]">{children}</main>
```

After:
```tsx
<main className="min-h-[calc(100vh-64px)]">
  <SectionLayout>{children}</SectionLayout>
</main>
```

Add the import at the top:
```tsx
import { SectionLayout } from "@/components/layout/SectionLayout";
```

**Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds. Sidebars now appear on marketplace and vault pages.

**Step 4: Commit**

```bash
git add src/components/layout/SectionLayout.tsx src/app/layout.tsx
git commit -m "feat: add SectionLayout with context-aware sidebars for marketplace and vault"
```

---

## Task 3: Create AvatarDropdown Component

**Files:**
- Create: `src/components/layout/AvatarDropdown.tsx`

**Step 1: Create the avatar dropdown**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut, LayoutDashboard, ChevronDown } from "lucide-react";

interface AvatarDropdownProps {
  name: string | null | undefined;
  email: string | null | undefined;
  isAdmin: boolean;
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

export function AvatarDropdown({ name, email, isAdmin }: AvatarDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const initials = getInitials(name, email);
  const displayName = name || email || "User";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full hover:bg-[var(--muted)] px-1 py-1 transition-colors"
        aria-label="User menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-foreground)]">
          {initials}
        </span>
        <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg overflow-hidden z-[60]">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {name && email && (
              <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">{email}</p>
            )}
          </div>
          <div className="py-1">
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                Admin Panel
              </Link>
            )}
            <button
              onClick={() => { signOut(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/layout/AvatarDropdown.tsx
git commit -m "feat: create AvatarDropdown component with user menu"
```

---

## Task 4: Rewrite Navbar

This is the main task. Rewrite `src/components/layout/Navbar.tsx` to:
1. Replace 14 nav items with 2 section tabs + utility cluster
2. Add active underline indicator for current section
3. Use AvatarDropdown instead of username + Sign Out
4. Rewrite mobile hamburger with grouped sections

**Files:**
- Modify: `src/components/layout/Navbar.tsx`

**Step 1: Rewrite the Navbar**

Key changes:
- Desktop nav: `Logo | Marketplace tab | My Vault tab | [Bell] [Wallet] [Avatar]`
- Section tabs get a green bottom-border when their section is active
- Bell notification popover stays (same logic, same dropdown)
- Wallet becomes a compact chip
- Mobile: hamburger opens grouped menu with section headers

Complete rewrite of `src/components/layout/Navbar.tsx`:

```tsx
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
  Plus,
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
                {/* Mobile notification dropdown reuses same markup as desktop */}
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
```

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/layout/Navbar.tsx
git commit -m "feat: rewrite Navbar with section tabs, avatar dropdown, and grouped mobile menu"
```

---

## Task 5: Visual Verification and Polish

**Files:**
- Possibly modify: `src/components/layout/AppSidebar.tsx`, `src/components/layout/Navbar.tsx`, `src/components/layout/SectionLayout.tsx`

**Step 1: Run the dev server and check all pages**

Run: `npm run dev`

Check these pages visually (or with Playwright):
1. Homepage (`/`) — no sidebar, slim top bar
2. Sign-in (`/auth/signin`) — no sidebar, only Marketplace tab + Sign In button
3. Marketplace (`/marketplace`) — marketplace sidebar visible, Marketplace tab active (underline)
4. Packs (`/packs`) — marketplace sidebar visible, Packs highlighted in sidebar
5. Vault (`/vault`) — vault sidebar visible, My Vault tab active (underline)
6. Portfolio (`/vault/portfolio`) — vault sidebar visible, Portfolio highlighted
7. Orders (`/orders`) — vault sidebar visible, Orders highlighted
8. Watchlist (`/watchlist`) — vault sidebar visible
9. Bids (`/bids`) — vault sidebar visible
10. Admin (`/admin`) — admin's own sidebar (unchanged), no AppSidebar
11. Sneaker detail (`/sneakers/[id]`) — no sidebar, full-width
12. NFC pages (`/nfc/register`, `/nfc/purchase`) — no sidebar
13. Avatar dropdown — click shows menu with name, Admin link, Sign Out
14. Bell — notification popover works
15. Wallet chip — shows balance, links to `/wallet`
16. Mobile hamburger — grouped sections with headers

**Step 2: Fix any visual issues found**

Common things to watch for:
- Sidebar overlapping content on narrow desktop (should be hidden below `md:`)
- Active underline alignment on section tabs
- Avatar dropdown z-index conflicts with notification dropdown
- Mobile menu not closing on route change (we added useEffect for this)
- Admin pages showing double sidebars (SectionLayout returns null for `/admin` paths)

**Step 3: Verify build**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds with no TypeScript errors.

**Step 4: Commit any polish fixes**

```bash
git add -A
git commit -m "fix: polish navigation redesign — visual tweaks and edge cases"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | AppSidebar component | Create `AppSidebar.tsx` |
| 2 | SectionLayout + root layout integration | Create `SectionLayout.tsx`, modify `layout.tsx` |
| 3 | AvatarDropdown component | Create `AvatarDropdown.tsx` |
| 4 | Navbar rewrite | Modify `Navbar.tsx` |
| 5 | Visual verification and polish | Fix any issues found |
