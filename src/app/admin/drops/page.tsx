"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Flame, Clock, Ban, Eye, Pause, Play } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";

interface PackTierSummary {
  id: string;
  name: string;
  priceCents: number;
  _count: { poolItems: number; rips: number };
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
  createdAt: string;
  packTiers: PackTierSummary[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  live: { label: "Live", color: "bg-green-100 text-green-700", icon: Flame },
  upcoming: { label: "Upcoming", color: "bg-blue-100 text-blue-700", icon: Clock },
  ended: { label: "Ended", color: "bg-gray-100 text-gray-700", icon: Ban },
  sold_out: { label: "Sold Out", color: "bg-red-100 text-red-700", icon: Ban },
};

export default function AdminDropsPage() {
  const router = useRouter();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    theme: "",
    imageUrl: "",
    startsAt: "",
    endsAt: "",
    maxPurchasesPerUser: "1",
  });

  useEffect(() => {
    fetchDrops();
  }, []);

  async function fetchDrops() {
    const res = await fetch("/api/admin/drops");
    if (res.ok) setDrops(await res.json());
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.name || !form.startsAt) return;
    setCreating(true);
    const res = await fetch("/api/admin/drops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        theme: form.theme || null,
        imageUrl: form.imageUrl || null,
        startsAt: form.startsAt,
        endsAt: form.endsAt || null,
        maxPurchasesPerUser: parseInt(form.maxPurchasesPerUser) || 1,
      }),
    });
    if (res.ok) {
      toast("Drop created", "success");
      setShowCreate(false);
      setForm({ name: "", description: "", theme: "", imageUrl: "", startsAt: "", endsAt: "", maxPurchasesPerUser: "1" });
      fetchDrops();
    } else {
      const data = await res.json();
      toast(data.error || "Failed to create drop", "error");
    }
    setCreating(false);
  }

  async function toggleStatus(drop: Drop) {
    const newStatus = drop.status === "live" ? "ended" : drop.status === "upcoming" ? "live" : "upcoming";
    const res = await fetch(`/api/admin/drops/${drop.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      toast(`Drop status changed to ${newStatus}`, "success");
      fetchDrops();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Curated Drops</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Create Drop
        </button>
      </div>

      {drops.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <Flame className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)] opacity-40" />
          <p className="text-sm text-[var(--muted-foreground)]">No drops yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {drops.map((drop) => {
            const cfg = STATUS_CONFIG[drop.status] || STATUS_CONFIG.ended;
            const StatusIcon = cfg.icon;
            const totalRips = drop.packTiers.reduce((sum, t) => sum + t._count.rips, 0);
            const totalPool = drop.packTiers.reduce((sum, t) => sum + t._count.poolItems, 0);

            return (
              <div key={drop.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--muted)]">
                      <Flame className="h-5 w-5 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{drop.name}</h3>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {drop.packTiers.length} tier{drop.packTiers.length !== 1 ? "s" : ""} &middot;{" "}
                        {totalRips} rips &middot; {totalPool} items in pool
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    <button
                      onClick={() => toggleStatus(drop)}
                      className="rounded-md border border-[var(--border)] p-2 text-sm hover:bg-[var(--muted)] transition-colors"
                      title={drop.status === "live" ? "End drop" : "Go live"}
                    >
                      {drop.status === "live" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => router.push(`/admin/drops/${drop.id}`)}
                      className="rounded-md border border-[var(--border)] p-2 text-sm hover:bg-[var(--muted)] transition-colors"
                      title="Manage drop"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                  <span>Starts: {new Date(drop.startsAt).toLocaleString()}</span>
                  {drop.endsAt && <span>Ends: {new Date(drop.endsAt).toLocaleString()}</span>}
                  <span>Limit: {drop.maxPurchasesPerUser}/user</span>
                </div>
                {drop.packTiers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {drop.packTiers.map((tier) => (
                      <span key={tier.id} className="inline-flex items-center gap-1 rounded-md bg-[var(--muted)] px-2 py-1 text-xs">
                        {tier.name} &middot; {formatPrice(tier.priceCents)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Drop">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Drop Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Valentine's Day Heat"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Drop description for users"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Theme</label>
              <input
                type="text"
                value={form.theme}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}
                placeholder="e.g. valentines, hype"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max per User</label>
              <input
                type="number"
                min="1"
                value={form.maxPurchasesPerUser}
                onChange={(e) => setForm({ ...form, maxPurchasesPerUser: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input
              type="text"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Starts At *</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ends At</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.name || !form.startsAt}
              className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Drop
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
