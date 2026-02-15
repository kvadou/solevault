# Phase 1: Authentication & Trust Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the TrustVault authentication system — transparent, verifiable authentication certificates with 12-point checklists, photo documentation, NFC chip tracking, and chain-of-custody history.

**Architecture:** Extend the existing Prisma schema with 4 new models (AuthenticationReport, AuthCheckpoint, AuthPhoto, OwnershipRecord) and 2 field additions to VaultItem. Replace the simple approve/reject admin workflow with a comprehensive authentication form. Add a public certificate page that displays the full verification record. Hook ownership tracking into all existing transfer points (vault submit, marketplace sale, pack rip reveal, webhook completion).

**Tech Stack:** Next.js 16 (app router), Prisma ORM, TypeScript, Tailwind CSS v4, Recharts (already installed), Lucide icons, existing Modal/Toast/Badge components.

---

## Task 1: Schema — New Authentication Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add new models and VaultItem fields to schema**

Add to `prisma/schema.prisma` after the existing `BuybackTransaction` model:

```prisma
model AuthenticationReport {
  id                String   @id @default(cuid())
  vaultItemId       String   @unique
  authenticatorId   String?
  aiConfidenceScore Float?
  aiProvider        String?
  overallResult     String   // "passed" | "failed" | "inconclusive"
  notes             String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  vaultItem     VaultItem       @relation(fields: [vaultItemId], references: [id])
  authenticator User?           @relation("AuthenticatorReports", fields: [authenticatorId], references: [id])
  checkpoints   AuthCheckpoint[]
  photos        AuthPhoto[]
}

model AuthCheckpoint {
  id        String @id @default(cuid())
  reportId  String
  name      String // "stitching" | "materials" | "logo_placement" | "glue_patterns" | "insole" | "box_label" | "box_condition" | "laces" | "uv_test" | "smell_test" | "weight" | "silhouette"
  result    String // "pass" | "fail" | "warning"
  notes     String?
  sortOrder Int

  report AuthenticationReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
}

model AuthPhoto {
  id        String   @id @default(cuid())
  reportId  String
  angle     String   // "top" | "left_side" | "right_side" | "back" | "front" | "sole_bottom" | "sole_side" | "insole" | "tongue" | "box_top" | "box_label" | "box_open"
  imageUrl  String
  sortOrder Int
  createdAt DateTime @default(now())

  report AuthenticationReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@index([reportId])
}

model OwnershipRecord {
  id          String   @id @default(cuid())
  vaultItemId String
  fromUserId  String?
  toUserId    String
  eventType   String   // "vault_submission" | "marketplace_sale" | "pack_reveal" | "redemption"
  orderId     String?
  packRipId   String?
  createdAt   DateTime @default(now())

  vaultItem VaultItem @relation(fields: [vaultItemId], references: [id])
  fromUser  User?     @relation("OwnershipFrom", fields: [fromUserId], references: [id])
  toUser    User      @relation("OwnershipTo", fields: [toUserId], references: [id])

  @@index([vaultItemId, createdAt])
}
```

Add to `VaultItem` model:
```prisma
  nfcChipId           String?  @unique
  authReport          AuthenticationReport?
  ownershipHistory    OwnershipRecord[]
```

Add to `User` model:
```prisma
  authenticatorReports AuthenticationReport[] @relation("AuthenticatorReports")
  ownershipFrom        OwnershipRecord[]      @relation("OwnershipFrom")
  ownershipTo          OwnershipRecord[]      @relation("OwnershipTo")
```

**Step 2: Run migration**

Run: `npx prisma db push`
Expected: Schema synced successfully, no errors.

**Step 3: Regenerate client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully.

**Step 4: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds (or only pre-existing warnings).

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add AuthenticationReport, AuthCheckpoint, AuthPhoto, OwnershipRecord models"
```

---

## Task 2: Auth Constants & Types

**Files:**
- Create: `src/lib/authentication.ts`

**Step 1: Create authentication constants and types file**

This file defines the 12-point checklist, photo angles, and shared types used by both admin UI and certificate page.

```typescript
// 12-point authentication checklist
export const AUTH_CHECKPOINTS = [
  { name: "stitching", label: "Stitching Quality", description: "Consistent stitch pattern, correct thread color, no loose threads" },
  { name: "materials", label: "Material Authenticity", description: "Correct leather, mesh, rubber compounds for this model" },
  { name: "logo_placement", label: "Logo Placement", description: "Correct positioning, size, and print quality of all logos" },
  { name: "glue_patterns", label: "Glue & Construction", description: "Clean glue lines, proper bonding, no excess adhesive" },
  { name: "insole", label: "Insole Printing", description: "Correct font, alignment, and printing quality on insole" },
  { name: "box_label", label: "Box Label Match", description: "Style code, size, and colorway match the shoe" },
  { name: "box_condition", label: "Box Condition", description: "Original box, correct style, proper construction" },
  { name: "laces", label: "Lace Quality", description: "Correct lace type, material, and tips for this model" },
  { name: "uv_test", label: "UV Light Test", description: "Hidden markers and patterns visible under UV match authentic reference" },
  { name: "smell_test", label: "Smell Test", description: "Glue and chemical indicators consistent with authentic production" },
  { name: "weight", label: "Weight Check", description: "Weight within expected range for this model and size" },
  { name: "silhouette", label: "Silhouette Comparison", description: "Overall shape matches authentic reference profile" },
] as const;

// Photo documentation angles
export const AUTH_PHOTO_ANGLES = [
  { angle: "top", label: "Top View" },
  { angle: "left_side", label: "Left Side" },
  { angle: "right_side", label: "Right Side" },
  { angle: "back", label: "Back / Heel" },
  { angle: "front", label: "Front / Toe" },
  { angle: "sole_bottom", label: "Sole (Bottom)" },
  { angle: "sole_side", label: "Sole (Side)" },
  { angle: "insole", label: "Insole" },
  { angle: "tongue", label: "Tongue / Label" },
  { angle: "box_top", label: "Box (Top)" },
  { angle: "box_label", label: "Box Label" },
  { angle: "box_open", label: "Box (Open)" },
] as const;

export type CheckpointName = typeof AUTH_CHECKPOINTS[number]["name"];
export type CheckpointResult = "pass" | "fail" | "warning";
export type PhotoAngle = typeof AUTH_PHOTO_ANGLES[number]["angle"];
export type OverallResult = "passed" | "failed" | "inconclusive";
```

**Step 2: Commit**

```bash
git add src/lib/authentication.ts
git commit -m "feat: add authentication checklist constants and types"
```

---

## Task 3: Admin Authentication API — Enhanced Workflow

**Files:**
- Modify: `src/app/api/admin/vault-items/[id]/route.ts`

**Step 1: Enhance the PATCH endpoint to accept full authentication data**

Replace the existing PATCH handler at `src/app/api/admin/vault-items/[id]/route.ts` with an enhanced version. The new handler accepts the 12-point checklist results, photo URLs, NFC chip ID, and AI confidence score — then creates an `AuthenticationReport` with related checkpoints and photos in a single transaction.

The body shape for a full authentication:
```json
{
  "action": "authenticate",
  "overallResult": "passed",
  "nfcChipId": "NFC-ABC123",
  "vaultLocation": "A-12-3",
  "aiConfidenceScore": 98.7,
  "notes": "Clean pair, all checks passed",
  "checkpoints": [
    { "name": "stitching", "result": "pass", "notes": "" },
    ...
  ],
  "photos": [
    { "angle": "top", "imageUrl": "https://..." },
    ...
  ]
}
```

The endpoint should:
1. Validate admin session (already exists)
2. If `body.action === "authenticate"`, create `AuthenticationReport` + `AuthCheckpoint[]` + `AuthPhoto[]` in a transaction
3. Update `VaultItem` status to `vaulted` (if passed) or keep `pending_auth` (if failed), set `nfcChipId`, `vaultLocation`, `authenticationStatus`
4. Create an `OwnershipRecord` for the initial vault (eventType: "vault_submission", fromUserId: null, toUserId: current owner)
5. Fall back to existing simple update logic if `body.action` is not "authenticate" (backwards compatible)

Keep the old simple PATCH behavior when `body.action` is not present — this preserves backwards compatibility with any existing code that uses the simple approve/reject flow.

**Step 2: Verify the build compiles**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/admin/vault-items/[id]/route.ts
git commit -m "feat: enhanced admin authentication endpoint with checklist, photos, NFC"
```

---

## Task 4: OwnershipRecord Hooks — Auto-Create on All Transfer Points

**Files:**
- Create: `src/lib/ownership.ts`
- Modify: `src/app/api/orders/route.ts` (wallet purchase path)
- Modify: `src/app/api/webhooks/route.ts` (Stripe purchase path)
- Modify: `src/app/api/packs/rip/[ripId]/route.ts` (pack reveal path)

**Step 1: Create ownership utility**

Create `src/lib/ownership.ts` with a helper function that creates OwnershipRecord entries:

```typescript
import { prisma } from "./prisma";

export async function createOwnershipRecord(params: {
  vaultItemId: string;
  fromUserId: string | null;
  toUserId: string;
  eventType: "vault_submission" | "marketplace_sale" | "pack_reveal" | "redemption";
  orderId?: string;
  packRipId?: string;
}) {
  return prisma.ownershipRecord.create({
    data: {
      vaultItemId: params.vaultItemId,
      fromUserId: params.fromUserId,
      toUserId: params.toUserId,
      eventType: params.eventType,
      orderId: params.orderId ?? null,
      packRipId: params.packRipId ?? null,
    },
  });
}
```

**Step 2: Add to wallet-purchase path in orders/route.ts**

In `src/app/api/orders/route.ts`, after the `prisma.$transaction` block that transfers ownership on wallet purchase (around line 83-96), add:

```typescript
await createOwnershipRecord({
  vaultItemId: listing.vaultItemId,
  fromUserId: listing.sellerId,
  toUserId: session.user.id!,
  eventType: "marketplace_sale",
  orderId: order.id,
});
```

Import `createOwnershipRecord` from `@/lib/ownership` at the top.

**Step 3: Add to Stripe webhook path in webhooks/route.ts**

In `src/app/api/webhooks/route.ts`, after the `prisma.$transaction` block for marketplace orders (around line 60-84), add:

```typescript
await createOwnershipRecord({
  vaultItemId: order.vaultItemId,
  fromUserId: order.sellerId,
  toUserId: order.buyerId,
  eventType: "marketplace_sale",
  orderId: order.id,
});
```

Import `createOwnershipRecord` from `@/lib/ownership` at the top.

**Step 4: Add to pack reveal path in packs/rip/[ripId]/route.ts**

In `src/app/api/packs/rip/[ripId]/route.ts`, after the `prisma.$transaction` block that reveals and transfers ownership (around line 65-74), add:

```typescript
// Get the previous owner (the platform/admin who added to pool)
const vaultItem = await prisma.vaultItem.findUnique({
  where: { id: rip.packPoolItem!.vaultItemId },
  select: { ownerId: true },
});

await createOwnershipRecord({
  vaultItemId: rip.packPoolItem!.vaultItemId,
  fromUserId: vaultItem?.ownerId ?? null, // previous owner before the transaction updated it
  toUserId: session.user.id!,
  eventType: "pack_reveal",
  packRipId: rip.id,
});
```

Note: Since the $transaction already updated the owner, we need to capture the previous owner BEFORE the transaction. Restructure slightly: read the previous ownerId before the transaction runs, then use it in the ownership record.

Import both `createOwnershipRecord` from `@/lib/ownership` and `prisma` is already imported.

**Step 5: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/lib/ownership.ts src/app/api/orders/route.ts src/app/api/webhooks/route.ts src/app/api/packs/rip/[ripId]/route.ts
git commit -m "feat: auto-create OwnershipRecord on every ownership transfer"
```

---

## Task 5: Certificate API — Public Endpoint

**Files:**
- Create: `src/app/api/vault-items/[id]/certificate/route.ts`
- Create: `src/app/api/nfc/[chipId]/route.ts`

**Step 1: Create certificate data endpoint**

Create `src/app/api/vault-items/[id]/certificate/route.ts`:

This is a **public** endpoint (no auth required). Returns the full authentication certificate data for a vault item:
- Vault item basic info (sneaker brand/model/colorway, size, condition)
- Authentication report (overall result, AI score, notes, created date)
- All 12 checkpoints with pass/fail/warning results
- All photos with angles
- NFC chip ID
- Chain of custody (ownership history with event types and dates — user names anonymized to first initial + last initial for privacy, e.g., "D.K.")
- Current owner anonymized the same way

If the vault item has no authentication report, return 404 with message "No authentication report available."

**Step 2: Create NFC lookup redirect endpoint**

Create `src/app/api/nfc/[chipId]/route.ts`:

This is a **public** endpoint. Looks up a VaultItem by `nfcChipId`, then redirects to the certificate page:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chipId: string }> }
) {
  const { chipId } = await params;

  const item = await prisma.vaultItem.findUnique({
    where: { nfcChipId: chipId },
    select: { id: true },
  });

  if (!item) {
    return NextResponse.json({ error: "NFC chip not found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${baseUrl}/certificate/${item.id}`);
}
```

**Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/api/vault-items/[id]/certificate/route.ts src/app/api/nfc/[chipId]/route.ts
git commit -m "feat: public certificate data API and NFC chip lookup endpoint"
```

---

## Task 6: Certificate Page — Public UI

**Files:**
- Create: `src/app/certificate/[itemId]/page.tsx`

**Step 1: Build the public authentication certificate page**

This page is the crown jewel — the differentiator from GOAT and StockX. It should:

1. **Hero Section** — Sneaker image (first photo from auth report), brand/model/colorway, "Vault Verified" badge with shield icon, NFC chip ID
2. **Authentication Score** — Large circular gauge showing AI confidence (e.g., 98.7%), overall result badge (Passed/Failed/Inconclusive), authenticator sign-off date
3. **12-Point Checklist** — Grid of checkpoint cards, each showing name, pass/fail/warning icon, description. Green checkmark for pass, red X for fail, yellow triangle for warning
4. **Photo Gallery** — Grid of 12 authentication photos with angle labels. Clicking opens a larger view (use Modal component)
5. **Chain of Custody** — Timeline showing every ownership change: who, when, event type. Owner names anonymized (first initial + last initial). Events: "Submitted to Vault", "Authenticated & Vaulted", "Sold on Marketplace", "Won in Mystery Pack", "Redeemed"
6. **Vault Status** — Current status, time in vault, current condition
7. **QR Code Section** — Display a QR code that links back to this same page (use a simple QR generation approach — inline SVG or a lightweight library). Also show NFC chip ID for scanning.
8. **Footer** — "Don't trust. Verify." tagline, SoleVault branding

Design notes:
- Use the existing CSS variable theming (`var(--background)`, `var(--accent)`, etc.)
- Mobile-responsive — single column on small screens, multi-column on larger
- This page is `"use client"` — fetches data from the certificate API on mount
- Use Lucide icons: `Shield`, `CheckCircle`, `XCircle`, `AlertTriangle`, `Clock`, `ArrowRight`, `QrCode`, `Smartphone`

**Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/certificate/[itemId]/page.tsx
git commit -m "feat: public authentication certificate page with checklist, photos, custody chain"
```

---

## Task 7: Admin Authentication UI — Enhanced Workflow Page

**Files:**
- Create: `src/app/admin/authenticate/[itemId]/page.tsx`
- Modify: `src/app/admin/submissions/page.tsx`

**Step 1: Create the full authentication workflow page**

Create `src/app/admin/authenticate/[itemId]/page.tsx`:

This is the admin page where an authenticator performs the full 12-point inspection. It should:

1. **Item Header** — Show sneaker brand/model/colorway, size, condition, submitter info, submission date
2. **Photo Upload Section** — 12 photo angle slots in a grid. Each slot shows the angle label and has a URL input (we're using URL-based images for now, matching existing pattern). Show a preview thumbnail when URL is entered.
3. **12-Point Checklist** — Each checkpoint is a row/card with:
   - Checkpoint name and description (from `AUTH_CHECKPOINTS` constant)
   - Three radio buttons: Pass / Warning / Fail
   - Optional notes text input
4. **NFC Chip ID** — Text input for entering the NFC chip ID
5. **Vault Location** — Text input for physical vault location (e.g., "A-12-3")
6. **AI Confidence Score** — Number input (0-100), optional (for when Entrupy integration is added later)
7. **Overall Decision** — Three large buttons: Approve (passed), Inconclusive, Reject (failed)
8. **Notes** — Textarea for general notes
9. **Submit Button** — Sends full payload to the enhanced PATCH endpoint

Import `AUTH_CHECKPOINTS` and `AUTH_PHOTO_ANGLES` from `@/lib/authentication`.

**Step 2: Add "Authenticate" button to submissions page**

Modify `src/app/admin/submissions/page.tsx`: In the vault item row within the review modal (around line 162-179), when `item.authenticationStatus === "pending"`, add an "Authenticate" link/button that navigates to `/admin/authenticate/[item.id]` alongside (or replacing) the existing simple Approve/Reject buttons. Keep the simple buttons too as a quick-action fallback.

```tsx
<Link
  href={`/admin/authenticate/${item.id}`}
  className="flex items-center gap-1 rounded bg-[var(--accent)] px-3 py-1 text-xs text-white hover:opacity-90"
>
  <Shield className="h-3 w-3" /> Full Authentication
</Link>
```

**Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/admin/authenticate/[itemId]/page.tsx src/app/admin/submissions/page.tsx
git commit -m "feat: admin full authentication workflow page with 12-point checklist"
```

---

## Task 8: Certificate Link on Sneaker Detail + Vault Pages

**Files:**
- Modify: `src/app/sneakers/[id]/page.tsx`
- Modify: `src/app/vault/page.tsx`

**Step 1: Add "View Certificate" link on sneaker detail listings**

In `src/app/sneakers/[id]/page.tsx`, in the listing rows (around line 131-154), add a small "Vault Verified" link next to each listing that links to `/certificate/[vaultItemId]`. This requires the API to return vaultItemId in the listing data.

First check: the sneaker detail API (`/api/sneakers/[id]`) already returns `vaultItems` with `id` and nested `listings`. The listings in `activeListing` are flattened but we need the parent vaultItem id. Adjust the flatMap to also carry `vaultItemId`.

Add a small shield icon link:
```tsx
<Link href={`/certificate/${l.vaultItemId}`} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
  <Shield className="h-3 w-3" /> Verified
</Link>
```

**Step 2: Add "View Certificate" link on vault page items**

In `src/app/vault/page.tsx`, for each vault item that has `authenticationStatus === "passed"`, add a small "View Certificate" link to `/certificate/[item.id]`.

**Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/sneakers/[id]/page.tsx src/app/vault/page.tsx
git commit -m "feat: add Vault Verified certificate links to sneaker detail and vault pages"
```

---

## Task 9: Initial Ownership Records for Existing Vault Items

**Files:**
- Create: `prisma/backfill-ownership.ts`

**Step 1: Write backfill script**

Create `prisma/backfill-ownership.ts` — a one-time script to create initial OwnershipRecord entries for all existing vaulted items that don't have one yet:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all vault items that have no ownership records
  const items = await prisma.vaultItem.findMany({
    where: {
      ownershipHistory: { none: {} },
    },
    select: { id: true, ownerId: true, createdAt: true },
  });

  console.log(`Found ${items.length} vault items without ownership records`);

  for (const item of items) {
    await prisma.ownershipRecord.create({
      data: {
        vaultItemId: item.id,
        fromUserId: null,
        toUserId: item.ownerId,
        eventType: "vault_submission",
        createdAt: item.createdAt,
      },
    });
  }

  console.log(`Created ${items.length} initial ownership records`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Step 2: Run the backfill**

Run: `npx tsx prisma/backfill-ownership.ts`
Expected: Output showing how many records were created.

**Step 3: Commit**

```bash
git add prisma/backfill-ownership.ts
git commit -m "feat: backfill script for initial ownership records on existing vault items"
```

---

## Task 10: Price History Auto-Population

**Files:**
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/webhooks/route.ts`

**Step 1: Record price history on wallet purchase**

In `src/app/api/orders/route.ts`, after the ownership record creation (added in Task 4), add:

```typescript
// Record price history
await prisma.priceHistory.create({
  data: {
    sneakerId: listing.vaultItem.sneakerId,
    size: listing.vaultItem.size,
    priceCents: listing.priceCents,
    source: "platform",
  },
});
```

This requires the listing query to include `vaultItem.sneakerId` and `vaultItem.size` — check that the existing `include` on the listing query provides this (it includes `vaultItem: { include: { sneaker: true } }` which gives us `sneakerId`).

**Step 2: Record price history on Stripe webhook purchase**

In `src/app/api/webhooks/route.ts`, after the ownership record creation, add a similar price history entry. This requires fetching the vault item's sneakerId and size — add a select for it from the order's vaultItem relation:

```typescript
const vaultItemData = await prisma.vaultItem.findUnique({
  where: { id: order.vaultItemId },
  select: { sneakerId: true, size: true },
});

if (vaultItemData) {
  await prisma.priceHistory.create({
    data: {
      sneakerId: vaultItemData.sneakerId,
      size: vaultItemData.size,
      priceCents: order.salePriceCents,
      source: "platform",
    },
  });
}
```

**Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/api/orders/route.ts src/app/api/webhooks/route.ts
git commit -m "feat: auto-record price history on every marketplace sale"
```

---

## Task 11: Price Chart on Sneaker Detail Page

**Files:**
- Modify: `src/app/sneakers/[id]/page.tsx`
- Modify: `src/app/api/sneakers/[id]/route.ts`

**Step 1: Enhance sneaker API to return richer price data**

In `src/app/api/sneakers/[id]/route.ts`, ensure the response includes price history sorted by date and also computed stats: `lastSalePriceCents`, `lowestPriceCents`, `highestPriceCents`, `totalSold` (count of completed orders for this sneaker). Add these as computed fields in the response.

**Step 2: Add price chart to sneaker detail page**

In `src/app/sneakers/[id]/page.tsx`, add a section below the listings grid that shows:
- **Market Data Bar** — Last Sale, Average Price, Price Range (high/low), Total Traded count
- **Price History Chart** — Using Recharts `LineChart` (already in dependencies). X-axis: date, Y-axis: price. Simple, clean line chart with the accent color.

Only show this section if `priceHistory.length > 0`.

The Recharts imports needed:
```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
```

**Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/sneakers/[id]/page.tsx src/app/api/sneakers/[id]/route.ts
git commit -m "feat: price history chart and market data on sneaker detail page"
```

---

## Summary: Task Dependency Order

```
Task 1: Schema (foundation — everything depends on this)
  └── Task 2: Constants/Types
  └── Task 3: Admin Auth API (depends on Task 1 schema)
  └── Task 4: Ownership Hooks (depends on Task 1 schema)
       └── Task 9: Backfill Script (depends on Task 4 pattern)
       └── Task 10: Price History Population (extends Task 4 files)
  └── Task 5: Certificate API (depends on Task 1 schema)
       └── Task 6: Certificate Page UI (depends on Task 5 API)
       └── Task 8: Certificate Links (depends on Task 6 existing)
  └── Task 7: Admin Auth UI (depends on Task 2 constants + Task 3 API)
  └── Task 11: Price Chart (depends on Task 10 for data)
```

Tasks can be executed in order 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 sequentially.

Total: **11 tasks**, estimated ~45-60 minutes of implementation time with a subagent-driven approach.
