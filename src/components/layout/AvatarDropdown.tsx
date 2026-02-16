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
