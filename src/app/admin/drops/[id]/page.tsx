"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Flame, Plus, Trash2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";

interface PoolItem {
  id: string;
  oddsWeight: number;
  status: string;
  vaultItem: {
    id: string;
    size: string;
    condition: string;
    sneaker: { brand: string; model: string; colorway: string; retailPriceCents: number | null };
  };
}

interface PackTier {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  totalSupply: number;
  soldCount: number;
  status: string;
  poolItems: PoolItem[];
  _count: { rips: number; poolItems: number };
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
  packTiers: PackTier[];
}

interface UnlinkedTier {
  id: string;
  name: string;
  priceCents: number;
  status: string;
}

export default function AdminDropDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [drop, setDrop] = useState<Drop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [unlinkedTiers, setUnlinkedTiers] = useState<UnlinkedTier[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    theme: "",
    imageUrl: "",
    startsAt: "",
    endsAt: "",
    status: "",
    maxPurchasesPerUser: "1",
  });

  useEffect(() => {
    fetchDrop();
  }, [id]);

  async function fetchDrop() {
    const res = await fetch(`/api/admin/drops/${id}`);
    if (res.ok) {
      const data: Drop = await res.json();
      setDrop(data);
      setForm({
        name: data.name,
        description: data.description || "",
        theme: data.theme || "",
        imageUrl: data.imageUrl || "",
        startsAt: data.startsAt ? new Date(data.startsAt).toISOString().slice(0, 16) : "",
        endsAt: data.endsAt ? new Date(data.endsAt).toISOString().slice(0, 16) : "",
        status: data.status,
        maxPurchasesPerUser: String(data.maxPurchasesPerUser),
      });
    } else {
      toast("Drop not found", "error");
      router.push("/admin/drops");
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/admin/drops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        theme: form.theme || null,
        imageUrl: form.imageUrl || null,
        startsAt: form.startsAt,
        endsAt: form.endsAt || null,
        status: form.status,
        maxPurchasesPerUser: parseInt(form.maxPurchasesPerUser) || 1,
      }),
    });
    if (res.ok) {
      toast("Drop updated", "success");
      fetchDrop();
    } else {
      const data = await res.json();
      toast(data.error || "Failed to update", "error");
    }
    setSaving(false);
  }

  async function openLinkModal() {
    setShowLinkModal(true);
    setLoadingTiers(true);
    const res = await fetch("/api/admin/packs");
    if (res.ok) {
      const allTiers: UnlinkedTier[] = await res.json();
      const linkedIds = new Set(drop?.packTiers.map((t) => t.id) || []);
      setUnlinkedTiers(allTiers.filter((t) => !linkedIds.has(t.id)));
    }
    setLoadingTiers(false);
  }

  async function linkTier(tierId: string) {
    const res = await fetch(`/api/admin/drops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addTierIds: [tierId] }),
    });
    if (res.ok) {
      toast("Tier linked to drop", "success");
      setShowLinkModal(false);
      fetchDrop();
    }
  }

  async function unlinkTier(tierId: string) {
    const res = await fetch(`/api/admin/drops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeTierIds: [tierId] }),
    });
    if (res.ok) {
      toast("Tier removed from drop", "success");
      fetchDrop();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!drop) return null;

  return (
    <div>
      <button
        onClick={() => router.push("/admin/drops")}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Drops
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--muted)]">
          <Flame className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{drop.name}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">/drops/{drop.slug}</p>
        </div>
      </div>

      {/* Edit Form */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5 mb-6">
        <h2 className="text-lg font-semibold mb-4">Drop Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="ended">Ended</option>
              <option value="sold_out">Sold Out</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <input
              type="text"
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Purchases/User</label>
            <input
              type="number"
              min="1"
              value={form.maxPurchasesPerUser}
              onChange={(e) => setForm({ ...form, maxPurchasesPerUser: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Starts At</label>
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
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input
              type="text"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Linked Pack Tiers */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Pack Tiers in This Drop</h2>
          <button
            onClick={openLinkModal}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Link Tier
          </button>
        </div>

        {drop.packTiers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No tiers linked. Link existing pack tiers to include them in this drop.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {drop.packTiers.map((tier) => (
              <div key={tier.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4">
                <div>
                  <h3 className="font-medium">{tier.name}</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {formatPrice(tier.priceCents)} &middot; {tier._count.rips} rips &middot;{" "}
                    {tier._count.poolItems} available &middot; {tier.soldCount}/{tier.totalSupply} sold
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    tier.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {tier.status}
                  </span>
                  <button
                    onClick={() => unlinkTier(tier.id)}
                    className="rounded-md border border-red-200 p-2 text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove from drop"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link Tier Modal */}
      <Modal open={showLinkModal} onClose={() => setShowLinkModal(false)} title="Link Pack Tier">
        {loadingTiers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : unlinkedTiers.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
            All pack tiers are already linked to a drop or none exist.
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {unlinkedTiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => linkTier(tier.id)}
                className="w-full flex items-center justify-between rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--muted)] transition-colors text-left"
              >
                <div>
                  <span className="font-medium text-sm">{tier.name}</span>
                  <span className="text-sm text-[var(--muted-foreground)] ml-2">{formatPrice(tier.priceCents)}</span>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${
                  tier.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                }`}>
                  {tier.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
