# TrustVault Polish & UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the TrustVault experience with a "Verify Now" flow on the vault page, file upload support in photo capture, a verification preview slide-over on listing badges, in-app notifications when verification completes, and image quality hints.

**Architecture:** Add a SlideOver component to the UI library. Extend PhotoCaptureGuide to accept file uploads (converted to data URLs). Wire up verification from the vault page via a modal with the photo capture guide. Create notifications when verification status changes. Add a verification preview slide-over triggered by clicking badges on listing cards and sneaker detail pages.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS 4, Lucide icons

**Key existing files:**
- Vault page: `src/app/vault/page.tsx`
- Photo capture: `src/components/verify/PhotoCaptureGuide.tsx`
- ListingCard: `src/components/marketplace/ListingCard.tsx`
- Sneaker detail: `src/app/sneakers/[id]/page.tsx`
- Modal: `src/components/ui/Modal.tsx`
- Toast: `src/components/ui/Toast.tsx`
- Notification API: `src/app/api/notifications/route.ts`
- Verify submit API: `src/app/api/verify/submit/route.ts`
- Certificate API: `src/app/api/verify/certificate/[certificateId]/route.ts`

---

## Task 1: Add File Upload to PhotoCaptureGuide

**Files:**
- Modify: `src/components/verify/PhotoCaptureGuide.tsx`

**Step 1: Add file upload alongside URL input**

Replace the URL-only input section with a dual-mode input: file upload button + URL fallback. When a file is selected, convert it to a data URL using `FileReader` and use that as the photo source.

Changes:
1. Add a hidden `<input type="file" accept="image/*" capture="environment">` ref
2. Add a "Take Photo / Choose File" button that triggers the file input
3. Keep the URL input as a secondary option ("or enter URL")
4. Add `handleFileSelect` that reads the file, validates size (max 10MB), and sets the photo
5. Add a minimum dimension hint (show warning if image is under 500px wide — don't block, just warn)

The file input should use `capture="environment"` which triggers the camera on mobile devices.

```tsx
// Add ref
const fileInputRef = useRef<HTMLInputElement>(null);

// Add handler
function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    // Show inline warning, don't use toast inside this component
    setFileError("File too large. Max 10MB.");
    return;
  }

  setFileError(null);
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    setPhotos((prev) => ({ ...prev, [currentAngle.key]: dataUrl }));
    // Auto-advance
    if (currentIndex < REQUIRED_ANGLES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  reader.readAsDataURL(file);
  // Reset file input so same file can be re-selected
  e.target.value = "";
}
```

Replace the current input section with:
```tsx
{!photos[currentAngle.key] && (
  <div className="p-4 space-y-3">
    {/* Primary: File/Camera upload */}
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      onChange={handleFileSelect}
      className="hidden"
    />
    <button
      onClick={() => fileInputRef.current?.click()}
      className="w-full rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
    >
      <Upload className="h-4 w-4" />
      Take Photo or Choose File
    </button>

    {fileError && (
      <p className="text-xs text-red-500">{fileError}</p>
    )}

    {/* Secondary: URL input */}
    <div className="text-center text-xs text-[var(--muted-foreground)]">or enter image URL</div>
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
        className="rounded-md bg-[var(--muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--border)] transition-colors disabled:opacity-50"
      >
        Add
      </button>
    </div>
  </div>
)}
```

Add `Upload` to the Lucide import. Add `useRef` to the React import. Add `fileError` state variable.

**Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/components/verify/PhotoCaptureGuide.tsx
git commit -m "feat: add file upload and camera capture to PhotoCaptureGuide"
```

---

## Task 2: Add "Verify Now" Flow to Vault Page

**Files:**
- Modify: `src/app/vault/page.tsx`

**Step 1: Add verification modal with PhotoCaptureGuide**

Add a "Verify" button to each vaulted item (next to the List and Buyback buttons). When clicked, open a full-width modal containing the PhotoCaptureGuide. On completion, submit the photos to `/api/verify/submit` and show status.

Changes to the vault page:

1. Import `PhotoCaptureGuide` and `CapturedPhotos` from `@/components/verify/PhotoCaptureGuide`
2. Add state: `verifyItem` (the item being verified), `verifying` (loading), `verifyResult` (success/error)
3. Add a "Verify" button with `ShieldCheck` icon in the action buttons for vaulted items
4. Add a Modal that opens when `verifyItem` is set, containing the PhotoCaptureGuide
5. On `onComplete`, POST to `/api/verify/submit` with `vaultItemId` and `imageUrls` (from the captured photos values)
6. Show success with certificate ID and a link to the trust profile, or error via toast

```tsx
// In the item action buttons section, add after the existing List and Buyback buttons:
<button
  onClick={() => setVerifyItem(item)}
  className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 transition-colors"
>
  <ShieldCheck className="h-3.5 w-3.5" /> Verify
</button>

// Verification modal (add before closing </div> of the page):
<Modal
  open={!!verifyItem}
  onClose={() => { if (!verifying) { setVerifyItem(null); setVerifyResult(null); } }}
  title="Verify Authenticity"
  className="max-w-2xl"
>
  {verifyResult ? (
    <div className="text-center space-y-4 py-4">
      <ShieldCheck className="h-12 w-12 text-green-500 mx-auto" />
      <p className="font-semibold">Verification Submitted</p>
      <p className="text-sm text-[var(--muted-foreground)]">
        Your item is being verified. This typically takes 30-60 seconds.
      </p>
      <Link
        href={`/verify/${verifyResult}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
      >
        View Trust Profile
      </Link>
    </div>
  ) : (
    <PhotoCaptureGuide
      onComplete={handleVerifySubmit}
      onCancel={() => setVerifyItem(null)}
    />
  )}
</Modal>
```

The `handleVerifySubmit` function:
```tsx
async function handleVerifySubmit(photos: CapturedPhotos) {
  if (!verifyItem) return;
  setVerifying(true);

  const res = await fetch("/api/verify/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vaultItemId: verifyItem.id,
      imageUrls: Object.values(photos),
    }),
  });

  if (res.ok) {
    const data = await res.json();
    setVerifyResult(data.certificateId);
    toast("Verification submitted!", "success");
  } else {
    const data = await res.json();
    toast(data.error || "Verification failed", "error");
    setVerifyItem(null);
  }
  setVerifying(false);
}
```

Note: Only show the Verify button for items that don't already have a pending or verified certificate. Check `item.authenticationStatus` — if it's already "authenticated" or similar, don't show. Read the vault page first to see how status is used.

**Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/vault/page.tsx
git commit -m "feat: add Verify Now flow to vault page with photo capture"
```

---

## Task 3: Verification Completion Notifications

**Files:**
- Modify: `src/app/api/verify/submit/route.ts`

**Step 1: Send in-app notification when verification completes**

In the `processVerification` function, after updating the certificate with the Entrupy result, create a notification for the item owner.

Add after the certificate update (around line 98):

```typescript
// Notify the owner of the verification result
const statusMessages: Record<string, { title: string; message: string }> = {
  verified: {
    title: "Item Verified!",
    message: `Your ${sneaker.brand} ${sneaker.model} has been verified authentic with ${result.confidenceScore}% confidence.`,
  },
  needs_review: {
    title: "Verification Needs Review",
    message: `Your ${sneaker.brand} ${sneaker.model} needs additional review. An admin will check it within 24 hours.`,
  },
  failed: {
    title: "Verification Failed",
    message: `Your ${sneaker.brand} ${sneaker.model} did not pass verification (score: ${result.confidenceScore}%). You can dispute this result.`,
  },
};

const msg = statusMessages[result.status];
if (msg) {
  // Need the ownerId — get from vaultItem
  await prisma.notification.create({
    data: {
      userId: ownerId,
      type: "verification",
      title: msg.title,
      message: msg.message,
      link: `/verify/${certificateId}`,
    },
  });
}
```

To get the `ownerId`, the `processVerification` function needs it as a parameter. Update the function signature and the call site to pass `session.user.id`.

Updated function signature:
```typescript
async function processVerification(
  certificateId: string,
  ownerId: string,
  sneaker: { brand: string; model: string; styleCode: string | null },
  imageUrls: string[]
)
```

Updated call:
```typescript
processVerification(certificate.id, session.user.id, vaultItem.sneaker, imageUrls).catch(...)
```

**Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/verify/submit/route.ts
git commit -m "feat: send in-app notification when verification completes"
```

---

## Task 4: Build SlideOver Component

**Files:**
- Create: `src/components/ui/SlideOver.tsx`

**Step 1: Create a reusable slide-over panel component**

Similar to Modal but slides in from the right side. Used for quick previews without full page navigation.

```tsx
"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function SlideOver({ open, onClose, title, children, className }: SlideOverProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--background)] border-l border-[var(--border)] shadow-xl transition-transform duration-300 ease-out overflow-y-auto",
          open ? "translate-x-0" : "translate-x-full",
          className
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-6 py-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </>
  );
}
```

**Step 2: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/components/ui/SlideOver.tsx
git commit -m "feat: add SlideOver panel component"
```

---

## Task 5: Verification Preview SlideOver on Badges

**Files:**
- Modify: `src/components/marketplace/ListingCard.tsx`
- Modify: `src/app/sneakers/[id]/page.tsx`

**Step 1: Add verification preview to ListingCard**

When a user clicks the "Verified" badge on a listing card, open a SlideOver panel showing a summary of the verification: confidence score, status, verification date, and a link to the full trust profile page. This requires fetching certificate data on badge click.

Changes to ListingCard:
1. Import `SlideOver` from `@/components/ui/SlideOver`
2. Add state: `showVerification` (boolean), `certData` (fetched certificate data), `loadingCert` (boolean)
3. Make the "Verified" badge a clickable button with `e.stopPropagation()` and `e.preventDefault()` to prevent card navigation
4. On click, fetch `/api/verify/certificate/[certificateId]` and open the SlideOver
5. Display: confidence gauge, status badge, verification date, submitted photos grid, link to full profile

The certificate ID is available from `vaultItem.certificates[0].id` (already in the ListingCard's data).

```tsx
// Badge becomes clickable
{vaultItem.certificates && vaultItem.certificates.length > 0 && (
  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      handleOpenVerification(vaultItem.certificates[0].id);
    }}
    className="absolute top-2 left-2"
  >
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-green-600/90 transition-colors cursor-pointer">
      <ShieldCheck className="h-3 w-3" />
      Verified
    </span>
  </button>
)}
```

SlideOver content:
```tsx
<SlideOver open={showVerification} onClose={() => setShowVerification(false)} title="Verification Details">
  {loadingCert ? (
    <div className="flex justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ) : certData ? (
    <div className="space-y-6">
      {/* Confidence score */}
      <div className="text-center">
        <div className="text-4xl font-bold text-green-600">{certData.certificate.confidenceScore}%</div>
        <p className="text-sm text-[var(--muted-foreground)]">Confidence Score</p>
      </div>

      {/* Status + date */}
      <div className="flex items-center justify-between text-sm">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(certData.certificate.status)}`}>
          {certData.certificate.status}
        </span>
        {certData.certificate.verifiedAt && (
          <span className="text-[var(--muted-foreground)]">
            {new Date(certData.certificate.verifiedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Photos */}
      {certData.certificate.imageUrls.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Submitted Photos</p>
          <div className="grid grid-cols-3 gap-2">
            {certData.certificate.imageUrls.map((url, i) => (
              <div key={i} className="aspect-square relative rounded-md overflow-hidden bg-[var(--muted)]">
                <Image src={url} alt="" fill className="object-cover" sizes="120px" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to full profile */}
      <Link
        href={`/verify/${certData.certificate.id}`}
        className="block w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        View Full Trust Profile
      </Link>
    </div>
  ) : null}
</SlideOver>
```

**Step 2: Add similar preview to sneaker detail page**

In the sneaker detail page, make the "TrustVault" link also open a SlideOver preview instead of navigating directly. The same pattern: fetch certificate data on click, show summary in SlideOver, with a link to the full page.

**Step 3: Verify and commit**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
git add src/components/marketplace/ListingCard.tsx "src/app/sneakers/[id]/page.tsx"
git commit -m "feat: add verification preview slide-over on listing badges"
```

---

## Task 6: Final Build Verification

**Step 1: Run TypeScript check and build**

```bash
npx tsc --noEmit --pretty
npm run build
```

**Step 2: Verify all routes and components work**

Confirm:
- PhotoCaptureGuide renders file upload button + URL fallback
- Vault page shows "Verify" button on vaulted items
- SlideOver component renders properly
- ListingCard badge opens verification preview
- Build passes with no errors
