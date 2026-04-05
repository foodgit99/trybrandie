

## Plan: Flexible Credit-Pack Pricing Model

### Overview
Replace the 4-tier subscription model with a simple, slider-based "Buy Credits" interface. Credits are sold in ₦5,000 increments (20 credits per increment). Users drag a slider to choose how many credits they want, with a default of 40 credits (₦10,000) for new users. The slider range is 20–200 credits (₦5,000–₦50,000).

### UI Design (inspired by the attached screenshot)
- Clean card with "Buy Credits" header and credit card icon
- Large credit count on the left, large price on the right (in accent color)
- Slider with gradient track (pink-to-purple like the reference)
- Min/max labels beneath the slider ("20 credits" / "200 credits")
- Breakdown line: e.g. "2 × ₦5,000 — ₦10,000"
- Large gradient CTA button: "⚡ Buy {N} Credits — ₦{price}"
- Subtle footer text: "₦5,000 per 20 credits"
- Payment verification and success states remain as-is

### Changes

**1. `src/pages/Plans.tsx`** — Complete rewrite of the main content
- Remove the 4-tier grid
- Add slider state (`units`, default = 2, range 1–10)
- Computed values: `credits = units * 20`, `price = units * 5000`
- Use the existing `Slider` component from `@/components/ui/slider`
- Gradient-styled CTA button
- Keep the existing Paystack verification flow and success screen intact
- Update `handleUpgrade` to pass `credits` and `amount` instead of a plan key

**2. `supabase/functions/paystack-checkout/index.ts`** — Accept flexible amounts
- Instead of looking up plan from `PLAN_AMOUNTS`, accept `credits` and `amount` directly
- Validate: `amount === credits / 20 * 500000` (₦5,000 in kobo per 20 credits)
- Validate min/max bounds (20–200 credits)
- Pass `credits` in metadata instead of `plan`

**3. `supabase/functions/paystack-verify/index.ts`** — Handle credit deposits
- Read `credits` from metadata instead of `plan`
- Add `credits` to the user's `paid_credits` pool (additive)
- No longer update `subscription_tier` (no tiers in this model)
- Return `credits` and `amount` in the success response

**4. `supabase/functions/paystack-webhook/index.ts`** — Handle credit deposits
- Read `credits` from metadata
- Add to `paid_credits` pool (same additive logic)
- Remove the old `paidCreditDeposits` tier map
- Affiliate commission tracking stays the same

**5. `src/components/landing/LandingPricing.tsx`** — Simplified landing pricing
- Replace the 4-card grid with a single "Buy Credits" card matching the in-app UI style
- Show the slider experience as a preview with a "Get started free" CTA
- Keep the "5 free credits/month" mention
- Add feature highlights below (no watermark, all formats, etc.)

### Files Changed
- `src/pages/Plans.tsx`
- `src/components/landing/LandingPricing.tsx`
- `supabase/functions/paystack-checkout/index.ts`
- `supabase/functions/paystack-verify/index.ts`
- `supabase/functions/paystack-webhook/index.ts`

