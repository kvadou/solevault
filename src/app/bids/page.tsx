"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Gavel, X as XIcon } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

interface Bid {
  id: string;
  sneakerId: string;
  size: string;
  amountCents: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  sneaker: {
    brand: string;
    model: string;
    colorway: string | null;
    imageUrl: string | null;
  };
}

function bidStatusVariant(status: string): string {
  switch (status) {
    case "active":
      return "active";
    case "accepted":
      return "completed";
    case "declined":
      return "rejected";
    case "expired":
    case "cancelled":
      return "cancelled";
    default:
      return status;
  }
}

export default function MyBidsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/bids?role=buyer")
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load");
          return r.json();
        })
        .then((data) => {
          setBids(data);
          setLoading(false);
        })
        .catch(() => {
          toast("Failed to load bids", "error");
          setLoading(false);
        });
    }
  }, [session]);

  async function cancelBid(bidId: string) {
    setCancellingId(bidId);
    try {
      const res = await fetch(`/api/bids/${bidId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      if (res.ok) {
        const updated = await res.json();
        setBids((prev) =>
          prev.map((b) => (b.id === bidId ? { ...b, status: updated.status } : b))
        );
        toast("Bid cancelled", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Failed to cancel bid", "error");
      }
    } catch {
      toast("Failed to cancel bid", "error");
    }
    setCancellingId(null);
  }

  function isExpired(bid: Bid) {
    return bid.status === "active" && new Date(bid.expiresAt) < new Date();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
          <h1 className="text-3xl font-bold">My Bids</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {bids.length} bid{bids.length !== 1 ? "s" : ""} placed
          </p>
        </div>
      </div>

      {bids.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Gavel className="h-12 w-12 mx-auto text-[var(--muted-foreground)]" />
          <p className="text-lg font-medium">No bids yet</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Browse sneakers and place bids on items you want.
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
          {bids.map((bid) => {
            const expired = isExpired(bid);
            const displayStatus = expired ? "expired" : bid.status;

            return (
              <div
                key={bid.id}
                className="rounded-lg border border-[var(--border)] overflow-hidden"
              >
                {/* Image */}
                <Link href={`/sneakers/${bid.sneakerId}`}>
                  <div className="aspect-[4/3] relative bg-[var(--muted)] cursor-pointer">
                    <Image
                      src={bid.sneaker.imageUrl || "/placeholder-sneaker.svg"}
                      alt={`${bid.sneaker.brand} ${bid.sneaker.model}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge status={bidStatusVariant(displayStatus)} className={
                        displayStatus === "active" ? "bg-green-100 text-green-800" :
                        displayStatus === "accepted" ? "bg-blue-100 text-blue-800" :
                        displayStatus === "declined" ? "bg-red-100 text-red-800" :
                        "bg-gray-100 text-gray-800"
                      } />
                    </div>
                  </div>
                </Link>

                {/* Card body */}
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">
                      {bid.sneaker.brand}
                    </p>
                    <Link
                      href={`/sneakers/${bid.sneakerId}`}
                      className="font-medium hover:text-[var(--accent)] transition-colors"
                    >
                      {bid.sneaker.model}
                    </Link>
                    {bid.sneaker.colorway && (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {bid.sneaker.colorway}
                      </p>
                    )}
                  </div>

                  {/* Bid details */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--muted-foreground)]">Size</span>
                      <span className="font-medium">{bid.size}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--muted-foreground)]">Bid Amount</span>
                      <span className="font-semibold">{formatPrice(bid.amountCents)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--muted-foreground)]">
                        {displayStatus === "active" ? "Expires" : "Placed"}
                      </span>
                      <span className="text-[var(--muted-foreground)]">
                        {displayStatus === "active"
                          ? formatDate(bid.expiresAt)
                          : formatDate(bid.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {displayStatus === "active" && !expired && (
                    <div className="pt-2 border-t border-[var(--border)]">
                      <button
                        onClick={() => cancelBid(bid.id)}
                        disabled={cancellingId === bid.id}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                      >
                        {cancellingId === bid.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XIcon className="h-3.5 w-3.5" />
                        )}
                        Cancel Bid
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
