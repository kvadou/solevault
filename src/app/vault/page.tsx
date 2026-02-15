"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Plus, Tag, PackageOpen, DollarSign, Shield, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatPrice, conditionLabel } from "@/lib/utils";

interface VaultItem {
  id: string;
  size: string;
  condition: string;
  status: string;
  authenticationStatus: string;
  askingPriceCents: number | null;
  imageUrls: string[];
  createdAt: string;
  sneaker: {
    id: string;
    brand: string;
    model: string;
    colorway: string | null;
    imageUrl: string | null;
  };
  listings: Array<{ id: string; priceCents: number; status: string }>;
}

interface RevenueShareSummary {
  pendingCents: number;
  pendingCount: number;
  creditedCents: number;
  creditedCount: number;
  totalEarnedCents: number;
}

interface VaultedItemRevenue {
  id: string;
  sneaker: { brand: string; model: string; colorway: string | null; imageUrl: string | null };
  size: string;
  condition: string;
  status: string;
  revenue: { totalRevenueCents: number; totalShareCents: number; tradeCount: number };
}

interface IncomingBid {
  id: string;
  sneakerId: string;
  size: string;
  amountCents: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  sneaker: { brand: string; model: string; colorway: string | null; imageUrl: string | null };
  bidder: { name: string | null };
}

export default function VaultPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listModal, setListModal] = useState<VaultItem | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listing, setListing] = useState(false);
  const [buybackModal, setBuybackModal] = useState<VaultItem | null>(null);
  const [buybackQuote, setBuybackQuote] = useState<{ fmvCents: number; payoutCents: number; platformRevenueCents: number } | null>(null);
  const [buybackLoading, setBuybackLoading] = useState(false);
  const [buybackExecuting, setBuybackExecuting] = useState(false);
  const [revShareSummary, setRevShareSummary] = useState<RevenueShareSummary | null>(null);
  const [revShareItems, setRevShareItems] = useState<VaultedItemRevenue[]>([]);
  const [showRevShare, setShowRevShare] = useState(false);
  const [incomingBids, setIncomingBids] = useState<IncomingBid[]>([]);
  const [bidActionId, setBidActionId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/vault")
        .then((r) => r.json())
        .then((data) => { setItems(data); setLoading(false); });
      fetch("/api/revenue-share")
        .then((r) => r.json())
        .then((data) => {
          setRevShareSummary(data.summary);
          setRevShareItems(data.vaultedItems || []);
        })
        .catch(() => {});
      fetch("/api/bids?role=seller")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setIncomingBids(data); })
        .catch(() => {});
    }
  }, [session]);

  async function handleList() {
    if (!listModal || !listPrice) return;
    setListing(true);

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultItemId: listModal.id, priceCents: Math.round(parseFloat(listPrice) * 100) }),
    });

    if (res.ok) {
      setListModal(null);
      setListPrice("");
      const data = await fetch("/api/vault").then((r) => r.json());
      setItems(data);
    }
    setListing(false);
  }

  async function openBuyback(item: VaultItem) {
    setBuybackModal(item);
    setBuybackLoading(true);
    setBuybackQuote(null);
    const res = await fetch(`/api/buyback?vaultItemId=${item.id}`);
    if (res.ok) {
      const data = await res.json();
      setBuybackQuote(data);
    } else {
      const data = await res.json();
      toast(data.error || "Could not get buyback quote", "error");
      setBuybackModal(null);
    }
    setBuybackLoading(false);
  }

  async function executeBuyback() {
    if (!buybackModal) return;
    setBuybackExecuting(true);
    const res = await fetch("/api/buyback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultItemId: buybackModal.id }),
    });
    if (res.ok) {
      const data = await res.json();
      toast(`Sold for ${formatPrice(data.payoutCents)}! Balance: ${formatPrice(data.newBalanceCents)}`, "success");
      setBuybackModal(null);
      setBuybackQuote(null);
      // Refresh vault items
      const refreshed = await fetch("/api/vault").then((r) => r.json());
      setItems(refreshed);
    } else {
      const data = await res.json();
      toast(data.error || "Buyback failed", "error");
    }
    setBuybackExecuting(false);
  }

  async function handleBidAction(bidId: string, action: "accept" | "decline") {
    setBidActionId(bidId);
    try {
      const res = await fetch(`/api/bids/${bidId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast(action === "accept" ? "Bid accepted! Ownership transferred." : "Bid declined", "success");
        setIncomingBids((prev) => prev.filter((b) => b.id !== bidId));
        if (action === "accept") {
          // Refresh vault items since one was sold
          const refreshed = await fetch("/api/vault").then((r) => r.json());
          setItems(refreshed);
        }
      } else {
        const data = await res.json();
        toast(data.error || `Failed to ${action} bid`, "error");
      }
    } catch {
      toast(`Failed to ${action} bid`, "error");
    }
    setBidActionId(null);
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
          <h1 className="text-3xl font-bold">My Vault</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{items.length} pair{items.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/vault/submit"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Vault a Pair
        </Link>
      </div>

      {/* Revenue Share Section */}
      {revShareSummary && revShareSummary.totalEarnedCents > 0 && (
        <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden">
          <button
            onClick={() => setShowRevShare(!showRevShare)}
            className="w-full flex items-center justify-between p-4 hover:bg-[var(--muted)]/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Vaulter Revenue Share</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  1% of all platform revenue from items you submitted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">{formatPrice(revShareSummary.totalEarnedCents)}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {formatPrice(revShareSummary.pendingCents)} pending
                </p>
              </div>
              {showRevShare ? <ChevronUp className="h-5 w-5 text-[var(--muted-foreground)]" /> : <ChevronDown className="h-5 w-5 text-[var(--muted-foreground)]" />}
            </div>
          </button>
          {showRevShare && revShareItems.length > 0 && (
            <div className="border-t border-[var(--border)] p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {revShareItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-medium truncate">{item.sneaker.brand} {item.sneaker.model}</p>
                      <span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${
                        item.status === "packed" ? "bg-purple-100 text-purple-700" :
                        item.status === "listed" ? "bg-blue-100 text-blue-700" :
                        item.status === "vaulted" ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">Size {item.size}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-[var(--muted-foreground)]">{item.revenue.tradeCount} trade{item.revenue.tradeCount !== 1 ? "s" : ""}</span>
                      <span className="font-medium text-green-600">+{formatPrice(item.revenue.totalShareCents)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Incoming Bids */}
      {incomingBids.length > 0 && (
        <div className="mb-8 rounded-lg border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold">Incoming Offers ({incomingBids.length})</h3>
            <p className="text-sm text-[var(--muted-foreground)]">Bids from buyers on your vaulted sneakers</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {incomingBids.map((bid) => (
              <div key={bid.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-sm">
                      {bid.sneaker.brand} {bid.sneaker.model}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Size {bid.size} &middot; from {bid.bidder.name || "Anonymous"} &middot; expires {new Date(bid.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-[var(--accent)]">{formatPrice(bid.amountCents)}</span>
                  <button
                    onClick={() => handleBidAction(bid.id, "accept")}
                    disabled={bidActionId === bid.id}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {bidActionId === bid.id ? "..." : "Accept"}
                  </button>
                  <button
                    onClick={() => handleBidAction(bid.id, "decline")}
                    disabled={bidActionId === bid.id}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted-foreground)] hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <PackageOpen className="h-12 w-12 mx-auto text-[var(--muted-foreground)]" />
          <p className="text-lg font-medium">Your vault is empty</p>
          <p className="text-sm text-[var(--muted-foreground)]">Start by vaulting your first pair of sneakers.</p>
          <Link
            href="/vault/submit"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            <Plus className="h-4 w-4" /> Vault Your First Pair
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[var(--border)] overflow-hidden">
              <div className="aspect-[4/3] relative bg-[var(--muted)]">
                <Image
                  src={item.imageUrls[0] || item.sneaker.imageUrl || "/placeholder-sneaker.svg"}
                  alt={`${item.sneaker.brand} ${item.sneaker.model}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <Badge status={item.status} />
                  <Badge status={item.authenticationStatus} />
                </div>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">{item.sneaker.brand}</p>
                <p className="font-medium">{item.sneaker.model}</p>
                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <span>Size {item.size}</span>
                  <span>&middot;</span>
                  <span>{conditionLabel(item.condition)}</span>
                </div>
                {item.authenticationStatus === "passed" && (
                  <Link
                    href={`/certificate/${item.id}`}
                    className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                  >
                    <Shield className="h-3 w-3" /> View Certificate
                  </Link>
                )}
                {item.askingPriceCents && (
                  <p className="text-lg font-bold">{formatPrice(item.askingPriceCents)}</p>
                )}
                <div className="pt-2 flex gap-2">
                  {item.status === "vaulted" && (
                    <>
                      <button
                        onClick={() => { setListModal(item); setListPrice(""); }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                      >
                        <Tag className="h-3.5 w-3.5" /> List
                      </button>
                      <button
                        onClick={() => openBuyback(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                      >
                        <DollarSign className="h-3.5 w-3.5" /> Buyback
                      </button>
                    </>
                  )}
                  {item.status === "listed" && (
                    <span className="flex-1 text-center text-sm text-[var(--muted-foreground)] py-1.5">Currently Listed</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List for sale modal */}
      <Modal
        open={!!listModal}
        onClose={() => { if (!listing) setListModal(null); }}
        title="List for Sale"
      >
        {listModal && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              {listModal.sneaker.brand} {listModal.sneaker.model} — Size {listModal.size}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1.5">Asking Price (USD)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="e.g. 250.00"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              {listPrice && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  You&apos;ll receive {formatPrice(Math.round(parseFloat(listPrice) * 100 * 0.975))} after 2.5% seller fee
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setListModal(null)}
                disabled={listing}
                className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleList}
                disabled={listing || !listPrice}
                className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {listing && <Loader2 className="h-4 w-4 animate-spin" />}
                List Now
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Buyback modal */}
      <Modal
        open={!!buybackModal}
        onClose={() => { if (!buybackExecuting) { setBuybackModal(null); setBuybackQuote(null); } }}
      >
        {buybackModal && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Instant Buyback</h2>
                <p className="text-sm text-[var(--muted-foreground)]">Sell instantly at 85% of fair market value</p>
              </div>
            </div>

            <p className="text-sm font-medium mb-4">
              {buybackModal.sneaker.brand} {buybackModal.sneaker.model} — Size {buybackModal.size}, {conditionLabel(buybackModal.condition)}
            </p>

            {buybackLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : buybackQuote ? (
              <>
                <div className="rounded-lg bg-[var(--muted)] p-4 mb-6 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Fair Market Value</span>
                    <span className="font-medium">{formatPrice(buybackQuote.fmvCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Platform fee (15%)</span>
                    <span className="font-medium text-red-500">-{formatPrice(buybackQuote.platformRevenueCents)}</span>
                  </div>
                  <div className="border-t border-[var(--border)] pt-2 flex justify-between">
                    <span className="font-medium">You receive</span>
                    <span className="text-lg font-bold text-green-600">{formatPrice(buybackQuote.payoutCents)}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setBuybackModal(null); setBuybackQuote(null); }}
                    disabled={buybackExecuting}
                    className="flex-1 rounded-lg border border-[var(--border)] py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeBuyback}
                    disabled={buybackExecuting}
                    className="flex-1 rounded-lg bg-[var(--accent)] py-3 text-sm font-bold text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {buybackExecuting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Sell for {formatPrice(buybackQuote.payoutCents)}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
