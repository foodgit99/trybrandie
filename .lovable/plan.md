

## Current Credit System

Credits are charged in the **edge function** (`supabase/functions/design-studio/index.ts`):

- Each design generation increments `profiles.generations_count` by **1**, regardless of quality mode
- Free tier limit is **10 generations/month** (hardcoded as `FREE_TIER_LIMIT = 10`)
- Monthly reset: if the current month differs from `generations_reset_at`, the count resets to 1
- The frontend also checks credits before sending the request (in `DesignStudio.tsx`) and shows a limit modal if exhausted

**In short: every generation costs exactly 1 credit, whether Fast or HD.**

---

## Plan: Differentiated Credit Costs for Fast vs HD

### Approach

- **Fast** = 1 credit (unchanged)
- **HD** = 2 credits per generation

### Changes

**1. Edge function (`supabase/functions/design-studio/index.ts`)**
- Read `render_quality` from the request body (already destructured)
- Set `creditCost = render_quality === "hd" ? 2 : 1`
- Change the limit check: `if (profile.generations_count + creditCost > 10)` → reject
- Change the increment: `generations_count: profile.generations_count + creditCost`

**2. Frontend (`src/pages/DesignStudio.tsx`)**
- Update `checkCreditsAvailable()` to account for HD costing 2 credits — check `generations_count + (renderQuality === "hd" ? 2 : 1) > FREE_TIER_LIMIT`
- Update the credits remaining display to show a tooltip or note that HD uses 2 credits
- Add a small label under the HD toggle button: "Uses 2 credits"

**3. Header credit display (`src/components/AppHeader.tsx`)**
- No changes needed — it already shows remaining credits correctly based on `generations_count`

### No Database Changes Required

The existing `generations_count` integer field works fine — we just increment by 2 instead of 1 for HD.

