

## Plan: Fix All Known Issues

Based on the full audit, here are the concrete fixes needed to make everything work properly (excluding payment integration).

### 1. Fix `audience-intelligence` edge function auth (broken)

The function uses `supabase.auth.getClaims(token)` which is not a valid Supabase JS method. Replace with `supabase.auth.getUser()` to match the working pattern in `design-studio/index.ts`.

**File:** `supabase/functions/audience-intelligence/index.ts` (lines 26-33)
- Replace `getClaims()` block with `getUser()` pattern

### 2. Fix credit reset year-boundary bug

The frontend `getCreditsRemaining()` in `DesignStudio.tsx` already checks both month AND year (line 203). But `AppHeader.tsx` also has this logic and already checks year too (line 49). The edge function (line 275) also checks both. **Verified: all three locations already compare both month and year.** No fix needed here.

### 3. Graceful 429/402 error handling in Design Studio

Currently when the edge function returns a 429, `supabase.functions.invoke` returns it as `{ error }` which triggers a generic toast. The problem: the 429 body contains `{ error: "Monthly generation limit reached..." }` but the Supabase client wraps non-2xx responses — the actual error message may get lost and show as "Edge function returned 429".

**File:** `src/pages/DesignStudio.tsx` (lines 358-366)
- After `supabase.functions.invoke`, check `error?.message` for "429" or "limit" keywords
- Show the limit modal (`setShowLimitModal(true)`) instead of a generic toast
- Also handle 402 (AI credits exhausted) with a specific message

### 4. Fix `trend-recommend` being called on every fresh studio load (wastes AI credits)

The trend recommendation fires an LLM call every time the studio loads without a pre-selected trend. This wastes credits. Make it deterministic instead — map brand vibe to a trend recommendation without an AI call.

**File:** `supabase/functions/trend-recommend/index.ts`
- Replace the LLM call with a deterministic mapping (vibe → trend), matching how the genome composer was optimized
- Keep the same response shape `{ trend_id, reason, confidence }`

**File:** `src/pages/DesignStudio.tsx` (lines 154-190)
- Remove the edge function call for trend recommendation
- Implement the deterministic mapping client-side in a simple function

### 5. Fix duplicate saves on edits

When a user edits an existing design, the auto-save creates a NEW design record instead of updating the existing one. After an edit, `currentDesignId` is reset to `null` (line 321), causing a fresh insert.

**File:** `src/pages/DesignStudio.tsx`
- On edits (`isEdit === true`), don't reset `currentDesignId` to null
- If `currentDesignId` exists, update the existing record instead of inserting a new one
- Only insert a new record for genuinely new generations

### 6. Fix AppHeader `forwardRef` console warning

**File:** `src/components/AppHeader.tsx`
- Wrap the `DropdownMenuTrigger` child in a proper `Button` with `asChild` pattern to avoid the ref warning

### Summary of changes

| File | Change |
|---|---|
| `supabase/functions/audience-intelligence/index.ts` | Replace `getClaims()` with `getUser()` |
| `supabase/functions/trend-recommend/index.ts` | Replace LLM call with deterministic vibe→trend mapping |
| `src/pages/DesignStudio.tsx` | Graceful 429/402 handling; fix duplicate saves on edits; remove trend-recommend edge function call, use client-side mapping |
| `src/components/AppHeader.tsx` | Fix `forwardRef` warning |

