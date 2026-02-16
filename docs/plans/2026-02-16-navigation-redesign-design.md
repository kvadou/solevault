# Navigation Redesign — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce the logged-in top navbar from 14 items to 6 by consolidating navigation into two section tabs with context-aware left sidebars.

**Architecture:** Client-side path detection via `usePathname()` determines which sidebar to show. A shared `SectionLayout` component wraps page content and conditionally renders a sidebar based on the current route. No route groups or file moves needed.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS, Lucide icons.

---

## Current Problem

The logged-in navbar shows 14 items in a single horizontal row:

```
Logo | Marketplace | Packs | Drops | Releases | My Vault | Portfolio | Orders | Watchlist | My Bids | 🔔 | $0.00 | Admin | Username + Sign Out
```

This is visually overwhelming and doesn't scale.

## Design

### Top Nav (Logged In)

```
[Vault] SoleVault     Marketplace  My Vault     [🔔] [$12.50] [DK ▾]
```

**6 items total:**
- **Left:** Logo → `/`
- **Center:** Two section tabs with active underline indicator
  - "Marketplace" → `/marketplace` (Browse section)
  - "My Vault" → `/vault` (Manage section)
- **Right utility cluster:**
  - Bell icon with existing notification popover (unchanged behavior)
  - Wallet balance chip → `/wallet`
  - Avatar circle (user initials) with dropdown chevron

**Avatar dropdown contents:**
- User name / email (display only, muted text)
- "Admin Panel" link (only if admin role) → `/admin`
- "Sign Out" button

**Top Nav (Logged Out):**
```
[Vault] SoleVault          Marketplace          [Sign In]
```
Only "Marketplace" tab visible. No "My Vault" (requires auth).

### Context Sidebars

Sidebars appear on the left when inside a section. They match the existing admin sidebar styling: `w-56`, border-right, muted background, icon + label links with active state highlighting.

**Marketplace sidebar** (visible on these paths):

| Icon | Label | Path |
|------|-------|------|
| ShoppingBag | Browse All | `/marketplace` |
| Gift | Packs | `/packs` |
| Flame | Drops | `/drops` |
| Calendar | Releases | `/releases` |

**My Vault sidebar** (visible on these paths):

| Icon | Label | Path |
|------|-------|------|
| Vault | My Items | `/vault` |
| Plus | Vault a Pair | `/vault/submit` |
| PieChart | Portfolio | `/vault/portfolio` |
| ShoppingCart | Orders | `/orders` |
| Eye | Watchlist | `/watchlist` |
| Gavel | My Bids | `/bids` |

**Pages with NO sidebar** (full-width content):
- `/` (homepage)
- `/auth/signin`
- `/sneakers/[id]` (sneaker detail)
- `/verify/[id]` (trust profile)
- `/certificate/[itemId]`
- `/nfc/*` (register, purchase, check-in)
- `/notifications` (linked from bell popover)
- `/wallet` (linked from wallet chip)
- `/sellers/[id]`

### Active State Logic

The top nav tabs determine which section is "active" based on pathname:
- **Marketplace active** when path starts with: `/marketplace`, `/packs`, `/drops`, `/releases`
- **My Vault active** when path starts with: `/vault`, `/orders`, `/watchlist`, `/bids`
- **Neither active** on standalone pages (homepage, sneaker detail, etc.)

### Mobile Navigation

**Top bar (mobile, logged in):**
```
[Vault] SoleVault                    [🔔] [☰]
```

Section tabs collapse into the hamburger. Bell stays visible for quick access.

**Hamburger menu** (slide-out from right, grouped sections):

```
BROWSE
  📦 Browse All
  🎁 Packs
  🔥 Drops
  📅 Releases

MY VAULT
  🏦 My Items
  📊 Portfolio
  🛒 Orders
  👁 Watchlist
  ⚖️ My Bids

─────────────────
  💰 Wallet  ···  $12.50
  🛡 Admin
  🚪 Sign Out
```

Section headers ("BROWSE", "MY VAULT") are small uppercase muted labels, not clickable.

### Mobile Sidebar Behavior

On mobile, context sidebars are **hidden** — the hamburger menu serves as the navigation. Pages render full-width. This matches the admin panel's existing mobile behavior (it uses a bottom tab bar on mobile but hides the sidebar).

---

## Implementation Architecture

### Files to Create

1. **`src/components/layout/AppSidebar.tsx`** — Shared sidebar component
   - Props: `section: "marketplace" | "vault" | null`
   - Returns `null` when section is null
   - Renders nav items with icons, active state based on `usePathname()`
   - Matches admin sidebar styling (w-56, border-r, bg-muted, etc.)

2. **`src/components/layout/SectionLayout.tsx`** — Layout wrapper
   - Uses `usePathname()` to detect current section
   - Renders `<AppSidebar>` + `<div className="flex-1">{children}</div>` in flex row
   - Returns just `{children}` when no section matches (standalone pages)

3. **`src/components/layout/AvatarDropdown.tsx`** — User menu dropdown
   - Avatar circle with user initials
   - Dropdown with user info, Admin link (conditional), Sign Out
   - Click-outside-to-close behavior

### Files to Modify

4. **`src/components/layout/Navbar.tsx`** — Major rewrite
   - Remove all per-link items (Marketplace, Packs, My Vault, Portfolio, etc.)
   - Add two section tab links: "Marketplace" and "My Vault"
   - Add active underline indicator based on current section
   - Replace username + Sign Out with AvatarDropdown
   - Keep Bell notification popover (unchanged)
   - Keep Wallet balance chip
   - Rewrite mobile hamburger with grouped sections

5. **`src/app/layout.tsx`** — Wrap children with SectionLayout
   - Change: `<main>{children}</main>` → `<main><SectionLayout>{children}</SectionLayout></main>`

### Files NOT Changed
- Admin layout (`src/app/admin/layout.tsx`) — keeps its own sidebar
- All page components — their content stays identical
- All API routes — no changes
- Individual page content/styling — untouched

### Section Detection Logic (SectionLayout)

```typescript
const MARKETPLACE_PATHS = ["/marketplace", "/packs", "/drops", "/releases"];
const VAULT_PATHS = ["/vault", "/orders", "/watchlist", "/bids"];

function getSection(pathname: string): "marketplace" | "vault" | null {
  if (MARKETPLACE_PATHS.some(p => pathname.startsWith(p))) return "marketplace";
  if (VAULT_PATHS.some(p => pathname.startsWith(p))) return "vault";
  return null;
}
```

### Admin Section Interaction

The admin section keeps its own sidebar. When a user navigates to `/admin/*`, the `SectionLayout` returns `null` for its sidebar (since `/admin` doesn't match marketplace or vault paths), and the admin layout provides its own sidebar. No conflict.

---

## Before / After Summary

| Aspect | Before | After |
|--------|--------|-------|
| Top nav items (logged in) | 14 | 6 |
| Navigation depth | Everything flat | 2-level (section → page) |
| Sidebar | Only admin | Marketplace, Vault, Admin |
| Mobile menu | Flat list of 14 items | Grouped sections |
| User controls | Username + Sign Out visible | Avatar dropdown |
| Wallet | Text link in nav | Compact chip in utility area |
