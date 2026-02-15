"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flame, Loader2, Clock, Zap } from "lucide-react";

interface PackTierSummary {
  id: string;
  name: string;
  priceCents: number;
  _count: { poolItems: number };
}

interface Drop {
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
  packTiers: PackTierSummary[];
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
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

const THEME_GRADIENTS: Record<string, string> = {
  valentines: "from-pink-600/30 via-red-500/20 to-rose-600/30",
  hype: "from-orange-600/30 via-amber-500/20 to-yellow-600/30",
  ice: "from-cyan-600/30 via-blue-500/20 to-indigo-600/30",
  grail: "from-purple-600/30 via-violet-500/20 to-fuchsia-600/30",
  default: "from-[var(--accent)]/20 via-transparent to-[var(--accent)]/10",
};

function getGradient(theme: string | null) {
  if (theme && THEME_GRADIENTS[theme]) return THEME_GRADIENTS[theme];
  return THEME_GRADIENTS.default;
}

export default function DropsPage() {
  const router = useRouter();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/drops")
      .then((res) => res.json())
      .then(setDrops)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  const liveDrops = drops.filter((d) => d.status === "live");
  const upcomingDrops = drops.filter((d) => d.status === "upcoming");
  const pastDrops = drops.filter((d) => d.status === "ended" || d.status === "sold_out");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/10 px-4 py-1.5 text-sm font-medium text-[var(--accent)] mb-4">
          <Flame className="h-4 w-4" /> Curated Drops
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">Limited Drops</h1>
        <p className="text-lg text-[var(--muted-foreground)] max-w-xl mx-auto">
          Exclusive, time-limited pack releases. Each drop features hand-curated sneakers. Don&apos;t miss out.
        </p>
      </div>

      {/* Live Drops */}
      {liveDrops.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <h2 className="text-xl font-bold">Live Now</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {liveDrops.map((drop) => (
              <DropCard key={drop.id} drop={drop} onClick={() => router.push(`/drops/${drop.slug}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Drops */}
      {upcomingDrops.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-bold">Upcoming</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingDrops.map((drop) => (
              <DropCard key={drop.id} drop={drop} onClick={() => router.push(`/drops/${drop.slug}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Past Drops */}
      {pastDrops.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-6 text-[var(--muted-foreground)]">Past Drops</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pastDrops.map((drop) => (
              <DropCard key={drop.id} drop={drop} onClick={() => router.push(`/drops/${drop.slug}`)} past />
            ))}
          </div>
        </section>
      )}

      {drops.length === 0 && (
        <div className="text-center py-20">
          <Flame className="h-12 w-12 mx-auto mb-4 text-[var(--muted-foreground)] opacity-40" />
          <p className="text-lg text-[var(--muted-foreground)]">No drops scheduled yet. Check back soon.</p>
        </div>
      )}
    </div>
  );
}

function DropCard({ drop, onClick, past }: { drop: Drop; onClick: () => void; past?: boolean }) {
  const gradient = getGradient(drop.theme);
  const totalRemaining = drop.packTiers.reduce((sum, t) => sum + (t._count?.poolItems ?? 0), 0);
  const priceRange = drop.packTiers.length > 0
    ? drop.packTiers.length === 1
      ? formatPrice(drop.packTiers[0].priceCents)
      : `${formatPrice(Math.min(...drop.packTiers.map((t) => t.priceCents)))} - ${formatPrice(Math.max(...drop.packTiers.map((t) => t.priceCents)))}`
    : "";

  return (
    <button
      onClick={onClick}
      className={`group relative text-left w-full overflow-hidden rounded-2xl border-2 transition-all hover:shadow-xl ${
        past
          ? "border-[var(--border)] opacity-60 hover:opacity-80"
          : drop.status === "live"
          ? "border-green-500/40 shadow-green-500/10 shadow-lg"
          : "border-blue-500/30"
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      <div className="relative p-6">
        {drop.status === "live" && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-bold text-green-400 mb-3">
            <Zap className="h-3 w-3" /> LIVE
          </div>
        )}
        {drop.status === "upcoming" && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400 mb-3">
            <Clock className="h-3 w-3" /> Drops in <CountdownTimer targetDate={drop.startsAt} />
          </div>
        )}
        {(drop.status === "ended" || drop.status === "sold_out") && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/20 px-2.5 py-1 text-xs font-bold text-gray-400 mb-3">
            {drop.status === "sold_out" ? "Sold Out" : "Ended"}
          </div>
        )}

        <h3 className="text-xl font-bold mb-1 group-hover:text-[var(--accent)] transition-colors">{drop.name}</h3>
        {drop.description && (
          <p className="text-sm text-[var(--muted-foreground)] mb-4 line-clamp-2">{drop.description}</p>
        )}

        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-[var(--muted-foreground)]">{drop.packTiers.length} tier{drop.packTiers.length !== 1 ? "s" : ""}</span>
            {priceRange && <span className="ml-2 font-semibold">{priceRange}</span>}
          </div>
          {drop.status === "live" && (
            <span className={`font-medium ${totalRemaining <= 10 ? "text-red-500" : "text-[var(--muted-foreground)]"}`}>
              {totalRemaining} left
            </span>
          )}
        </div>

        {drop.endsAt && drop.status === "live" && (
          <div className="mt-3 text-xs text-[var(--muted-foreground)]">
            Ends in <CountdownTimer targetDate={drop.endsAt} />
          </div>
        )}

        <div className="mt-2 text-xs text-[var(--muted-foreground)]">
          Limit: {drop.maxPurchasesPerUser} per user
        </div>
      </div>
    </button>
  );
}
