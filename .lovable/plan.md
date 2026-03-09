

## Root Cause

The `process_referral()` function is **only called at the end of the 10-step onboarding flow** in `Onboarding.tsx` (line 214). If a referred user signs up but doesn't complete onboarding, the referrer never gets their 5 credits.

Your referred user signed up (their profile has `referred_by: "b9879b7d"`) but didn't finish onboarding, so `process_referral` was never triggered. The `referral_rewards` table is empty.

You also said you want the reward to trigger **after the referred user's first design**, not onboarding.

## Plan

**1. Move `process_referral` call from Onboarding to first design creation**

In `src/contexts/DesignGenerationContext.tsx`, after a **new design** is successfully inserted (line 182, inside the `if (!saveErr && designData?.id)` block):

- Call `supabase.rpc("process_referral", { p_user_id: user_id })`
- If it returns `success: true`, fire the `referral_reward` email to the referrer (same logic currently in Onboarding.tsx)
- Wrap in try/catch so it never blocks the design flow
- This is fire-and-forget; it's idempotent (the function checks `already_claimed`)

**2. Remove the `process_referral` call from `src/pages/Onboarding.tsx`**

Remove lines 212-222 (the referral processing block) since it will now live in the design generation context.

**3. Manually award the missed referral for your existing referred user**

Run a one-time database call to process the existing referral that was missed:
```sql
SELECT process_referral('5aabab23-b6e0-4127-a6ca-b7a4edc82a71');
```

### Files Changed

| File | Change |
|---|---|
| `src/contexts/DesignGenerationContext.tsx` | Add `process_referral` call after first design insert |
| `src/pages/Onboarding.tsx` | Remove referral processing block |

