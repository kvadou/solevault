"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Plus, Tag, PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatPrice, conditionLabel } from "@/lib/utils";

interface VaultItem {
  id: string;
  size: string;
  condition: string;
  status: string;
  authenticationStatus: string;
  askingPriceCents: number | null;
  imageUrls: string[];
  createdAt: string;
  sneaker: {
    id: string;
    brand: string;
    model: string;
    colorway: string | null;
    imageUrl: string | null;
  };
  listings: Array<{ id: string; priceCents: number; status: string }>;
}

export default function VaultPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listModal, setListModal] = useState<VaultItem | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listing, setListing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/vault")
        .then((r) => r.json())
        .then((data) => { setItems(data); setLoading(false); });
    }
  }, [session]);

  async function handleList() {
    if (!listModal || !listPrice) return;
    setListing(true);

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultItemId: listModal.id, priceCents: Math.round(parseFloat(listPrice) * 100) }),
    });

    if (res.ok) {
      setListModal(null);
      setListPrice("");
      const data = await fetch("/api/vault").then((r) => r.json());
      setItems(data);
    }
    setListing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Vault</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{items.length} pair{items.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/vault/submit"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Vault a Pair
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <PackageOpen className="h-12 w-12 mx-auto text-[var(--muted-foreground)]" />
          <p className="text-lg font-medium">Your vault is empty</p>
          <p className="text-sm text-[var(--muted-foreground)]">Start by vaulting your first pair of sneakers.</p>
          <Link
            href="/vault/submit"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            <Plus className="h-4 w-4" /> Vault Your First Pair
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[var(--border)] overflow-hidden">
              <div className="aspect-[4/3] relative bg-[var(--muted)]">
                <Image
                  src={item.imageUrls[0] || item.sneaker.imageUrl || "/placeholder-sneaker.svg"}
                  alt={`${item.sneaker.brand} ${item.sneaker.model}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute top-2 left-2 flex gap-1.5">
                  <Badge status={item.status} />
                  <Badge status={item.authenticationStatus} />
                </div>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">{item.sneaker.brand}</p>
                <p className="font-medium">{item.sneaker.model}</p>
                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <span>Size {item.size}</span>
                  <span>&middot;</span>
                  <span>{conditionLabel(item.condition)}</span>
                </div>
                {item.askingPriceCents && (
                  <p className="text-lg font-bold">{formatPrice(item.askingPriceCents)}</p>
                )}
                <div className="pt-2 flex gap-2">
                  {item.status === "vaulted" && (
                    <button
                      onClick={() => { setListModal(item); setListPrice(""); }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                    >
                      <Tag className="h-3.5 w-3.5" /> List for Sale
                    </button>
                  )}
                  {item.status === "listed" && (
                    <span className="flex-1 text-center text-sm text-[var(--muted-foreground)] py-1.5">Currently Listed</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List for sale modal */}
      <Modal
        open={!!listModal}
        onClose={() => { if (!listing) setListModal(null); }}
        title="List for Sale"
      >
        {listModal && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              {listModal.sneaker.brand} {listModal.sneaker.model} — Size {listModal.size}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1.5">Asking Price (USD)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="e.g. 250.00"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              {listPrice && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  You&apos;ll receive {formatPrice(Math.round(parseFloat(listPrice) * 100 * 0.975))} after 2.5% seller fee
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setListModal(null)}
                disabled={listing}
                className="flex-1 rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleList}
                disabled={listing || !listPrice}
                className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {listing && <Loader2 className="h-4 w-4 animate-spin" />}
                List Now
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
