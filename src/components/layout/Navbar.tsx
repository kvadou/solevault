"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { Menu, X, Vault, ShoppingBag, LayoutDashboard, LogOut, User, Wallet, Gift, Flame } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  useEffect(() => {
    if (session?.user) {
      fetch("/api/wallet")
        .then((res) => res.json())
        .then((data) => setBalanceCents(data.balanceCents ?? 0))
        .catch(() => {});
    }
  }, [session]);

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
            {session && (
              <>
                <Link href="/vault" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
                  My Vault
                </Link>
                <Link href="/orders" className="text-sm font-medium hover:text-[var(--accent)] transition-colors">
                  Orders
                </Link>
                <Link href="/wallet" className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-[var(--accent)] transition-colors">
                  <Wallet className="h-3.5 w-3.5" />
                  {balanceCents !== null ? formatPrice(balanceCents) : "—"}
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
          {session && (
            <>
              <Link href="/vault" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <Vault className="h-4 w-4" /> My Vault
              </Link>
              <Link href="/orders" className="flex items-center gap-2 text-sm py-2" onClick={() => setMobileOpen(false)}>
                <ShoppingBag className="h-4 w-4" /> Orders
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
