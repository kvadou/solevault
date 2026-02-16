"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  ShieldCheck,
  TrendingUp,
  Clock,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StatsData {
  mode: "live" | "mock";
  statusCounts: { status: string; count: number }[];
  monthlyTrend: {
    month: string;
    total: number;
    verified: number;
    failed: number;
    needs_review: number;
    disputed: number;
  }[];
  avgConfidenceScore: number;
  passRate: number;
  totalSubmissions: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    verified: "Verified",
    failed: "Failed",
    needs_review: "Needs Review",
    disputed: "Disputed",
    pending: "Pending",
  };
  return labels[status] || status;
}

function statusColorClass(status: string): string {
  const colors: Record<string, string> = {
    verified: "bg-green-500",
    failed: "bg-red-500",
    needs_review: "bg-yellow-500",
    disputed: "bg-orange-500",
    pending: "bg-gray-400",
  };
  return colors[status] || "bg-gray-400";
}

function statusIcon(status: string) {
  switch (status) {
    case "verified":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "needs_review":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "disputed":
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

function formatMonth(yyyymm: string): string {
  const [year, month] = yyyymm.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function VerificationAnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/verification-stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch stats");
        return r.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-20 text-[var(--muted-foreground)]">
        <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">{error || "Failed to load analytics."}</p>
      </div>
    );
  }

  const pendingReview =
    stats.statusCounts.find((s) => s.status === "needs_review")?.count ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/verifications"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Queue
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <BarChart3 className="h-6 w-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold">Verification Analytics</h1>
      </div>
      <p className="text-sm text-[var(--muted-foreground)] mb-8">
        Entrupy mode:{" "}
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
            stats.mode === "live"
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          )}
        >
          {stats.mode === "live" ? "Live" : "Mock"}
        </span>
      </p>

      {/* ============================================================ */}
      {/*  SUMMARY CARDS                                                */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {/* Total submissions */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Total Submissions
            </span>
          </div>
          <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
        </div>

        {/* Pass rate */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Pass Rate
            </span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.passRate}%</p>
        </div>

        {/* Avg confidence */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Avg Confidence
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {stats.avgConfidenceScore}%
          </p>
        </div>

        {/* Pending review */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Pending Review
            </span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{pendingReview}</p>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  STATUS BREAKDOWN                                             */}
      {/* ============================================================ */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">Status Breakdown</h2>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5 space-y-4">
          {stats.statusCounts.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No verification data yet.
            </p>
          ) : (
            stats.statusCounts.map((s) => {
              const pct =
                stats.totalSubmissions > 0
                  ? Math.round((s.count / stats.totalSubmissions) * 100)
                  : 0;
              return (
                <div key={s.status} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {statusIcon(s.status)}
                      <span className="text-sm font-medium">
                        {statusLabel(s.status)}
                      </span>
                    </div>
                    <span className="text-sm text-[var(--muted-foreground)]">
                      {s.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        statusColorClass(s.status)
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  MONTHLY TREND                                                */}
      {/* ============================================================ */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Monthly Trend</h2>
        {stats.monthlyTrend.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-5">
            <p className="text-sm text-[var(--muted-foreground)]">
              No monthly data available yet.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--muted)]">
                    <th className="text-left px-4 py-3 font-semibold">Month</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-green-600">
                      Verified
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-red-500">
                      Failed
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-yellow-600">
                      Review
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-orange-600">
                      Disputed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {stats.monthlyTrend.map((row) => (
                    <tr
                      key={row.month}
                      className="hover:bg-[var(--muted)]/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        {formatMonth(row.month)}
                      </td>
                      <td className="px-4 py-3 text-right">{row.total}</td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {row.verified}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500">
                        {row.failed}
                      </td>
                      <td className="px-4 py-3 text-right text-yellow-600">
                        {row.needs_review}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-600">
                        {row.disputed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
