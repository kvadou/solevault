"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, Gift, Package } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";

interface VaultItemWithSneaker {
  id: string;
  size: string;
  condition: string;
  status: string;
  sneaker: { brand: string; model: string; colorway: string | null; retailPriceCents: number | null; imageUrl: string | null };
}

interface PoolItem {
  id: string;
  oddsWeight: number;
  status: string;
  vaultItem: VaultItemWithSneaker;
}

interface PackTierDetail {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  description: string | null;
  totalSupply: number;
  soldCount: number;
  status: string;
  poolItems: PoolItem[];
  _count: { rips: number };
}

export default function AdminPackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tier, setTier] = useState<PackTierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddItems, setShowAddItems] = useState(false);
  const [availableItems, setAvailableItems] = useState<VaultItemWithSneaker[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [oddsWeight, setOddsWeight] = useState("1");
  const [adding, setAdding] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchTier = useCallback(async () => {
    const res = await fetch(`/api/admin/packs/${params.id}`);
    if (res.ok) {
      setTier(await res.json());
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  async function openAddItems() {
    setShowAddItems(true);
    setLoadingItems(true);
    // Fetch vaulted items not already in any pack pool
    const res = await fetch("/api/vault?status=vaulted&admin=true");
    if (res.ok) {
      const items = await res.json();
      // Filter out items already in this tier's pool
      const pooledIds = new Set(tier?.poolItems.map((p) => p.vaultItem.id) ?? []);
      setAvailableItems(items.filter((i: VaultItemWithSneaker) => !pooledIds.has(i.id)));
    }
    setLoadingItems(false);
  }

  async function handleAddToPool() {
    if (selectedIds.length === 0) return;
    setAdding(true);
    const res = await fetch(`/api/admin/packs/${params.id}/pool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultItemIds: selectedIds, oddsWeight: parseInt(oddsWeight) || 1 }),
    });
    if (res.ok) {
      const data = await res.json();
      toast(`Added ${data.added} items to pool`, "success");
      setShowAddItems(false);
      setSelectedIds([]);
      fetchTier();
    } else {
      const data = await res.json();
      toast(data.error || "Failed to add items", "error");
    }
    setAdding(false);
  }

  async function handleRemoveFromPool(poolItemId: string) {
    const res = await fetch(`/api/admin/packs/${params.id}/pool`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolItemId }),
    });
    if (res.ok) {
      toast("Item removed from pool", "success");
      fetchTier();
    } else {
      const data = await res.json();
      toast(data.error || "Failed to remove", "error");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!tier) {
    return <p className="text-sm text-[var(--muted-foreground)]">Pack tier not found.</p>;
  }

  const availablePoolItems = tier.poolItems.filter((p) => p.status === "available");
  const claimedPoolItems = tier.poolItems.filter((p) => p.status === "claimed");
  const totalWeight = availablePoolItems.reduce((sum, p) => sum + p.oddsWeight, 0);

  return (
    <div>
      <button
        onClick={() => router.push("/admin/packs")}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Packs
      </button>

      {/* Header */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--muted)]">
            <Gift className="h-6 w-6 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tier.name}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{formatPrice(tier.priceCents)} per rip</p>
          </div>
          <span className={`ml-auto inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            tier.status === "active"
              ? "bg-green-100 text-green-700"
              : tier.status === "sold_out"
              ? "bg-red-100 text-red-700"
              : "bg-yellow-100 text-yellow-700"
          }`}>
            {tier.status}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="rounded-md bg-[var(--muted)] p-3">
            <p className="text-[var(--muted-foreground)]">Pool Size</p>
            <p className="text-lg font-semibold">{availablePoolItems.length}</p>
          </div>
          <div className="rounded-md bg-[var(--muted)] p-3">
            <p className="text-[var(--muted-foreground)]">Rips Sold</p>
            <p className="text-lg font-semibold">{tier.soldCount}/{tier.totalSupply}</p>
          </div>
          <div className="rounded-md bg-[var(--muted)] p-3">
            <p className="text-[var(--muted-foreground)]">Revenue</p>
            <p className="text-lg font-semibold">{formatPrice(tier._count.rips * tier.priceCents)}</p>
          </div>
          <div className="rounded-md bg-[var(--muted)] p-3">
            <p className="text-[var(--muted-foreground)]">Claimed</p>
            <p className="text-lg font-semibold">{claimedPoolItems.length}</p>
          </div>
        </div>
      </div>

      {/* Pool Items */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">Item Pool ({availablePoolItems.length} available)</h2>
          <button
            onClick={openAddItems}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Add Items
          </button>
        </div>

        {tier.poolItems.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)] opacity-40" />
            <p className="text-sm text-[var(--muted-foreground)]">No items in pool. Add vaulted items to make this pack available.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {tier.poolItems.map((poolItem) => (
              <div key={poolItem.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {poolItem.vaultItem.sneaker.brand} {poolItem.vaultItem.sneaker.model}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Size {poolItem.vaultItem.size} &middot; {poolItem.vaultItem.condition} &middot;{" "}
                    {poolItem.vaultItem.sneaker.retailPriceCents ? formatPrice(poolItem.vaultItem.sneaker.retailPriceCents) : "No price"} retail
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">Weight: {poolItem.oddsWeight}</p>
                  {totalWeight > 0 && poolItem.status === "available" && (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {((poolItem.oddsWeight / totalWeight) * 100).toFixed(1)}% chance
                    </p>
                  )}
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  poolItem.status === "available" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {poolItem.status}
                </span>
                {poolItem.status === "available" && (
                  <button
                    onClick={() => handleRemoveFromPool(poolItem.id)}
                    className="rounded-md p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove from pool"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Items Modal */}
      <Modal open={showAddItems} onClose={() => { setShowAddItems(false); setSelectedIds([]); }} className="max-w-lg">
        <h2 className="text-lg font-semibold mb-1">Add Items to Pool</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">Select vaulted items to include in {tier.name}</p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Odds Weight</label>
          <input
            type="number"
            min="1"
            value={oddsWeight}
            onChange={(e) => setOddsWeight(e.target.value)}
            className="w-24 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Higher weight = more likely to be pulled</p>
        </div>

        {loadingItems ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : availableItems.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4">No vaulted items available. Items must be in &quot;vaulted&quot; status.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)]">
            {availableItems.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--muted)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="rounded border-[var(--border)]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.sneaker.brand} {item.sneaker.model}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Size {item.size} &middot; {item.condition} &middot;{" "}
                    {item.sneaker.retailPriceCents ? formatPrice(item.sneaker.retailPriceCents) : "—"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setSelectedIds([])}
              className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              Clear ({selectedIds.length})
            </button>
            <button
              onClick={handleAddToPool}
              disabled={adding}
              className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              Add {selectedIds.length} Items
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
