## Context

The affiliate system is already substantially built:
- `/affiliate/signup` (633 lines) — application form with hero, tier explanation
- `/affiliate` — dashboard with stats, milestones, links, commissions/referrals/network/payouts tabs, payout request flow
- Admin approval queue in `/admin`
- 7 email templates wired in `send-email`: application received, approved, rejected, new referral, commission earned, new recruit, network referral
- Monthly digest cron (`affiliate-monthly-digest`)
- 2-tier commission engine in `paystack-webhook` (20% direct first / 5% lifetime, 5% network first / 3% lifetime)
- Milestone gamification with confetti

Two things are missing for the experience to feel complete: **(1)** a public marketing page that converts cold visitors (creators, influencers, agencies) before they hit the signup form, and **(2)** a dashboard polish pass — the current dashboard is functional but utilitarian.

---

## 1. Public Affiliate Marketing Page (`/affiliates`)

New route, **no auth required**, separate from `/affiliate/signup`. Targets cold traffic from social, blog, outreach.

### Sections (top to bottom)
1. **Hero** — Headline ("Turn your audience into income"), subhead, dual CTA: "Apply now" → `/affiliate/signup`, "See earnings calculator" → smooth scroll. Trust strip (Nigerian payouts, monthly, no cap).
2. **Why Brandie** — 3 cards: real product creators love, recurring commissions, 2-tier network earnings.
3. **How it works** — 4-step visual: Apply → Get approved → Share your link → Earn monthly.
4. **Commission breakdown** — Two-column comparison of Tier 1 (Direct: 20% first + 5% lifetime) vs Tier 2 (Network: 5% first + 3% lifetime), with worked examples.
5. **Live earnings calculator** — Interactive: sliders for "referrals/month" and "recruited affiliates", live ₦ output for month 1, month 6, year 1. Pure client-side math using existing commission formulas.
6. **Who it's for** — Three persona cards: Creators, Influencers, Agencies. Each with 2-3 bullets on fit.
7. **Marketing assets preview** — Mock of swipe copy + banner kit that approved affiliates get (deliverable becomes a dashboard tab in section 2 below).
8. **Milestones teaser** — Show the 7 milestone tiers (₦10K → ₦1M Legend) as social proof of upside.
9. **FAQ** — 8 questions: eligibility, payout schedule, minimum payout, cookie window, tax, cross-border, what counts as a referral, support.
10. **Final CTA** — "Apply in 2 minutes" → `/affiliate/signup`.

### Implementation
- New page `src/pages/AffiliateMarketing.tsx`
- Route in `src/App.tsx`: `<Route path="/affiliates" element={<AffiliateMarketing />} />` (note plural to distinguish from existing `/affiliate`)
- Reuse landing-page primitives: `LandingNav`, `LandingFooter`, brand tokens
- SEO: title "Brandie Affiliate Program — Earn 20% + Lifetime Commissions", description, og image, JSON-LD `FAQPage` for the FAQ section
- Add link from `LandingFooter` "Affiliates"
- Update `public/sitemap.xml` + `public/robots.txt` (allow)
- Extract commission constants into `src/lib/affiliateConfig.ts` so calculator and signup page share one source of truth

---

## 2. Dashboard Polish (`/affiliate`)

Keep all existing logic; reorganize and elevate the UI.

### Header redesign
- Replace flat 6-stat grid with a 2-row layout:
  - **Hero row**: large "Total Earned" with sparkline of last 30 days, plus prominent "Request Payout" button when balance available
  - **Secondary row**: 4 compact stat chips (Direct, Network, Pending, Available)
- Add a "Tier status" badge next to greeting based on highest milestone reached (e.g. "💎 Diamond Affiliate")

### Links section
- Combine Referral + Recruitment links into a single "Share & Recruit" card with tabs
- Add "Copy with UTMs" toggle, QR code generator, and pre-written swipe copy buttons (X, WhatsApp, Email, Instagram bio)
- Auto-shortened display of the link

### New tab: Marketing Kit
- Downloadable banner images (use existing brand assets; 3 sizes: square, story, banner)
- Swipe copy library: 6 pre-written posts (educational, promotional, testimonial, story) — copy-to-clipboard
- Email template: text to send to a friend/list
- Disclosure snippet (FTC-style "I may earn a commission")

### Network tab upgrade
- Visual tree: you → recruited affiliates → their referral counts (2 levels deep, read-only)
- Show recruited affiliate's monthly contribution to your earnings

### Payouts tab
- Add minimum payout threshold notice (configurable, default ₦5,000)
- Payout status timeline (requested → approved → processing → paid) instead of bare badge
- Show estimated arrival date based on current weekday

### Empty states
- All four tabs: replace plain "No X yet" text with branded empty-state component (icon + headline + single CTA "Copy your link")

### Mobile
- Verify stats wrap cleanly; convert tabs to scrollable pills on `<sm`
- Ensure floating nav doesn't overlap CTAs (respect safe-area, per project memory)

### Implementation
- Refactor `AffiliateDashboard.tsx` into focused subcomponents under `src/components/affiliate/`:
  - `AffiliateHeader.tsx`, `ShareKitCard.tsx`, `MarketingKitTab.tsx`, `NetworkTree.tsx`, `PayoutTimeline.tsx`, `EmptyState.tsx`
- Add `src/lib/affiliateAssets.ts` listing marketing kit URLs (placeholder paths; actual asset generation deferred)
- No DB schema changes required for this pass
- Reuse existing data fetched in `loadData()`

---

## Out of scope for this round
- Payout flow rework + payout-related emails (would be next milestone)
- Lifecycle automation (inactivity nudges, monthly performance email beyond existing digest)
- Generating real banner image assets (will use brand-tokened placeholders for now)

---

## Files

**New**
- `src/pages/AffiliateMarketing.tsx`
- `src/components/affiliate/AffiliateHeader.tsx`
- `src/components/affiliate/ShareKitCard.tsx`
- `src/components/affiliate/MarketingKitTab.tsx`
- `src/components/affiliate/NetworkTree.tsx`
- `src/components/affiliate/PayoutTimeline.tsx`
- `src/components/affiliate/EmptyState.tsx`
- `src/lib/affiliateConfig.ts`
- `src/lib/affiliateAssets.ts`

**Edited**
- `src/App.tsx` (new route)
- `src/pages/AffiliateDashboard.tsx` (compose new subcomponents)
- `src/components/landing/LandingFooter.tsx` (link)
- `public/sitemap.xml`, `public/robots.txt`
