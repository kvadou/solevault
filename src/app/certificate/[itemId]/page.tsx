"use client";

import { useState, useEffect, use, useCallback } from "react";
import Image from "next/image";
import {
  Shield,
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Package,
  ArrowRight,
  Smartphone,
  QrCode,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { AUTH_CHECKPOINTS } from "@/lib/authentication";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CertificateData {
  item: {
    id: string;
    size: string;
    condition: string;
    status: string;
    nfcChipId: string | null;
    vaultLocation: string | null;
    vaultedAt: string | null;
    createdAt: string;
  };
  sneaker: {
    brand: string;
    model: string;
    colorway: string | null;
    styleCode: string | null;
    imageUrl: string | null;
  };
  report: {
    overallResult: string;
    aiConfidenceScore: number | null;
    aiProvider: string | null;
    notes: string | null;
    createdAt: string;
    checkpoints: Array<{ name: string; result: string; notes: string | null }>;
    photos: Array<{ angle: string; imageUrl: string }>;
  };
  currentOwner: string;
  ownershipChain: Array<{
    id: string;
    eventType: string;
    from: string | null;
    to: string;
    createdAt: string;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function conditionLabel(c: string) {
  const map: Record<string, string> = {
    deadstock: "Deadstock (DS)",
    vnds: "Very Near Deadstock",
    excellent: "Excellent",
    good: "Good",
  };
  return map[c] || c;
}

function eventLabel(e: string) {
  const map: Record<string, string> = {
    vault_submission: "Submitted to Vault",
    marketplace_sale: "Sold on Marketplace",
    pack_reveal: "Won in Mystery Pack",
    redemption: "Redeemed from Vault",
  };
  return map[e] || e;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timeInVault(vaultedAt: string | null) {
  if (!vaultedAt) return "N/A";
  const diff = Date.now() - new Date(vaultedAt).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "Less than a day";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month";
  return `${months} months`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ConfidenceGauge({ score }: { score: number }) {
  const radius = 70;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 95 ? "#22c55e" : score >= 80 ? "#eab308" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg
        width="180"
        height="180"
        viewBox="0 0 180 180"
        className="drop-shadow-lg"
      >
        {/* Background circle */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          transform="rotate(-90 90 90)"
          style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
        {/* Score text */}
        <text
          x="90"
          y="82"
          textAnchor="middle"
          fontSize="32"
          fontWeight="bold"
          fill="var(--foreground)"
        >
          {score.toFixed(1)}%
        </text>
        <text
          x="90"
          y="106"
          textAnchor="middle"
          fontSize="12"
          fill="var(--muted-foreground)"
        >
          AI Confidence
        </text>
      </svg>
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  if (result === "passed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-600">
        <ShieldCheck className="h-4 w-4" />
        Authentic
      </span>
    );
  }
  if (result === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-500">
        <XCircle className="h-4 w-4" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-3 py-1 text-sm font-semibold text-yellow-600">
      <AlertTriangle className="h-4 w-4" />
      Inconclusive
    </span>
  );
}

function CheckpointCard({
  checkpoint,
}: {
  checkpoint: { name: string; result: string; notes: string | null };
}) {
  const meta = AUTH_CHECKPOINTS.find((c) => c.name === checkpoint.name);
  const label = meta?.label || checkpoint.name;
  const description = meta?.description || "";

  let icon;
  if (checkpoint.result === "pass") {
    icon = <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />;
  } else if (checkpoint.result === "fail") {
    icon = <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
  } else {
    icon = <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />;
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-2 hover:border-[var(--accent)] transition-colors">
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            {description}
          </p>
          {checkpoint.notes && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1 italic">
              {checkpoint.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CertificatePage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = use(params);
  const [data, setData] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/vault-items/${itemId}/certificate`)
      .then((r) => {
        if (!r.ok) throw new Error("Certificate not found");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [itemId]);

  const handleCopyLink = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  /* Loading state */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <div className="relative">
          <Shield className="h-12 w-12 text-[var(--accent)] animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading certificate...</span>
        </div>
      </div>
    );
  }

  /* Error state */
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Shield className="h-12 w-12 text-[var(--muted-foreground)]" />
        <p className="text-lg font-medium">Certificate Not Found</p>
        <p className="text-sm text-[var(--muted-foreground)]">
          {error || "This item does not have an authentication certificate."}
        </p>
      </div>
    );
  }

  const { item, sneaker, report, currentOwner, ownershipChain } = data;
  const passedCount = report.checkpoints.filter(
    (c) => c.result === "pass"
  ).length;
  const totalCount = report.checkpoints.length;

  return (
    <div className="min-h-screen">
      {/* ============================================================ */}
      {/*  HERO SECTION                                                 */}
      {/* ============================================================ */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--background) 0%, var(--muted) 50%, var(--background) 100%)",
        }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex flex-col items-center text-center gap-6">
            {/* Vault Verified badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-1.5">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                Vault Verified
              </span>
            </div>

            {/* Sneaker image */}
            {sneaker.imageUrl && (
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-[var(--muted)] overflow-hidden shadow-lg">
                <Image
                  src={sneaker.imageUrl}
                  alt={`${sneaker.brand} ${sneaker.model}`}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}

            {/* Title */}
            <div>
              <p className="text-sm text-[var(--muted-foreground)] uppercase tracking-widest font-medium">
                {sneaker.brand}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold mt-1">
                {sneaker.model}
              </h1>
              {sneaker.colorway && (
                <p className="text-[var(--muted-foreground)] mt-1">
                  {sneaker.colorway}
                </p>
              )}
              {sneaker.styleCode && (
                <p className="text-sm text-[var(--muted-foreground)] font-mono mt-0.5">
                  {sneaker.styleCode}
                </p>
              )}
            </div>

            {/* Result badge & score summary */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <ResultBadge result={report.overallResult} />
              <span className="text-sm text-[var(--muted-foreground)]">
                {passedCount}/{totalCount} checks passed
              </span>
              <span className="text-sm text-[var(--muted-foreground)]">
                Authenticated {formatDate(report.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  MAIN CONTENT                                                 */}
      {/* ============================================================ */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* ----------------------------------------------------------
            AI CONFIDENCE GAUGE
        ---------------------------------------------------------- */}
        {report.aiConfidenceScore !== null && (
          <section className="flex flex-col items-center gap-4">
            <h2 className="text-lg font-semibold">AI Verification Score</h2>
            <ConfidenceGauge score={report.aiConfidenceScore} />
            {report.aiProvider && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Powered by {report.aiProvider}
              </p>
            )}
          </section>
        )}

        {/* ----------------------------------------------------------
            12-POINT CHECKLIST GRID
        ---------------------------------------------------------- */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">
              {totalCount}-Point Authentication
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.checkpoints.map((cp) => (
              <CheckpointCard key={cp.name} checkpoint={cp} />
            ))}
          </div>
          {report.notes && (
            <div className="mt-4 rounded-lg bg-[var(--muted)] p-4">
              <p className="text-sm font-medium mb-1">Authenticator Notes</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {report.notes}
              </p>
            </div>
          )}
        </section>

        {/* ----------------------------------------------------------
            PHOTO GALLERY
        ---------------------------------------------------------- */}
        {report.photos.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <QrCode className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold">Photo Documentation</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {report.photos.map((photo) => {
                const angleMeta = AUTH_CHECKPOINTS.find(
                  () => false
                ); // not used for label
                void angleMeta;
                const angleLabel =
                  photo.angle
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div
                    key={photo.angle}
                    className="rounded-lg border border-[var(--border)] overflow-hidden group"
                  >
                    <div className="aspect-square relative bg-[var(--muted)]">
                      <Image
                        src={photo.imageUrl}
                        alt={angleLabel}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    </div>
                    <div className="px-3 py-2 text-center">
                      <p className="text-xs font-medium text-[var(--muted-foreground)]">
                        {angleLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ----------------------------------------------------------
            CHAIN OF CUSTODY TIMELINE
        ---------------------------------------------------------- */}
        {ownershipChain.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Clock className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold">Chain of Custody</h2>
            </div>
            <div className="relative ml-4">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border)]" />

              <div className="space-y-6">
                {ownershipChain.map((record, idx) => (
                  <div key={record.id} className="relative flex items-start gap-4 pl-6">
                    {/* Dot */}
                    <div
                      className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 ${
                        idx === ownershipChain.length - 1
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--background)]"
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs font-medium">
                          {eventLabel(record.eventType)}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {formatDate(record.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-[var(--muted-foreground)]">
                        {record.from && (
                          <>
                            <span className="font-medium text-[var(--foreground)]">
                              {record.from}
                            </span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                          </>
                        )}
                        <span className="font-medium text-[var(--foreground)]">
                          {record.to}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ----------------------------------------------------------
            VAULT DETAILS
        ---------------------------------------------------------- */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Vault Details</h2>
          </div>
          <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">
                Condition
              </span>
              <span className="text-sm font-medium">
                {conditionLabel(item.condition)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">
                Size
              </span>
              <span className="text-sm font-medium">{item.size}</span>
            </div>
            {item.vaultLocation && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--muted-foreground)]">
                  Vault Location
                </span>
                <span className="text-sm font-medium font-mono">
                  {item.vaultLocation}
                </span>
              </div>
            )}
            {item.nfcChipId && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--muted-foreground)]">
                  NFC Chip ID
                </span>
                <span className="text-sm font-medium font-mono">
                  {item.nfcChipId}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">
                Time in Vault
              </span>
              <span className="text-sm font-medium">
                {timeInVault(item.vaultedAt)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">
                Current Owner
              </span>
              <span className="text-sm font-medium">{currentOwner}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">
                Status
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)] capitalize">
                {item.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------
            NFC / SHARE SECTION
        ---------------------------------------------------------- */}
        <section>
          <div className="rounded-lg border border-[var(--border)] p-6 space-y-6"
            style={{
              background:
                "linear-gradient(135deg, var(--muted) 0%, var(--background) 100%)",
            }}
          >
            {/* NFC info */}
            {item.nfcChipId && (
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/15">
                  <Smartphone className="h-6 w-6 text-[var(--accent)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">NFC-Enabled</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Tap the shoe&apos;s NFC chip to verify authenticity instantly
                  </p>
                  <p className="text-xs font-mono text-[var(--muted-foreground)] mt-0.5">
                    Chip ID: {item.nfcChipId}
                  </p>
                </div>
              </div>
            )}

            {/* Share */}
            <div className="border-t border-[var(--border)] pt-6">
              <p className="text-sm font-semibold mb-3">Share Certificate</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted-foreground)] font-mono truncate">
                  {typeof window !== "undefined"
                    ? window.location.href
                    : `/certificate/${itemId}`}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-[var(--muted-foreground)] pb-8">
          <p>
            Certificate ID: {item.id}
          </p>
          <p className="mt-1">
            Powered by SoleVault TrustVault Authentication System
          </p>
        </div>
      </div>
    </div>
  );
}
