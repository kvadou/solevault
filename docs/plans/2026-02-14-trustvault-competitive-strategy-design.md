# TrustVault: Competitive Strategy & Authentication System Design

**Date:** 2026-02-14
**Status:** Approved for implementation
**Context:** Competitive analysis of GOAT + StockX, differentiation strategy, and authentication system design for SoleVault

---

## 1. Competitive Landscape

### GOAT (~$3.7B valuation)
- Human experts + ML authentication, global verification centers
- New + used sneakers, widest condition range
- AR try-on (78% engagement on hyped releases)
- GOAT Storage ($15/mo) + GOAT Clean service
- Instant Ship for pre-verified items (3-7 days)
- Alias seller app with AI pricing recommendations
- ~9.5% seller commission
- USD only

### StockX (~$3.8B valuation)
- In-house auth team, 60M+ items inspected, 1.4M rejected ($400M+ value)
- Bid/Ask stock-market model with real-time price discovery
- Deadstock only (brand new, unworn)
- Full price history, bid/ask spreads, volatility metrics, ticker-style IDs
- Verified Seller pilot (top 1% skip auth center)
- Flex storage program + Early Payouts for sellers
- 9%+ seller fee (varies by level) + 3% payment processing
- Multi-currency (USD, AUD, CAD, EUR, GBP)

### SoleVault (Current State)
- Vault system with physical authentication + digital custody
- Marketplace with search, filters, instant wallet-to-wallet trading
- Wallet system (deposit, withdraw, transfers)
- Mystery Packs with weighted odds (casino layer)
- 5% total fees (2.5% buyer + 2.5% seller)
- Zero-day trading (no shipping between trades)
- Admin panel (submissions, inventory, packs, orders)
- PriceHistory + Watchlist schemas (not yet populated/UI)

---

## 2. SoleVault's Three Unfair Advantages

### Advantage 1: Zero-Day Trading
Once authenticated and vaulted, sneakers trade instantly. No shipping delays.
- GOAT: 7-10 business days
- StockX: 7-12 business days
- SoleVault: **Instant** (wallet-to-wallet, ownership record update)

### Advantage 2: Mystery Packs / Casino Layer
Neither competitor gamifies their marketplace. Packs create engagement loops and re-monetization via the 90% buyback mechanism.

### Advantage 3: Fee Structure
5% total vs 12-15% on competitors. On a $300 sneaker: $15 vs $36-45.

---

## 3. The Authenticity Strategy: "TrustVault"

Core insight: GOAT and StockX treat authentication as an opaque one-time checkpoint. SoleVault makes it a transparent, continuous, verifiable record.

**Tagline: "Don't trust. Verify."**

### Layer 1 — Physical Authentication (at intake)

Every sneaker entering the vault goes through:

1. **Expert Inspection** — 12-point checklist:
   - Stitching quality and consistency
   - Material authenticity (leather, mesh, rubber compounds)
   - Logo placement and accuracy
   - Glue patterns and construction
   - Insole printing and quality
   - Box label matching (style code, size, colorway)
   - Box condition and construction
   - Lace quality and type
   - UV light test (hidden markers)
   - Smell test (glue/chemical indicators)
   - Weight comparison to reference
   - Overall silhouette comparison

2. **AI Verification** — Entrupy API integration for secondary ML-powered authentication (99.1% accuracy on luxury goods). Returns a confidence score.

3. **NFC Provenance Chip** — Tamper-proof NFC tag embedded in authenticated sneaker. Scanning with phone returns full authentication record, vault history, ownership chain.

4. **Photo Documentation** — 12+ angle photographs, timestamped, stored permanently.

### Layer 2 — The Authentication Certificate

Public, scannable, verifiable report for every vaulted sneaker at `/sneakers/vault/[itemId]/certificate`:

- All 12 authentication photos (timestamped)
- AI confidence score (e.g., "98.7% authentic")
- Human authenticator sign-off (anonymous but verifiable)
- 12-point checklist with pass/fail per checkpoint
- NFC chip ID linked to physical sneaker
- Chain of custody: every owner, every trade, time in vault
- QR code for easy sharing/scanning
- Condition at authentication + current condition

### Layer 3 — Continuous Vault Monitoring

While sneakers sit in the vault:
- Climate-controlled storage conditions
- Periodic condition checks with updated photos
- Condition grade updates if degradation detected
- Full audit trail accessible to current owner

---

## 4. Features to Build (Priority Ordered)

### Phase 1: Authentication & Trust Foundation

#### 1A. Authentication Certificate System
- **New model:** `AuthenticationReport` with checkpoint results, photos, AI score
- **New page:** `/sneakers/vault/[itemId]/certificate` — public certificate view
- **Admin enhancement:** Authentication workflow captures 12-point checklist results + photos
- **API:** `/api/vault-items/[id]/certificate` — public endpoint for certificate data

#### 1B. NFC Chip Integration
- **New model field:** `nfcChipId` on VaultItem
- **Admin workflow:** Assign NFC chip ID during authentication
- **Public API:** `/api/nfc/[chipId]` — returns certificate data when chip scanned
- **QR code generation** on certificate page linking to the same data

#### 1C. Chain of Custody
- **New model:** `OwnershipRecord` tracking every ownership change with timestamps
- Auto-created on: vault submission, marketplace sale, pack rip reveal, redemption
- Displayed on certificate page as timeline

### Phase 2: Market Data & Engagement

#### 2A. Price History Population
- Record sale price on every completed order into `PriceHistory`
- Display price chart on sneaker detail page (Recharts already available)
- Show: last sale, average price, high/low, price trend direction

#### 2B. Watchlist UI + Price Alerts
- Watchlist page at `/watchlist`
- "Watch" button on sneaker detail pages
- Target price field — notify when listing drops below target
- Email notification (or in-app) when target hit

#### 2C. Sneaker Detail Page Enhancement
- Last sale price, price range, total vault items, times traded
- Active listings count, lowest ask, highest bid (when bids added)
- Stock-market-style data presentation

### Phase 3: Portfolio & Investment Features

#### 3A. Vault Portfolio Dashboard
- Total vault value (sum of current market values)
- Daily/weekly value change
- Per-item value tracking (current value vs. purchase price, ROI)
- Visual chart of portfolio value over time

#### 3B. Make an Offer / Bid System
- Buyers can bid below asking price on any vaulted sneaker (even unlisted)
- Sellers receive bids and can accept/counter/decline
- Creates price discovery without full stock-exchange complexity
- New models: `Bid` with status workflow

### Phase 4: Seller & Growth Features

#### 4A. Condition-Based Pricing Guidance
- AI-suggested price based on condition, size, brand, recent sales
- "Suggested price: $285-$315" shown when creating listing
- Based on historical sales data from platform

#### 4B. Seller Levels / Reputation
- Tiers based on volume + authentication pass rate
- Lower fees at higher levels (5% → 4% → 3%)
- Badge displayed on listings

#### 4C. Release Calendar
- Upcoming sneaker drops with dates
- "Remind me" functionality
- Drives traffic and engagement

---

## 5. Data Model Changes

### New Models

```
AuthenticationReport {
  id
  vaultItemId (unique, FK to VaultItem)
  authenticatorId (FK to User, nullable — admin who performed auth)
  aiConfidenceScore (Float, 0-100)
  aiProvider (String, e.g., "entrupy")
  aiRawResponse (JSON, full API response)
  overallResult (enum: passed, failed, inconclusive)
  notes (String, optional)
  checkpoints (relation to AuthCheckpoint[])
  photos (relation to AuthPhoto[])
  createdAt
  updatedAt
}

AuthCheckpoint {
  id
  reportId (FK to AuthenticationReport)
  name (String, e.g., "stitching", "materials", "logo_placement")
  result (enum: pass, fail, warning)
  notes (String, optional)
  sortOrder (Int)
}

AuthPhoto {
  id
  reportId (FK to AuthenticationReport)
  angle (String, e.g., "top", "left_side", "sole", "box_label")
  imageUrl (String)
  sortOrder (Int)
  createdAt
}

OwnershipRecord {
  id
  vaultItemId (FK to VaultItem)
  fromUserId (FK to User, nullable — null for initial vault)
  toUserId (FK to User)
  eventType (enum: vault_submission, marketplace_sale, pack_reveal, redemption)
  orderId (FK to Order, nullable)
  packRipId (FK to PackRip, nullable)
  createdAt
}

Bid {
  id
  sneakerId (FK to Sneaker)
  bidderId (FK to User)
  size (String)
  amountCents (Int)
  status (enum: active, accepted, countered, declined, expired, cancelled)
  expiresAt (DateTime)
  vaultItemId (FK to VaultItem, nullable — set when accepted)
  createdAt
  updatedAt
}
```

### Model Modifications

```
VaultItem — add fields:
  nfcChipId (String, unique, nullable)
  authReport (relation to AuthenticationReport)
  ownershipHistory (relation to OwnershipRecord[])
  bids (relation to Bid[])
  currentMarketValueCents (Int, nullable — computed/cached)

Sneaker — add fields:
  lastSalePriceCents (Int, nullable)
  avgSalePriceCents (Int, nullable)
  totalVaulted (Int, default 0)
  totalTraded (Int, default 0)
```

---

## 6. New Pages & Routes

### Public
- `/sneakers/vault/[itemId]/certificate` — Authentication certificate (public, shareable)
- `/nfc/[chipId]` — Redirect from NFC scan to certificate page

### Authenticated
- `/watchlist` — User's watched sneakers with price alerts
- `/vault/portfolio` — Portfolio dashboard with value tracking

### API Routes
- `GET /api/vault-items/[id]/certificate` — Public certificate data
- `GET /api/nfc/[chipId]` — NFC chip lookup → certificate redirect
- `GET /api/watchlist` — User's watchlist
- `POST /api/watchlist` — Add to watchlist (sneakerId + optional targetPrice)
- `DELETE /api/watchlist/[id]` — Remove from watchlist
- `GET /api/bids` — User's active bids
- `POST /api/bids` — Place a bid
- `PATCH /api/bids/[id]` — Accept/decline/counter a bid
- `GET /api/vault/portfolio` — Portfolio value + per-item breakdown
- `PATCH /api/admin/vault-items/[id]/authenticate` — Enhanced auth workflow (checkpoints + photos + AI score + NFC)

### Admin Enhancements
- Enhanced authentication workflow page with:
  - 12-point checklist form
  - Photo upload for each angle
  - AI verification trigger (Entrupy API call)
  - NFC chip ID assignment
  - Overall pass/fail decision with notes

---

## 7. Implementation Sequence

### Phase 1: Authentication & Trust Foundation (Priority)
1. Schema changes: AuthenticationReport, AuthCheckpoint, AuthPhoto, OwnershipRecord + VaultItem modifications
2. Admin authentication workflow enhancement (checklist, photos, NFC field)
3. Authentication certificate page (public, shareable)
4. NFC lookup endpoint
5. Ownership record auto-creation on vault submit, sale, pack reveal
6. Chain of custody display on certificate page

### Phase 2: Market Data & Engagement
7. Price history auto-population on order completion
8. Price chart on sneaker detail page
9. Sneaker detail page enhancement (market data display)
10. Watchlist UI + API
11. Price alert system (in-app, stretch: email)

### Phase 3: Portfolio & Trading
12. Vault portfolio dashboard (value tracking, ROI per item)
13. Bid system (model, API, UI on sneaker pages)
14. Bid notification + management UI

### Phase 4: Seller & Growth
15. AI pricing suggestions (based on historical data)
16. Seller levels / reputation system
17. Release calendar

---

## 8. Success Metrics

- **Authentication trust:** Certificate page views, NFC scans, time-on-certificate-page
- **Trading velocity:** Average time from listing to sale (target: <24 hours)
- **Engagement:** Daily active users, vault items per user, watchlist items per user
- **Revenue:** Pack revenue, marketplace fee revenue, deposit volume
- **Retention:** 7-day and 30-day return rate
- **Authentication quality:** Fake detection rate, customer disputes rate (target: <0.5%)
