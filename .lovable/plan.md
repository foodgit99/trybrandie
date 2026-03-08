

## Plan: Switch to Paystack + Naira Currency

### Overview
There is no actual Stripe integration — the Plans page just shows a "Coming soon" toast. This plan updates pricing to Naira, creates Paystack checkout infrastructure, and wires up the upgrade buttons.

### Changes

**1. Update Plans page pricing (`src/pages/Plans.tsx`)**
- Change prices to Naira:
  - Free: ₦0
  - Entrepreneur: ₦12,500/mo
  - Creator: ₦22,500/mo
  - Agency: ₦59,000/mo
- Add Paystack plan codes to each tier
- On "Upgrade" click, call the Paystack checkout edge function and redirect to Paystack's hosted checkout URL
- Add loading state to buttons during checkout

**2. Store Paystack secret key**
- Use `add_secret` to store `PAYSTACK_SECRET_KEY`

**3. Create Paystack checkout edge function (`supabase/functions/paystack-checkout/index.ts`)**
- Accepts `{ plan, email, user_id }`
- Calls `https://api.paystack.co/transaction/initialize` with the amount in kobo and user metadata
- Returns the Paystack authorization URL for redirect

**4. Create Paystack webhook edge function (`supabase/functions/paystack-webhook/index.ts`)**
- Verifies webhook signature using HMAC SHA-512
- On `charge.success`, updates the user's `subscription_tier` in profiles

**5. Database migration**
- Add `subscription_tier` text column (default `'free'`) to `profiles` table

### Files Changed

| File | Change |
|---|---|
| `src/pages/Plans.tsx` | Naira pricing, Paystack checkout redirect |
| `supabase/functions/paystack-checkout/index.ts` | New — initialize Paystack transaction |
| `supabase/functions/paystack-webhook/index.ts` | New — handle payment confirmation |
| `supabase/config.toml` | Add function entries |
| DB migration | Add `subscription_tier` to profiles |

