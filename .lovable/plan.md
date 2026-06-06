## Goal
Add a fresh, v2-styled **Pricing** page for the new Brandie experience. Keep the existing credit-pack model (₦5,000 / 20 credits) and the existing one-time Paystack checkout. Leave `/plans` untouched as a fallback, and update the landing page pricing section to mirror the new design.

## Scope
1. **New route `/pricing`** (public + authenticated friendly).
2. **New component** `src/pages/v2/Pricing.tsx` — fully working: balance, slider, Paystack one-time checkout, callback verification, success state. Reuses `paystack-checkout` + `paystack-verify` edge functions exactly like `/plans`.
3. **Replace `LandingPricing`** body with the same visual treatment so the marketing site and in-app pricing tell the same story. Button on landing routes to `/auth` for guests and `/pricing` for signed-in users.
4. **No changes** to edge functions, DB, or the existing `/plans` page.

## UX (v2 visual language — warm neutral palette, serif headings, generous whitespace)
- Hero: "Pay only for what you create." + sub-copy framing it as no subscription, no expiry.
- Single Credit Pack card (the hero unit):
  - Slider 1–10 units, default 2, with live `credits` and `₦price` big numerals.
  - Per-credit rate caption ("₦250 / credit").
  - Primary CTA: `Buy {credits} credits — ₦{price}` (Paystack flow).
  - Guest CTA: `Sign up to buy` → `/auth?next=/pricing`.
- Side panel with what every credit unlocks (uses existing `features` list from `LandingPricing`).
- "Current balance" pill only when authed (mirrors `/plans`).
- Post-payment success state identical to `/plans` (verify polling, invalidate `profile` queries, CTA → `/cockpit`).
- SEO tags via `<SEO>` (title <60, desc <160, canonical `/pricing`, indexable).

## Technical details
- File: `src/pages/v2/Pricing.tsx` — copy the verification + checkout logic from `src/pages/Plans.tsx` lines 40–153; restyle the layout in v2 tokens.
- `callback_url` passed to `paystack-checkout` → `https://trybrandie.com/pricing` so the redirect lands back on the new page.
- Route in `src/App.tsx`: `<Route path="/pricing" element={<V2Pricing />} />` (public, no `ProtectedRoute` — but checkout button gates on `user`).
- Landing: rewrite `src/components/landing/LandingPricing.tsx` body to the new layout. Keep constants (`PRICE_PER_UNIT`, `CREDITS_PER_UNIT`, `formatNaira`, `features`). CTA: `navigate(user ? "/pricing" : "/auth?next=/pricing")` — read `user` from `useAuth`.
- Header: use `AppHeader` when `user` exists, else a slim landing-style nav (mirrors how other v2 pages handle it).
- No new dependencies. No design tokens added — reuse existing `primary`, `accent`, `secondary`, `border`, `card`, `muted-foreground`.

## Verification
1. `/pricing` renders for both guest and authed users; slider math correct; CTA disabled while loading.
2. Click CTA while signed in → redirected to Paystack → returning to `/pricing?reference=…` shows verifying → success state, credits visible in header.
3. Landing pricing section visually matches `/pricing` and routes correctly.
4. `/plans` still works unchanged.

## Out of scope
- Subscription billing, multiple tiers, recurring Paystack plans.
- WhatsApp pricing copy, currency switcher, coupon codes.
- Removing or deprecating `/plans`.
