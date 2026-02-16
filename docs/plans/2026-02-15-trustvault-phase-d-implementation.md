# TrustVault Phase D: Entrupy Live Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the mock Entrupy service with a production-ready client that supports both mock and live modes, add webhook handling for async results, build an admin review queue for "needs_review" items, a dispute flow for failed verifications, and an analytics dashboard for auth metrics.

**Architecture:** The Entrupy client (`src/lib/entrupy.ts`) becomes environment-aware — when `ENTRUPY_API_KEY` is set, it calls the real API; otherwise it uses the existing mock. The webhook endpoint handles Entrupy's async result callbacks to update certificates. Admin pages provide review queue and analytics views under the existing `/admin` layout. Sellers can dispute failed verifications, which appear in the admin review queue alongside needs_review items.

**Tech Stack:** Next.js 16 App Router, Prisma 6, TypeScript, Tailwind CSS 4, Lucide icons, Stripe (existing)

**Key existing files:**
- Mock service: `src/lib/entrupy.ts`
- Submit API: `src/app/api/verify/submit/route.ts`
- Status API: `src/app/api/verify/[certificateId]/status/route.ts`
- Certificate API: `src/app/api/verify/certificate/[certificateId]/route.ts`
- Webhooks: `src/app/api/webhooks/route.ts`
- Admin layout: `src/app/admin/layout.tsx`
- Admin dashboard: `src/app/admin/page.tsx`
- Admin stats API: `src/app/api/admin/stats/route.ts`

---

## Task 1: Production-Ready Entrupy Client

**Files:**
- Modify: `src/lib/entrupy.ts`

**Step 1: Rewrite the Entrupy client to support both mock and live modes**

Replace the entire file. The live client calls the Entrupy API when `ENTRUPY_API_KEY` is set; otherwise falls back to the existing mock behavior.

```typescript
import type { Prisma } from "@prisma/client";

export interface EntrupySubmitRequest {
  imageUrls: string[];
  brand: string;
  model: string;
  styleCode?: string;
}

export interface EntrupyResult {
  externalCertId: string;
  confidenceScore: number;
  status: "verified" | "needs_review" | "failed";
  resultData: Record<string, unknown>;
}

const ENTRUPY_API_KEY = process.env.ENTRUPY_API_KEY;
const ENTRUPY_BASE_URL = process.env.ENTRUPY_BASE_URL || "https://api.entrupy.com/v1";

function isLiveMode(): boolean {
  return !!ENTRUPY_API_KEY;
}

/**
 * Submit item for verification.
 * Live mode: calls real Entrupy API and returns job reference.
 * Mock mode: simulates delay and returns deterministic results based on image count.
 */
export async function submitForVerification(
  req: EntrupySubmitRequest
): Promise<EntrupyResult> {
  if (isLiveMode()) {
    return submitLive(req);
  }
  return submitMock(req);
}

/**
 * Returns whether the system is using the live Entrupy API.
 */
export function getEntrupyMode(): "live" | "mock" {
  return isLiveMode() ? "live" : "mock";
}

// ── Live implementation ──────────────────────────────────────────────

async function submitLive(req: EntrupySubmitRequest): Promise<EntrupyResult> {
  const response = await fetch(`${ENTRUPY_BASE_URL}/authentications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENTRUPY_API_KEY}`,
    },
    body: JSON.stringify({
      images: req.imageUrls,
      brand: req.brand,
      model: req.model,
      style_code: req.styleCode,
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/entrupy`,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Entrupy API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  // Entrupy may return immediately (synchronous) or return a job_id (async).
  // If async, we return a pending result — the webhook will update the certificate.
  if (data.status === "processing" || data.job_id) {
    return {
      externalCertId: data.job_id || data.id,
      confidenceScore: 0,
      status: "needs_review", // Will be updated by webhook
      resultData: {
        provider: "entrupy",
        mode: "async",
        jobId: data.job_id || data.id,
        submittedAt: new Date().toISOString(),
      },
    };
  }

  // Synchronous result
  return parseEntrupyResponse(data);
}

/**
 * Parse a completed Entrupy API response into our standard format.
 */
export function parseEntrupyResponse(data: Record<string, unknown>): EntrupyResult {
  const score = typeof data.confidence_score === "number" ? data.confidence_score : 0;
  const certId = (data.certificate_id || data.id || "") as string;

  let status: EntrupyResult["status"];
  if (score >= 90) {
    status = "verified";
  } else if (score >= 70) {
    status = "needs_review";
  } else {
    status = "failed";
  }

  return {
    externalCertId: certId,
    confidenceScore: score,
    status,
    resultData: {
      provider: "entrupy",
      mode: "live",
      ...data,
    },
  };
}

// ── Mock implementation ──────────────────────────────────────────────

async function submitMock(req: EntrupySubmitRequest): Promise<EntrupyResult> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));

  const imageCount = req.imageUrls.length;
  const certId = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (imageCount >= 6) {
    const score = 92 + Math.floor(Math.random() * 7);
    return {
      externalCertId: certId,
      confidenceScore: score,
      status: "verified",
      resultData: {
        provider: "entrupy-mock",
        imageCount,
        brand: req.brand,
        model: req.model,
        analysisTimestamp: new Date().toISOString(),
      },
    };
  }

  if (imageCount >= 4) {
    const score = 75 + Math.floor(Math.random() * 11);
    return {
      externalCertId: certId,
      confidenceScore: score,
      status: "needs_review",
      resultData: {
        provider: "entrupy-mock",
        imageCount,
        reason: "Insufficient angles for high-confidence result",
        brand: req.brand,
        model: req.model,
        analysisTimestamp: new Date().toISOString(),
      },
    };
  }

  const score = 40 + Math.floor(Math.random() * 21);
  return {
    externalCertId: certId,
    confidenceScore: score,
    status: "failed",
    resultData: {
      provider: "entrupy-mock",
      imageCount,
      reason: "Too few images for reliable authentication",
      brand: req.brand,
      model: req.model,
      analysisTimestamp: new Date().toISOString(),
    },
  };
}
```

**Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/lib/entrupy.ts
git commit -m "feat: make Entrupy client production-ready with live/mock modes"
```

---

## Task 2: Entrupy Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/entrupy/route.ts`

**Step 1: Create the Entrupy webhook endpoint**

This endpoint receives async verification results from Entrupy and updates the certificate record.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEntrupyResponse } from "@/lib/entrupy";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

const ENTRUPY_WEBHOOK_SECRET = process.env.ENTRUPY_WEBHOOK_SECRET;

function verifySignature(body: string, signature: string | null): boolean {
  if (!ENTRUPY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto
    .createHmac("sha256", ENTRUPY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: Request) {
  const body = await req.text();

  // Verify webhook signature in production
  if (ENTRUPY_WEBHOOK_SECRET) {
    const signature = req.headers.get("x-entrupy-signature");
    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(body);
    const jobId = payload.job_id || payload.id;

    if (!jobId) {
      return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
    }

    // Find the certificate by externalCertId (which stores the job_id)
    const certificate = await prisma.authenticationCertificate.findFirst({
      where: { externalCertId: jobId },
    });

    if (!certificate) {
      // Could be a stale webhook or test — log and return OK
      console.warn(`Entrupy webhook: no certificate found for job ${jobId}`);
      return NextResponse.json({ received: true });
    }

    // Parse the Entrupy result
    const result = parseEntrupyResponse(payload);

    // Update the certificate with the final result
    await prisma.authenticationCertificate.update({
      where: { id: certificate.id },
      data: {
        confidenceScore: result.confidenceScore,
        status: result.status,
        resultData: result.resultData as Prisma.InputJsonValue,
        verifiedAt: result.status === "verified" ? new Date() : null,
      },
    });

    return NextResponse.json({ received: true, certificateId: certificate.id });
  } catch (err) {
    console.error("Entrupy webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
```

**Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/webhooks/entrupy/route.ts
git commit -m "feat: add Entrupy webhook handler for async verification results"
```

---

## Task 3: Admin Review Queue for Needs-Review and Disputed Items

**Files:**
- Create: `src/app/api/admin/verifications/route.ts`
- Create: `src/app/api/admin/verifications/[id]/route.ts`
- Create: `src/app/admin/verifications/page.tsx`
- Modify: `src/app/admin/layout.tsx` (add nav item)

**Step 1: Create the admin verifications list API**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") || "needs_review";

  const certificates = await prisma.authenticationCertificate.findMany({
    where: {
      status: statusFilter === "all"
        ? { in: ["needs_review", "failed", "disputed"] }
        : statusFilter,
    },
    include: {
      vaultItem: {
        include: {
          sneaker: { select: { brand: true, model: true, imageUrl: true, styleCode: true } },
          owner: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(certificates);
}
```

**Step 2: Create the admin verification action API**

This endpoint lets admins approve, reject, or override verification results.

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, notes } = body as { action: "approve" | "reject"; notes?: string };

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const certificate = await prisma.authenticationCertificate.findUnique({
    where: { id },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  const updatedData: Record<string, unknown> = {};

  if (action === "approve") {
    updatedData.status = "verified";
    updatedData.confidenceScore = certificate.confidenceScore || 90;
    updatedData.verifiedAt = new Date();
  } else {
    updatedData.status = "failed";
  }

  // Store admin review notes in resultData
  const existingResultData = (certificate.resultData as Record<string, unknown>) || {};
  updatedData.resultData = {
    ...existingResultData,
    adminReview: {
      action,
      notes: notes || null,
      reviewedBy: session.user?.id,
      reviewedAt: new Date().toISOString(),
    },
  };

  const updated = await prisma.authenticationCertificate.update({
    where: { id },
    data: updatedData,
  });

  return NextResponse.json(updated);
}
```

**Step 3: Create the admin verifications page**

```tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, ShieldCheck, ShieldAlert, AlertTriangle, Check, X, Eye } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface Certificate {
  id: string;
  status: string;
  confidenceScore: number | null;
  imageUrls: string[];
  createdAt: string;
  externalCertId: string | null;
  resultData: Record<string, unknown> | null;
  vaultItem: {
    id: string;
    size: string;
    condition: string;
    sneaker: { brand: string; model: string; imageUrl: string | null; styleCode: string | null };
    owner: { id: string; name: string | null; email: string | null };
  };
}

export default function AdminVerificationsPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("needs_review");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/verifications?status=${filter}`)
      .then((r) => r.json())
      .then((data) => {
        setCertificates(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast("Failed to load verifications", "error");
      });
  }, [filter]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionLoading(true);
    const res = await fetch(`/api/admin/verifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes: reviewNotes }),
    });

    if (res.ok) {
      setCertificates((prev) => prev.filter((c) => c.id !== id));
      setReviewingId(null);
      setReviewNotes("");
      toast(`Verification ${action === "approve" ? "approved" : "rejected"}`, "success");
    } else {
      toast("Action failed", "error");
    }
    setActionLoading(false);
  }

  const statusIcon = (status: string) => {
    if (status === "needs_review") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (status === "disputed") return <ShieldAlert className="h-4 w-4 text-red-500" />;
    return <ShieldCheck className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Verification Review Queue</h1>
        <div className="flex gap-2">
          {["needs_review", "disputed", "failed", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
              }`}
            >
              {f === "all" ? "All" : f.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted-foreground)]">
          <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No items to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <div key={cert.id} className="rounded-lg border border-[var(--border)] p-4">
              <div className="flex items-start gap-4">
                {/* Sneaker image */}
                <div className="relative h-20 w-20 rounded-md bg-[var(--muted)] overflow-hidden shrink-0">
                  {cert.vaultItem.sneaker.imageUrl && (
                    <Image src={cert.vaultItem.sneaker.imageUrl} alt="" fill className="object-cover" sizes="80px" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {statusIcon(cert.status)}
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                      {cert.status.replace("_", " ")}
                    </span>
                    {cert.confidenceScore !== null && (
                      <span className="text-xs font-mono bg-[var(--muted)] px-2 py-0.5 rounded">
                        Score: {cert.confidenceScore}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold mt-1">
                    {cert.vaultItem.sneaker.brand} {cert.vaultItem.sneaker.model}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Size {cert.vaultItem.size} · {cert.vaultItem.condition} ·
                    Seller: {cert.vaultItem.owner.name || cert.vaultItem.owner.email}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Submitted {new Date(cert.createdAt).toLocaleDateString()}
                    {cert.externalCertId && ` · Cert: ${cert.externalCertId}`}
                  </p>

                  {/* Submitted photos */}
                  {cert.imageUrls.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {cert.imageUrls.slice(0, 6).map((url, i) => (
                        <div key={i} className="relative h-12 w-12 rounded bg-[var(--muted)] overflow-hidden">
                          <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="48px" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dispute reason if present */}
                  {cert.resultData && (cert.resultData as Record<string, unknown>).disputeReason && (
                    <div className="mt-2 rounded bg-red-50 border border-red-200 p-2">
                      <p className="text-xs text-red-700">
                        <strong>Dispute reason:</strong>{" "}
                        {String((cert.resultData as Record<string, unknown>).disputeReason)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <a
                    href={`/verify/${cert.id}`}
                    target="_blank"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                    title="View trust profile"
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => setReviewingId(reviewingId === cert.id ? null : cert.id)}
                    className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    Review
                  </button>
                </div>
              </div>

              {/* Expanded review panel */}
              {reviewingId === cert.id && (
                <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
                  <div>
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Admin Notes</label>
                    <input
                      type="text"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Optional notes about this decision"
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(cert.id, "approve")}
                      disabled={actionLoading}
                      className="flex items-center gap-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(cert.id, "reject")}
                      disabled={actionLoading}
                      className="flex items-center gap-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Add nav item to admin layout**

In `src/app/admin/layout.tsx`, add to the NAV_ITEMS array:

```typescript
{ href: "/admin/verifications", label: "Verifications", icon: ShieldCheck },
```

Import `ShieldCheck` from lucide-react (add to existing import).

**Step 5: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/admin/verifications/route.ts "src/app/api/admin/verifications/[id]/route.ts" src/app/admin/verifications/page.tsx src/app/admin/layout.tsx
git commit -m "feat: add admin verification review queue with approve/reject actions"
```

---

## Task 4: Dispute Flow for Failed Verifications

**Files:**
- Create: `src/app/api/verify/dispute/route.ts`
- Modify: `src/app/verify/[id]/page.tsx` (add dispute button for failed results)

**Step 1: Create the dispute API**

Sellers can dispute a failed verification, which changes status to "disputed" and adds it to the admin review queue.

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { certificateId, reason } = body as { certificateId: string; reason: string };

    if (!certificateId || !reason?.trim()) {
      return NextResponse.json(
        { error: "certificateId and reason are required" },
        { status: 400 }
      );
    }

    const certificate = await prisma.authenticationCertificate.findUnique({
      where: { id: certificateId },
      include: { vaultItem: { select: { ownerId: true } } },
    });

    if (!certificate) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }

    // Only the item owner can dispute
    if (certificate.vaultItem.ownerId !== session.user.id) {
      return NextResponse.json({ error: "You do not own this item" }, { status: 403 });
    }

    // Can only dispute failed verifications
    if (certificate.status !== "failed") {
      return NextResponse.json(
        { error: "Only failed verifications can be disputed" },
        { status: 400 }
      );
    }

    const existingResultData = (certificate.resultData as Record<string, unknown>) || {};

    const updated = await prisma.authenticationCertificate.update({
      where: { id: certificateId },
      data: {
        status: "disputed",
        resultData: {
          ...existingResultData,
          disputeReason: reason.trim(),
          disputedBy: session.user.id,
          disputedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, certificate: updated }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Dispute submission failed" }, { status: 500 });
  }
}
```

**Step 2: Add dispute button to the trust profile page**

In `src/app/verify/[id]/page.tsx`, add a dispute section that appears when the certificate status is "failed" and the viewer is the item owner. This needs:

1. A "Dispute This Result" button below the status badge area
2. When clicked, show a text input for the dispute reason and a submit button
3. On submit, call POST `/api/verify/dispute` with certificateId and reason
4. On success, update the displayed status to "disputed" and show a toast

The dispute UI should be a collapsible section — hidden by default, shown on button click. Use state variables: `showDispute`, `disputeReason`, `disputeLoading`.

Add this after the status badge/confidence section, only when `data.certificate.status === "failed"`:

```tsx
{/* Dispute section - only for failed certs owned by current user */}
{data.certificate.status === "failed" && session?.user?.id === data.certificate.ownerId && (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
    {!showDispute ? (
      <button
        onClick={() => setShowDispute(true)}
        className="text-sm font-medium text-red-700 hover:text-red-900 transition-colors"
      >
        Dispute this result
      </button>
    ) : (
      <>
        <p className="text-sm text-red-700">
          Explain why you believe this result is incorrect. An admin will review your dispute.
        </p>
        <input
          type="text"
          value={disputeReason}
          onChange={(e) => setDisputeReason(e.target.value)}
          placeholder="Reason for dispute"
          className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <div className="flex gap-2">
          <button
            onClick={handleDispute}
            disabled={disputeLoading || !disputeReason.trim()}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {disputeLoading ? "Submitting..." : "Submit Dispute"}
          </button>
          <button
            onClick={() => { setShowDispute(false); setDisputeReason(""); }}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </>
    )}
  </div>
)}
```

The `handleDispute` function:
```typescript
async function handleDispute() {
  setDisputeLoading(true);
  const res = await fetch("/api/verify/dispute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ certificateId: data.certificate.id, reason: disputeReason }),
  });
  if (res.ok) {
    toast("Dispute submitted. An admin will review it.", "success");
    setData((prev) => prev ? { ...prev, certificate: { ...prev.certificate, status: "disputed" } } : prev);
    setShowDispute(false);
  } else {
    const err = await res.json();
    toast(err.error || "Failed to submit dispute", "error");
  }
  setDisputeLoading(false);
}
```

Note: The trust profile page needs to know the current user's session to show the dispute button. Add `useSession` from next-auth/react if not already present, and pass the current user's ID into the owner check. Also need to return the `ownerId` from the certificate API.

**Step 3: Update certificate API to include ownerId**

In `src/app/api/verify/certificate/[certificateId]/route.ts`, ensure the response includes `certificate.ownerId` (from `vaultItem.ownerId`) so the trust profile page can check ownership for the dispute button.

**Step 4: Add "disputed" to statusColor in utils**

In `src/lib/utils.ts`, add to the `statusColor` function:
```typescript
disputed: "bg-orange-100 text-orange-700",
```

**Step 5: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/verify/dispute/route.ts "src/app/verify/[id]/page.tsx" "src/app/api/verify/certificate/[certificateId]/route.ts" src/lib/utils.ts
git commit -m "feat: add dispute flow for failed verifications"
```

---

## Task 5: Authentication Analytics Dashboard

**Files:**
- Create: `src/app/api/admin/verification-stats/route.ts`
- Create: `src/app/admin/verifications/analytics/page.tsx`

**Step 1: Create the verification stats API**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntrupyMode } from "@/lib/entrupy";

export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Overall counts by status
  const statusCounts = await prisma.authenticationCertificate.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  // Monthly submission trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentCerts = await prisma.authenticationCertificate.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true, status: true, confidenceScore: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by month
  const monthlyData: Record<string, { total: number; verified: number; failed: number; needsReview: number }> = {};
  for (const cert of recentCerts) {
    const key = cert.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyData[key]) {
      monthlyData[key] = { total: 0, verified: 0, failed: 0, needsReview: 0 };
    }
    monthlyData[key].total++;
    if (cert.status === "verified") monthlyData[key].verified++;
    if (cert.status === "failed") monthlyData[key].failed++;
    if (cert.status === "needs_review" || cert.status === "disputed") monthlyData[key].needsReview++;
  }

  // Average confidence score
  const scores = recentCerts
    .map((c) => c.confidenceScore)
    .filter((s): s is number => s !== null);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // Pass rate (verified / total non-pending)
  const totalCompleted = recentCerts.filter((c) => c.status !== "pending").length;
  const totalVerified = recentCerts.filter((c) => c.status === "verified").length;
  const passRate = totalCompleted > 0 ? Math.round((totalVerified / totalCompleted) * 100) : 0;

  return NextResponse.json({
    mode: getEntrupyMode(),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id])),
    monthlyTrend: Object.entries(monthlyData).map(([month, data]) => ({ month, ...data })),
    avgConfidenceScore: avgScore,
    passRate,
    totalSubmissions: recentCerts.length,
  });
}
```

**Step 2: Create the analytics page**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Loader2, ShieldCheck, ShieldAlert, AlertTriangle, TrendingUp, BarChart3, Activity } from "lucide-react";

interface AnalyticsData {
  mode: "live" | "mock";
  statusCounts: Record<string, number>;
  monthlyTrend: Array<{ month: string; total: number; verified: number; failed: number; needsReview: number }>;
  avgConfidenceScore: number;
  passRate: number;
  totalSubmissions: number;
}

export default function VerificationAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/verification-stats")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalAll = Object.values(data.statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Verification Analytics</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          data.mode === "live"
            ? "bg-green-100 text-green-700"
            : "bg-yellow-100 text-yellow-700"
        }`}>
          {data.mode === "live" ? "Live Entrupy" : "Mock Mode"}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-[var(--border)] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Total Submissions</span>
            <BarChart3 className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold mt-2">{totalAll}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Pass Rate</span>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold mt-2">{data.passRate}%</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Avg Confidence</span>
            <Activity className="h-5 w-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold mt-2">{data.avgConfidenceScore}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--muted-foreground)]">Pending Review</span>
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold mt-2">
            {(data.statusCounts.needs_review || 0) + (data.statusCounts.disputed || 0)}
          </p>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="rounded-lg border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold mb-4">Status Breakdown</h2>
        <div className="space-y-3">
          {[
            { key: "verified", label: "Verified", color: "bg-green-500", icon: ShieldCheck },
            { key: "needs_review", label: "Needs Review", color: "bg-yellow-500", icon: AlertTriangle },
            { key: "failed", label: "Failed", color: "bg-red-500", icon: ShieldAlert },
            { key: "disputed", label: "Disputed", color: "bg-orange-500", icon: ShieldAlert },
            { key: "pending", label: "Pending", color: "bg-blue-500", icon: Loader2 },
          ].map(({ key, label, color, icon: Icon }) => {
            const count = data.statusCounts[key] || 0;
            const pct = totalAll > 0 ? Math.round((count / totalAll) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
                <span className="text-sm w-28">{label}</span>
                <div className="flex-1 h-4 rounded-full bg-[var(--muted)] overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-mono w-16 text-right">{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly trend */}
      {data.monthlyTrend.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly Trend</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 text-[var(--muted-foreground)] font-medium">Month</th>
                  <th className="text-right py-2 text-[var(--muted-foreground)] font-medium">Total</th>
                  <th className="text-right py-2 text-green-600 font-medium">Verified</th>
                  <th className="text-right py-2 text-yellow-600 font-medium">Review</th>
                  <th className="text-right py-2 text-red-600 font-medium">Failed</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyTrend.map((row) => (
                  <tr key={row.month} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 font-medium">{row.month}</td>
                    <td className="py-2 text-right">{row.total}</td>
                    <td className="py-2 text-right text-green-600">{row.verified}</td>
                    <td className="py-2 text-right text-yellow-600">{row.needsReview}</td>
                    <td className="py-2 text-right text-red-600">{row.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/admin/verification-stats/route.ts src/app/admin/verifications/analytics/page.tsx
git commit -m "feat: add verification analytics dashboard for admin"
```

---

## Task 6: Final Build Verification

**Step 1: Run TypeScript check and build**

```bash
npx tsc --noEmit --pretty
npm run build
```

**Step 2: Verify routes**

Confirm these new routes appear:
- `/api/webhooks/entrupy`
- `/api/admin/verifications`
- `/api/admin/verifications/[id]`
- `/api/admin/verification-stats`
- `/api/verify/dispute`
- `/admin/verifications`
- `/admin/verifications/analytics`
