# TrustVault Phase B: Intelligence Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build trust scoring — calculation logic, public API, seller trust widget on vault dashboard, condition report integration into listing flow, trust score enforcement, and trust display on marketplace surfaces.

**Architecture:** Trust score is a 5-factor weighted composite (0-100) cached on the User model and recalculated via a Vercel Cron endpoint. Condition reports are prompted during listing creation. Low trust scores trigger restrictions (listing limits, warning banners). Trust data surfaces on the vault dashboard, listing cards, and a new public seller trust profile page.

**Tech Stack:** Next.js 16 App Router, Prisma 6, TypeScript, Tailwind CSS 4, Lucide icons, Vercel Cron

**Key existing files:**
- Schema: `prisma/schema.prisma` (User has trustScore, trustTotalVerified, trustDisputeRate, trustLastCalculatedAt)
- Seller levels: `src/lib/seller-levels.ts`
- Vault page: `src/app/vault/page.tsx` (seller level widget at line 247-292)
- Orders API: `src/app/api/orders/route.ts` (ownership transfer + seller level update)
- Listings API: `src/app/api/listings/route.ts`
- ListingCard: `src/components/marketplace/ListingCard.tsx`
- SellerBadge: `src/components/ui/SellerBadge.tsx`
- Condition report API: `src/app/api/verify/condition-report/route.ts` (already built in Phase A)

---

## Task 1: Build Trust Score Calculation Logic

**Files:**
- Create: `src/lib/trust-score.ts`

**Step 1: Create the trust score module**

```typescript
import { prisma } from "@/lib/prisma";

/**
 * Trust Score: 5-factor weighted composite (0-100)
 *
 * | Factor              | Weight | Calculation                                                |
 * |---------------------|--------|------------------------------------------------------------|
 * | Auth pass rate      | 35%    | (certificates scoring 90+) / (total submitted) × 100      |
 * | Transaction history | 25%    | (completed sales without disputes) / (total sales) × 100  |
 * | Condition accuracy  | 20%    | Placeholder — always 100 until buyer condition reports exist|
 * | Response time       | 10%    | Ship within 24h=100, 48h=75, 72h=50, 72h+=25             |
 * | Account age         | 10%    | Log scale: 30d=40, 90d=60, 180d=80, 365d+=100            |
 */

interface TrustScoreBreakdown {
  authPassRate: number;
  transactionScore: number;
  conditionAccuracy: number;
  responseTime: number;
  accountAge: number;
  totalScore: number;
}

export async function calculateTrustScore(userId: string): Promise<TrustScoreBreakdown> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      totalSales: true,
    },
  });

  if (!user) throw new Error(`User ${userId} not found`);

  // Factor 1: Auth pass rate (35%)
  const certificates = await prisma.authenticationCertificate.findMany({
    where: {
      vaultItem: { ownerId: userId },
      status: { in: ["verified", "needs_review", "failed"] },
    },
    select: { confidenceScore: true },
  });

  let authPassRate = 100; // Default for users with no submissions
  if (certificates.length > 0) {
    const passed = certificates.filter((c) => c.confidenceScore !== null && c.confidenceScore >= 90).length;
    authPassRate = Math.round((passed / certificates.length) * 100);
  }

  // Factor 2: Transaction history (25%)
  const totalOrders = await prisma.order.count({
    where: { sellerId: userId, status: "completed" },
  });
  // For now, all completed orders count as non-disputed (no dispute model yet)
  const transactionScore = totalOrders > 0 ? 100 : (user.totalSales > 0 ? 100 : 50);

  // Factor 3: Condition accuracy (20%)
  // Placeholder — requires buyer-side condition confirmation to compare
  const conditionAccuracy = 100;

  // Factor 4: Response time (10%)
  // Placeholder — requires shipping tracking data
  // Default to 75 (48h equivalent) for active sellers, 50 for new
  const responseTime = user.totalSales > 0 ? 75 : 50;

  // Factor 5: Account age (10%)
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  let accountAge: number;
  if (daysSinceCreation >= 365) accountAge = 100;
  else if (daysSinceCreation >= 180) accountAge = 80;
  else if (daysSinceCreation >= 90) accountAge = 60;
  else if (daysSinceCreation >= 30) accountAge = 40;
  else accountAge = 20;

  // Weighted sum
  const totalScore = Math.round(
    authPassRate * 0.35 +
    transactionScore * 0.25 +
    conditionAccuracy * 0.20 +
    responseTime * 0.10 +
    accountAge * 0.10
  );

  return {
    authPassRate,
    transactionScore,
    conditionAccuracy,
    responseTime,
    accountAge,
    totalScore: Math.min(100, Math.max(0, totalScore)),
  };
}

export async function updateUserTrustScore(userId: string): Promise<number> {
  const breakdown = await calculateTrustScore(userId);

  const certificates = await prisma.authenticationCertificate.count({
    where: {
      vaultItem: { ownerId: userId },
      status: "verified",
    },
  });

  const totalSubmitted = await prisma.authenticationCertificate.count({
    where: {
      vaultItem: { ownerId: userId },
      status: { in: ["verified", "needs_review", "failed"] },
    },
  });

  const disputeRate = 0; // Placeholder until dispute model exists

  await prisma.user.update({
    where: { id: userId },
    data: {
      trustScore: breakdown.totalScore,
      trustTotalVerified: certificates,
      trustDisputeRate: disputeRate,
      authPassRate: totalSubmitted > 0 ? breakdown.authPassRate : null,
      trustLastCalculatedAt: new Date(),
    },
  });

  return breakdown.totalScore;
}

/**
 * Recalculate trust scores for all users who have sold at least one item
 * or submitted at least one verification.
 */
export async function recalculateAllTrustScores(): Promise<{ updated: number; errors: number }> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { totalSales: { gt: 0 } },
        { vaultItems: { some: { certificates: { some: {} } } } },
      ],
    },
    select: { id: true },
  });

  let updated = 0;
  let errors = 0;

  for (const user of users) {
    try {
      await updateUserTrustScore(user.id);
      updated++;
    } catch (err) {
      console.error(`Failed to update trust score for user ${user.id}:`, err);
      errors++;
    }
  }

  return { updated, errors };
}

/**
 * Trust score enforcement tiers
 */
export type TrustTier = "excellent" | "good" | "warning" | "restricted" | "suspended";

export function getTrustTier(score: number | null): TrustTier {
  if (score === null) return "good"; // New users default to good
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "warning";
  if (score >= 30) return "restricted";
  return "suspended";
}

export function getMaxActiveListings(tier: TrustTier): number | null {
  if (tier === "restricted") return 5;
  if (tier === "suspended") return 0;
  return null; // No limit
}

export const TRUST_TIER_LABELS: Record<TrustTier, { label: string; color: string; description: string }> = {
  excellent: { label: "Excellent", color: "text-green-600", description: "Trusted seller" },
  good: { label: "Good", color: "text-blue-600", description: "Normal marketplace access" },
  warning: { label: "Warning", color: "text-yellow-600", description: "Improve your trust score" },
  restricted: { label: "Restricted", color: "text-orange-600", description: "Limited to 5 active listings" },
  suspended: { label: "Suspended", color: "text-red-600", description: "Cannot list items" },
};
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/lib/trust-score.ts
git commit -m "feat: add trust score calculation, enforcement tiers, and batch recalculation"
```

---

## Task 2: Build Trust Score API and Cron Endpoint

**Files:**
- Create: `src/app/api/trust/[userId]/route.ts`
- Create: `src/app/api/cron/trust-scores/route.ts`
- Create: `vercel.json` (if not exists, or modify)

**Step 1: Create the public trust profile API**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTrustTier, TRUST_TIER_LABELS } from "@/lib/trust-score";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      sellerLevel: true,
      totalSales: true,
      trustScore: true,
      trustTotalVerified: true,
      trustDisputeRate: true,
      authPassRate: true,
      trustLastCalculatedAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tier = getTrustTier(user.trustScore);
  const tierInfo = TRUST_TIER_LABELS[tier];

  // Get recent verified certificates for this seller
  const recentCertificates = await prisma.authenticationCertificate.findMany({
    where: {
      vaultItem: { ownerId: userId },
      status: "verified",
    },
    select: {
      id: true,
      confidenceScore: true,
      verifiedAt: true,
      sneaker: {
        select: { brand: true, model: true, imageUrl: true },
      },
    },
    orderBy: { verifiedAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    sellerLevel: user.sellerLevel,
    totalSales: user.totalSales,
    trustScore: user.trustScore,
    trustTier: tier,
    trustTierLabel: tierInfo.label,
    trustTierDescription: tierInfo.description,
    totalVerified: user.trustTotalVerified,
    disputeRate: user.trustDisputeRate,
    authPassRate: user.authPassRate,
    memberSince: user.createdAt,
    lastCalculated: user.trustLastCalculatedAt,
    recentCertificates: recentCertificates.map((c) => ({
      id: c.id,
      confidenceScore: c.confidenceScore,
      verifiedAt: c.verifiedAt,
      sneaker: c.sneaker,
    })),
  });
}
```

**Step 2: Create the cron endpoint for nightly recalculation**

```typescript
import { NextResponse } from "next/server";
import { recalculateAllTrustScores } from "@/lib/trust-score";

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await recalculateAllTrustScores();

  return NextResponse.json({
    success: true,
    ...result,
    calculatedAt: new Date().toISOString(),
  });
}
```

**Step 3: Create or update vercel.json with cron config**

Check if `vercel.json` exists first. If not, create it:

```json
{
  "crons": [
    {
      "path": "/api/cron/trust-scores",
      "schedule": "0 4 * * *"
    }
  ]
}
```

If `vercel.json` already exists, add the `crons` field to it.

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add src/app/api/trust/[userId]/route.ts src/app/api/cron/trust-scores/route.ts vercel.json
git commit -m "feat: add trust score API, public seller trust endpoint, and nightly cron"
```

---

## Task 3: Add Trust Score Widget to Vault Dashboard

**Files:**
- Modify: `src/app/vault/page.tsx`
- Modify: `src/app/api/vault/route.ts` (to include trust data in response)

**Step 1: Update the vault API to return trust score data**

In `src/app/api/vault/route.ts`, find the user query and add trust fields to the select/response. The vault API should return:

```typescript
trustScore: user.trustScore,
trustTotalVerified: user.trustTotalVerified,
trustDisputeRate: user.trustDisputeRate,
trustLastCalculatedAt: user.trustLastCalculatedAt,
```

**Step 2: Add trust score widget to vault page**

In `src/app/vault/page.tsx`:

1. Add `ShieldCheck` to lucide-react imports
2. Add trust data to state and fetch
3. Add a trust score widget AFTER the seller level widget (after the closing `</div>` on line 292).

The trust widget should show:
- Trust score (big number) with tier label and color
- Score breakdown: auth pass rate, total verified, dispute rate
- "Excellent"/"Good"/"Warning"/"Restricted" tier badge
- If tier is "warning" or lower, show improvement tips
- Link to public trust profile

```tsx
{/* Trust Score Widget */}
{trustData && trustData.trustScore !== null && (
  <div className="mb-8 rounded-lg border border-[var(--border)] p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
          <ShieldCheck className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold">Trust Score</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            {trustData.trustTierLabel} · {trustData.totalVerified} verified
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold">{trustData.trustScore}</p>
        <p className="text-xs text-[var(--muted-foreground)]">/100</p>
      </div>
    </div>
    {/* Stats row */}
    <div className="mt-3 grid grid-cols-3 gap-3">
      <div className="text-center">
        <p className="text-lg font-semibold">{trustData.authPassRate ?? "—"}%</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Auth Pass Rate</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold">{trustData.totalVerified}</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Verified Items</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold">{trustData.disputeRate != null ? `${trustData.disputeRate}%` : "0%"}</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Dispute Rate</p>
      </div>
    </div>
  </div>
)}
```

**Step 3: Verify TypeScript compiles and commit**

```bash
git add src/app/vault/page.tsx src/app/api/vault/route.ts
git commit -m "feat: add trust score widget to vault dashboard"
```

---

## Task 4: Integrate Condition Report into Listing Flow

**Files:**
- Modify: `src/app/vault/page.tsx` (listing modal)

**Step 1: Add condition report fields to the listing modal**

In `src/app/vault/page.tsx`, find the listing modal (the `<Modal>` component that opens when `listModal` is set). Currently it shows pricing guidance and a price input. Add a condition report section before the list button:

Add state:
```typescript
const [listCondition, setListCondition] = useState("excellent");
const [listConditionNotes, setListConditionNotes] = useState("");
```

Add to the modal UI (before the List button):
```tsx
{/* Condition Report */}
<div className="space-y-2">
  <label className="block text-sm font-medium">Condition</label>
  <select
    value={listCondition}
    onChange={(e) => setListCondition(e.target.value)}
    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
  >
    <option value="new">New</option>
    <option value="like_new">Like New</option>
    <option value="excellent">Excellent</option>
    <option value="good">Good</option>
    <option value="fair">Fair</option>
  </select>
  <input
    type="text"
    value={listConditionNotes}
    onChange={(e) => setListConditionNotes(e.target.value)}
    placeholder="Any notes about condition (optional)"
    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
  />
</div>
```

**Step 2: Submit condition report when listing is created**

In the listing submission handler (the function that POSTs to `/api/listings`), after a successful listing creation, fire a condition report:

```typescript
// After successful listing creation
try {
  await fetch("/api/verify/condition-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vaultItemId: listModal.id,
      condition: listCondition,
      notes: listConditionNotes || undefined,
      context: "listing",
    }),
  });
} catch {
  // Don't break listing flow if condition report fails
}
```

Reset the condition state when modal closes.

**Step 3: Verify and commit**

```bash
git add src/app/vault/page.tsx
git commit -m "feat: integrate condition report into listing creation flow"
```

---

## Task 5: Trust Score Enforcement in Listings API

**Files:**
- Modify: `src/app/api/listings/route.ts`

**Step 1: Add trust enforcement to the POST handler**

At the top of the POST handler in the listings API, after auth check, add trust score enforcement:

```typescript
import { getTrustTier, getMaxActiveListings } from "@/lib/trust-score";

// ... inside POST handler, after auth check:

// Trust score enforcement
const seller = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { trustScore: true },
});

const tier = getTrustTier(seller?.trustScore ?? null);

if (tier === "suspended") {
  return NextResponse.json(
    { error: "Your account is suspended due to a low trust score. Please contact support." },
    { status: 403 }
  );
}

const maxListings = getMaxActiveListings(tier);
if (maxListings !== null) {
  const activeCount = await prisma.listing.count({
    where: { sellerId: session.user.id, status: "active" },
  });
  if (activeCount >= maxListings) {
    return NextResponse.json(
      { error: `You can only have ${maxListings} active listings with your current trust score. Improve your trust score to list more.` },
      { status: 403 }
    );
  }
}
```

**Step 2: Verify and commit**

```bash
git add src/app/api/listings/route.ts
git commit -m "feat: enforce trust score restrictions on listing creation"
```

---

## Task 6: Add Trust Score Display to Marketplace Surfaces

**Files:**
- Modify: `src/components/marketplace/ListingCard.tsx` (add trust score indicator)
- Modify: `src/app/api/listings/route.ts` (include trust score in response)
- Create: `src/components/ui/TrustBadge.tsx`

**Step 1: Create TrustBadge component**

```tsx
import { ShieldCheck, ShieldAlert } from "lucide-react";

interface TrustBadgeProps {
  score: number | null;
  size?: "sm" | "md";
}

export function TrustBadge({ score, size = "sm" }: TrustBadgeProps) {
  if (score === null) return null;

  const isExcellent = score >= 80;
  const isWarning = score < 40;

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
          isExcellent
            ? "bg-green-100 text-green-700"
            : isWarning
            ? "bg-yellow-100 text-yellow-700"
            : "bg-blue-100 text-blue-700"
        }`}
        title={`Trust Score: ${score}/100`}
      >
        {isWarning ? (
          <ShieldAlert className="h-2.5 w-2.5" />
        ) : (
          <ShieldCheck className="h-2.5 w-2.5" />
        )}
        {score}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        isExcellent
          ? "bg-green-100 text-green-700"
          : isWarning
          ? "bg-yellow-100 text-yellow-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {isWarning ? (
        <ShieldAlert className="h-3 w-3" />
      ) : (
        <ShieldCheck className="h-3 w-3" />
      )}
      Trust: {score}
    </span>
  );
}
```

**Step 2: Update listings API to include seller trust score**

In `src/app/api/listings/route.ts`, find the `owner` select in the Prisma query and add `trustScore`:

```typescript
owner: {
  select: { id: true, name: true, sellerLevel: true, trustScore: true },
},
```

**Step 3: Update ListingCard to show trust badge**

In `src/components/marketplace/ListingCard.tsx`:

1. Add `trustScore?: number | null` to the `owner` type in the interface
2. Import `TrustBadge` from `@/components/ui/TrustBadge`
3. Add `TrustBadge` next to `SellerBadge` in the brand row:

```tsx
<div className="flex items-center justify-between">
  <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-wide">{sneaker.brand}</p>
  <div className="flex items-center gap-1">
    {vaultItem.owner?.trustScore != null && (
      <TrustBadge score={vaultItem.owner.trustScore} />
    )}
    {vaultItem.owner?.sellerLevel && (
      <SellerBadge level={vaultItem.owner.sellerLevel as SellerLevel} />
    )}
  </div>
</div>
```

**Step 4: Verify and commit**

```bash
git add src/components/ui/TrustBadge.tsx src/components/marketplace/ListingCard.tsx src/app/api/listings/route.ts
git commit -m "feat: add TrustBadge component and display trust scores on listing cards"
```

---

## Task 7: Create Public Seller Trust Profile Page

**Files:**
- Create: `src/app/sellers/[id]/page.tsx`

**Step 1: Create the seller profile page**

This is a public page showing a seller's trust profile. It fetches from `GET /api/trust/[userId]`.

The page should show:
- Seller name + seller level badge
- Trust score (large) with tier badge
- Stats grid: total sales, total verified, auth pass rate, dispute rate, member since
- Recent verified items (from recentCertificates)
- Each certificate links to `/verify/[certificateId]`

Follow the same visual patterns as existing pages (CSS variables, Tailwind, lucide icons).

**Step 2: Verify and commit**

```bash
git add "src/app/sellers/[id]/page.tsx"
git commit -m "feat: add public seller trust profile page at /sellers/[id]"
```

---

## Task 8: Final Build Verification

**Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit --pretty
```

**Step 2: Run build**

```bash
npm run build
```

**Step 3: Verify new routes exist in build output**

Confirm these routes appear:
- `/api/trust/[userId]`
- `/api/cron/trust-scores`
- `/sellers/[id]`
