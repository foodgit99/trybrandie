

# Bug Fix: Bonus Credits Never Consumed — Treated as Permanent

## The Problem

Bonus credits (earned via referrals, 5 per referral) are **never decremented** when used. They are added to the monthly tier limit as a permanent pool, meaning a user who earned 15 bonus credits gets 15 extra credits **every single month forever**.

Here's what happens for an Entrepreneur user with 15 bonus credits who used 30 credits last month:

- Month rolls over → `getCreditsUsed()` returns 0 (correct monthly reset)
- `creditsRemaining = tierLimit(50) + bonusCredits(15) - creditsUsed(0) = 65`
- The user sees **65 / 50** — more credits than their plan allows

The `logo-designer` edge function correctly decrements `bonus_credits` when consumed, but these functions do NOT:

1. **`design-studio`** — only increments `generations_count`, never touches `bonus_credits`
2. **`video-studio`** — same issue
3. **`brand-engine`** (Content Hub) — partially handles it but has edge cases
4. **`video-render`** — same issue

## The Fix

### 1. Fix credit deduction in `design-studio/index.ts` (2 locations)

When deducting credits, consume bonus credits first:
- If `bonus_credits >= creditCost`: decrement `bonus_credits` by `creditCost`, do NOT increment `generations_count`
- If `bonus_credits > 0 but < creditCost`: set `bonus_credits` to 0, increment `generations_count` by the remainder
- If `bonus_credits == 0`: increment `generations_count` by `creditCost` (current behavior)

Apply this logic in both the design generation deduction block (~line 828-845) and the carousel deduction block (~line 1947-1958).

### 2. Fix credit deduction in `video-studio/index.ts`

Same bonus-first deduction logic when deducting the 3-credit storyboard cost.

### 3. Fix credit deduction in `video-render/index.ts`

Same bonus-first deduction logic when deducting the 5-credit render cost.

### 4. Fix credit deduction in `brand-engine/index.ts`

Align the Content Hub deduction with the same pattern.

### 5. Fix frontend display in `AppHeader.tsx`

The display formula `tierLimit + bonusCredits - creditsUsed` is correct IF bonus credits are being properly decremented. No change needed here once the backend is fixed — the display will naturally show correct values.

## Summary

- **Root cause**: Bonus credits act as a permanent monthly boost instead of a consumable pool
- **Impact**: Every user with bonus credits gets inflated allowances that never decrease
- **Fix**: Deduct from `bonus_credits` first across all 4 edge functions, matching the pattern already used in `logo-designer`

