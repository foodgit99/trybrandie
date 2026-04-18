

## Root Cause

The Design Studio's client-side pre-flight credit check (`checkGenerationLimit`) and the in-page credits badge (`getCreditsRemaining`) in `src/pages/DesignStudio.tsx` only sum **free + bonus + paid** credits. They never include **reward credits**.

So when a user's 20-credit balance comes entirely from admin-granted reward credits, the Studio blocks generation with the "Generation limit reached" modal — even though:
- The header (correctly) shows 20 credits
- The backend would (correctly) deduct from the reward bucket if it ever got the request

I confirmed this against the database: at least 10 users right now have 0 free/bonus/paid but 20–40 active reward credits. Every one of them is currently locked out of Studio generation.

The bug was introduced when reward credits were added — `AppHeader.tsx`, `Index.tsx`, and `LowCreditsBanner.tsx` were updated, but `DesignStudio.tsx` was missed.

## Fix

In `src/pages/DesignStudio.tsx`, mirror the same reward-credit query already used in `AppHeader.tsx`:

1. **Add a `rewardCredits` query** (alongside the existing `profile` query) — sums `remaining` from `credit_rewards` where `remaining > 0` and `expires_at > now()`.

2. **Update `getCreditsRemaining()`** (line 307) to add `rewardCredits` to the total so the in-page badge matches the header.

3. **Update `checkGenerationLimit()`** (line 477) to fetch active reward credits and include them in `totalAvailable` before comparing against `creditCost`. This is the actual gate that's blocking users.

4. **Improve the modal copy** — the current text hardcodes "10 free generations." Change it to reflect actual cost vs. balance (e.g., "This generation costs X credits but you only have Y available.") so future mismatches are easier to spot.

## Files to edit

- `src/pages/DesignStudio.tsx` — add reward query, fix both credit calculations, update modal text

## No backend changes needed

The edge functions (`design-studio`, etc.) already deduct correctly using the shared `reward-credits.ts` helper. This is purely a frontend gating bug.

