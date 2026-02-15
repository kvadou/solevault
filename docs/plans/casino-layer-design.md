# SoleVault Casino Layer — Approved Design

**Status:** All sections approved
**Date:** 2026-02-14

---

## Overview

The casino layer replicates Courtyard.io's revenue engine adapted for sneakers. Six interconnected systems built on top of a wallet foundation create a self-reinforcing flywheel: users deposit money, rip mystery packs, take instant buybacks, items get repacked, and the cycle repeats. Courtyard went from $50K/mo to $50M/mo in 18 months with this model. Their average item trades 8x/month.

**Build order:** Wallet → Mystery Packs → Instant Buyback → Curated Drops → Vaulter Revenue Share → Redemption Flow

---

## Section 1: Wallet System

**Purpose:** On-platform balance that all purchases deduct from. Reduces payment friction and keeps money in the ecosystem.

### Data Model

**New model — `WalletTransaction`:**

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | FK to User |
| type | String | `deposit` / `withdrawal` / `purchase` / `sale` / `buyback` / `revenue_share` / `refund` |
| amountCents | Int | Positive = credit, negative = debit |
| balanceAfterCents | Int | Running balance snapshot |
| description | String | Human-readable (e.g., "Pack rip: Gold Tier") |
| stripePaymentIntentId | String? | For deposits |
| stripeTransferId | String? | For withdrawals |
| referenceType | String? | `pack_rip` / `order` / `buyback` / `redemption` |
| referenceId | String? | ID of the related record |
| createdAt | DateTime | Timestamp |

**User model changes:**
- `balanceCents` already exists (Int, default 0)
- Add `stripeConnectAccountId` (String?) for withdrawals

### Deposit Flow
1. User clicks "Add Funds" → enters amount (min $5, max $500)
2. Stripe Checkout session created → user pays
3. Webhook confirms payment → `balanceCents` incremented, `WalletTransaction` created with type `deposit`

### Withdrawal Flow
1. User clicks "Withdraw" → enters amount (min $10)
2. Stripe Connect onboarding if first time (sets up `stripeConnectAccountId`)
3. Platform initiates Stripe transfer minus $1.50 fee
4. `balanceCents` decremented, `WalletTransaction` created with type `withdrawal`

### Purchase Integration
All purchases (marketplace, packs) check wallet balance first. If sufficient, deduct directly. If insufficient, prompt to deposit the difference.

### Fee Structure
- Deposits: Free (Stripe processing absorbed by platform)
- Withdrawals: $1.50 flat fee (friction to keep money in ecosystem)

---

## Section 2: Mystery Packs — Data Model & Pack Configuration

**Purpose:** Tiered mystery packs with randomized sneaker assignment. The primary revenue driver.

### Data Model

**New model — `PackTier`:**

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| name | String | e.g., "Bronze Pack" |
| slug | String (unique) | URL-safe name |
| priceCents | Int | Pack price |
| imageUrl | String? | Pack artwork |
| description | String? | Marketing copy |
| totalSupply | Int | Total rips available |
| soldCount | Int (default 0) | Counter |
| status | String | `active` / `sold_out` / `paused` |
| dropId | String? | FK to Drop (null = standard pack) |
| createdAt | DateTime | Timestamp |

**New model — `PackPoolItem`:**

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| packTierId | String | FK to PackTier |
| vaultItemId | String | FK to VaultItem |
| oddsWeight | Int | Higher = more likely to be pulled |
| status | String | `available` / `claimed` |
| claimedAt | DateTime? | When pulled |

**New model — `PackRip`:**

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | FK to User |
| packTierId | String | FK to PackTier |
| packPoolItemId | String? | FK to PackPoolItem (the item won) |
| priceCents | Int | Price paid |
| platformRevenueCents | Int | Revenue from this rip |
| status | String | `pending` / `revealed` / `buyback` |
| revealedAt | DateTime? | When animation completed |
| createdAt | DateTime | Timestamp |

### VaultItem Status Addition
Add `"packed"` to VaultItem status enum. When a VaultItem is assigned to a PackPoolItem, its status changes to `"packed"` to prevent double-assignment.

### Admin Configuration Flow
1. Admin creates a PackTier (name, price, image)
2. Admin assigns VaultItems to the tier's pool with odds weights
3. Eligible items: `VaultItem.status = "vaulted"` and not currently listed
4. On assignment, VaultItem status → `"packed"`
5. Admin can adjust pool, pause tiers, or mark sold out

### Odds Display
Each PackTier shows published odds by value bracket (e.g., "15% chance of $100+ item, 40% chance of $50-99 item, 45% chance of $25-49 item"). Calculated dynamically from pool weights. Transparency builds trust.

---

## Section 3: Mystery Packs — Reveal UX & Rip Mechanics

### Purchase Flow (User Side)
1. User browses `/packs` — sees available tiers as large, visually rich cards showing price, odds brackets, and "X remaining" count
2. User clicks "Rip Pack" → wallet balance check. If insufficient, inline prompt to deposit. If sufficient, deduct `priceCents` immediately and create `PackRip` with `status: "pending"`
3. Server-side: weighted random selection runs against the `PackPoolItem` pool, selects one item, marks it `claimed`, but does NOT return the result to the client yet

### The Reveal Animation (Dopamine Engine)

Route: `/packs/rip/[ripId]` — fullscreen experience. Three phases:

**Phase 1 — Anticipation (~2s):** Pack card appears center-screen, glowing/pulsing. Background dims. Builds tension.

**Phase 2 — The Rip (~1.5s):** User clicks/taps to rip. Card tears open with particle effects. A silhouette of a sneaker fades in behind a blur.

**Phase 3 — The Reveal (~1s):** Blur clears, sneaker image slides in with the model name, colorway, size, and current FMV. Color-coded border: green if value > pack price (winner), white if roughly equal, no special treatment if below. Confetti burst on big wins.

After reveal: `PackRip.status` → `"revealed"`, `revealedAt` set, `VaultItem` ownership transfers to user.

### Post-Reveal Actions (Shown Immediately)
- **"Keep in Vault"** — item sits in user's vault
- **"Instant Buyback"** — sell back at 85% FMV, credits wallet instantly
- **"List for Sale"** — go to marketplace listing flow

### Anti-Manipulation
Random selection happens server-side at purchase time, not reveal time. The animation is purely cosmetic — the outcome is already determined. Prevents client-side tampering.

---

## Section 4: Instant Buyback — The Flywheel Engine

**Purpose:** Any user can sell any vaulted item back to the platform instantly at 85% FMV. Credits wallet immediately. Item returns to platform inventory for repacking. This is THE mechanism that keeps the flywheel spinning.

### FMV Calculation
- Rolling weighted average of the last 5 sale prices on the platform for that sneaker+size combo
- Recency bias: most recent sale weighted 2x
- Fallback: if fewer than 3 platform sales exist, use seeded retail price
- Admin can override FMV manually per sneaker+size via `fmvOverrideCents` field on VaultItem

### Data Model

**New model — `BuybackTransaction`:**

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | FK to User |
| vaultItemId | String | FK to VaultItem |
| fmvCents | Int | FMV at time of buyback |
| payoutCents | Int | 85% of FMV |
| platformRevenueCents | Int | 15% spread |
| createdAt | DateTime | Timestamp |

### VaultItem Addition
Add `fmvOverrideCents` (Int?) to VaultItem for admin FMV overrides.

### Buyback Flow
1. User views item in vault (or post-rip screen) → "Instant Buyback" button shows payout amount
2. User confirms via custom modal showing: FMV, payout amount, 15% platform fee breakdown
3. On confirm:
   - `VaultItem.ownerId` transfers to a platform system account
   - `VaultItem.status` → `"vaulted"` (available for repacking)
   - User's `balanceCents` increases by `payoutCents`
   - `BuybackTransaction` created
4. Item is now back in platform inventory — admin can reassign to a PackPoolItem

### The Flywheel Math
User rips $50 pack → gets sneaker worth $60 FMV → takes buyback at $51 (85%) → platform keeps $9 spread. Platform repacks item into another $50 pack. Next user rips it. Repeat.

Each cycle generates ~15% spread revenue. At 8 trades/month per item (Courtyard's benchmark), a single $60 sneaker generates ~$72/month in spread revenue.

### No Cooldown
No cooldown on buybacks — friction-free selling is the point. The 15% haircut IS the friction.

---

## Section 5: Curated Drops — FOMO-Driven Releases

**Purpose:** Limited-edition themed pack collections released on a schedule. Unlike standard packs (always available), drops are time-limited and quantity-limited. They sell out — that's the point.

### Data Model

**New model — `Drop`:**

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| name | String | e.g., "Travis Scott Collection" |
| slug | String (unique) | URL-safe name |
| description | String? | Theme story/marketing copy |
| imageUrl | String? | Drop artwork |
| theme | String? | Category tag |
| startsAt | DateTime | When drop goes live |
| endsAt | DateTime? | Optional end time (null = ends when sold out) |
| status | String | `upcoming` / `live` / `sold_out` / `ended` |
| maxPurchasesPerUser | Int (default 1) | Per-user cap (1-3) |
| createdAt | DateTime | Timestamp |

### PackTier Integration
Existing `PackTier` model gets nullable `dropId` FK to `Drop`:
- `dropId = null` → standard always-available pack
- `dropId` set → part of a drop, only purchasable when drop is `live`

### Drop Lifecycle (Admin)
1. Admin creates Drop with theme, name, start time, optional end time
2. Admin creates PackTiers linked to the drop, assigns VaultItems to pools
3. Drop appears on `/drops` in "upcoming" state with countdown timer
4. At `startsAt`, status flips to `live` — packs become purchasable
5. Sells out or `endsAt` passes → status flips to `sold_out` or `ended`

### User Experience
- `/drops` page shows: upcoming drops with countdown timers, live drops with "Buy Now" + remaining count, past drops greyed out with "Sold Out" badge
- Drop detail page (`/drops/[slug]`) shows theme story, all available tiers, odds per tier, countdown or purchase button
- Per-user purchase limit enforced via `PackRip` count for that drop's tiers

### Marketing Hooks
Drops announced via email/social ahead of time. Countdown + limited supply + per-user cap creates genuine scarcity. Past drops visible and sold out reinforces FOMO for future ones.

---

## Section 6: Vaulter Revenue Share — Incentivizing Supply

**Purpose:** 1% revenue share to the original vaulter every time their submitted item generates platform revenue. Makes vaulting a passive income stream, incentivizing supply.

### VaultItem Addition
Add `originalVaulterId` (String) to VaultItem — set once when item is first vaulted via VaultSubmission, never changes regardless of ownership transfers.

### Data Model

**New model — `RevenueShare`:**

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| vaulterId | String | FK to User (original vaulter) |
| vaultItemId | String | FK to VaultItem |
| sourceType | String | `pack_rip` / `buyback` / `marketplace_sale` |
| sourceId | String | ID of PackRip, BuybackTransaction, or Order |
| totalRevenueCents | Int | Platform's total revenue from transaction |
| shareAmountCents | Int | 1% of totalRevenueCents |
| status | String | `pending` / `credited` |
| creditedAt | DateTime? | When credited to wallet |
| createdAt | DateTime | Timestamp |

### Payout Flow
- Revenue shares accumulate as `pending` records
- Batched: scheduled job (or on-demand trigger) batches all pending shares for a user, credits `balanceCents`, marks `credited`
- Minimum payout threshold: $0.50 (50 cents) — avoids micro-transaction clutter

### User Visibility
Vault dashboard shows each submitted item with:
- Current location (packed/listed/in someone's vault)
- Lifetime revenue generated
- Lifetime revenue share earned

### The Math
A sneaker trading 8x/month at $50 avg price generates ~$60/month in platform revenue. Vaulter gets ~$0.60/month per item. Submit 20 pairs → ~$12/month passive. Small but sticky.

---

## Section 7: Redemption Flow — Physical Delivery with Friction

**Purpose:** Allow users to receive physical sneakers while discouraging redemption through fees and friction. Target: <3% redemption rate (Courtyard's benchmark).

### Data Model

**New model — `Redemption`:**

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | FK to User |
| vaultItemId | String | FK to VaultItem |
| shippingFeeCents | Int | $1500 standard, $2500 high-value/special |
| shippingAddress | Json | { street, city, state, zip, country } |
| trackingNumber | String? | Set when shipped |
| status | String | `requested` / `processing` / `shipped` / `delivered` / `cancelled` |
| requestedAt | DateTime | When user requested |
| shippedAt | DateTime? | When shipped |
| deliveredAt | DateTime? | When delivered |
| createdAt | DateTime | Timestamp |

### Redemption Flow
1. User clicks "Redeem" on a vaulted item → custom modal shows: shipping fee, estimated delivery (5-7 business days), warning: "This item will be permanently removed from your vault. You will no longer earn from trades or be able to sell instantly."
2. Shipping fee deducted from wallet (or Stripe if insufficient balance)
3. `Redemption` created with `status: "requested"`, `VaultItem.status` → `"redeemed"`
4. Admin dashboard shows pending redemptions in queue. Admin picks/packs, enters tracking number, status → `"shipped"`
5. Delivery confirmation (manual or webhook) → status → `"delivered"`

### Friction by Design
- Shipping fee: $15-25 (non-trivial)
- 5-7 day wait vs instant buyback cash
- Warning modal emphasizes what they're giving up (instant liquidity, future trades)
- No free shipping promotions — ever
- Post-redemption: `originalVaulterId` revenue share stops, item exits all pools

### The Psychology
Buyback gives 85% of value in 2 seconds. Redemption gives the physical shoe in 5-7 days minus a shipping fee. For most users, the math favors staying in the ecosystem.

---

## New Prisma Models Summary

| Model | Purpose |
|-------|---------|
| WalletTransaction | Ledger for all wallet movements |
| PackTier | Pack tier configuration |
| PackPoolItem | Items in a pack's pool with odds weights |
| PackRip | Record of a pack purchase/reveal |
| BuybackTransaction | Instant buyback records |
| Drop | Curated drop events |
| RevenueShare | Vaulter revenue share tracking |
| Redemption | Physical delivery requests |

## VaultItem Status Values (Updated)
`pending_auth` → `authenticated` → `vaulted` → `packed` / `listed` / `sold` / `redeemed`

## VaultItem New Fields
- `originalVaulterId` (String) — original submitter, never changes
- `fmvOverrideCents` (Int?) — admin FMV override

## User New Fields
- `stripeConnectAccountId` (String?) — for withdrawals

## Implementation Order
1. Wallet System (foundation for everything)
2. Mystery Packs (data model + admin + reveal UX)
3. Instant Buyback (completes the flywheel)
4. Curated Drops (layered on top of packs)
5. Vaulter Revenue Share (incentive layer)
6. Redemption Flow (final piece)
