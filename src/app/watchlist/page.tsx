"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Heart, X, Bell, ExternalLink } from "lucide-react";
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
    retailPriceCents: number | null;
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
  const [targetInput, setTargetInput] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/watchlist")
        .then((r) => r.json())
        .then((data) => { setItems(data); setLoading(false); });
    }
  }, [session]);

  async function removeItem(id: string) {
    const res = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast("Removed from watchlist", "success");
    }
  }

  async function saveTarget(id: string) {
    const cents = targetInput ? Math.round(parseFloat(targetInput) * 100) : null;
    const res = await fetch(`/api/watchlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPriceCents: cents }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, targetPriceCents: cents, targetReached: cents != null && i.lowestAskCents != null && i.lowestAskCents <= cents }
            : i
        )
      );
      setEditingId(null);
      setTargetInput("");
      toast("Price alert updated", "success");
    }
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
          <h1 className="text-3xl font-bold">My Watchlist</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {items.length} sneaker{items.length !== 1 ? "s" : ""} watched
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Heart className="h-12 w-12 mx-auto text-[var(--muted-foreground)]" />
          <p className="text-lg font-medium">Your watchlist is empty</p>
          <p className="text-sm text-[var(--muted-foreground)]">Browse the marketplace to find sneakers to watch.</p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[var(--border)] overflow-hidden">
              <Link href={`/sneakers/${item.sneakerId}`}>
                <div className="aspect-[4/3] relative bg-[var(--muted)]">
                  <Image
                    src={item.sneaker.imageUrl || "/placeholder-sneaker.svg"}
                    alt={`${item.sneaker.brand} ${item.sneaker.model}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {item.targetReached && (
                    <div className="absolute top-2 right-2 rounded-full bg-green-500 text-white text-xs font-bold px-2.5 py-1 flex items-center gap-1">
                      <Bell className="h-3 w-3" /> Target Reached!
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-4 space-y-2">
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">{item.sneaker.brand}</p>
                <p className="font-medium">{item.sneaker.model}</p>
                {item.sneaker.colorway && (
                  <p className="text-xs text-[var(--muted-foreground)]">{item.sneaker.colorway}</p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)]">Lowest Ask</p>
                    <p className="text-lg font-bold">
                      {item.lowestAskCents != null ? formatPrice(item.lowestAskCents) : "No listings"}
                    </p>
                  </div>
                  {item.sneaker.retailPriceCents && (
                    <div className="text-right">
                      <p className="text-xs text-[var(--muted-foreground)]">Retail</p>
                      <p className="text-sm text-[var(--muted-foreground)]">{formatPrice(item.sneaker.retailPriceCents)}</p>
                    </div>
                  )}
                </div>

                {/* Target price section */}
                <div className="pt-2 border-t border-[var(--border)]">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        placeholder="Target price"
                        className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        autoFocus
                      />
                      <button
                        onClick={() => saveTarget(item.id)}
                        className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setTargetInput(""); }}
                        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      {item.targetPriceCents != null ? (
                        <button
                          onClick={() => { setEditingId(item.id); setTargetInput((item.targetPriceCents! / 100).toString()); }}
                          className={`text-xs font-medium ${item.targetReached ? "text-green-600" : "text-[var(--muted-foreground)]"}`}
                        >
                          <Bell className="h-3 w-3 inline mr-1" />
                          Alert at {formatPrice(item.targetPriceCents)}
                        </button>
                      ) : (
                        <button
                          onClick={() => { setEditingId(item.id); setTargetInput(""); }}
                          className="text-xs text-[var(--accent)] hover:underline"
                        >
                          <Bell className="h-3 w-3 inline mr-1" /> Set price alert
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Link
                    href={`/sneakers/${item.sneakerId}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--muted)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--border)] transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View
                  </Link>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
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
