

## Plan: Fix Post-Payment Redirect

### Problem
After Paystack payment, users get stuck on Paystack's success page because the `callback_url` uses `window.location.origin` (preview URL) instead of the published domain.

### Changes

**1. `src/pages/Plans.tsx` (line 138)**
Change `callback_url` from `window.location.origin + "/plans"` to `"https://trybrandie.com/plans"`.

**2. `supabase/functions/paystack-checkout/index.ts`**
Add a fallback: if `callback_url` is not provided or contains "lovable.app", override it with `"https://trybrandie.com/plans"`.

This ensures Paystack always redirects to the correct published domain after payment, regardless of where the checkout was initiated.

### Files Changed

| File | Change |
|---|---|
| `src/pages/Plans.tsx` | Hardcode callback_url to `https://trybrandie.com/plans` |
| `supabase/functions/paystack-checkout/index.ts` | Add server-side fallback for callback_url |

