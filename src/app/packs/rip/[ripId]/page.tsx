"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Vault, ShoppingBag, DollarSign, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";

interface RipData {
  id: string;
  status: string;
  priceCents: number;
  revealedAt: string | null;
  packTier: { name: string; priceCents: number };
  packPoolItem: {
    vaultItem: {
      id: string;
      size: string;
      condition: string;
      sneaker: {
        brand: string;
        model: string;
        colorway: string | null;
        retailPriceCents: number | null;
        imageUrl: string | null;
      };
    };
  } | null;
}

type Phase = "loading" | "anticipation" | "ripping" | "revealed";

export default function RipRevealPage() {
  const params = useParams();
  const router = useRouter();
  const { status: authStatus } = useSession();
  const [rip, setRip] = useState<RipData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [confettiPieces, setConfettiPieces] = useState<{ id: number; x: number; color: string; delay: number; size: number }[]>([]);
  const [buybackOpen, setBuybackOpen] = useState(false);
  const [buybackQuote, setBuybackQuote] = useState<{ fmvCents: number; payoutCents: number; platformRevenueCents: number } | null>(null);
  const [buybackLoading, setBuybackLoading] = useState(false);
  const [buybackExecuting, setBuybackExecuting] = useState(false);

  const fetchRip = useCallback(async () => {
    const res = await fetch(`/api/packs/rip/${params.ripId}`);
    if (res.ok) {
      const data = await res.json();
      setRip(data);
      if (data.status === "revealed") {
        setPhase("revealed");
      } else {
        setPhase("anticipation");
      }
    } else {
      router.push("/packs");
    }
  }, [params.ripId, router]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (authStatus === "authenticated") {
      fetchRip();
    }
  }, [authStatus, router, fetchRip]);

  async function handleRip() {
    setPhase("ripping");

    // Call reveal endpoint
    await fetch(`/api/packs/rip/${params.ripId}`, { method: "POST" });

    // Re-fetch to get the revealed item data
    const res = await fetch(`/api/packs/rip/${params.ripId}`);
    if (res.ok) {
      const data = await res.json();
      setRip(data);
    }

    // Animate: brief delay then reveal
    setTimeout(() => {
      setPhase("revealed");

      // Check if it's a big win and trigger confetti
      if (rip?.packPoolItem) {
        const value = rip.packPoolItem.vaultItem.sneaker.retailPriceCents ?? 0;
        if (value > rip.priceCents) {
          launchConfetti();
        }
      }
    }, 1500);
  }

  function launchConfetti() {
    const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
    const pieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      size: Math.random() * 8 + 4,
    }));
    setConfettiPieces(pieces);
    setTimeout(() => setConfettiPieces([]), 3000);
  }

  async function openBuyback() {
    if (!rip?.packPoolItem) return;
    setBuybackOpen(true);
    setBuybackLoading(true);
    const res = await fetch(`/api/buyback?vaultItemId=${rip.packPoolItem.vaultItem.id}`);
    if (res.ok) {
      setBuybackQuote(await res.json());
    } else {
      toast("Could not get buyback quote", "error");
      setBuybackOpen(false);
    }
    setBuybackLoading(false);
  }

  async function executeBuyback() {
    if (!rip?.packPoolItem) return;
    setBuybackExecuting(true);
    const res = await fetch("/api/buyback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultItemId: rip.packPoolItem.vaultItem.id }),
    });
    if (res.ok) {
      const data = await res.json();
      toast(`Sold for ${formatPrice(data.payoutCents)}!`, "success");
      setBuybackOpen(false);
      router.push("/wallet");
    } else {
      const data = await res.json();
      toast(data.error || "Buyback failed", "error");
    }
    setBuybackExecuting(false);
  }

  if (phase === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  const sneaker = rip?.packPoolItem?.vaultItem.sneaker;
  const vaultItem = rip?.packPoolItem?.vaultItem;
  const retailValue = sneaker?.retailPriceCents ?? 0;
  const isWinner = retailValue > (rip?.priceCents ?? 0);
  const isBigWin = retailValue >= (rip?.priceCents ?? 0) * 2;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)] overflow-hidden">
      {/* Confetti */}
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute top-0 animate-[confettiFall_2.5s_ease-in_forwards]"
          style={{
            left: `${piece.x}%`,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animationDelay: `${piece.delay}s`,
          }}
        />
      ))}

      {/* Phase 1: Anticipation */}
      {phase === "anticipation" && (
        <div className="flex flex-col items-center animate-[fadeIn_0.5s_ease-out]">
          <div
            className="relative flex h-64 w-48 cursor-pointer items-center justify-center rounded-2xl border-2 border-[var(--accent)]/50 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 shadow-2xl shadow-[var(--accent)]/20 transition-transform hover:scale-105 active:scale-95 animate-[pulse_2s_ease-in-out_infinite]"
            onClick={handleRip}
          >
            <div className="absolute inset-0 rounded-2xl bg-[var(--accent)]/5 animate-[ping_2s_ease-in-out_infinite]" />
            <div className="text-center z-10">
              <Sparkles className="h-12 w-12 mx-auto mb-3 text-[var(--accent)]" />
              <p className="text-lg font-bold">{rip?.packTier.name}</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">{formatPrice(rip?.priceCents ?? 0)}</p>
            </div>
          </div>
          <p className="mt-8 text-sm text-[var(--muted-foreground)] animate-[fadeIn_1s_ease-out_0.5s_both]">
            Tap to rip
          </p>
        </div>
      )}

      {/* Phase 2: Ripping */}
      {phase === "ripping" && (
        <div className="flex flex-col items-center animate-[fadeIn_0.3s_ease-out]">
          <div className="relative flex h-64 w-48 items-center justify-center">
            {/* Torn halves animation */}
            <div className="absolute inset-0 rounded-2xl border-2 border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 animate-[ripLeft_1s_ease-in_forwards] origin-right" />
            <div className="absolute inset-0 rounded-2xl border-2 border-[var(--accent)]/30 bg-gradient-to-bl from-[var(--accent)]/20 to-[var(--accent)]/5 animate-[ripRight_1s_ease-in_forwards] origin-left" />

            {/* Sneaker silhouette */}
            <div className="relative z-10 animate-[fadeIn_0.5s_ease-out_0.5s_both]">
              <div className="h-32 w-32 rounded-xl bg-[var(--muted)] animate-pulse flex items-center justify-center">
                <span className="text-4xl">👟</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3: Revealed */}
      {phase === "revealed" && sneaker && vaultItem && (
        <div className="flex flex-col items-center animate-[fadeIn_0.5s_ease-out] max-w-md w-full px-4">
          {/* Result card */}
          <div className={`w-full rounded-2xl border-2 p-8 text-center mb-8 ${
            isBigWin
              ? "border-yellow-400 bg-gradient-to-br from-yellow-500/10 to-amber-500/5 shadow-2xl shadow-yellow-500/20"
              : isWinner
              ? "border-green-400 bg-gradient-to-br from-green-500/10 to-emerald-500/5 shadow-xl shadow-green-500/10"
              : "border-[var(--border)] bg-[var(--background)]"
          }`}>
            {isBigWin && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700 mb-4">
                <Sparkles className="h-3 w-3" /> BIG WIN
              </div>
            )}
            {isWinner && !isBigWin && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 mb-4">
                <Sparkles className="h-3 w-3" /> WINNER
              </div>
            )}

            {/* Sneaker image */}
            <div className="flex justify-center mb-6">
              {sneaker.imageUrl ? (
                <img
                  src={sneaker.imageUrl}
                  alt={`${sneaker.brand} ${sneaker.model}`}
                  className="h-40 w-40 rounded-xl object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-[var(--muted)]">
                  <span className="text-6xl">👟</span>
                </div>
              )}
            </div>

            <h2 className="text-2xl font-bold mb-1">{sneaker.brand} {sneaker.model}</h2>
            {sneaker.colorway && (
              <p className="text-sm text-[var(--muted-foreground)] mb-2">{sneaker.colorway}</p>
            )}
            <div className="flex items-center justify-center gap-3 text-sm text-[var(--muted-foreground)] mb-4">
              <span>Size {vaultItem.size}</span>
              <span>&middot;</span>
              <span>{vaultItem.condition}</span>
            </div>

            {retailValue > 0 && (
              <p className="text-3xl font-black">
                {formatPrice(retailValue)}
                <span className="text-sm font-normal text-[var(--muted-foreground)] ml-2">value</span>
              </p>
            )}

            {retailValue > 0 && (
              <p className={`text-sm mt-2 font-medium ${
                isWinner ? "text-green-600" : "text-[var(--muted-foreground)]"
              }`}>
                Paid {formatPrice(rip?.priceCents ?? 0)} &middot;{" "}
                {isWinner
                  ? `+${formatPrice(retailValue - (rip?.priceCents ?? 0))} profit`
                  : `${formatPrice((rip?.priceCents ?? 0) - retailValue)} below pack price`}
              </p>
            )}
          </div>

          {/* Post-reveal actions */}
          <div className="w-full grid gap-3">
            <button
              onClick={() => router.push("/vault")}
              className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              <Vault className="h-4 w-4" />
              Keep in Vault
            </button>
            <button
              onClick={() => router.push("/marketplace")}
              className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              <ShoppingBag className="h-4 w-4" />
              List for Sale
            </button>
            <button
              onClick={openBuyback}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
            >
              <DollarSign className="h-4 w-4" />
              Instant Buyback
            </button>
          </div>

          {/* Rip another */}
          <button
            onClick={() => router.push("/packs")}
            className="mt-4 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors underline"
          >
            Rip Another Pack
          </button>
        </div>
      )}

      {/* Back button (always visible) */}
      <button
        onClick={() => router.push("/packs")}
        className="fixed top-6 left-6 rounded-md border border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm px-3 py-1.5 text-sm hover:bg-[var(--muted)] transition-colors"
      >
        Back to Packs
      </button>

      {/* Buyback Modal */}
      <Modal open={buybackOpen} onClose={() => { if (!buybackExecuting) { setBuybackOpen(false); setBuybackQuote(null); } }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Instant Buyback</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Sell at 85% of fair market value</p>
          </div>
        </div>

        {sneaker && (
          <p className="text-sm font-medium mb-4">
            {sneaker.brand} {sneaker.model} — Size {vaultItem?.size}
          </p>
        )}

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
                onClick={() => { setBuybackOpen(false); setBuybackQuote(null); }}
                disabled={buybackExecuting}
                className="flex-1 rounded-lg border border-[var(--border)] py-3 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                Keep Item
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
      </Modal>

      {/* CSS keyframe animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ripLeft {
          0% { clip-path: inset(0 0 0 0); transform: translateX(0) rotate(0deg); }
          100% { clip-path: inset(0 50% 0 0); transform: translateX(-60px) rotate(-15deg); opacity: 0; }
        }
        @keyframes ripRight {
          0% { clip-path: inset(0 0 0 0); transform: translateX(0) rotate(0deg); }
          100% { clip-path: inset(0 0 0 50%); transform: translateX(60px) rotate(15deg); opacity: 0; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
