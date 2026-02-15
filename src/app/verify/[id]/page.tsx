"use client";

import { useState, useEffect, use, useCallback } from "react";
import Image from "next/image";
import {
  ShieldCheck,
  Shield,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
  Loader2,
  FileCheck,
  Camera,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TrustProfileData {
  certificate: {
    id: string;
    provider: string;
    externalCertId: string | null;
    confidenceScore: number | null;
    status: string;
    imageUrls: string[];
    verifiedAt: string | null;
    createdAt: string;
  };
  sneaker: {
    brand: string;
    model: string;
    colorway: string | null;
    styleCode: string | null;
    imageUrl: string | null;
  };
  item: {
    id: string;
    size: string;
    condition: string;
    status: string;
  };
  sellerTrust: {
    sellerLevel: string;
    trustScore: number | null;
    totalVerified: number;
    anonymizedName: string;
  };
  ownershipHistory: Array<{
    id: string;
    eventType: string;
    from: string | null;
    to: string;
    createdAt: string;
  }>;
  conditionReports: Array<{
    id: string;
    condition: string;
    notes: string | null;
    photoUrls: string[];
    context: string | null;
    reporter: string;
    createdAt: string;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function conditionLabel(c: string) {
  const map: Record<string, string> = {
    new: "New",
    like_new: "Like New",
    deadstock: "Deadstock (DS)",
    vnds: "Very Near Deadstock",
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
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

function sellerLevelLabel(level: string) {
  const map: Record<string, string> = {
    new: "New Seller",
    bronze: "Bronze",
    silver: "Silver",
    gold: "Gold",
    platinum: "Platinum",
  };
  return map[level] || level;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-600">
        <ShieldCheck className="h-4 w-4" />
        Verified Authentic
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-500">
        <XCircle className="h-4 w-4" />
        Failed
      </span>
    );
  }
  if (status === "needs_review") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-3 py-1 text-sm font-semibold text-yellow-600">
        <AlertTriangle className="h-4 w-4" />
        Needs Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-3 py-1 text-sm font-semibold text-yellow-600">
      <Clock className="h-4 w-4" />
      Pending
    </span>
  );
}

function ConfidenceGauge({ score }: { score: number }) {
  const radius = 70;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 90 ? "#22c55e" : score >= 70 ? "#eab308" : "#ef4444";

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
          Confidence Score
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TrustProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<TrustProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/verify/certificate/${id}`)
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
  }, [id]);

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
          {error || "This certificate does not exist or is no longer available."}
        </p>
      </div>
    );
  }

  const { certificate, sneaker, item, sellerTrust, ownershipHistory, conditionReports } = data;

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
            {/* TrustVault Verified badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-1.5">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                TrustVault Verified
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

            {/* Status badge & verification date */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <StatusBadge status={certificate.status} />
              {certificate.verifiedAt && (
                <span className="text-sm text-[var(--muted-foreground)]">
                  Verified {formatDate(certificate.verifiedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  MAIN CONTENT                                                 */}
      {/* ============================================================ */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* ----------------------------------------------------------
            CONFIDENCE GAUGE
        ---------------------------------------------------------- */}
        {certificate.confidenceScore !== null && (
          <section className="flex flex-col items-center gap-4">
            <h2 className="text-lg font-semibold">Verification Confidence</h2>
            <ConfidenceGauge score={certificate.confidenceScore} />
            {certificate.provider && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Powered by {certificate.provider}
              </p>
            )}
          </section>
        )}

        {/* ----------------------------------------------------------
            VERIFICATION PHOTOS
        ---------------------------------------------------------- */}
        {certificate.imageUrls && certificate.imageUrls.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Camera className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold">Verification Photos</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {certificate.imageUrls.map((url, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[var(--border)] overflow-hidden group"
                >
                  <div className="aspect-square relative bg-[var(--muted)]">
                    <Image
                      src={url}
                      alt={`Verification photo ${idx + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className="text-xs font-medium text-[var(--muted-foreground)]">
                      Photo {idx + 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ----------------------------------------------------------
            ITEM DETAILS
        ---------------------------------------------------------- */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <FileCheck className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Item Details</h2>
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
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">
                Seller
              </span>
              <span className="text-sm font-medium">
                {sellerTrust.anonymizedName}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">
                Seller Level
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)] capitalize">
                {sellerLevelLabel(sellerTrust.sellerLevel)}
              </span>
            </div>
            {sellerTrust.trustScore !== null && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--muted-foreground)]">
                  Trust Score
                </span>
                <span className="text-sm font-medium">{sellerTrust.trustScore}/100</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">
                Certificate ID
              </span>
              <span className="text-sm font-medium font-mono">
                {certificate.id}
              </span>
            </div>
            {certificate.externalCertId && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--muted-foreground)]">
                  External Certificate
                </span>
                <span className="text-sm font-medium font-mono">
                  {certificate.externalCertId}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ----------------------------------------------------------
            CHAIN OF CUSTODY TIMELINE
        ---------------------------------------------------------- */}
        {ownershipHistory.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Clock className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold">Chain of Custody</h2>
            </div>
            <div className="relative ml-4">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border)]" />

              <div className="space-y-6">
                {ownershipHistory.map((record, idx) => (
                  <div key={record.id} className="relative flex items-start gap-4 pl-6">
                    {/* Dot */}
                    <div
                      className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 ${
                        idx === ownershipHistory.length - 1
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
            CONDITION REPORTS
        ---------------------------------------------------------- */}
        {conditionReports.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <FileCheck className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold">Condition Reports</h2>
            </div>
            <div className="space-y-4">
              {conditionReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-3 hover:border-[var(--accent)] transition-colors"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs font-medium capitalize">
                        {conditionLabel(report.condition)}
                      </span>
                      {report.context && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {report.context}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>by {report.reporter}</span>
                      <span>{formatDate(report.createdAt)}</span>
                    </div>
                  </div>
                  {report.notes && (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {report.notes}
                    </p>
                  )}
                  {report.photoUrls && report.photoUrls.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {report.photoUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="aspect-square relative rounded-md bg-[var(--muted)] overflow-hidden"
                        >
                          <Image
                            src={url}
                            alt={`Condition photo ${idx + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 33vw, 25vw"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ----------------------------------------------------------
            SHARE SECTION
        ---------------------------------------------------------- */}
        <section>
          <div
            className="rounded-lg border border-[var(--border)] p-6 space-y-6"
            style={{
              background:
                "linear-gradient(135deg, var(--muted) 0%, var(--background) 100%)",
            }}
          >
            <div>
              <p className="text-sm font-semibold mb-3">Share Certificate</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted-foreground)] font-mono truncate">
                  {typeof window !== "undefined"
                    ? window.location.href
                    : `/verify/${id}`}
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
            Certificate ID: {certificate.id}
          </p>
          <p className="mt-1">
            Powered by SoleVault TrustVault Authentication System
          </p>
        </div>
      </div>
    </div>
  );
}
