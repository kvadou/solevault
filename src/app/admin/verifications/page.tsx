"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  ShieldCheck,
  ShieldAlert,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CertificateItem {
  id: string;
  provider: string;
  externalCertId: string | null;
  confidenceScore: number | null;
  status: string;
  imageUrls: string[];
  resultData: Record<string, unknown> | null;
  verifiedAt: string | null;
  createdAt: string;
  sneaker: {
    brand: string;
    model: string;
    colorway: string | null;
    styleCode: string | null;
    imageUrl: string | null;
  };
  vaultItem: {
    id: string;
    owner: {
      id: string;
      name: string | null;
      email: string;
      sellerLevel: string;
    };
  };
}

type FilterStatus = "needs_review" | "disputed" | "failed" | "all";

const FILTER_OPTIONS: { value: FilterStatus; label: string; icon: React.ElementType }[] = [
  { value: "needs_review", label: "Needs Review", icon: Clock },
  { value: "disputed", label: "Disputed", icon: AlertTriangle },
  { value: "failed", label: "Failed", icon: XCircle },
  { value: "all", label: "All", icon: ShieldCheck },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminVerificationsPage() {
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("needs_review");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verifications?status=${filter}`);
      if (!res.ok) throw new Error("Failed to fetch verifications");
      const data = await res.json();
      setCertificates(data.certificates);
    } catch {
      toast("Failed to load verifications", "error");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handleAction = async (certId: string, action: "approve" | "reject") => {
    setActionLoading(certId);
    try {
      const res = await fetch(`/api/admin/verifications/${certId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: reviewNotes[certId] || undefined,
        }),
      });
      if (!res.ok) throw new Error("Action failed");
      toast(
        action === "approve"
          ? "Certificate approved"
          : "Certificate rejected",
        "success"
      );
      setExpandedId(null);
      fetchCertificates();
    } catch {
      toast("Failed to process action", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <ShieldCheck className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "disputed":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case "needs_review":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <ShieldAlert className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-6 w-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold">Verification Review Queue</h1>
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors border",
              filter === opt.value
                ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--muted)]"
            )}
          >
            <opt.icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
        </div>
      )}

      {/* Empty state */}
      {!loading && certificates.length === 0 && (
        <div className="text-center py-16 text-[var(--muted-foreground)]">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No certificates match this filter.</p>
        </div>
      )}

      {/* Certificate list */}
      {!loading && certificates.length > 0 && (
        <div className="space-y-3">
          {certificates.map((cert) => {
            const isExpanded = expandedId === cert.id;
            const resultObj = cert.resultData as Record<string, unknown> | null;
            const disputeReason = resultObj?.disputeReason
              ? String(resultObj.disputeReason)
              : null;

            return (
              <div
                key={cert.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden"
              >
                {/* Card header */}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : cert.id)
                  }
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-[var(--muted)]/30 transition-colors"
                >
                  {/* Sneaker image */}
                  <div className="relative h-14 w-14 rounded-md bg-[var(--muted)] overflow-hidden shrink-0">
                    {cert.sneaker.imageUrl ? (
                      <Image
                        src={cert.sneaker.imageUrl}
                        alt={cert.sneaker.model}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ShieldAlert className="h-5 w-5 text-[var(--muted-foreground)]" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {cert.sneaker.brand} {cert.sneaker.model}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {cert.vaultItem.owner.name || cert.vaultItem.owner.email}{" "}
                      &middot; {cert.vaultItem.owner.sellerLevel}
                    </p>
                  </div>

                  {/* Status + score */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(cert.status)}
                      <span className="text-xs font-medium capitalize">
                        {cert.status.replace("_", " ")}
                      </span>
                    </div>
                    {cert.confidenceScore !== null && (
                      <span className="text-xs font-mono bg-[var(--muted)] px-2 py-0.5 rounded">
                        {cert.confidenceScore}%
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] p-4 space-y-4">
                    {/* Submitted photos */}
                    {(cert.imageUrls?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-2 text-[var(--muted-foreground)] uppercase tracking-wider">
                          Submitted Photos
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {cert.imageUrls.map((url, idx) => (
                            <div
                              key={idx}
                              className="aspect-square relative rounded-md bg-[var(--muted)] overflow-hidden"
                            >
                              <Image
                                src={url}
                                alt={`Photo ${idx + 1}`}
                                fill
                                className="object-cover"
                                sizes="100px"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dispute reason */}
                    {disputeReason && (
                      <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
                        <p className="text-xs font-semibold text-orange-700 mb-1">
                          Dispute Reason
                        </p>
                        <p className="text-sm text-orange-800">
                          {disputeReason}
                        </p>
                      </div>
                    )}

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Certificate ID
                        </span>
                        <p className="font-mono text-xs">{cert.id}</p>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          External ID
                        </span>
                        <p className="font-mono text-xs">
                          {cert.externalCertId || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Provider
                        </span>
                        <p className="text-xs">{cert.provider}</p>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Submitted
                        </span>
                        <p className="text-xs">
                          {new Date(cert.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Review actions */}
                    {(cert.status === "needs_review" ||
                      cert.status === "disputed") && (
                      <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                        <textarea
                          placeholder="Review notes (optional)"
                          value={reviewNotes[cert.id] || ""}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({
                              ...prev,
                              [cert.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(cert.id, "approve")}
                            disabled={actionLoading === cert.id}
                            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === cert.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(cert.id, "reject")}
                            disabled={actionLoading === cert.id}
                            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === cert.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
