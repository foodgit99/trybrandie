

## Fix: Content Hub Credit Check Bugs

### Root Causes Identified

**Bug 1 — Missing monthly reset in available credits calculation**

In `brand-engine/index.ts`, the `checkContentGenStatus` function (line 112) calculates available credits as:
```
availableCredits = max(0, limit - profile.generations_count) + bonus_credits
```
But it does NOT check whether `generations_reset_at` is from a previous month. The design-studio function correctly resets `generations_count` when a new month arrives, but brand-engine reads the stale value. So a user who used all 10 free-tier credits last month would show 0 tier credits remaining, even though the month has reset — making them appear to only have their bonus credits.

**Bug 2 — AI gateway 402 confused with user credit 402**

In the `callAI` helper (line 473), when the Lovable AI gateway returns HTTP 402 (AI balance depleted), it returns `{ error: "AI credits exhausted", status: 402 }`. This gets forwarded as HTTP 402 to the frontend, which interprets ANY 402 as "user credits exhausted" and shows a misleading toast. The user sees "Not enough credits" when the real issue is an AI service error.

### Fixes

#### 1. `supabase/functions/brand-engine/index.ts` — Fix `checkContentGenStatus`

Add monthly reset logic for `generations_count`, mirroring what design-studio already does:

```typescript
const checkContentGenStatus = async () => {
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("content_hub_gen_count, content_hub_gen_reset_at, generations_count, generations_reset_at, bonus_credits, subscription_tier")
    .eq("user_id", userId)
    .single();
  if (!profile) throw new Error("Profile not found");

  const weekStart = getISOWeekStart();
  const resetAt = new Date(profile.content_hub_gen_reset_at);
  const genCount = resetAt < weekStart ? 0 : (profile.content_hub_gen_count || 0);
  const isFree = genCount === 0;

  // Account for monthly reset of generations_count
  const tierLimits = { free: 10, entrepreneur: 50, creator: 150, agency: 400 };
  const limit = tierLimits[profile.subscription_tier] || 10;
  const genResetAt = new Date(profile.generations_reset_at);
  const now = new Date();
  const monthReset = now.getMonth() !== genResetAt.getMonth() || now.getFullYear() !== genResetAt.getFullYear();
  const effectiveGenCount = monthReset ? 0 : profile.generations_count;
  const availableCredits = Math.max(0, limit - effectiveGenCount) + (profile.bonus_credits || 0);

  return { is_free: isFree, credits_required: isFree ? 0 : 2, available_credits: availableCredits, profile };
};
```

Also fix `deductAndTrackGeneration` to account for monthly reset when deducting from `generations_count`.

#### 2. `supabase/functions/brand-engine/index.ts` — Fix AI gateway 402 handling

Change the `callAI` function to return status 503 instead of 402 when the AI gateway returns 402, so the frontend doesn't confuse it with user credit errors:

```typescript
if (response.status === 402) return { error: "AI service temporarily unavailable. Please try again.", status: 503 };
```

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/brand-engine/index.ts` | Add `generations_reset_at` to profile query, add monthly reset logic, change AI gateway 402 to 503 |

No frontend changes needed — the existing 402 handling in `callEngine` will continue to work correctly once the backend stops sending false 402s.

