"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Gift, Eye, Pause, Play } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";

interface PackTier {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  description: string | null;
  totalSupply: number;
  soldCount: number;
  status: string;
  createdAt: string;
  _count: { poolItems: number; rips: number };
}

export default function AdminPacksPage() {
  const router = useRouter();
  const [tiers, setTiers] = useState<PackTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", priceDollars: "", description: "", totalSupply: "" });

  useEffect(() => {
    fetchTiers();
  }, []);

  async function fetchTiers() {
    const res = await fetch("/api/admin/packs");
    if (res.ok) setTiers(await res.json());
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.name || !form.priceDollars || !form.totalSupply) return;
    setCreating(true);
    const res = await fetch("/api/admin/packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        priceCents: Math.round(parseFloat(form.priceDollars) * 100),
        description: form.description || null,
        totalSupply: parseInt(form.totalSupply),
      }),
    });
    if (res.ok) {
      toast("Pack tier created", "success");
      setShowCreate(false);
      setForm({ name: "", priceDollars: "", description: "", totalSupply: "" });
      fetchTiers();
    } else {
      const data = await res.json();
      toast(data.error || "Failed to create", "error");
    }
    setCreating(false);
  }

  async function toggleStatus(tier: PackTier) {
    const newStatus = tier.status === "active" ? "paused" : "active";
    const res = await fetch(`/api/admin/packs/${tier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      toast(`Pack ${newStatus === "active" ? "activated" : "paused"}`, "success");
      fetchTiers();
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
        <h1 className="text-2xl font-bold">Mystery Packs</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Create Pack Tier
        </button>
      </div>

      {tiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
          <Gift className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)] opacity-40" />
          <p className="text-sm text-[var(--muted-foreground)]">No pack tiers yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tiers.map((tier) => (
            <div key={tier.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--muted)]">
                    <Gift className="h-5 w-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{tier.name}</h3>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {formatPrice(tier.priceCents)} &middot; {tier._count.poolItems} items in pool &middot; {tier.soldCount}/{tier.totalSupply} sold
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    tier.status === "active"
                      ? "bg-green-100 text-green-700"
                      : tier.status === "sold_out"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {tier.status}
                  </span>
                  <button
                    onClick={() => toggleStatus(tier)}
                    className="rounded-md border border-[var(--border)] p-2 text-sm hover:bg-[var(--muted)] transition-colors"
                    title={tier.status === "active" ? "Pause" : "Activate"}
                  >
                    {tier.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => router.push(`/admin/packs/${tier.id}`)}
                    className="rounded-md border border-[var(--border)] p-2 text-sm hover:bg-[var(--muted)] transition-colors"
                    title="Manage pool"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {tier.description && (
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">{tier.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Pack Tier">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Pack Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Bronze Pack, Gold Pack"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Price ($) *</label>
            <input
              type="number"
              min="1"
              value={form.priceDollars}
              onChange={(e) => setForm({ ...form, priceDollars: e.target.value })}
              placeholder="e.g. 25, 50, 100"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total Supply *</label>
            <input
              type="number"
              min="1"
              value={form.totalSupply}
              onChange={(e) => setForm({ ...form, totalSupply: e.target.value })}
              placeholder="e.g. 50, 100"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Pack description for users"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
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
              disabled={creating || !form.name || !form.priceDollars || !form.totalSupply}
              className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Tier
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
