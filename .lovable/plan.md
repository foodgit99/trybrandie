

# Plan: Simplify Credit System — 5 Monthly + Consumable Bonus/Paid

## Current System
- Each tier gets a monthly allowance (free=10, entrepreneur=50, creator=150, agency=400) that resets via `generations_count` / `generations_reset_at`
- `bonus_credits` is a separate consumable pool (earned via referrals)
- Credits remaining = `tierLimit + bonusCredits - generationsUsed`
- All tier credits renew monthly; bonus credits are consumed first

## New System
- **Every user gets exactly 5 free credits per month** (regardless of tier)
- **Bonus credits** (referrals) are one-time consumable — once used, gone forever
- **Paid credits** (from subscriptions) are one-time consumable — once used, gone forever
- The monthly reset only replenishes 5 free credits, nothing else

### New Credit Model
- `generations_count` tracks usage of the 5 monthly free credits (resets monthly)
- `bonus_credits` stays as-is (consumed, never renewed)
- New column: `paid_credits` (purchased via subscription, consumed, never renewed)
- **Credits remaining** = `(5 - monthlyUsed) + bonus_credits + paid_credits`
- **Deduction order**: free monthly credits first → bonus credits → paid credits

### What Paid Plans Give You
When a user subscribes to a tier, they receive a one-time deposit of paid credits:
- Entrepreneur: 50 paid credits added
- Creator: 150 paid credits added
- Agency: 400 paid credits added

These do NOT renew automatically. Each billing cycle would need to re-deposit credits (handled by the payment webhook).

## Changes

### 1. Database Migration
Add `paid_credits` column to `profiles` table (integer, default 0, not null).

### 2. Frontend — AppHeader.tsx
- Remove `getTierLimit` function
- Change display: remaining = `max(0, 5 - monthlyUsed) + bonus_credits + paid_credits`
- Show total remaining without a "/ limit" denominator (since there's no fixed cap)

### 3. Frontend — Index.tsx (Dashboard Credit Summary)
- Same formula: remaining = free remaining + bonus + paid
- Update labels from "Credits This Month" to reflect the new model

### 4. Frontend — DesignStudio.tsx
- Update `getCreditsRemaining` to use new formula
- Update credit check logic

### 5. Frontend — Settings.tsx
- Update credit display text

### 6. Frontend — Plans.tsx
- Update plan descriptions (e.g., "50 one-time credits" instead of "50 credits/mo")

### 7. Edge Functions — All 5 functions
Update credit availability check and deduction logic in:
- `design-studio/index.ts` (2 deduction blocks)
- `video-studio/index.ts`
- `video-render/index.ts`
- `brand-engine/index.ts`
- `logo-designer/index.ts`

New deduction order: free monthly → bonus → paid.
New availability check: `freeRemaining + bonus_credits + paid_credits >= cost`

### 8. Payment Webhook — `paystack-webhook/index.ts`
When a subscription payment succeeds, deposit the tier's credit amount into `paid_credits` (additive) instead of just setting `subscription_tier`.

## Files Changed
1. **Migration** — add `paid_credits` column
2. **`src/components/AppHeader.tsx`** — new credit formula
3. **`src/pages/Index.tsx`** — dashboard credit display
4. **`src/pages/DesignStudio.tsx`** — credit check
5. **`src/pages/Settings.tsx`** — credit display text
6. **`src/pages/Plans.tsx`** — plan descriptions
7. **`supabase/functions/design-studio/index.ts`** — deduction logic
8. **`supabase/functions/video-studio/index.ts`** — deduction logic
9. **`supabase/functions/video-render/index.ts`** — deduction logic
10. **`supabase/functions/brand-engine/index.ts`** — deduction logic
11. **`supabase/functions/logo-designer/index.ts`** — deduction logic
12. **`supabase/functions/paystack-webhook/index.ts`** — deposit paid credits on payment

