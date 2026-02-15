"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Eye, Trash2, Pencil, Check, X, ArrowDown, Bell } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";

interface WatchlistItem {
  id: string;
  sneakerId: string;
  targetPriceCents: number | null;
  createdAt: string;
  sneaker: {
    id: string;
    brand: string;
    model: string;
    colorway: string | null;
    imageUrl: string | null;
    retailPriceCents: number;
  };
  lowestAskCents: number | null;
  targetReached: boolean;
}

export default function WatchlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/watchlist")
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load");
          return r.json();
        })
        .then((data) => {
          setItems(data);
          setLoading(false);
        })
        .catch(() => {
          toast("Failed to load watchlist", "error");
          setLoading(false);
        });
    }
  }, [session]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  function startEditing(item: WatchlistItem) {
    setEditingId(item.id);
    setEditValue(
      item.targetPriceCents !== null
        ? (item.targetPriceCents / 100).toFixed(2)
        : ""
    );
  }

  function cancelEditing() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveTargetPrice(itemId: string) {
    setSavingId(itemId);
    const parsedValue =
      editValue.trim() === "" ? null : Math.round(parseFloat(editValue) * 100);

    if (parsedValue !== null && (isNaN(parsedValue) || parsedValue <= 0)) {
      toast("Please enter a valid price", "error");
      setSavingId(null);
      return;
    }

    try {
      const res = await fetch(`/api/watchlist/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPriceCents: parsedValue }),
      });

      if (res.ok) {
        const updated = await res.json();
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== itemId) return item;
            const newTarget = updated.targetPriceCents ?? null;
            const targetReached =
              newTarget != null &&
              item.lowestAskCents != null &&
              item.lowestAskCents <= newTarget;
            return { ...item, targetPriceCents: newTarget, targetReached };
          })
        );
        toast("Target price updated", "success");
        setEditingId(null);
        setEditValue("");
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Failed to update target price", "error");
      }
    } catch {
      toast("Failed to update target price", "error");
    }
    setSavingId(null);
  }

  async function removeItem(itemId: string) {
    setRemovingId(itemId);
    try {
      const res = await fetch(`/api/watchlist/${itemId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== itemId));
        toast("Removed from watchlist", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Failed to remove from watchlist", "error");
      }
    } catch {
      toast("Failed to remove from watchlist", "error");
    }
    setRemovingId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Watchlist</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {items.length} sneaker{items.length !== 1 ? "s" : ""} watched
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Eye className="h-12 w-12 mx-auto text-[var(--muted-foreground)]" />
          <p className="text-lg font-medium">Your watchlist is empty</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Browse sneakers and add them to your watchlist to track prices.
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-[var(--border)] overflow-hidden"
            >
              {/* Image */}
              <Link href={`/sneakers/${item.sneaker.id}`}>
                <div className="aspect-[4/3] relative bg-[var(--muted)] cursor-pointer">
                  <Image
                    src={item.sneaker.imageUrl || "/placeholder-sneaker.svg"}
                    alt={`${item.sneaker.brand} ${item.sneaker.model}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {item.targetReached && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-1 text-xs font-semibold text-white shadow">
                      <ArrowDown className="h-3 w-3" />
                      Target Reached
                    </div>
                  )}
                </div>
              </Link>

              {/* Card body */}
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
                    {item.sneaker.brand}
                  </p>
                  <Link
                    href={`/sneakers/${item.sneaker.id}`}
                    className="font-medium hover:text-[var(--accent)] transition-colors"
                  >
                    {item.sneaker.model}
                  </Link>
                  {item.sneaker.colorway && (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {item.sneaker.colorway}
                    </p>
                  )}
                </div>

                {/* Prices */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--muted-foreground)]">
                      Lowest Ask
                    </span>
                    <span className="font-semibold">
                      {item.lowestAskCents !== null
                        ? formatPrice(item.lowestAskCents)
                        : "No asks"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--muted-foreground)]">
                      Retail
                    </span>
                    <span>{formatPrice(item.sneaker.retailPriceCents)}</span>
                  </div>
                </div>

                {/* Target price row */}
                <div className="pt-2 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--muted-foreground)] flex items-center gap-1">
                      <Bell className="h-3 w-3" />
                      Target Price
                    </span>
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[var(--muted-foreground)]">$</span>
                        <input
                          ref={editInputRef}
                          type="number"
                          min="0"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTargetPrice(item.id);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          className="w-20 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                          placeholder="0.00"
                        />
                        <button
                          onClick={() => saveTargetPrice(item.id)}
                          disabled={savingId === item.id}
                          className="rounded p-0.5 hover:bg-[var(--muted)] transition-colors text-green-600 disabled:opacity-50"
                          title="Save"
                          aria-label="Save target price"
                        >
                          {savingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="rounded p-0.5 hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
                          title="Cancel"
                          aria-label="Cancel editing"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={
                            item.targetReached
                              ? "font-semibold text-green-600"
                              : item.targetPriceCents !== null
                                ? "font-medium"
                                : "text-[var(--muted-foreground)] italic"
                          }
                        >
                          {item.targetPriceCents !== null
                            ? formatPrice(item.targetPriceCents)
                            : "Not set"}
                        </span>
                        <button
                          onClick={() => startEditing(item)}
                          className="rounded p-0.5 hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
                          title="Edit target price"
                          aria-label="Edit target price"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/sneakers/${item.sneaker.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={removingId === item.id}
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                    title="Remove from watchlist"
                    aria-label="Remove from watchlist"
                  >
                    {removingId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
