# TrustVault Phase C: Physical Layer (NFC) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the NFC physical verification layer — schema, tag registration, scan endpoint, check-in flow on ownership transfer, tamper detection, and tag purchase via Stripe.

**Architecture:** NfcTag model links physical NFC hardware UIDs to VaultItems. Sellers register tags via `/nfc/register` (reads NFC UID from phone, links to item). Anyone can scan via `/api/nfc/[tagUid]` which redirects to the public trust profile. On ownership transfer, buyers scan tags to "check in" items, creating a condition report and ownership event. Tamper detection marks tags as deactivated when anomalies are detected. Tag purchases go through Stripe.

**Tech Stack:** Next.js 16 App Router, Prisma 6, TypeScript, Tailwind CSS 4, Lucide icons, Stripe, Web NFC API

**Key existing files:**
- Schema: `prisma/schema.prisma` (VaultItem already has nfcChipId field)
- Stripe: `src/lib/stripe.ts`
- Webhooks: `src/app/api/webhooks/route.ts`
- Orders: `src/app/api/orders/route.ts`
- Certificate API: `src/app/api/verify/certificate/[certificateId]/route.ts`
- Condition report API: `src/app/api/verify/condition-report/route.ts`
- Ownership: `src/lib/ownership.ts`

---

## Task 1: Add NfcTag Model to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add NfcTag model**

Add after the ConditionReport model:

```prisma
model NfcTag {
  id          String    @id @default(cuid())
  vaultItemId String?
  tagUid      String    @unique
  tagType     String    @default("nfc") // "nfc" | "qr"
  status      String    @default("unassigned") // "unassigned" | "active" | "deactivated"
  purchaseId  String?   // Stripe payment reference
  assignedAt  DateTime?
  createdAt   DateTime  @default(now())

  vaultItem VaultItem? @relation(fields: [vaultItemId], references: [id])

  @@index([status])
}
```

Add relation to VaultItem model:
```prisma
  nfcTags         NfcTag[]
```

**Step 2: Run migration**

```bash
npx prisma db push && npx prisma generate
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add NfcTag model to Prisma schema"
```

---

## Task 2: Build NFC Registration API and Page

**Files:**
- Create: `src/app/api/nfc/register/route.ts`
- Create: `src/app/nfc/register/page.tsx`

**Step 1: Create the NFC registration API**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tagUid, vaultItemId } = body as { tagUid: string; vaultItemId: string };

  if (!tagUid || !vaultItemId) {
    return NextResponse.json({ error: "tagUid and vaultItemId are required" }, { status: 400 });
  }

  // Verify the user owns the vault item
  const vaultItem = await prisma.vaultItem.findUnique({
    where: { id: vaultItemId },
  });

  if (!vaultItem) {
    return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
  }

  if (vaultItem.ownerId !== session.user.id) {
    return NextResponse.json({ error: "You do not own this item" }, { status: 403 });
  }

  // Check if tag UID is already registered
  const existingTag = await prisma.nfcTag.findUnique({
    where: { tagUid },
  });

  if (existingTag && existingTag.status === "active") {
    return NextResponse.json({ error: "This tag is already registered to an item" }, { status: 409 });
  }

  // Create or reactivate the tag
  const nfcTag = existingTag
    ? await prisma.nfcTag.update({
        where: { tagUid },
        data: {
          vaultItemId,
          status: "active",
          assignedAt: new Date(),
        },
      })
    : await prisma.nfcTag.create({
        data: {
          tagUid,
          vaultItemId,
          status: "active",
          assignedAt: new Date(),
        },
      });

  // Also update the VaultItem's nfcChipId for backwards compatibility
  await prisma.vaultItem.update({
    where: { id: vaultItemId },
    data: { nfcChipId: tagUid },
  });

  return NextResponse.json(nfcTag, { status: 201 });
}
```

**Step 2: Create the NFC registration page**

This page lets sellers tap their NFC tag to read the UID, then select a vault item to link it to. Uses the Web NFC API (available on Android Chrome). Falls back to manual UID entry on unsupported browsers.

```tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Smartphone, Check, AlertTriangle, QrCode } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface VaultItem {
  id: string;
  size: string;
  condition: string;
  nfcChipId: string | null;
  sneaker: {
    brand: string;
    model: string;
    imageUrl: string | null;
  };
}

export default function NfcRegisterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [tagUid, setTagUid] = useState("");
  const [scanning, setScanning] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check Web NFC API support
    setNfcSupported("NDEFReader" in window);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/vault")
      .then((r) => r.json())
      .then((data) => {
        // Filter to items that are vaulted/listed and don't already have NFC
        const eligible = (data.items || data).filter(
          (item: VaultItem & { status: string }) =>
            ["vaulted", "listed", "authenticated"].includes(item.status) && !item.nfcChipId
        );
        setItems(eligible);
        setLoading(false);
      });
  }, [status, router]);

  async function startNfcScan() {
    if (!nfcSupported) return;
    setScanning(true);
    try {
      const ndef = new (window as unknown as { NDEFReader: new () => { scan: () => Promise<void>; onreading: ((event: { serialNumber: string }) => void) | null } }).NDEFReader();
      await ndef.scan();
      ndef.onreading = (event) => {
        setTagUid(event.serialNumber);
        setScanning(false);
        toast("NFC tag detected!", "success");
      };
    } catch {
      setScanning(false);
      toast("Failed to read NFC tag. Try manual entry.", "error");
    }
  }

  async function handleRegister() {
    if (!selectedItem || !tagUid.trim()) return;
    setRegistering(true);

    const res = await fetch("/api/nfc/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagUid: tagUid.trim(), vaultItemId: selectedItem }),
    });

    if (res.ok) {
      setSuccess(true);
      toast("NFC tag registered successfully!", "success");
    } else {
      const data = await res.json();
      toast(data.error || "Registration failed", "error");
    }
    setRegistering(false);
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Tag Registered!</h1>
        <p className="text-[var(--muted-foreground)]">
          Your NFC tag is now linked. Anyone can scan it to view the trust profile.
        </p>
        <button
          onClick={() => { setSuccess(false); setTagUid(""); setSelectedItem(null); }}
          className="rounded-md bg-[var(--accent)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Register Another
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Register NFC Tag</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Link a physical NFC tag or QR sticker to your vault item
          </p>
        </div>

        {/* Step 1: Scan or enter tag UID */}
        <div className="rounded-lg border border-[var(--border)] p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-[var(--accent)]" />
            Step 1: Read Tag
          </h2>

          {nfcSupported ? (
            <div className="space-y-3">
              <button
                onClick={startNfcScan}
                disabled={scanning}
                className="w-full rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Hold tag near phone...
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4" />
                    Tap NFC Tag to Phone
                  </>
                )}
              </button>
              <div className="text-center text-xs text-[var(--muted-foreground)]">or enter manually</div>
            </div>
          ) : (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800">
                NFC not supported in this browser. Enter the tag UID manually.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">Tag UID</label>
            <input
              type="text"
              value={tagUid}
              onChange={(e) => setTagUid(e.target.value)}
              placeholder="e.g. 04:A3:12:8B:C5:90:80"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {tagUid && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Tag UID captured: <span className="font-mono">{tagUid}</span>
            </div>
          )}
        </div>

        {/* Step 2: Select vault item */}
        <div className="rounded-lg border border-[var(--border)] p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <QrCode className="h-5 w-5 text-[var(--accent)]" />
            Step 2: Select Item
          </h2>

          {items.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No eligible items. Items must be vaulted and not already tagged.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 transition-colors text-left ${
                    selectedItem === item.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  <div className="relative h-12 w-12 rounded-md bg-[var(--muted)] overflow-hidden shrink-0">
                    {item.sneaker.imageUrl && (
                      <Image src={item.sneaker.imageUrl} alt="" fill className="object-cover" sizes="48px" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {item.sneaker.brand} {item.sneaker.model}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Size {item.size} · {item.condition}
                    </p>
                  </div>
                  {selectedItem === item.id && (
                    <Check className="h-5 w-5 text-[var(--accent)] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Register button */}
        <button
          onClick={handleRegister}
          disabled={!tagUid.trim() || !selectedItem || registering}
          className="w-full rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {registering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            "Register Tag"
          )}
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/nfc/register/route.ts src/app/nfc/register/page.tsx
git commit -m "feat: add NFC registration API and page"
```

---

## Task 3: Build NFC Scan Endpoint

**Files:**
- Create: `src/app/api/nfc/[tagUid]/route.ts`

**Step 1: Create the scan endpoint**

When anyone scans an NFC tag, this endpoint resolves the UID to the linked vault item's trust profile and redirects.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tagUid: string }> }
) {
  const { tagUid } = await params;

  const nfcTag = await prisma.nfcTag.findUnique({
    where: { tagUid },
    include: {
      vaultItem: {
        include: {
          certificates: {
            where: { status: "verified" },
            select: { id: true },
            orderBy: { verifiedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!nfcTag) {
    return NextResponse.json({ error: "Unknown tag" }, { status: 404 });
  }

  if (nfcTag.status === "deactivated") {
    return NextResponse.json(
      { error: "This tag has been deactivated — possible tamper detected", tagUid },
      { status: 410 }
    );
  }

  if (!nfcTag.vaultItem) {
    return NextResponse.json({ error: "Tag not linked to any item" }, { status: 404 });
  }

  // If the item has a TrustVault certificate, redirect to /verify/[certificateId]
  const certificate = nfcTag.vaultItem.certificates[0];
  if (certificate) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solevault.com";
    return NextResponse.redirect(`${baseUrl}/verify/${certificate.id}`);
  }

  // Otherwise redirect to the existing certificate page
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solevault.com";
  return NextResponse.redirect(`${baseUrl}/certificate/${nfcTag.vaultItemId}`);
}
```

**Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add "src/app/api/nfc/[tagUid]/route.ts"
git commit -m "feat: add NFC scan endpoint with redirect to trust profile"
```

---

## Task 4: Build NFC Check-in Flow and Tamper Detection

**Files:**
- Create: `src/app/api/nfc/check-in/route.ts`
- Create: `src/app/api/nfc/report-tamper/route.ts`
- Create: `src/app/nfc/check-in/[tagUid]/page.tsx`

**Step 1: Create the check-in API**

When a buyer scans a tag after receiving an item, they can "check in" — confirming receipt and creating a condition report.

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tagUid, condition, notes } = body as {
    tagUid: string;
    condition: string;
    notes?: string;
  };

  if (!tagUid || !condition) {
    return NextResponse.json({ error: "tagUid and condition are required" }, { status: 400 });
  }

  const nfcTag = await prisma.nfcTag.findUnique({
    where: { tagUid },
    include: { vaultItem: true },
  });

  if (!nfcTag || !nfcTag.vaultItem) {
    return NextResponse.json({ error: "Tag not found or not linked" }, { status: 404 });
  }

  if (nfcTag.status === "deactivated") {
    return NextResponse.json({ error: "This tag has been deactivated" }, { status: 410 });
  }

  // Verify the current user is the owner (buyer who received the item)
  if (nfcTag.vaultItem.ownerId !== session.user.id) {
    return NextResponse.json(
      { error: "You are not the current owner of this item" },
      { status: 403 }
    );
  }

  // Create condition report with "check_in" context
  const conditionReport = await prisma.conditionReport.create({
    data: {
      vaultItemId: nfcTag.vaultItemId!,
      reporterId: session.user.id,
      condition,
      notes: notes || null,
      photoUrls: [],
      context: "check_in",
    },
  });

  return NextResponse.json({
    success: true,
    conditionReport,
    message: "Check-in complete. Condition report recorded.",
  }, { status: 201 });
}
```

**Step 2: Create the tamper report API**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const { tagUid } = body as { tagUid: string };

  if (!tagUid) {
    return NextResponse.json({ error: "tagUid is required" }, { status: 400 });
  }

  const nfcTag = await prisma.nfcTag.findUnique({
    where: { tagUid },
  });

  if (!nfcTag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  if (nfcTag.status === "deactivated") {
    return NextResponse.json({ message: "Tag already deactivated" });
  }

  // Deactivate the tag
  await prisma.nfcTag.update({
    where: { tagUid },
    data: { status: "deactivated" },
  });

  // If linked to a vault item, clear the NFC chip reference
  if (nfcTag.vaultItemId) {
    await prisma.vaultItem.update({
      where: { id: nfcTag.vaultItemId },
      data: { nfcChipId: null },
    });
  }

  return NextResponse.json({
    success: true,
    message: "Tag deactivated due to tamper detection",
  });
}
```

**Step 3: Create the check-in page**

This page is shown when a buyer scans a tag. It prompts them to confirm receipt and report condition.

```tsx
"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Check, ShieldCheck, Package } from "lucide-react";
import { toast } from "@/components/ui/Toast";

interface TagData {
  vaultItem: {
    id: string;
    size: string;
    condition: string;
    sneaker: { brand: string; model: string; imageUrl: string | null };
    owner: { id: string };
  };
  status: string;
}

export default function NfcCheckInPage({ params }: { params: Promise<{ tagUid: string }> }) {
  const { tagUid } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [tagData, setTagData] = useState<TagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [condition, setCondition] = useState("excellent");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/nfc/${tagUid}`, { redirect: "manual" })
      .then(async (r) => {
        if (r.status === 410) {
          setError("This tag has been deactivated — possible tamper detected.");
          setLoading(false);
          return;
        }
        // The scan endpoint redirects, but we need the tag data
        // Fetch tag details directly instead
        const tagRes = await fetch(`/api/nfc/tag-info/${tagUid}`);
        if (!tagRes.ok) {
          setError("Tag not found");
          setLoading(false);
          return;
        }
        const data = await tagRes.json();
        setTagData(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load tag info");
        setLoading(false);
      });
  }, [tagUid]);

  async function handleCheckIn() {
    setSubmitting(true);
    const res = await fetch("/api/nfc/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagUid, condition, notes: notes || undefined }),
    });

    if (res.ok) {
      setDone(true);
      toast("Check-in complete!", "success");
    } else {
      const data = await res.json();
      toast(data.error || "Check-in failed", "error");
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <ShieldCheck className="h-12 w-12 text-red-500 mx-auto" />
        <h1 className="text-2xl font-bold">Tag Issue</h1>
        <p className="text-[var(--muted-foreground)]">{error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Check-in Complete</h1>
        <p className="text-[var(--muted-foreground)]">
          Your condition report has been recorded on the chain of custody.
        </p>
      </div>
    );
  }

  if (!tagData) return null;

  const { vaultItem } = tagData;
  const isOwner = session?.user?.id === vaultItem.owner.id;

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-8 space-y-6">
      <div className="text-center space-y-2">
        <Package className="h-8 w-8 text-[var(--accent)] mx-auto" />
        <h1 className="text-2xl font-bold">NFC Tag Scanned</h1>
      </div>

      {/* Item card */}
      <div className="rounded-lg border border-[var(--border)] p-4 flex items-center gap-4">
        <div className="relative h-16 w-16 rounded-md bg-[var(--muted)] overflow-hidden shrink-0">
          {vaultItem.sneaker.imageUrl && (
            <Image src={vaultItem.sneaker.imageUrl} alt="" fill className="object-cover" sizes="64px" />
          )}
        </div>
        <div>
          <p className="font-semibold">{vaultItem.sneaker.brand} {vaultItem.sneaker.model}</p>
          <p className="text-sm text-[var(--muted-foreground)]">Size {vaultItem.size}</p>
        </div>
      </div>

      {isOwner ? (
        <>
          <div className="rounded-lg border border-[var(--border)] p-4 space-y-4">
            <h2 className="font-semibold">Check In This Item</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Confirm you received this item and report its current condition.
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="new">New</option>
                <option value="like_new">Like New</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations about the item"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <button
            onClick={handleCheckIn}
            disabled={submitting}
            className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Complete Check-In
          </button>
        </>
      ) : (
        <div className="rounded-lg border border-[var(--border)] p-4 text-center space-y-2">
          <p className="text-sm text-[var(--muted-foreground)]">
            {authStatus === "authenticated"
              ? "You are not the current owner of this item. Only the owner can check in."
              : "Sign in to check in this item if you're the owner."}
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Create tag info API**

The check-in page needs tag data without a redirect. Create `src/app/api/nfc/tag-info/[tagUid]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tagUid: string }> }
) {
  const { tagUid } = await params;

  const nfcTag = await prisma.nfcTag.findUnique({
    where: { tagUid },
    include: {
      vaultItem: {
        include: {
          sneaker: {
            select: { brand: true, model: true, imageUrl: true },
          },
          owner: { select: { id: true } },
        },
      },
    },
  });

  if (!nfcTag || !nfcTag.vaultItem) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  return NextResponse.json({
    tagUid: nfcTag.tagUid,
    status: nfcTag.status,
    vaultItem: {
      id: nfcTag.vaultItem.id,
      size: nfcTag.vaultItem.size,
      condition: nfcTag.vaultItem.condition,
      sneaker: nfcTag.vaultItem.sneaker,
      owner: nfcTag.vaultItem.owner,
    },
  });
}
```

**Step 5: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/nfc/check-in/route.ts src/app/api/nfc/report-tamper/route.ts src/app/api/nfc/tag-info/[tagUid]/route.ts "src/app/nfc/check-in/[tagUid]/page.tsx"
git commit -m "feat: add NFC check-in flow, tamper detection, and tag info API"
```

---

## Task 5: Build Tag Purchase Flow

**Files:**
- Create: `src/app/api/nfc/purchase/route.ts`
- Create: `src/app/nfc/purchase/page.tsx`

**Step 1: Create the tag purchase API**

Creates a Stripe checkout session for purchasing NFC tags or QR stickers.

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const TAG_PRODUCTS = {
  qr: { name: "QR Verification Sticker", priceCents: 200, type: "qr" },
  nfc: { name: "Premium NFC Tag", priceCents: 800, type: "nfc" },
} as const;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tagType, quantity } = body as { tagType: "qr" | "nfc"; quantity: number };

  if (!tagType || !TAG_PRODUCTS[tagType]) {
    return NextResponse.json({ error: "Invalid tag type" }, { status: 400 });
  }

  const qty = Math.min(Math.max(1, quantity || 1), 50);
  const product = TAG_PRODUCTS[tagType];

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: tagType === "nfc"
              ? "Tamper-evident NFC sticker for shoe authentication"
              : "Printed QR code sticker for box/bag verification",
          },
          unit_amount: product.priceCents,
        },
        quantity: qty,
      },
    ],
    metadata: {
      userId: session.user.id,
      tagType,
      quantity: String(qty),
      type: "nfc_tag_purchase",
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/nfc/register?purchased=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/nfc/purchase?cancelled=true`,
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
```

**Step 2: Create the tag purchase page**

```tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone, QrCode, Shield, Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/utils";

const TAGS = [
  {
    type: "qr" as const,
    name: "QR Sticker",
    priceCents: 200,
    icon: QrCode,
    description: "Printed QR code applied to box or shoe bag. Budget option for basic verification.",
    features: ["Links to trust profile", "Applied to shoe box", "Weather-resistant"],
  },
  {
    type: "nfc" as const,
    name: "Premium NFC Tag",
    priceCents: 800,
    icon: Smartphone,
    description: "Tamper-evident NFC sticker applied to shoe. Encrypted UID. Breaks if removed.",
    features: ["Tap to verify", "Tamper-evident", "Encrypted UID", "Inside tongue/insole"],
  },
];

export default function NfcPurchasePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<"qr" | "nfc">("nfc");
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);

  const selected = TAGS.find((t) => t.type === selectedType)!;

  async function handlePurchase() {
    if (!session) {
      router.push("/auth/signin");
      return;
    }
    setPurchasing(true);

    const res = await fetch("/api/nfc/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagType: selectedType, quantity }),
    });

    const data = await res.json();
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      setPurchasing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Purchase Verification Tags</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Physical tags that link to your item's trust profile
        </p>
      </div>

      {/* Tag tier selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TAGS.map((tag) => {
          const Icon = tag.icon;
          return (
            <button
              key={tag.type}
              onClick={() => setSelectedType(tag.type)}
              className={`rounded-lg border p-6 text-left transition-colors ${
                selectedType === tag.type
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  tag.type === "nfc" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{tag.name}</p>
                  <p className="text-lg font-bold text-[var(--accent)]">
                    {formatPrice(tag.priceCents)}
                    <span className="text-xs font-normal text-[var(--muted-foreground)]"> each</span>
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] mb-3">{tag.description}</p>
              <ul className="space-y-1">
                {tag.features.map((f) => (
                  <li key={f} className="text-xs text-[var(--muted-foreground)] flex items-center gap-1.5">
                    <Shield className="h-3 w-3 text-[var(--accent)]" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Quantity + checkout */}
      <div className="rounded-lg border border-[var(--border)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{selected.name}</p>
            <p className="text-sm text-[var(--muted-foreground)]">{formatPrice(selected.priceCents)} each</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-lg font-bold w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(50, quantity + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold">{formatPrice(selected.priceCents * quantity)}</span>
        </div>

        <button
          onClick={handlePurchase}
          disabled={purchasing}
          className="w-full rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {purchasing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to Stripe...
            </>
          ) : (
            `Purchase ${quantity} Tag${quantity !== 1 ? "s" : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/nfc/purchase/route.ts src/app/nfc/purchase/page.tsx
git commit -m "feat: add NFC tag purchase flow with Stripe checkout"
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
- `/api/nfc/register`
- `/api/nfc/[tagUid]`
- `/api/nfc/check-in`
- `/api/nfc/report-tamper`
- `/api/nfc/tag-info/[tagUid]`
- `/api/nfc/purchase`
- `/nfc/register`
- `/nfc/check-in/[tagUid]`
- `/nfc/purchase`
