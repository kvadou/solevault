"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Loader2, Check, ShieldCheck, Package } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface TagData {
  vaultItem: {
    id: string;
    size: string;
    condition: string;
    sneaker: { brand: string; model: string; imageUrl: string | null };
    owner: { id: string };
  };
  status: string;
}

export default function NfcCheckInPage({ params }: { params: Promise<{ tagUid: string }> }) {
  const { tagUid } = use(params);
  const { data: session, status: authStatus } = useSession();
  const [tagData, setTagData] = useState<TagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [condition, setCondition] = useState("excellent");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/nfc/tag-info/${tagUid}`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json();
          setError(data.error || "Tag not found");
          setLoading(false);
          return;
        }
        const data = await r.json();
        setTagData(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load tag info");
        setLoading(false);
      });
  }, [tagUid]);

  async function handleCheckIn() {
    setSubmitting(true);
    const res = await fetch("/api/nfc/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagUid, condition, notes: notes || undefined }),
    });

    if (res.ok) {
      setDone(true);
      toast("Check-in complete!", "success");
    } else {
      const data = await res.json();
      toast(data.error || "Check-in failed", "error");
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <ShieldCheck className="h-12 w-12 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold">Tag Issue</h1>
        <p className="text-[var(--muted-foreground)]">{error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Check-in Complete</h1>
        <p className="text-[var(--muted-foreground)]">
          Your condition report has been recorded on the chain of custody.
        </p>
      </div>
    );
  }

  if (tagData && tagData.status === "deactivated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <ShieldCheck className="h-12 w-12 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold">Tag Deactivated</h1>
        <p className="text-[var(--muted-foreground)]">
          This tag has been deactivated due to possible tampering.
        </p>
      </div>
    );
  }

  if (!tagData) return null;

  const { vaultItem } = tagData;
  const isOwner = session?.user?.id === vaultItem.owner.id;

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-8 space-y-6">
      <div className="text-center space-y-2">
        <Package className="h-8 w-8 text-[var(--accent)] mx-auto" />
        <h1 className="text-2xl font-bold">NFC Tag Scanned</h1>
      </div>

      {/* Item card */}
      <div className="rounded-lg border border-[var(--border)] p-4 flex items-center gap-4">
        <div className="relative h-16 w-16 rounded-md bg-[var(--muted)] overflow-hidden shrink-0">
          {vaultItem.sneaker.imageUrl && (
            <Image src={vaultItem.sneaker.imageUrl} alt="" fill className="object-cover" sizes="64px" />
          )}
        </div>
        <div>
          <p className="font-semibold">{vaultItem.sneaker.brand} {vaultItem.sneaker.model}</p>
          <p className="text-sm text-[var(--muted-foreground)]">Size {vaultItem.size}</p>
        </div>
      </div>

      {isOwner ? (
        <>
          <div className="rounded-lg border border-[var(--border)] p-4 space-y-4">
            <h2 className="font-semibold">Check In This Item</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Confirm you received this item and report its current condition.
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="new">New</option>
                <option value="like_new">Like New</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations about the item"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <button
            onClick={handleCheckIn}
            disabled={submitting}
            className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Complete Check-In
          </button>
        </>
      ) : (
        <div className="rounded-lg border border-[var(--border)] p-4 text-center space-y-2">
          <p className="text-sm text-[var(--muted-foreground)]">
            {authStatus === "authenticated"
              ? "You are not the current owner of this item. Only the owner can check in."
              : "Sign in to check in this item if you are the owner."}
          </p>
        </div>
      )}
    </div>
  );
}
