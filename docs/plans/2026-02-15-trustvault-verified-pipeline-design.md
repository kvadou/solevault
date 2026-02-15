# TrustVault Verified Pipeline: Deep Trust Moat Design

**Date:** 2026-02-15
**Status:** Draft — pending implementation planning
**Context:** Post-Phase 4 competitive strategy. Doubling down on TrustVault as SoleVault's primary differentiator against Whatnot, GOAT, and StockX. Making every item a certified, verifiable asset.

---

## 1. Strategic Rationale

Whatnot dominates live commerce and social engagement. GOAT and StockX have massive authentication infrastructure. SoleVault can't outspend them — but can out-trust them by giving sellers and buyers tools that no other platform offers:

- **Entrupy AI authentication** accessible to individual sellers (GOAT/StockX keep this in-house)
- **NFC-tagged physical verification** that travels with the shoe (no competitor does this)
- **Public trust profiles** that work outside SoleVault (free marketing + lock-in)
- **Transparent chain of custody** that builds value over time (the "Carfax for sneakers" moment)

The flywheel: more items verified → more trust data → higher buyer confidence → more sellers want verification → more items verified. This moat deepens with every transaction and is nearly impossible to replicate without physical infrastructure + AI integration + historical data.

---

## 2. Architecture Overview

Three layers working together:

### Layer 1 — AI Authentication (Entrupy Integration)
Sellers upload photos through a guided capture flow. Images hit the Entrupy API which returns an authentication confidence score (0-100) and a certificate ID. Items scoring 90+ get "Verified Authentic" badge. Items 70-89 get "Needs Review" (flagged for manual check). Below 70, listing is blocked.

### Layer 2 — Physical Verification (NFC + QR)
Every verified item gets a unique QR code linking to its Trust Profile page. Premium sellers can purchase NFC tags — tamper-evident stickers attached to the shoe. Anyone can scan the tag/QR and see the full verification history, chain of custody, and authentication certificate.

### Layer 3 — Trust Profile (Public Page)
Each verified item gets a public `/verify/{id}` page showing: authentication score, certificate, all ownership transfers, condition reports at each transfer, and the seller's trust metrics. Shareable, embeddable, SEO-indexed.

---

## 3. Data Model

### AuthenticationCertificate

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| vaultItemId | String | FK to VaultItem |
| sneakerId | String | FK to Sneaker |
| provider | Enum | `entrupy` or `manual` |
| externalCertId | String? | Entrupy certificate ID |
| confidenceScore | Int | 0-100 authentication confidence |
| status | Enum | `pending`, `verified`, `needs_review`, `failed` |
| imageUrls | String[] | The 6+ photos submitted for verification |
| resultData | Json? | Full API response from provider |
| verifiedAt | DateTime? | When verification completed |
| expiresAt | DateTime? | Certificate expiration (optional) |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### NfcTag

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| vaultItemId | String? | FK to VaultItem (null when unassigned) |
| tagUid | String (unique) | Hardware NFC UID |
| status | Enum | `unassigned`, `active`, `deactivated` |
| assignedAt | DateTime? | When linked to an item |
| createdAt | DateTime | Auto |

### ConditionReport

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| vaultItemId | String | FK to VaultItem |
| reporterId | String | FK to User |
| condition | Enum | `new`, `like_new`, `excellent`, `good`, `fair` |
| notes | String? | Free-text description |
| photoUrls | String[] | Condition photos |
| context | Enum | `listing`, `transfer`, `check_in` |
| createdAt | DateTime | Auto |

### TrustScore (cached fields on User model)

| Field | Type | Description |
|-------|------|-------------|
| trustScore | Int | Composite score 0-100 |
| trustAuthPassRate | Float | % of items scoring 90+ |
| trustTotalVerified | Int | Lifetime verified count |
| trustDisputeRate | Float | % of transactions disputed |
| trustLastCalculatedAt | DateTime | Last recalculation |

---

## 4. API Routes

### Verification Submission
```
POST /api/verify/submit
Body: { vaultItemId, images: File[] }
Response: { certificateId, status: "pending" }
```
Uploads photos, kicks off async Entrupy API call. Returns immediately.

### Verification Status (Polling)
```
GET /api/verify/[certificateId]/status
Response: { status, confidenceScore?, verifiedAt? }
```
Client polls every 5s until status leaves `pending`. Typically resolves in 30-60s.

### Public Certificate
```
GET /api/verify/certificate/[certificateId]
Response: { certificate, sneaker, ownershipHistory, conditionReports, sellerTrust }
```
No auth required. Powers the public trust profile page.

### Condition Report
```
POST /api/verify/condition-report
Body: { vaultItemId, condition, notes?, photos: File[] }
Response: { conditionReport }
```
Auth required. Submitted during listing, transfer, or check-in.

### Seller Trust Profile
```
GET /api/trust/[userId]
Response: { trustScore, authPassRate, totalVerified, sellerLevel, recentCertificates[] }
```
No auth required. Public seller trust data.

### NFC Registration
```
POST /api/nfc/register
Body: { tagUid, vaultItemId }
Response: { nfcTag }
```
Auth required. Links a physical NFC tag to a vault item.

### NFC Scan
```
GET /api/nfc/[tagUid]
Response: 302 redirect to /verify/[certificateId]
```
No auth required. Scanned by anyone — phone NFC reader or QR code.

---

## 5. User-Facing Flows

### Seller Verification Flow (during listing)

1. **Photo Capture Guide** — Full-screen guided UI showing ghost overlays for each required angle (left profile, right profile, sole, tongue tag, heel tab, box label). Progress bar tracks 6/6 shots. Basic quality checks (blur detection, minimum resolution) before accepting each photo.

2. **Submit for Verification** — Photos upload to storage, Entrupy API call fires asynchronously. Seller sees "Verifying..." state with estimated wait (~30-60s). They can navigate away — a push notification arrives when done.

3. **Result Screen** — Three outcomes:
   - **Verified (90+):** Green shield, confidence score displayed, "Verified Authentic" badge appears on listing. Seller proceeds to set price.
   - **Needs Review (70-89):** Yellow warning. Seller can request manual admin review (resolved within 24h) or re-submit better quality photos.
   - **Failed (<70):** Red block. Item cannot be listed. Explanation provided. Seller can dispute (triggers admin review).

### Buyer Verification Experience

- Verified items show a shield badge + confidence score on listing cards and detail pages.
- Clicking the badge opens a slide-over panel: authentication certificate, submitted photos, chain of custody timeline, condition reports, and seller trust score.
- One tap to view the full public trust profile page.
- Unverified items show no badge — creating social pressure for sellers to verify.

### Public Trust Profile (`/verify/[id]`)

Shareable page — no login required. Displays:
- Sneaker hero image + name
- Authentication certificate with Entrupy badge and confidence score
- Full ownership timeline (anonymized usernames for privacy)
- Every condition report with photos at each ownership change
- QR code for the NFC tag (if tagged)
- Seller trust score summary

Sellers share this link on Instagram, eBay, or any marketplace to prove authenticity — which markets SoleVault organically.

---

## 6. NFC Hardware Workflow

### Tag Tiers

| Tier | Price | Type | Use Case |
|------|-------|------|----------|
| Basic QR Sticker | $2 | Printed QR code | Applied to box or shoe bag. Budget option. |
| Premium NFC Tag | $8 | Tamper-evident NFC sticker | Applied to shoe (inside tongue/insole). Encrypted UID. Breaks if removed. |

### Registration Flow

1. Seller purchases tags through SoleVault (in-app purchase or shipped bundle).
2. Tags arrive. Seller opens `/nfc/register` on their phone.
3. Seller taps the NFC tag to phone — app reads the hardware UID.
4. App links the UID to the selected vault item. Tag status → `active`.
5. On future scans by anyone: tag UID resolves to the public trust profile.

### Transfer on Sale

When ownership changes hands:
1. Buyer receives the shoe with NFC tag attached.
2. Buyer scans the NFC tag from their phone.
3. App recognizes the tag → prompts buyer to "check in" the item.
4. Check-in adds a new chain of custody entry + prompts a condition report.
5. If the NFC scan doesn't match the expected item (tag swapped), system flags it and notifies both parties.

### Tamper Detection

Premium NFC tags are tamper-evident — physically removing them damages the antenna, making the tag unreadable. If a previously active tag stops responding, the system marks it as `deactivated` and flags the item. This prevents shoe-swapping fraud.

---

## 7. Trust Score System

### Scoring Formula

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Auth pass rate | 35% | `(items scoring 90+) / (total submitted)` × 100 |
| Transaction history | 25% | `(completed sales without disputes) / (total sales)` × 100 |
| Condition accuracy | 20% | `(transfers where buyer condition matches seller claim)` / `(total transfers)` × 100 |
| Response time | 10% | Inverse scale: ship within 24h = 100, 48h = 75, 72h = 50, 72h+ = 25 |
| Account age | 10% | Log scale: 30 days = 40, 90 days = 60, 180 days = 80, 365+ days = 100 |

### Score = weighted sum, clamped 0-100

### Update Frequency
- Recalculated nightly via cron job
- Stored as cached fields on the User model
- Displayed on seller profiles, listing cards, bid screens

### Enforcement

| Score Range | Status |
|-------------|--------|
| 80-100 | Excellent — eligible for "Trusted" badge overlay on seller level |
| 60-79 | Good — normal marketplace access |
| 40-59 | Warning — yellow indicator, "Improve your trust score" prompt |
| 30-39 | Restricted — limited to 5 active listings, warning banner on profile |
| 0-29 | Suspended — cannot list items, must contact support |

### Integration with Seller Levels

Trust score augments the existing seller level system:
- A Platinum seller with 90+ trust score → **"Trusted Platinum"** badge (visually distinct, gold shield)
- Trust score visible alongside seller level on all surfaces
- Future: trust score could unlock fee discounts or priority placement

---

## 8. Implementation Phases

### Phase A: Foundation (build first)
1. Add `AuthenticationCertificate`, `ConditionReport` models to Prisma schema
2. Add trust score fields to User model
3. Build verification submission API (`/api/verify/submit`, `/status`)
4. Build guided photo capture UI component
5. Stub the Entrupy integration (mock responses) for development
6. Build public trust profile page (`/verify/[id]`)
7. Add verification badge to listing cards and detail pages

### Phase B: Intelligence (trust scoring)
8. Build trust score calculation logic (`/lib/trust-score.ts`)
9. Add trust score API route (`/api/trust/[userId]`)
10. Add seller trust profile section to user profiles
11. Build condition report submission flow (during listing + transfer)
12. Trust score enforcement (restrictions for low scores)
13. Integrate trust score display into marketplace surfaces

### Phase C: Physical Layer (NFC)
14. Add `NfcTag` model to Prisma schema
15. Build NFC registration API and page (`/nfc/register`)
16. Build NFC scan endpoint (`/api/nfc/[tagUid]`)
17. NFC check-in flow on ownership transfer
18. Tamper detection logic
19. Tag purchase flow (in-app, Stripe)

### Phase D: Entrupy Live Integration
20. Replace mock with real Entrupy API calls
21. Webhook handler for async results
22. Admin review queue for "needs_review" items
23. Dispute flow for failed verifications
24. Analytics dashboard for auth metrics

---

## 9. Competitive Advantage Summary

| Feature | SoleVault | Whatnot | GOAT | StockX |
|---------|-----------|---------|------|--------|
| AI authentication for individual sellers | Yes (Entrupy) | No | In-house only | In-house only |
| NFC physical tracking | Yes | No | No | No |
| Public shareable trust profiles | Yes | No | No | No |
| Chain of custody timeline | Yes | No | Limited | No |
| Condition reports at every transfer | Yes | No | No | No |
| Seller trust scoring (transparent) | Yes | Ratings only | No | No |
| Verification works outside platform | Yes (QR/NFC) | No | No | No |

**The key differentiator:** GOAT and StockX require items to ship through their verification centers. SoleVault lets sellers verify in-place using AI + NFC, making verification accessible, portable, and transparent. This is fundamentally harder to copy because it requires the physical tag infrastructure, the AI integration, AND the historical chain of custody data — all of which compound over time.
