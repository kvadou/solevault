"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";

interface Sneaker {
  id: string;
  brand: string;
  model: string;
  colorway: string | null;
}

const SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "14"];
const CONDITIONS = [
  { value: "deadstock", label: "Deadstock (DS) — Brand new, never worn" },
  { value: "vnds", label: "VNDS — Tried on / worn once" },
  { value: "excellent", label: "Excellent — Light wear, no visible flaws" },
  { value: "good", label: "Good — Normal wear, minor scuffs" },
];

export default function VaultSubmitPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sneakers, setSneakers] = useState<Sneaker[]>([]);
  const [step, setStep] = useState(1);
  const [selectedSneaker, setSelectedSneaker] = useState("");
  const [size, setSize] = useState("");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/sneakers").then((r) => r.json()).then(setSneakers);
  }, []);

  const filtered = sneakers.filter((s) =>
    `${s.brand} ${s.model} ${s.colorway}`.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit() {
    if (!selectedSneaker || !size || !condition) return;
    setSubmitting(true);

    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sneakerId: selectedSneaker, size, condition, notes: notes || undefined }),
    });

    if (res.ok) {
      setSuccess(true);
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center space-y-4">
        <CheckCircle className="h-16 w-16 text-[var(--accent)] mx-auto" />
        <h1 className="text-2xl font-bold">Submission Received!</h1>
        <p className="text-[var(--muted-foreground)]">
          Your vault submission has been created. We&apos;ll provide a shipping label shortly.
          Once received, your pair will be authenticated and vaulted.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <button onClick={() => router.push("/vault")} className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]">
            View My Vault
          </button>
          <button onClick={() => { setSuccess(false); setStep(1); setSelectedSneaker(""); setSize(""); setCondition(""); setNotes(""); }}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Vault Your Sneakers</h1>
      <p className="text-[var(--muted-foreground)] mb-8">Send us your sneakers for authentication, storage, and instant trading.</p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= s ? "bg-[var(--accent)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}>{s}</div>
            {s < 3 && <div className={`h-0.5 w-8 ${step > s ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />}
          </div>
        ))}
        <span className="text-sm text-[var(--muted-foreground)] ml-2">
          {step === 1 ? "Select Sneaker" : step === 2 ? "Details" : "Review"}
        </span>
      </div>

      {/* Step 1: Select Sneaker */}
      {step === 1 && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search for a sneaker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSelectedSneaker(s.id); setStep(2); }}
                className={`w-full text-left rounded-md px-3 py-2.5 text-sm hover:bg-[var(--muted)] transition-colors ${
                  selectedSneaker === s.id ? "bg-[var(--accent)]/10 border border-[var(--accent)]" : ""
                }`}
              >
                <span className="font-medium">{s.brand} {s.model}</span>
                {s.colorway && <span className="text-[var(--muted-foreground)]"> — {s.colorway}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-8">No sneakers found. Admin can add new models.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Size & Condition */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Size</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
                    size === s
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Condition</label>
            <div className="space-y-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCondition(c.value)}
                  className={`w-full text-left rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    condition === c.value
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >{c.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any details about the pair (box condition, accessories, etc.)"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!size || !condition}
              className="flex-1 rounded-md bg-[var(--primary)] py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--border)] p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Sneaker</span>
              <span className="font-medium">{sneakers.find((s) => s.id === selectedSneaker)?.brand} {sneakers.find((s) => s.id === selectedSneaker)?.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Size</span>
              <span>{size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Condition</span>
              <span className="capitalize">{condition}</span>
            </div>
            {notes && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Notes</span>
                <span className="text-right max-w-[200px]">{notes}</span>
              </div>
            )}
          </div>
          <div className="rounded-lg bg-[var(--muted)] p-4 text-sm text-[var(--muted-foreground)]">
            <p className="font-medium text-[var(--foreground)] mb-1">What happens next:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>We&apos;ll email you a prepaid shipping label</li>
              <li>Ship your sneakers to our authentication center</li>
              <li>We authenticate and photograph the pair</li>
              <li>Once approved, it&apos;s vaulted and ready to trade</li>
            </ol>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors">
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-md bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit for Vaulting
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
