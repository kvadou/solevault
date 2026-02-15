"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Flame, Loader2, Clock, Zap, BarChart3, TrendingUp, Gift, ArrowLeft } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";

interface OddsBracket {
  label: string;
  percentage: number;
}

interface PackTier {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
  description: string | null;
  totalSupply: number;
  soldCount: number;
  remaining: number;
  status: string;
  oddsBrackets: OddsBracket[];
}

interface DropDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  theme: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  maxPurchasesPerUser: number;
  packTiers: PackTier[];
  userPurchaseCount: number;
  canPurchase: boolean;
}

const THEME_GRADIENTS: Record<string, string> = {
  valentines: "from-pink-600/20 via-red-500/10 to-rose-600/20",
  hype: "from-orange-600/20 via-amber-500/10 to-yellow-600/20",
  ice: "from-cyan-600/20 via-blue-500/10 to-indigo-600/20",
  grail: "from-purple-600/20 via-violet-500/10 to-fuchsia-600/20",
  default: "from-[var(--accent)]/10 via-transparent to-[var(--accent)]/5",
};

const TIER_COLORS: Record<string, { border: string; bg: string; glow: string }> = {
  bronze: { border: "border-amber-600/40", bg: "from-amber-900/20 to-amber-700/10", glow: "shadow-amber-500/20" },
  silver: { border: "border-gray-400/40", bg: "from-gray-600/20 to-gray-400/10", glow: "shadow-gray-400/20" },
  gold: { border: "border-yellow-500/40", bg: "from-yellow-700/20 to-yellow-500/10", glow: "shadow-yellow-500/20" },
  platinum: { border: "border-cyan-400/40", bg: "from-cyan-700/20 to-cyan-400/10", glow: "shadow-cyan-400/20" },
  diamond: { border: "border-purple-400/40", bg: "from-purple-700/20 to-purple-400/10", glow: "shadow-purple-400/20" },
};

function getTierStyle(name: string) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(TIER_COLORS)) {
    if (lower.includes(key)) return TIER_COLORS[key];
  }
  return { border: "border-[var(--border)]", bg: "from-[var(--muted)] to-transparent", glow: "" };
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("NOW");
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (days > 0) setTimeLeft(`${days}d ${hours}h ${mins}m`);
      else setTimeLeft(`${hours}h ${mins}m ${secs}s`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span className="font-mono tabular-nums">{timeLeft}</span>;
}

export default function DropDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [drop, setDrop] = useState<DropDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [ripping, setRipping] = useState<string | null>(null);
  const [confirmTier, setConfirmTier] = useState<PackTier | null>(null);
  const [balanceCents, setBalanceCents] = useState(0);

  useEffect(() => {
    fetch(`/api/drops/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setDrop)
      .catch(() => router.push("/drops"))
      .finally(() => setLoading(false));
  }, [slug, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/wallet")
        .then((res) => res.json())
        .then((data) => setBalanceCents(data.balanceCents ?? 0));
    }
  }, [session]);

  async function handleRip(tier: PackTier) {
    if (!session?.user) {
      router.push("/auth/signin");
      return;
    }
    if (!drop?.canPurchase) {
      toast(`Purchase limit reached (${drop?.maxPurchasesPerUser} per user)`, "error");
      return;
    }
    if (balanceCents < tier.priceCents) {
      toast(`Insufficient balance. You need ${formatPrice(tier.priceCents)}`, "error");
      router.push("/wallet");
      return;
    }
    setConfirmTier(tier);
  }

  async function confirmRip() {
    if (!confirmTier) return;
    setRipping(confirmTier.id);
    setConfirmTier(null);

    const res = await fetch("/api/packs/rip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packTierId: confirmTier.id }),
    });

    const data = await res.json();
    if (data.ripId) {
      router.push(`/packs/rip/${data.ripId}`);
    } else {
      toast(data.error || "Failed to rip pack", "error");
      setRipping(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (!drop) return null;

  const gradient = THEME_GRADIENTS[drop.theme || ""] || THEME_GRADIENTS.default;
  const isLive = drop.status === "live";
  const isUpcoming = drop.status === "upcoming";
  const isEnded = drop.status === "ended" || drop.status === "sold_out";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() => router.push("/drops")}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> All Drops
      </button>

      {/* Drop Header */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} border border-[var(--border)] p-8 mb-8`}>
        <div className="max-w-2xl">
          {isLive && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1 text-sm font-bold text-green-400 mb-4">
              <Zap className="h-3.5 w-3.5" /> LIVE NOW
            </div>
          )}
          {isUpcoming && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-sm font-bold text-blue-400 mb-4">
              <Clock className="h-3.5 w-3.5" /> Drops in <CountdownTimer targetDate={drop.startsAt} />
            </div>
          )}
          {isEnded && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/20 px-3 py-1 text-sm font-bold text-gray-400 mb-4">
              {drop.status === "sold_out" ? "Sold Out" : "Ended"}
            </div>
          )}

          <h1 className="text-4xl font-bold tracking-tight mb-3">{drop.name}</h1>
          {drop.description && (
            <p className="text-lg text-[var(--muted-foreground)] mb-4">{drop.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted-foreground)]">
            <span>Limit: {drop.maxPurchasesPerUser} per user</span>
            {session?.user && (
              <span>
                Your purchases: {drop.userPurchaseCount}/{drop.maxPurchasesPerUser}
              </span>
            )}
            {drop.endsAt && isLive && (
              <span>Ends in <CountdownTimer targetDate={drop.endsAt} /></span>
            )}
          </div>

          {!drop.canPurchase && session?.user && (
            <div className="mt-4 inline-flex items-center rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 text-sm text-yellow-500">
              You&apos;ve reached the purchase limit for this drop.
            </div>
          )}
        </div>
      </div>

      {/* Pack Tiers */}
      {drop.packTiers.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {drop.packTiers.map((tier) => {
            const style = getTierStyle(tier.name);
            const isSoldOut = tier.status === "sold_out" || tier.remaining === 0;
            const isRipping = ripping === tier.id;
            const canBuy = isLive && drop.canPurchase && !isSoldOut;

            return (
              <div
                key={tier.id}
                className={`relative overflow-hidden rounded-2xl border-2 ${style.border} bg-gradient-to-br ${style.bg} p-6 transition-all ${
                  canBuy ? `hover:shadow-xl ${style.glow}` : "opacity-70"
                }`}
              >
                <div className="flex justify-center mb-6">
                  <div className="relative flex h-32 w-32 items-center justify-center">
                    <Gift className="h-20 w-20 text-[var(--foreground)] opacity-20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-black">{formatPrice(tier.priceCents)}</span>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-center mb-1">{tier.name}</h3>
                {tier.description && (
                  <p className="text-sm text-center text-[var(--muted-foreground)] mb-4">{tier.description}</p>
                )}

                <div className="flex items-center justify-center gap-1.5 mb-4">
                  <span className={`text-sm font-medium ${tier.remaining <= 5 ? "text-red-500" : "text-[var(--muted-foreground)]"}`}>
                    {isSoldOut ? "Sold Out" : `${tier.remaining} remaining`}
                  </span>
                </div>

                {tier.oddsBrackets.length > 0 && (
                  <div className="rounded-lg bg-[var(--background)]/50 p-3 mb-5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-1">
                      <BarChart3 className="h-3 w-3" /> Odds
                    </div>
                    {tier.oddsBrackets.map((bracket, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="h-3 w-3 text-[var(--accent)]" />
                          {bracket.label}
                        </span>
                        <span className="font-medium">{bracket.percentage}%</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => handleRip(tier)}
                  disabled={!canBuy || isRipping}
                  className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {isRipping ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Ripping...
                    </span>
                  ) : isSoldOut ? (
                    "Sold Out"
                  ) : !isLive ? (
                    isUpcoming ? "Not Yet Available" : "Drop Ended"
                  ) : !drop.canPurchase ? (
                    "Limit Reached"
                  ) : (
                    `Rip for ${formatPrice(tier.priceCents)}`
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Gift className="h-12 w-12 mx-auto mb-4 text-[var(--muted-foreground)] opacity-40" />
          <p className="text-[var(--muted-foreground)]">No packs in this drop yet.</p>
        </div>
      )}

      {/* Confirm Modal */}
      <Modal open={!!confirmTier} onClose={() => setConfirmTier(null)}>
        {confirmTier && (
          <>
            <div className="text-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/10 mx-auto mb-4">
                <Flame className="h-8 w-8 text-[var(--accent)]" />
              </div>
              <h2 className="text-xl font-bold mb-1">Rip {confirmTier.name}?</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                From the <strong>{drop.name}</strong> drop
              </p>
            </div>

            <div className="rounded-lg bg-[var(--muted)] p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Pack cost</span>
                <span className="font-medium">{formatPrice(confirmTier.priceCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Wallet balance</span>
                <span className="font-medium">{formatPrice(balanceCents)}</span>
              </div>
              <div className="border-t border-[var(--border)] pt-2 flex justify-between">
                <span className="text-[var(--muted-foreground)]">Balance after</span>
                <span className="font-medium">{formatPrice(balanceCents - confirmTier.priceCents)}</span>
              </div>
              <div className="border-t border-[var(--border)] pt-2 flex justify-between">
                <span className="text-[var(--muted-foreground)]">Purchases remaining</span>
                <span className="font-medium">{drop.maxPurchasesPerUser - drop.userPurchaseCount - 1}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTier(null)}
                className="flex-1 rounded-lg border border-[var(--border)] py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRip}
                className="flex-1 rounded-lg bg-[var(--accent)] py-3 text-sm font-bold text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
              >
                Rip It!
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
