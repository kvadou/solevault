"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Shield, ShieldCheck, Vault, TrendingUp, Heart } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SlideOver } from "@/components/ui/SlideOver";
import { toast } from "@/components/ui/Toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatPrice, conditionLabel, calculateFees, statusColor } from "@/lib/utils";

interface SneakerDetail {
  id: string;
  brand: string;
  model: string;
  colorway: string | null;
  styleCode: string | null;
  retailPriceCents: number | null;
  imageUrl: string | null;
  releaseDate: string | null;
  vaultItems: Array<{
    id: string;
    size: string;
    condition: string;
    imageUrls: string[];
    listings: Array<{ id: string; priceCents: number; createdAt: string }>;
    owner: { id: string; name: string | null };
    certificates?: Array<{ id: string; confidenceScore: number | null }>;
  }>;
  priceHistory: Array<{ priceCents: number; recordedAt: string; size: string }>;
  marketStats?: {
    lastSalePriceCents: number | null;
    avgSalePriceCents: number | null;
    lowestSalePriceCents: number | null;
    highestSalePriceCents: number | null;
    totalSold: number;
    totalVaultItems: number;
    activeListingsCount: number;
    lowestAskCents: number | null;
  };
  isWatching?: boolean;
  watchlistId?: string | null;
}

export default function SneakerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [sneaker, setSneaker] = useState<SneakerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ listingId: string; priceCents: number; size: string } | null>(null);
  const [watching, setWatching] = useState(false);
  const [watchlistEntryId, setWatchlistEntryId] = useState<string | null>(null);
  const [watchLoading, setWatchLoading] = useState(false);
  const [bidSize, setBidSize] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [bidding, setBidding] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [certData, setCertData] = useState<Record<string, unknown> | null>(null);
  const [loadingCert, setLoadingCert] = useState(false);

  function handleOpenVerification(certificateId: string) {
    setShowVerification(true);
    setLoadingCert(true);
    setCertData(null);
    fetch(`/api/verify/certificate/${certificateId}`)
      .then((r) => r.json())
      .then((data) => setCertData(data))
      .catch(() => setCertData(null))
      .finally(() => setLoadingCert(false));
  }

  useEffect(() => {
    fetch(`/api/sneakers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setSneaker(data);
        setWatching(data.isWatching ?? false);
        setWatchlistEntryId(data.watchlistId ?? null);
        setLoading(false);
      });
  }, [id]);

  async function toggleWatch() {
    if (!session) { router.push("/auth/signin"); return; }
    setWatchLoading(true);
    if (watching && watchlistEntryId) {
      const res = await fetch(`/api/watchlist/${watchlistEntryId}`, { method: "DELETE" });
      if (res.ok) {
        setWatching(false);
        setWatchlistEntryId(null);
        toast("Removed from watchlist", "success");
      }
    } else {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sneakerId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setWatching(true);
        setWatchlistEntryId(data.id);
        toast("Added to watchlist", "success");
      }
    }
    setWatchLoading(false);
  }

  async function handleBuy() {
    if (!confirmModal || !session) return;
    setBuying(true);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: confirmModal.listingId }),
    });

    const data = await res.json();
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      setBuying(false);
    }
  }

  async function placeBid() {
    if (!session) { router.push("/auth/signin"); return; }
    if (!bidSize || !bidAmount) { toast("Select a size and enter an amount", "error"); return; }
    setBidding(true);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sneakerId: id,
          size: bidSize,
          amountCents: Math.round(parseFloat(bidAmount) * 100),
        }),
      });
      if (res.ok) {
        toast("Bid placed successfully!", "success");
        setBidSize("");
        setBidAmount("");
      } else {
        const data = await res.json();
        toast(data.error || "Failed to place bid", "error");
      }
    } catch {
      toast("Failed to place bid", "error");
    }
    setBidding(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!sneaker) {
    return <div className="text-center py-20">Sneaker not found</div>;
  }

  const activeListing = sneaker.vaultItems
    .flatMap((v) => v.listings.map((l) => ({ ...l, vaultItemId: v.id, size: v.size, condition: v.condition, imageUrls: v.imageUrls, certificateId: v.certificates?.[0]?.id ?? null })))
    .sort((a, b) => a.priceCents - b.priceCents);

  const lowestPrice = activeListing[0]?.priceCents;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image */}
        <div className="aspect-square relative rounded-lg bg-[var(--muted)] overflow-hidden">
          <Image
            src={sneaker.imageUrl || "/placeholder-sneaker.svg"}
            alt={`${sneaker.brand} ${sneaker.model}`}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <p className="text-sm text-[var(--muted-foreground)] uppercase tracking-wide">{sneaker.brand}</p>
            <h1 className="text-3xl font-bold mt-1">{sneaker.model}</h1>
            {sneaker.colorway && <p className="text-[var(--muted-foreground)] mt-1">{sneaker.colorway}</p>}
            {sneaker.styleCode && <p className="text-sm text-[var(--muted-foreground)]">{sneaker.styleCode}</p>}
            <button
              onClick={toggleWatch}
              disabled={watchLoading}
              className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                watching
                  ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
              }`}
            >
              <Heart className={`h-4 w-4 ${watching ? "fill-current" : ""}`} />
              {watchLoading ? "..." : watching ? "Watching" : "Watch"}
            </button>
          </div>

          {lowestPrice && (
            <div className="rounded-lg bg-[var(--muted)] p-4">
              <p className="text-sm text-[var(--muted-foreground)]">Starting at</p>
              <p className="text-3xl font-bold text-[var(--accent)]">{formatPrice(lowestPrice)}</p>
              {sneaker.retailPriceCents && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Retail: {formatPrice(sneaker.retailPriceCents)}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1.5"><Shield className="h-4 w-4" /> Authenticated</span>
            <span className="inline-flex items-center gap-1.5"><Vault className="h-4 w-4" /> Vaulted</span>
            <span className="inline-flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> Insured</span>
          </div>

          {/* Available listings */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Available Listings</h2>
            {activeListing.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No listings available right now.</p>
            ) : (
              <div className="space-y-2">
                {activeListing.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-[var(--muted)] px-2 py-0.5 rounded font-medium">
                        Size {l.size}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">{conditionLabel(l.condition)}</span>
                      <Link href={`/certificate/${l.vaultItemId}`} className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Verified
                      </Link>
                      {l.certificateId && (
                        <button
                          onClick={() => handleOpenVerification(l.certificateId!)}
                          className="text-xs text-green-600 hover:underline inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="h-3 w-3" /> TrustVault
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">{formatPrice(l.priceCents)}</span>
                      <button
                        onClick={() => {
                          if (!session) { router.push("/auth/signin"); return; }
                          setConfirmModal({ listingId: l.id, priceCents: l.priceCents, size: l.size });
                        }}
                        className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Make an Offer */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Make an Offer</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-3">
              Place a bid below asking price — sellers will be notified.
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Size</label>
                <input
                  type="text"
                  value={bidSize}
                  onChange={(e) => setBidSize(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Offer Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="200.00"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
              <button
                onClick={placeBid}
                disabled={bidding || !bidSize || !bidAmount}
                className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {bidding && <Loader2 className="h-4 w-4 animate-spin" />}
                Place Bid
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Market Data & Price History */}
      {sneaker.marketStats && (
        <div className="mt-8 space-y-6">
          {/* Market Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sneaker.marketStats.lowestAskCents != null && (
              <div className="rounded-lg border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Lowest Ask</p>
                <p className="text-lg font-bold mt-1 text-[var(--accent)]">{formatPrice(sneaker.marketStats.lowestAskCents)}</p>
              </div>
            )}
            {sneaker.marketStats.lastSalePriceCents != null && (
              <div className="rounded-lg border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Last Sale</p>
                <p className="text-lg font-bold mt-1">{formatPrice(sneaker.marketStats.lastSalePriceCents)}</p>
              </div>
            )}
            {sneaker.marketStats.avgSalePriceCents != null && (
              <div className="rounded-lg border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Average</p>
                <p className="text-lg font-bold mt-1">{formatPrice(sneaker.marketStats.avgSalePriceCents)}</p>
              </div>
            )}
            {sneaker.marketStats.lowestSalePriceCents != null && sneaker.marketStats.highestSalePriceCents != null && (
              <div className="rounded-lg border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Range</p>
                <p className="text-lg font-bold mt-1">
                  {formatPrice(sneaker.marketStats.lowestSalePriceCents)} — {formatPrice(sneaker.marketStats.highestSalePriceCents)}
                </p>
              </div>
            )}
            <div className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Total Traded</p>
              <p className="text-lg font-bold mt-1">{sneaker.marketStats.totalSold}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">In Vault</p>
              <p className="text-lg font-bold mt-1">{sneaker.marketStats.totalVaultItems}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">Active Listings</p>
              <p className="text-lg font-bold mt-1">{sneaker.marketStats.activeListingsCount}</p>
            </div>
          </div>

          {/* Price History Chart */}
          {sneaker.priceHistory.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] p-4">
              <h2 className="text-lg font-semibold mb-4">Price History</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...sneaker.priceHistory]
                      .reverse()
                      .map((p) => ({
                        date: new Date(p.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                        price: p.priceCents / 100,
                      }))}
                  >
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip
                      formatter={(value: number | string | undefined) => [`$${Number(value ?? 0).toFixed(2)}`, "Price"]}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ fill: "var(--accent)", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Purchase confirmation modal */}
      <Modal
        open={!!confirmModal}
        onClose={() => { if (!buying) setConfirmModal(null); }}
        title="Confirm Purchase"
      >
        {confirmModal && (
          <div className="space-y-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Item</span>
                <span className="font-medium">{sneaker.brand} {sneaker.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Size</span>
                <span>{confirmModal.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Price</span>
                <span>{formatPrice(confirmModal.priceCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Buyer Fee (2.5%)</span>
                <span>{formatPrice(calculateFees(confirmModal.priceCents).buyerFeeCents)}</span>
              </div>
              <div className="border-t border-[var(--border)] pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatPrice(calculateFees(confirmModal.priceCents).totalBuyerPays)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={buying}
                className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBuy}
                disabled={buying}
                className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {buying && <Loader2 className="h-4 w-4 animate-spin" />}
                Pay with Stripe
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Verification preview slide-over */}
      <SlideOver
        open={showVerification}
        onClose={() => setShowVerification(false)}
        title="Verification Details"
      >
        {loadingCert ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : certData && "certificate" in certData ? (
          <div className="space-y-6">
            {/* Confidence score */}
            <div className="text-center">
              <p className="text-5xl font-bold">
                {String((certData.certificate as Record<string, unknown>).confidenceScore ?? "—")}
                <span className="text-lg font-normal text-[var(--muted-foreground)]">%</span>
              </p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Confidence Score</p>
            </div>

            {/* Status & date */}
            <div className="flex items-center justify-center gap-3">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(String((certData.certificate as Record<string, unknown>).status ?? ""))}`}>
                {String((certData.certificate as Record<string, unknown>).status ?? "")}
              </span>
              {typeof (certData.certificate as Record<string, unknown>).verifiedAt === "string" && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  {new Date(String((certData.certificate as Record<string, unknown>).verifiedAt)).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Submitted photos */}
            {Array.isArray((certData.certificate as Record<string, unknown>).imageUrls) &&
              ((certData.certificate as Record<string, unknown>).imageUrls as string[]).length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Submitted Photos</h3>
                <div className="grid grid-cols-3 gap-2">
                  {((certData.certificate as Record<string, unknown>).imageUrls as string[]).map((url, i) => (
                    <div key={i} className="aspect-square relative rounded-md overflow-hidden bg-[var(--muted)]">
                      <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="120px" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View full trust profile link */}
            <Link
              href={`/verify/${(certData.certificate as Record<string, unknown>).id}`}
              className="block w-full text-center rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              View Full Trust Profile
            </Link>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
            Unable to load verification details.
          </p>
        )}
      </SlideOver>
    </div>
  );
}
