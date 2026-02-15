"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Zap, TrendingUp, BarChart3 } from "lucide-react";
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

export default function PacksPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tiers, setTiers] = useState<PackTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [ripping, setRipping] = useState<string | null>(null);
  const [confirmTier, setConfirmTier] = useState<PackTier | null>(null);
  const [balanceCents, setBalanceCents] = useState(0);

  useEffect(() => {
    fetch("/api/packs")
      .then((res) => res.json())
      .then(setTiers)
      .finally(() => setLoading(false));

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

    if (balanceCents < tier.priceCents) {
      toast(`Insufficient balance. You need ${formatPrice(tier.priceCents)} — add funds first.`, "error");
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/10 px-4 py-1.5 text-sm font-medium text-[var(--accent)] mb-4">
          <Zap className="h-4 w-4" /> Mystery Packs
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">Rip a Pack</h1>
        <p className="text-lg text-[var(--muted-foreground)] max-w-xl mx-auto">
          Every pack contains an authenticated sneaker. Higher tiers mean higher value pulls. Can you beat the odds?
        </p>
      </div>

      {tiers.length === 0 ? (
        <div className="text-center py-16">
          <Gift className="h-12 w-12 mx-auto mb-4 text-[var(--muted-foreground)] opacity-40" />
          <p className="text-[var(--muted-foreground)]">No packs available right now. Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => {
            const style = getTierStyle(tier.name);
            const isSoldOut = tier.status === "sold_out" || tier.remaining === 0;
            const isRipping = ripping === tier.id;

            return (
              <div
                key={tier.id}
                className={`relative overflow-hidden rounded-2xl border-2 ${style.border} bg-gradient-to-br ${style.bg} p-6 transition-all hover:shadow-xl ${style.glow} ${
                  isSoldOut ? "opacity-60" : ""
                }`}
              >
                {/* Pack visual */}
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

                {/* Remaining */}
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  <span className={`text-sm font-medium ${tier.remaining <= 5 ? "text-red-500" : "text-[var(--muted-foreground)]"}`}>
                    {isSoldOut ? "Sold Out" : `${tier.remaining} remaining`}
                  </span>
                </div>

                {/* Odds brackets */}
                {tier.oddsBrackets.length > 0 && (
                  <div className="rounded-lg bg-[var(--background)]/50 p-3 mb-5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] mb-1">
                      <BarChart3 className="h-3 w-3" /> Odds
                    </div>
                    {tier.oddsBrackets.map((bracket, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="h-3 w-3 text-[var(--accent)]" />
                          ${bracket.label}
                        </span>
                        <span className="font-medium">{bracket.percentage}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rip button */}
                <button
                  onClick={() => handleRip(tier)}
                  disabled={isSoldOut || isRipping}
                  className="w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {isRipping ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Ripping...
                    </span>
                  ) : isSoldOut ? (
                    "Sold Out"
                  ) : (
                    `Rip for ${formatPrice(tier.priceCents)}`
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Modal */}
      <Modal open={!!confirmTier} onClose={() => setConfirmTier(null)}>
        {confirmTier && (
          <>
            <div className="text-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/10 mx-auto mb-4">
                <Gift className="h-8 w-8 text-[var(--accent)]" />
              </div>
              <h2 className="text-xl font-bold mb-1">Rip {confirmTier.name}?</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                {formatPrice(confirmTier.priceCents)} will be deducted from your wallet
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
