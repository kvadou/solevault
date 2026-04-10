# Security Audit — SoleVault
**Date:** 2026-04-08
**Stack:** Next.js 16 (App Router), NextAuth v5 (JWT strategy), Prisma 6, PostgreSQL, Stripe, TypeScript strict
**Deployment:** Vercel

---

## TRACK A — OWASP & Auth Security

### #1 — Rate Limiting on API Routes ❌ FAIL (CRITICAL)
No rate limiting middleware found anywhere. No `middleware.ts` exists. No `@upstash/ratelimit`, `express-rate-limit`, or any throttling library installed.

**Exposed routes without limits:**
- `POST /api/auth/register` — brute-force account creation
- `POST /api/bids` — bid spam
- `POST /api/orders` — order flooding
- `POST /api/packs/rip` — pack rip abuse
- All public/authenticated endpoints

---

### #2 — Auth Tokens in localStorage ✅ PASS (CRITICAL)
No `localStorage` usage detected. NextAuth v5 uses httpOnly cookies via JWT session strategy. Auth tokens are never exposed to client JS.

---

### #3 — Input Sanitization on Forms ⚠️ PARTIAL (CRITICAL)
Most routes do basic presence checks but **no Zod or validation library** is used anywhere.

**Critical gap — `/api/sneakers` POST** (`src/app/api/sneakers/route.ts:41`):
```ts
const sneaker = await prisma.sneaker.create({ data: body });
```
Raw `body` passed directly to Prisma with zero validation. Admin-only but still allows injection of arbitrary fields (e.g., `id`, `createdAt`).

**Other gaps:**
- `/api/auth/register` — no email format check, no password minimum length (`src/app/api/auth/register/route.ts`)
- `/api/bids` POST — no upper bound on `amountCents` or `expiresInDays` (`src/app/api/bids/route.ts`)
- No DOMPurify or HTML sanitization on any user-facing string fields

**What's OK:** Prisma ORM prevents SQL injection. Some routes have allowlist validation (condition, context fields).

---

### #4 — Hardcoded API Keys in Frontend ✅ PASS (CRITICAL)
- `.env` and `.env.local` are in `.gitignore` — not tracked in git (confirmed)
- No hardcoded keys found in source files
- `STRIPE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET`, `ENTRUPY_API_KEY` all loaded via `process.env` server-side only
- No secret keys in `NEXT_PUBLIC_*` namespace

---

### #5 — Stripe Webhooks Without Signature Verification ⚠️ PARTIAL (HIGH)
**Stripe webhook** (`src/app/api/webhooks/route.ts:19`): `stripe.webhooks.constructEvent()` is called correctly. ✅

**Entrupy webhook** (`src/app/api/webhooks/entrupy/route.ts:8`): Signature verification only runs **if** `ENTRUPY_WEBHOOK_SECRET` is set:
```ts
if (ENTRUPY_WEBHOOK_SECRET) { // skipped if env var missing! }
```
If this env var is not configured in production, the endpoint accepts unauthenticated POST requests that can manipulate authentication certificate statuses.

---

### #8 — Sessions That Never Expire ⚠️ PARTIAL (HIGH)
`src/lib/auth.ts`: NextAuth configured with `session: { strategy: "jwt" }` but **no `maxAge` set**. NextAuth default JWT expiry is 30 days, which is acceptable but not explicitly set.

No explicit `maxAge` on session config:
```ts
session: { strategy: "jwt" }, // missing maxAge
```
Should explicitly set: `session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }`.

---

### #10 — Password Reset Links That Don't Expire ✅ N/A (HIGH)
No custom password reset flow exists in the codebase. Users authenticate via Google OAuth or credentials. No reset token mechanism found. If/when password reset is added, token expiry must be implemented.

---

### #16 — Admin Routes With No Role Checks ✅ PASS (CRITICAL)
All 15 admin API routes checked. Every single one has a role check:
```ts
if (!session?.user || session.user.role !== "admin") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```
Consistent pattern across all routes in `src/app/api/admin/`.

---

## TRACK B — Data & Performance

### #6 — Database Indexing on Queried Fields ⚠️ PARTIAL (MEDIUM)
Good indexing in place for most high-traffic tables. However:

**Missing indexes:**
- `VaultItem` — `ownerId` frequently queried but no `@@index([ownerId])` (`prisma/schema.prisma`)
- `VaultItem` — `status` queried constantly in filters, no standalone index
- `Listing` — `sellerId` and `status` queried together, no composite index
- `Order` — `buyerId`, `sellerId` queried but no indexes

**Present indexes:** `WalletTransaction`, `PackRip`, `BuybackTransaction`, `Bid`, `Notification`, `AuthenticationCertificate`, `NfcTag`, `RevenueShare`, `ConditionReport`, `OwnershipRecord`, `Release` all have appropriate indexes.

---

### #9 — Pagination on Database Queries ⚠️ PARTIAL (HIGH)
Most user-facing routes have `take:` limits. Unbounded queries exist in admin routes:

**No pagination:**
- `GET /api/admin/submissions` — `findMany()` with no `take` (`src/app/api/admin/submissions/route.ts:11`)
- `GET /api/admin/verifications` — `findMany()` with no `take` (`src/app/api/admin/verifications/route.ts:22`)
- `GET /api/admin/drops` — `findMany()` with no `take` (`src/app/api/admin/drops/route.ts:11`)
- `GET /api/admin/packs` — `findMany()` with no `take` (`src/app/api/admin/packs/route.ts:11`)

Admin routes returning unlimited rows are lower risk but will cause performance degradation at scale.

---

### #15 — Database Connection Pooling ❌ FAIL (MEDIUM)
`DATABASE_URL` is currently pointing to `localhost` (dev environment). No connection pooling configured.

For Vercel deployment, each serverless function creates its own Prisma client connection. Without PgBouncer or `connection_limit=1` in the DATABASE_URL, this will exhaust PostgreSQL connections under load.

No `?connection_limit=` or `?pgbouncer=true` params found. No Prisma Accelerate configured.

---

### #19 — Backup Strategy ❌ FAIL (CRITICAL)
No backup strategy documented or configured. No backup scripts, cron jobs, or platform backup configuration found. Vercel does not provide PostgreSQL backup — the database provider (likely external Postgres or Supabase) needs PITR or scheduled backups configured explicitly.

---

## TRACK C — Frontend & Resilience

### #7 — Error Boundaries in UI ❌ FAIL (MEDIUM)
No `error.tsx` or `global-error.tsx` files found anywhere in `src/`. No `ErrorBoundary` component or `componentDidCatch` usage detected.

Any unhandled React error will crash the entire page with a blank screen for users.

---

### #11 — Environment Variable Validation at Startup ❌ FAIL (MEDIUM)
No env validation library (`@t3-oss/env-nextjs`, `envalid`, `zod` env schema). All env vars are consumed directly with `process.env.X!` non-null assertions. If `STRIPE_SECRET_KEY`, `DATABASE_URL`, or `NEXTAUTH_SECRET` are missing, the app will throw runtime errors instead of failing fast at startup with a clear message.

Key unvalidated vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ENTRUPY_API_KEY`, `ENTRUPY_WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`.

---

### #12 — Images Uploaded Directly to Server ✅ PASS (MEDIUM)
No file upload endpoints found. `imageUrls` fields in the API accept URL strings (presumably externally hosted). No `multer`, `formidable`, or server-side file write operations detected. Images are stored as URL strings pointing to external sources.

---

### #13 — CORS Policy ✅ PASS (HIGH)
Next.js App Router — same-origin by default. No Express CORS middleware needed. No `Access-Control-Allow-Origin: *` found. No explicit CORS configuration needed for this architecture.

---

### #14 — Emails Sent Synchronously ✅ N/A (MEDIUM)
No email sending code found in the codebase. No nodemailer, Resend, SendGrid, or Postmark integration. If email is added later, use an async API (Resend recommended).

---

### #18 — Production Logging ❌ FAIL (HIGH)
Only `console.log` / `console.error` present. No structured logging, no log aggregation service (Sentry, LogRocket, Datadog, etc.).

Instances found:
- `src/app/api/verify/submit/route.ts:68` — error swallowed with `console.error`
- `src/app/api/webhooks/entrupy/route.ts:86` — errors not reported
- `src/lib/trust-score.ts:152` — trust score failures silently logged to console only

In production (Vercel), console logs are ephemeral. Any runtime error is invisible unless captured by an error tracking service.

---

## TRACK D — Infrastructure & TypeScript

### #17 — Health Check Endpoint ❌ FAIL (MEDIUM)
No `/api/health`, `/api/ping`, or `/api/status` endpoint found. No uptime monitoring configured. Vercel has basic deployment health but no application-level health check.

---

### #20 — TypeScript Strict Mode ✅ PASS (HIGH)
`tsconfig.json` has `"strict": true`. Zero `any` usages detected in `src/` TypeScript files. Full type safety enforced.

---

## SCORECARD

```
=================================================================
SECURITY AUDIT SCORECARD — SoleVault
Date: 2026-04-08
Stack: Next.js 16, NextAuth v5 (JWT), Prisma 6, PostgreSQL, Stripe, Vercel
=================================================================

TRACK A — OWASP & Auth Security
 #1  Rate Limiting .............. FAIL     CRITICAL
 #2  Auth Token Storage ......... PASS     CRITICAL
 #3  Input Sanitization ......... PARTIAL  CRITICAL
 #4  Hardcoded API Keys ......... PASS     CRITICAL
 #5  Webhook Verification ....... PARTIAL  HIGH
 #8  Session Expiry ............. PARTIAL  HIGH
 #10 Password Reset Expiry ...... N/A      HIGH
 #16 Admin Role Checks .......... PASS     CRITICAL

TRACK B — Data & Performance
 #6  Database Indexing ........... PARTIAL  MEDIUM
 #9  Pagination ................. PARTIAL  HIGH
 #15 Connection Pooling ......... FAIL     MEDIUM
 #19 Backup Strategy ............ FAIL     CRITICAL

TRACK C — Frontend & Resilience
 #7  Error Boundaries ........... FAIL     MEDIUM
 #11 Env Var Validation ......... FAIL     MEDIUM
 #12 Image Upload Strategy ...... PASS     MEDIUM
 #13 CORS Policy ................ PASS     HIGH
 #14 Async Email Sending ........ N/A      MEDIUM
 #18 Production Logging ......... FAIL     HIGH

TRACK D — Infrastructure & TypeScript
 #17 Health Check Endpoint ...... FAIL     MEDIUM
 #20 TypeScript Strict Mode ..... PASS     HIGH

=================================================================
SCORE: 6 PASS + 2 N/A = 8/18 applicable | 2 CRITICAL FAIL | 2 HIGH FAIL | 4 MEDIUM FAIL | 6 PARTIAL
=================================================================
```

---

## TOP 3 FIXES

### Fix #1 — Rate Limiting (CRITICAL | Quick Fix ~30 min)

**Problem:** Zero rate limiting on any API route. `/api/auth/register`, `/api/packs/rip`, `/api/orders` are all open to abuse.

**Fix:** Add Upstash Rate Limit via middleware:

```bash
npm install @upstash/ratelimit @upstash/redis
```

Create `src/middleware.ts`:
```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "10 s"),
});

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
```

---

### Fix #2 — Backup Strategy (CRITICAL | Moderate ~1-2 hrs)

**Problem:** No database backups configured. A single bad migration or data corruption = permanent loss.

**Fix (choose one):**
- **Supabase:** Enable Point-in-Time Recovery in Dashboard > Project Settings > Database
- **Neon/Railway/Render:** Enable automated daily backups in platform settings
- **DIY:** Add a cron job to `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/trust-scores", "schedule": "0 4 * * *" },
    { "path": "/api/cron/db-backup", "schedule": "0 2 * * *" }
  ]
}
```
At minimum, document where the database lives and confirm your provider has automatic backups enabled.

---

### Fix #3 — Entrupy Webhook Verification + Production Logging (HIGH | Quick Fix ~45 min total)

**Problem A:** Entrupy webhook skips signature check if `ENTRUPY_WEBHOOK_SECRET` is not set (`src/app/api/webhooks/entrupy/route.ts:8`). An attacker can POST fake auth results and mark counterfeit shoes as verified.

**Fix:**
```ts
// Hard fail if secret not configured — don't silently accept unauthenticated webhooks
if (!ENTRUPY_WEBHOOK_SECRET) {
  return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
}
```

**Problem B:** No error tracking. `console.error` in Vercel is ephemeral.

**Fix:** Install Sentry (5 min):
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```
This captures all unhandled errors, API route crashes, and gives you a dashboard. Free tier covers this project's scale.

---

## Additional Items (Backlog)

| Item | File | Effort |
|------|------|--------|
| Add `@@index([ownerId])` to VaultItem | `prisma/schema.prisma` | 15 min |
| Add `maxAge` to NextAuth session config | `src/lib/auth.ts` | 5 min |
| Add input validation (Zod) to register route | `src/app/api/auth/register/route.ts` | 20 min |
| Fix raw body passthrough in sneaker POST | `src/app/api/sneakers/route.ts:41` | 15 min |
| Add `global-error.tsx` to app root | `src/app/global-error.tsx` | 20 min |
| Add env validation with `@t3-oss/env-nextjs` | `src/env.ts` | 30 min |
| Add `?connection_limit=1` to DATABASE_URL | `.env` + deployment config | 10 min |
| Add `/api/health` endpoint | `src/app/api/health/route.ts` | 10 min |
