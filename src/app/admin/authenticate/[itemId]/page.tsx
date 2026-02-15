"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { AUTH_CHECKPOINTS, AUTH_PHOTO_ANGLES } from "@/lib/authentication";
import type { CheckpointResult, OverallResult } from "@/lib/authentication";
import { toast } from "@/components/ui/Toast";

interface VaultItemData {
  id: string;
  size: string;
  condition: string;
  status: string;
  authenticationStatus: string;
  nfcChipId: string | null;
  vaultLocation: string | null;
  sneaker: {
    brand: string;
    model: string;
    colorway: string | null;
  };
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  submission: {
    id: string;
    trackingNumber: string | null;
  } | null;
  authReport: {
    id: string;
    overallResult: string;
    checkpoints: Array<{ name: string; result: string; notes: string | null }>;
    photos: Array<{ angle: string; imageUrl: string }>;
  } | null;
}

interface CheckpointState {
  result: CheckpointResult | null;
  notes: string;
}

interface PhotoState {
  imageUrl: string;
}

export default function AdminAuthenticatePage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.itemId as string;

  const [item, setItem] = useState<VaultItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [checkpoints, setCheckpoints] = useState<Record<string, CheckpointState>>(() => {
    const initial: Record<string, CheckpointState> = {};
    AUTH_CHECKPOINTS.forEach((cp) => {
      initial[cp.name] = { result: null, notes: "" };
    });
    return initial;
  });

  const [photos, setPhotos] = useState<Record<string, PhotoState>>(() => {
    const initial: Record<string, PhotoState> = {};
    AUTH_PHOTO_ANGLES.forEach((p) => {
      initial[p.angle] = { imageUrl: "" };
    });
    return initial;
  });

  const [nfcChipId, setNfcChipId] = useState("");
  const [vaultLocation, setVaultLocation] = useState("");
  const [aiConfidence, setAiConfidence] = useState("");
  const [overallNotes, setOverallNotes] = useState("");

  const fetchItem = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/vault-items/${itemId}`);
      if (!res.ok) throw new Error("Failed to fetch item");
      const data = await res.json();
      setItem(data);
      if (data.nfcChipId) setNfcChipId(data.nfcChipId);
      if (data.vaultLocation) setVaultLocation(data.vaultLocation);
    } catch {
      toast("Failed to load item data", "error");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  function updateCheckpoint(name: string, field: keyof CheckpointState, value: string | CheckpointResult | null) {
    setCheckpoints((prev) => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  }

  function updatePhoto(angle: string, imageUrl: string) {
    setPhotos((prev) => ({
      ...prev,
      [angle]: { imageUrl },
    }));
  }

  async function handleSubmit(overallResult: OverallResult) {
    // Validate: all checkpoints must have a result
    const incomplete = AUTH_CHECKPOINTS.filter((cp) => !checkpoints[cp.name].result);
    if (incomplete.length > 0) {
      toast(`Please complete all checkpoints. Missing: ${incomplete.map((c) => c.label).join(", ")}`, "error");
      return;
    }

    setSubmitting(true);

    const payload = {
      action: "authenticate",
      overallResult,
      nfcChipId: nfcChipId || undefined,
      vaultLocation: vaultLocation || undefined,
      aiConfidenceScore: aiConfidence ? parseFloat(aiConfidence) : undefined,
      notes: overallNotes || undefined,
      checkpoints: AUTH_CHECKPOINTS.map((cp) => ({
        name: cp.name,
        result: checkpoints[cp.name].result,
        notes: checkpoints[cp.name].notes || undefined,
      })),
      photos: AUTH_PHOTO_ANGLES
        .filter((p) => photos[p.angle].imageUrl.trim())
        .map((p) => ({
          angle: p.angle,
          imageUrl: photos[p.angle].imageUrl.trim(),
        })),
    };

    try {
      const res = await fetch(`/api/admin/vault-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to submit authentication");
      }

      const resultLabels: Record<OverallResult, string> = {
        passed: "approved and vaulted",
        failed: "rejected",
        inconclusive: "marked as inconclusive",
      };
      toast(`Item ${resultLabels[overallResult]} successfully`, "success");
      router.push("/admin/submissions");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Submission failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="py-20 text-center">
        <p className="text-[var(--muted-foreground)]">Item not found.</p>
        <Link href="/admin/submissions" className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline">
          Back to Submissions
        </Link>
      </div>
    );
  }

  const completedCount = AUTH_CHECKPOINTS.filter((cp) => checkpoints[cp.name].result).length;
  const passCount = AUTH_CHECKPOINTS.filter((cp) => checkpoints[cp.name].result === "pass").length;
  const warnCount = AUTH_CHECKPOINTS.filter((cp) => checkpoints[cp.name].result === "warning").length;
  const failCount = AUTH_CHECKPOINTS.filter((cp) => checkpoints[cp.name].result === "fail").length;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div>
        <Link
          href="/admin/submissions"
          className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Submissions
        </Link>

        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[var(--accent)]/10 p-2">
            <Shield className="h-6 w-6 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {item.sneaker.brand} {item.sneaker.model}
            </h1>
            {item.sneaker.colorway && (
              <p className="text-[var(--muted-foreground)]">{item.sneaker.colorway}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
              <span>Size {item.size}</span>
              <span className="text-[var(--border)]">|</span>
              <span>{item.condition}</span>
              <span className="text-[var(--border)]">|</span>
              <span>{item.owner.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">Inspection Progress</span>
          <span className="text-[var(--muted-foreground)]">
            {completedCount} / {AUTH_CHECKPOINTS.length} checkpoints
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[var(--muted)]">
          <div
            className="h-2 rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${(completedCount / AUTH_CHECKPOINTS.length) * 100}%` }}
          />
        </div>
        {completedCount > 0 && (
          <div className="mt-2 flex gap-4 text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" /> {passCount} Pass
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-500" /> {warnCount} Warning
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" /> {failCount} Fail
            </span>
          </div>
        )}
      </div>

      {/* Photo Documentation Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Camera className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">Photo Documentation</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {AUTH_PHOTO_ANGLES.map((photo) => (
            <div
              key={photo.angle}
              className="rounded-lg border border-[var(--border)] p-3 space-y-2"
            >
              <label className="block text-xs font-medium text-[var(--muted-foreground)]">
                {photo.label}
              </label>
              {photos[photo.angle].imageUrl ? (
                <div className="relative aspect-square overflow-hidden rounded bg-[var(--muted)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photos[photo.angle].imageUrl}
                    alt={photo.label}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded bg-[var(--muted)]">
                  <Camera className="h-6 w-6 text-[var(--muted-foreground)]/40" />
                </div>
              )}
              <input
                type="text"
                placeholder="Image URL..."
                value={photos[photo.angle].imageUrl}
                onChange={(e) => updatePhoto(photo.angle, e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Authentication Checkpoints */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold">12-Point Authentication Checklist</h2>
        </div>
        <div className="space-y-3">
          {AUTH_CHECKPOINTS.map((cp, idx) => {
            const state = checkpoints[cp.name];
            return (
              <div
                key={cp.name}
                className={`rounded-lg border p-4 transition-colors ${
                  state.result === "pass"
                    ? "border-green-300 bg-green-50/50"
                    : state.result === "warning"
                    ? "border-yellow-300 bg-yellow-50/50"
                    : state.result === "fail"
                    ? "border-red-300 bg-red-50/50"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--muted)] text-xs font-medium">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-semibold">{cp.label}</h3>
                    </div>
                    <p className="mt-1 ml-8 text-xs text-[var(--muted-foreground)]">
                      {cp.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCheckpoint(cp.name, "result", "pass")}
                      className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        state.result === "pass"
                          ? "bg-green-500 text-white shadow-sm"
                          : "border border-green-300 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCheckpoint(cp.name, "result", "warning")}
                      className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        state.result === "warning"
                          ? "bg-yellow-500 text-white shadow-sm"
                          : "border border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Warn
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCheckpoint(cp.name, "result", "fail")}
                      className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        state.result === "fail"
                          ? "bg-red-500 text-white shadow-sm"
                          : "border border-red-300 text-red-700 hover:bg-red-50"
                      }`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Fail
                    </button>
                  </div>
                </div>
                <div className="mt-2 ml-8">
                  <input
                    type="text"
                    placeholder="Notes (optional)..."
                    value={state.notes}
                    onChange={(e) => updateCheckpoint(cp.name, "notes", e.target.value)}
                    className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Details */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Additional Details</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              NFC Chip ID
            </label>
            <input
              type="text"
              placeholder="e.g. NFC-2024-XXXXX"
              value={nfcChipId}
              onChange={(e) => setNfcChipId(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Vault Location
            </label>
            <input
              type="text"
              placeholder="e.g. Shelf A3, Bin 12"
              value={vaultLocation}
              onChange={(e) => setVaultLocation(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              AI Confidence Score (0-100)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Optional"
              value={aiConfidence}
              onChange={(e) => setAiConfidence(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
            Overall Notes
          </label>
          <textarea
            rows={3}
            placeholder="Any additional observations, concerns, or notes about this authentication..."
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Decision Buttons */}
      <div className="rounded-lg border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold mb-2">Authentication Decision</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          Review all checkpoints before making a final decision. This action cannot be undone.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handleSubmit("passed")}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-500 px-6 py-3 text-sm font-semibold text-white hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Approve &amp; Vault
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("inconclusive")}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-yellow-500 px-6 py-3 text-sm font-semibold text-white hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Inconclusive
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("failed")}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-500 px-6 py-3 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
