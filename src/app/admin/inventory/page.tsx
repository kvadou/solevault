"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export default function AdminInventory() {
  const [showAddSneaker, setShowAddSneaker] = useState(false);
  const [newSneaker, setNewSneaker] = useState({ brand: "", model: "", colorway: "", styleCode: "", retailPriceCents: "", imageUrl: "" });
  const [adding, setAdding] = useState(false);

  async function handleAddSneaker() {
    setAdding(true);
    await fetch("/api/sneakers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: newSneaker.brand,
        model: newSneaker.model,
        colorway: newSneaker.colorway || null,
        styleCode: newSneaker.styleCode || null,
        retailPriceCents: newSneaker.retailPriceCents ? parseInt(newSneaker.retailPriceCents) * 100 : null,
        imageUrl: newSneaker.imageUrl || null,
      }),
    });
    setNewSneaker({ brand: "", model: "", colorway: "", styleCode: "", retailPriceCents: "", imageUrl: "" });
    setShowAddSneaker(false);
    setAdding(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <button
          onClick={() => setShowAddSneaker(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Add Sneaker to Catalog
        </button>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        Use this page to add sneaker models to the catalog. Users will select from these when submitting vault requests.
        Use the Submissions page to approve/reject individual vault items.
      </p>

      {/* Add sneaker modal */}
      <Modal open={showAddSneaker} onClose={() => setShowAddSneaker(false)} title="Add Sneaker to Catalog" className="max-w-md">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Brand *</label>
            <input
              type="text"
              value={newSneaker.brand}
              onChange={(e) => setNewSneaker({ ...newSneaker, brand: e.target.value })}
              placeholder="e.g. Nike, Jordan, Adidas"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Model *</label>
            <input
              type="text"
              value={newSneaker.model}
              onChange={(e) => setNewSneaker({ ...newSneaker, model: e.target.value })}
              placeholder="e.g. Air Jordan 1 Retro High OG"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Colorway</label>
            <input
              type="text"
              value={newSneaker.colorway}
              onChange={(e) => setNewSneaker({ ...newSneaker, colorway: e.target.value })}
              placeholder="e.g. Chicago, Bred, University Blue"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Style Code</label>
            <input
              type="text"
              value={newSneaker.styleCode}
              onChange={(e) => setNewSneaker({ ...newSneaker, styleCode: e.target.value })}
              placeholder="e.g. DZ5485-612"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Retail Price ($)</label>
            <input
              type="number"
              value={newSneaker.retailPriceCents}
              onChange={(e) => setNewSneaker({ ...newSneaker, retailPriceCents: e.target.value })}
              placeholder="e.g. 170"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input
              type="url"
              value={newSneaker.imageUrl}
              onChange={(e) => setNewSneaker({ ...newSneaker, imageUrl: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowAddSneaker(false)}
              className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSneaker}
              disabled={adding || !newSneaker.brand || !newSneaker.model}
              className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              Add to Catalog
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
