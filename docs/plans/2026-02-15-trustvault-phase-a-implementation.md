# TrustVault Phase A: Foundation Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the foundation layer of TrustVault — Prisma models, mock Entrupy service, verification APIs, guided photo capture UI, public trust profile page, and verification badges on marketplace surfaces.

**Architecture:** New `AuthenticationCertificate` model (seller-initiated AI verification via Entrupy) lives alongside the existing `AuthenticationReport` model (admin manual authentication). A `ConditionReport` model tracks condition at listing/transfer. Trust score fields are cached on the User model. The Entrupy integration is stubbed with a mock service that returns deterministic results.

**Tech Stack:** Next.js 16 App Router, Prisma 6, TypeScript, Tailwind CSS 4, Lucide icons, NextAuth v5

**Existing key files:**
- Schema: `prisma/schema.prisma`
- Auth: `src/lib/auth.ts`, Prisma: `src/lib/prisma.ts`
- Utils: `src/lib/utils.ts`, Authentication constants: `src/lib/authentication.ts`
- Listing card: `src/components/marketplace/ListingCard.tsx`
- Sneaker detail: `src/app/sneakers/[id]/page.tsx`
- Existing certificate page: `src/app/certificate/[itemId]/page.tsx`
- Certificate API: `src/app/api/vault-items/[id]/certificate/route.ts`
- Listings API: `src/app/api/listings/route.ts`

---

## Task 1: Add Prisma Models and User Trust Fields

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add AuthenticationCertificate model to schema**

Add after the `AuthPhoto` model (line ~354):

```prisma
model AuthenticationCertificate {
  id               String    @id @default(cuid())
  vaultItemId      String
  sneakerId        String
  provider         String    @default("entrupy") // "entrupy" | "manual"
  externalCertId   String?
  confidenceScore  Int?      // 0-100
  status           String    @default("pending") // "pending" | "verified" | "needs_review" | "failed"
  imageUrls        String[]
  resultData       Json?
  verifiedAt       DateTime?
  expiresAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  vaultItem VaultItem @relation(fields: [vaultItemId], references: [id])
  sneaker   Sneaker   @relation(fields: [sneakerId], references: [id])

  @@index([vaultItemId])
  @@index([status])
}
```

**Step 2: Add ConditionReport model**

Add after AuthenticationCertificate:

```prisma
model ConditionReport {
  id          String   @id @default(cuid())
  vaultItemId String
  reporterId  String
  condition   String   // "new" | "like_new" | "excellent" | "good" | "fair"
  notes       String?
  photoUrls   String[]
  context     String   // "listing" | "transfer" | "check_in"
  createdAt   DateTime @default(now())

  vaultItem VaultItem @relation(fields: [vaultItemId], references: [id])
  reporter  User      @relation(fields: [reporterId], references: [id])

  @@index([vaultItemId])
}
```

**Step 3: Add trust score fields to User model**

Add these fields to the User model after `authPassRate`:

```prisma
  trustScore              Int?
  trustTotalVerified      Int       @default(0)
  trustDisputeRate        Float?
  trustLastCalculatedAt   DateTime?
```

**Step 4: Add relations**

Add to User model relations section:
```prisma
  conditionReports  ConditionReport[]
```

Add to VaultItem model relations section:
```prisma
  certificates       AuthenticationCertificate[]
  conditionReports   ConditionReport[]
```

Add to Sneaker model relations section:
```prisma
  certificates  AuthenticationCertificate[]
```

**Step 5: Run migration**

```bash
npx prisma db push && npx prisma generate
```

Expected: Schema synced, client generated with new models.

**Step 6: Verify**

```bash
npx prisma db push --dry-run
```

Expected: "No changes to push" — confirms schema is already synced.

**Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add AuthenticationCertificate, ConditionReport models and trust score fields"
```

---

## Task 2: Create Mock Entrupy Service

**Files:**
- Create: `src/lib/entrupy.ts`

**Step 1: Create the mock service**

```typescript
// Mock Entrupy AI authentication service
// Replace with real Entrupy API integration in Phase D

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

/**
 * Mock Entrupy verification.
 * Simulates a 2-3 second delay and returns deterministic results based on image count.
 * - 6+ images: verified (score 92-98)
 * - 4-5 images: needs_review (score 75-85)
 * - <4 images: failed (score 40-60)
 */
export async function submitForVerification(
  req: EntrupySubmitRequest
): Promise<EntrupyResult> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));

  const imageCount = req.imageUrls.length;
  const certId = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (imageCount >= 6) {
    const score = 92 + Math.floor(Math.random() * 7); // 92-98
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
    const score = 75 + Math.floor(Math.random() * 11); // 75-85
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

  const score = 40 + Math.floor(Math.random() * 21); // 40-60
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

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors related to entrupy.ts.

**Step 3: Commit**

```bash
git add src/lib/entrupy.ts
git commit -m "feat: add mock Entrupy AI authentication service"
```

---

## Task 3: Build Verification Submit API

**Files:**
- Create: `src/app/api/verify/submit/route.ts`

**Step 1: Create the submit endpoint**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitForVerification } from "@/lib/entrupy";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { vaultItemId, imageUrls } = body as {
    vaultItemId: string;
    imageUrls: string[];
  };

  if (!vaultItemId || !imageUrls?.length) {
    return NextResponse.json(
      { error: "vaultItemId and imageUrls are required" },
      { status: 400 }
    );
  }

  // Verify the user owns this vault item
  const vaultItem = await prisma.vaultItem.findUnique({
    where: { id: vaultItemId },
    include: { sneaker: true },
  });

  if (!vaultItem) {
    return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
  }

  if (vaultItem.ownerId !== session.user.id) {
    return NextResponse.json({ error: "You do not own this item" }, { status: 403 });
  }

  // Check for existing pending/verified certificate
  const existing = await prisma.authenticationCertificate.findFirst({
    where: {
      vaultItemId,
      status: { in: ["pending", "verified"] },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This item already has an active verification", certificateId: existing.id },
      { status: 409 }
    );
  }

  // Create pending certificate
  const certificate = await prisma.authenticationCertificate.create({
    data: {
      vaultItemId,
      sneakerId: vaultItem.sneakerId,
      provider: "entrupy",
      status: "pending",
      imageUrls,
    },
  });

  // Fire-and-forget: process verification asynchronously
  processVerification(certificate.id, vaultItem.sneaker, imageUrls).catch(
    (err) => console.error("Verification processing failed:", err)
  );

  return NextResponse.json(
    { certificateId: certificate.id, status: "pending" },
    { status: 201 }
  );
}

async function processVerification(
  certificateId: string,
  sneaker: { brand: string; model: string; styleCode: string | null },
  imageUrls: string[]
) {
  try {
    const result = await submitForVerification({
      imageUrls,
      brand: sneaker.brand,
      model: sneaker.model,
      styleCode: sneaker.styleCode ?? undefined,
    });

    await prisma.authenticationCertificate.update({
      where: { id: certificateId },
      data: {
        externalCertId: result.externalCertId,
        confidenceScore: result.confidenceScore,
        status: result.status,
        resultData: result.resultData,
        verifiedAt: result.status === "verified" ? new Date() : null,
      },
    });
  } catch (err) {
    console.error("Entrupy verification error:", err);
    await prisma.authenticationCertificate.update({
      where: { id: certificateId },
      data: { status: "failed" },
    });
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/api/verify/submit/route.ts
git commit -m "feat: add verification submit API with async Entrupy processing"
```

---

## Task 4: Build Verification Status API

**Files:**
- Create: `src/app/api/verify/[certificateId]/status/route.ts`

**Step 1: Create the status polling endpoint**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const { certificateId } = await params;

  const certificate = await prisma.authenticationCertificate.findUnique({
    where: { id: certificateId },
    select: {
      id: true,
      status: true,
      confidenceScore: true,
      verifiedAt: true,
      provider: true,
    },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  return NextResponse.json(certificate);
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/api/verify/[certificateId]/status/route.ts
git commit -m "feat: add verification status polling endpoint"
```

---

## Task 5: Build Public Certificate API

**Files:**
- Create: `src/app/api/verify/certificate/[certificateId]/route.ts`

**Step 1: Create the public certificate endpoint**

This is a public endpoint (no auth required) that powers the `/verify/[id]` trust profile page.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function anonymizeName(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}.${parts[parts.length - 1][0]}.`;
    return `${name[0]}.`;
  }
  return `${email[0]}.***`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const { certificateId } = await params;

  const certificate = await prisma.authenticationCertificate.findUnique({
    where: { id: certificateId },
    include: {
      sneaker: true,
      vaultItem: {
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              sellerLevel: true,
              trustScore: true,
              trustTotalVerified: true,
            },
          },
          ownershipHistory: {
            orderBy: { createdAt: "asc" },
            include: {
              fromUser: { select: { name: true, email: true } },
              toUser: { select: { name: true, email: true } },
            },
          },
          conditionReports: {
            orderBy: { createdAt: "desc" },
            include: {
              reporter: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  if (certificate.status === "pending") {
    return NextResponse.json(
      { error: "Verification is still in progress" },
      { status: 202 }
    );
  }

  const { vaultItem, sneaker } = certificate;

  return NextResponse.json({
    certificate: {
      id: certificate.id,
      provider: certificate.provider,
      externalCertId: certificate.externalCertId,
      confidenceScore: certificate.confidenceScore,
      status: certificate.status,
      imageUrls: certificate.imageUrls,
      verifiedAt: certificate.verifiedAt,
      createdAt: certificate.createdAt,
    },
    sneaker: {
      brand: sneaker.brand,
      model: sneaker.model,
      colorway: sneaker.colorway,
      styleCode: sneaker.styleCode,
      imageUrl: sneaker.imageUrl,
    },
    item: {
      id: vaultItem.id,
      size: vaultItem.size,
      condition: vaultItem.condition,
      status: vaultItem.status,
    },
    sellerTrust: {
      sellerLevel: vaultItem.owner.sellerLevel,
      trustScore: vaultItem.owner.trustScore,
      totalVerified: vaultItem.owner.trustTotalVerified,
      anonymizedName: anonymizeName(vaultItem.owner.name, vaultItem.owner.email),
    },
    ownershipHistory: vaultItem.ownershipHistory.map((record) => ({
      id: record.id,
      eventType: record.eventType,
      from: record.fromUser
        ? anonymizeName(record.fromUser.name, record.fromUser.email)
        : null,
      to: anonymizeName(record.toUser.name, record.toUser.email),
      createdAt: record.createdAt,
    })),
    conditionReports: vaultItem.conditionReports.map((cr) => ({
      id: cr.id,
      condition: cr.condition,
      notes: cr.notes,
      photoUrls: cr.photoUrls,
      context: cr.context,
      reporter: anonymizeName(cr.reporter.name, cr.reporter.email),
      createdAt: cr.createdAt,
    })),
  });
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/api/verify/certificate/[certificateId]/route.ts
git commit -m "feat: add public certificate API for trust profile page"
```

---

## Task 6: Build Condition Report API

**Files:**
- Create: `src/app/api/verify/condition-report/route.ts`

**Step 1: Create the condition report endpoint**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_CONDITIONS = ["new", "like_new", "excellent", "good", "fair"];
const VALID_CONTEXTS = ["listing", "transfer", "check_in"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { vaultItemId, condition, notes, photoUrls } = body as {
    vaultItemId: string;
    condition: string;
    notes?: string;
    photoUrls?: string[];
    context?: string;
  };

  if (!vaultItemId || !condition) {
    return NextResponse.json(
      { error: "vaultItemId and condition are required" },
      { status: 400 }
    );
  }

  if (!VALID_CONDITIONS.includes(condition)) {
    return NextResponse.json(
      { error: `condition must be one of: ${VALID_CONDITIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const context = body.context || "listing";
  if (!VALID_CONTEXTS.includes(context)) {
    return NextResponse.json(
      { error: `context must be one of: ${VALID_CONTEXTS.join(", ")}` },
      { status: 400 }
    );
  }

  // Verify the vault item exists
  const vaultItem = await prisma.vaultItem.findUnique({
    where: { id: vaultItemId },
  });

  if (!vaultItem) {
    return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
  }

  const conditionReport = await prisma.conditionReport.create({
    data: {
      vaultItemId,
      reporterId: session.user.id,
      condition,
      notes: notes || null,
      photoUrls: photoUrls || [],
      context,
    },
  });

  return NextResponse.json(conditionReport, { status: 201 });
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/api/verify/condition-report/route.ts
git commit -m "feat: add condition report submission API"
```

---

## Task 7: Build Guided Photo Capture Component

**Files:**
- Create: `src/components/verify/PhotoCaptureGuide.tsx`

**Step 1: Create the guided photo capture component**

This is a full-screen guided UI showing ghost overlays for each required angle with progress tracking.

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Check, ChevronLeft, ChevronRight, X } from "lucide-react";

const REQUIRED_ANGLES = [
  { key: "left_side", label: "Left Side", description: "Full left profile at eye level" },
  { key: "right_side", label: "Right Side", description: "Full right profile at eye level" },
  { key: "sole", label: "Sole", description: "Bottom of shoe, flat against surface" },
  { key: "tongue_tag", label: "Tongue Tag", description: "Close-up of the tongue label" },
  { key: "heel_tab", label: "Heel Tab", description: "Back of the shoe, heel area" },
  { key: "box_label", label: "Box Label", description: "Label on the shoe box" },
] as const;

export type CapturedPhotos = Record<string, string>;

interface PhotoCaptureGuideProps {
  onComplete: (photos: CapturedPhotos) => void;
  onCancel: () => void;
}

export function PhotoCaptureGuide({ onComplete, onCancel }: PhotoCaptureGuideProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhotos>({});
  const [urlInput, setUrlInput] = useState("");

  const completedCount = Object.keys(photos).length;
  const currentAngle = REQUIRED_ANGLES[currentIndex];
  const isComplete = completedCount === REQUIRED_ANGLES.length;

  function handleAddPhoto() {
    if (!urlInput.trim()) return;
    setPhotos((prev) => ({ ...prev, [currentAngle.key]: urlInput.trim() }));
    setUrlInput("");
    // Auto-advance to next unfilled angle
    if (currentIndex < REQUIRED_ANGLES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleRemovePhoto(key: string) {
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Photo {completedCount}/{REQUIRED_ANGLES.length}
          </span>
          <button
            onClick={onCancel}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${(completedCount / REQUIRED_ANGLES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Angle selector dots */}
      <div className="flex items-center justify-center gap-2">
        {REQUIRED_ANGLES.map((angle, idx) => (
          <button
            key={angle.key}
            onClick={() => setCurrentIndex(idx)}
            className={`h-3 w-3 rounded-full transition-colors ${
              idx === currentIndex
                ? "bg-[var(--accent)] scale-125"
                : photos[angle.key]
                ? "bg-green-500"
                : "bg-[var(--border)]"
            }`}
            title={angle.label}
          />
        ))}
      </div>

      {/* Current angle card */}
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <div className="aspect-[4/3] relative bg-[var(--muted)] flex items-center justify-center">
          {photos[currentAngle.key] ? (
            <Image
              src={photos[currentAngle.key]}
              alt={currentAngle.label}
              fill
              className="object-cover"
            />
          ) : (
            <div className="text-center space-y-2 p-6">
              <Camera className="h-12 w-12 text-[var(--muted-foreground)] mx-auto" />
              <p className="text-lg font-semibold">{currentAngle.label}</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {currentAngle.description}
              </p>
            </div>
          )}

          {photos[currentAngle.key] && (
            <button
              onClick={() => handleRemovePhoto(currentAngle.key)}
              className="absolute top-2 right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* URL input for adding photo */}
        {!photos[currentAngle.key] && (
          <div className="p-4 space-y-2">
            <label className="block text-xs text-[var(--muted-foreground)]">
              Image URL for {currentAngle.label}
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPhoto()}
                placeholder="https://..."
                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                onClick={handleAddPhoto}
                disabled={!urlInput.trim()}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        {isComplete ? (
          <button
            onClick={() => onComplete(photos)}
            className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors inline-flex items-center gap-2"
          >
            <Check className="h-4 w-4" /> Submit for Verification
          </button>
        ) : (
          <button
            onClick={() =>
              setCurrentIndex(Math.min(REQUIRED_ANGLES.length - 1, currentIndex + 1))
            }
            disabled={currentIndex === REQUIRED_ANGLES.length - 1}
            className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-6 gap-2">
        {REQUIRED_ANGLES.map((angle) => (
          <button
            key={angle.key}
            onClick={() => setCurrentIndex(REQUIRED_ANGLES.findIndex((a) => a.key === angle.key))}
            className={`aspect-square rounded-md border overflow-hidden relative ${
              photos[angle.key]
                ? "border-green-500"
                : "border-[var(--border)] bg-[var(--muted)]"
            }`}
          >
            {photos[angle.key] ? (
              <>
                <Image
                  src={photos[angle.key]}
                  alt={angle.label}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Camera className="h-3 w-3 text-[var(--muted-foreground)]" />
              </div>
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center py-0.5 truncate px-0.5">
              {angle.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/components/verify/PhotoCaptureGuide.tsx
git commit -m "feat: add guided photo capture component for verification"
```

---

## Task 8: Build Public Trust Profile Page

**Files:**
- Create: `src/app/verify/[id]/page.tsx`

**Step 1: Create the public trust profile page**

This is the `/verify/[id]` page that displays the Entrupy authentication certificate, ownership history, condition reports, and seller trust info. It's public — no login required. The `[id]` param is the certificate ID.

```tsx
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
    context: string;
    reporter: string;
    createdAt: string;
  }>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function conditionLabel(c: string) {
  const map: Record<string, string> = {
    new: "New",
    like_new: "Like New",
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    deadstock: "Deadstock (DS)",
    vnds: "VNDS",
  };
  return map[c] || c;
}

function ConfidenceGauge({ score }: { score: number }) {
  const radius = 70;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 90 ? "#22c55e" : score >= 70 ? "#eab308" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="180" viewBox="0 0 180 180" className="drop-shadow-lg">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx="90" cy="90" r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${progress} ${circumference}`}
          transform="rotate(-90 90 90)" style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
        <text x="90" y="82" textAnchor="middle" fontSize="32" fontWeight="bold" fill="var(--foreground)">
          {score}
        </text>
        <text x="90" y="106" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">
          Confidence Score
        </text>
      </svg>
    </div>
  );
}

function StatusBadge({ status, score }: { status: string; score: number | null }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-600">
        <ShieldCheck className="h-4 w-4" /> Verified Authentic
      </span>
    );
  }
  if (status === "needs_review") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-3 py-1 text-sm font-semibold text-yellow-600">
        <AlertTriangle className="h-4 w-4" /> Under Review {score !== null && `(${score}%)`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-500">
      <XCircle className="h-4 w-4" /> Failed
    </span>
  );
}

export default function TrustProfilePage({ params }: { params: Promise<{ id: string }> }) {
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
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [id]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Shield className="h-12 w-12 text-[var(--accent)] animate-pulse" />
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading trust profile...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Shield className="h-12 w-12 text-[var(--muted-foreground)]" />
        <p className="text-lg font-medium">Certificate Not Found</p>
        <p className="text-sm text-[var(--muted-foreground)]">
          {error || "This verification certificate does not exist."}
        </p>
      </div>
    );
  }

  const { certificate, sneaker, item, sellerTrust, ownershipHistory, conditionReports } = data;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--background) 0%, var(--muted) 50%, var(--background) 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-1.5">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                TrustVault Verified
              </span>
            </div>

            {sneaker.imageUrl && (
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-[var(--muted)] overflow-hidden shadow-lg">
                <Image src={sneaker.imageUrl} alt={`${sneaker.brand} ${sneaker.model}`} fill className="object-cover" priority />
              </div>
            )}

            <div>
              <p className="text-sm text-[var(--muted-foreground)] uppercase tracking-widest font-medium">{sneaker.brand}</p>
              <h1 className="text-3xl sm:text-4xl font-bold mt-1">{sneaker.model}</h1>
              {sneaker.colorway && <p className="text-[var(--muted-foreground)] mt-1">{sneaker.colorway}</p>}
              {sneaker.styleCode && <p className="text-sm text-[var(--muted-foreground)] font-mono mt-0.5">{sneaker.styleCode}</p>}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <StatusBadge status={certificate.status} score={certificate.confidenceScore} />
              {certificate.verifiedAt && (
                <span className="text-sm text-[var(--muted-foreground)]">
                  Verified {formatDate(certificate.verifiedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Confidence gauge */}
        {certificate.confidenceScore !== null && (
          <section className="flex flex-col items-center gap-4">
            <h2 className="text-lg font-semibold">AI Authentication Score</h2>
            <ConfidenceGauge score={certificate.confidenceScore} />
            <p className="text-xs text-[var(--muted-foreground)]">
              Powered by {certificate.provider === "entrupy" ? "Entrupy AI" : certificate.provider}
            </p>
          </section>
        )}

        {/* Verification photos */}
        {certificate.imageUrls.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Camera className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold">Verification Photos</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {certificate.imageUrls.map((url, idx) => (
                <div key={idx} className="rounded-lg border border-[var(--border)] overflow-hidden">
                  <div className="aspect-square relative bg-[var(--muted)]">
                    <Image src={url} alt={`Verification photo ${idx + 1}`} fill className="object-cover" sizes="(max-width: 640px) 50vw, 16vw" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Item details */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <FileCheck className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Item Details</h2>
          </div>
          <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">Condition</span>
              <span className="text-sm font-medium">{conditionLabel(item.condition)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">Size</span>
              <span className="text-sm font-medium">{item.size}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-[var(--muted-foreground)]">Seller</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{sellerTrust.anonymizedName}</span>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[var(--muted)] capitalize">
                  {sellerTrust.sellerLevel}
                </span>
              </div>
            </div>
            {sellerTrust.trustScore !== null && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--muted-foreground)]">Trust Score</span>
                <span className="text-sm font-medium">{sellerTrust.trustScore}/100</span>
              </div>
            )}
            {certificate.externalCertId && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[var(--muted-foreground)]">Certificate ID</span>
                <span className="text-sm font-medium font-mono">{certificate.externalCertId}</span>
              </div>
            )}
          </div>
        </section>

        {/* Chain of custody */}
        {ownershipHistory.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Clock className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold">Chain of Custody</h2>
            </div>
            <div className="relative ml-4">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border)]" />
              <div className="space-y-6">
                {ownershipHistory.map((record, idx) => (
                  <div key={record.id} className="relative flex items-start gap-4 pl-6">
                    <div className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 ${
                      idx === ownershipHistory.length - 1
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--background)]"
                    }`} />
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
                            <span className="font-medium text-[var(--foreground)]">{record.from}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                          </>
                        )}
                        <span className="font-medium text-[var(--foreground)]">{record.to}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Condition reports */}
        {conditionReports.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <FileCheck className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold">Condition Reports</h2>
            </div>
            <div className="space-y-4">
              {conditionReports.map((report) => (
                <div key={report.id} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs font-medium capitalize">
                        {conditionLabel(report.condition)}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)] capitalize">
                        {report.context.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(report.createdAt)}
                    </span>
                  </div>
                  {report.notes && (
                    <p className="text-sm text-[var(--muted-foreground)]">{report.notes}</p>
                  )}
                  {report.photoUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {report.photoUrls.map((url, idx) => (
                        <div key={idx} className="aspect-square relative rounded-md overflow-hidden bg-[var(--muted)]">
                          <Image src={url} alt={`Condition photo ${idx + 1}`} fill className="object-cover" sizes="120px" />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Reported by {report.reporter}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Share section */}
        <section>
          <div className="rounded-lg border border-[var(--border)] p-6"
            style={{ background: "linear-gradient(135deg, var(--muted) 0%, var(--background) 100%)" }}
          >
            <p className="text-sm font-semibold mb-3">Share Trust Profile</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted-foreground)] font-mono truncate">
                {typeof window !== "undefined" ? window.location.href : `/verify/${id}`}
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
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-[var(--muted-foreground)] pb-8">
          <p>Certificate ID: {certificate.id}</p>
          <p className="mt-1">Powered by SoleVault TrustVault Verification System</p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/verify/[id]/page.tsx
git commit -m "feat: add public trust profile page at /verify/[id]"
```

---

## Task 9: Add Verification Badge to Listing Cards

**Files:**
- Modify: `src/components/marketplace/ListingCard.tsx`
- Modify: `src/app/api/listings/route.ts`

**Step 1: Update the listings API to include certificate data**

Read the current listings API and add a certificate check. Add `certificates` to the VaultItem include in the Prisma query so we can check if a listing has a verified certificate.

In `src/app/api/listings/route.ts`, find the `prisma.listing.findMany` call and add to the `vaultItem.include`:

```typescript
certificates: {
  where: { status: "verified" },
  select: { id: true, confidenceScore: true },
  take: 1,
  orderBy: { verifiedAt: "desc" },
},
```

**Step 2: Update ListingCard props and UI**

In `src/components/marketplace/ListingCard.tsx`:

Add to the `vaultItem` type in the interface:

```typescript
certificates?: Array<{ id: string; confidenceScore: number | null }>;
```

Add the ShieldCheck import:

```typescript
import { ShieldCheck } from "lucide-react";
```

Add the verification badge after the condition badge in the image overlay area (after the existing `<div className="absolute top-2 right-2">` block):

```tsx
{vaultItem.certificates && vaultItem.certificates.length > 0 && (
  <div className="absolute top-2 left-2">
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
      <ShieldCheck className="h-3 w-3" />
      Verified
    </span>
  </div>
)}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/components/marketplace/ListingCard.tsx src/app/api/listings/route.ts
git commit -m "feat: add TrustVault verified badge to listing cards"
```

---

## Task 10: Add Verification Badge to Sneaker Detail Page

**Files:**
- Modify: `src/app/sneakers/[id]/page.tsx`
- Modify: `src/app/api/sneakers/[id]/route.ts`

**Step 1: Update the sneaker detail API to include certificate data**

In `src/app/api/sneakers/[id]/route.ts`, find the Prisma query for the sneaker and add certificate data to the vaultItems include:

```typescript
certificates: {
  where: { status: "verified" },
  select: { id: true, confidenceScore: true },
  take: 1,
  orderBy: { verifiedAt: "desc" },
},
```

**Step 2: Update the sneaker detail page**

In `src/app/sneakers/[id]/page.tsx`:

Add `ShieldCheck` to the lucide-react imports (it's already importing `Shield`).

Update the `activeListing` mapping to include certificate info. Where the listing rows render, update the "Verified" link that currently points to `/certificate/${l.vaultItemId}` to also show TrustVault verification when available:

After the existing `<Shield>` Verified link, add a TrustVault badge when a certificate exists:

```tsx
{/* existing: */}
<Link href={`/certificate/${l.vaultItemId}`} className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1">
  <Shield className="h-3 w-3" /> Verified
</Link>
{/* add TrustVault badge if certificate exists: */}
{l.certificateId && (
  <Link href={`/verify/${l.certificateId}`} className="text-xs text-green-600 hover:underline inline-flex items-center gap-1">
    <ShieldCheck className="h-3 w-3" /> TrustVault
  </Link>
)}
```

Update the `activeListing` flatMap to include certificate data:

```typescript
const activeListing = sneaker.vaultItems
  .flatMap((v) => v.listings.map((l) => ({
    ...l,
    vaultItemId: v.id,
    size: v.size,
    condition: v.condition,
    imageUrls: v.imageUrls,
    certificateId: v.certificates?.[0]?.id ?? null,
  })))
  .sort((a, b) => a.priceCents - b.priceCents);
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/sneakers/[id]/page.tsx src/app/api/sneakers/[id]/route.ts
git commit -m "feat: add TrustVault badge to sneaker detail page listings"
```

---

## Task 11: Add statusColor entries for new statuses

**Files:**
- Modify: `src/lib/utils.ts`

**Step 1: Add new status colors**

Add these entries to the `statusColor` function's `colors` record:

```typescript
verified: "bg-green-100 text-green-800",
needs_review: "bg-yellow-100 text-yellow-800",
```

Note: `pending` and `failed` already exist.

**Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add verified and needs_review status colors"
```

---

## Task 12: Final Build Verification

**Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors.

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors. Warnings about missing Entrupy env vars are acceptable.

**Step 3: Verify new routes exist**

Start dev server and confirm:
- `GET /api/verify/[certificateId]/status` — returns 404 for non-existent IDs
- `POST /api/verify/submit` — returns 401 without auth
- `GET /api/verify/certificate/[certificateId]` — returns 404 for non-existent IDs
- `POST /api/verify/condition-report` — returns 401 without auth
- `/verify/[id]` — renders error state for non-existent IDs

**Step 4: Final commit if any adjustments needed**

```bash
git status
```
