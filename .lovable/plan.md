

## Investigation: Inconsistent Credit Consumption

### Root Causes Found

**1. AI-based intent classification is non-deterministic (primary cause)**

The server-side edge function (`design-studio/index.ts`, line 738-781) uses an LLM call (`gemini-2.5-flash-lite`) to classify edit requests as MINOR (free) or MAJOR (costs credits). This is inherently inconsistent -- the same edit request phrased slightly differently could be classified differently for different users. One user saying "change the background" might get classified as MINOR while another gets MAJOR.

Additionally, if the classification API call fails (`classifyResponse.ok` is false), `isFreeEdit` stays `false` (line 735), meaning the user gets charged. So network hiccups cause some users to pay for edits that should be free.

**2. Client-side credit display doesn't match server-side logic**

The `AppHeader` component hardcodes `FREE_TIER_LIMIT = 10` and doesn't account for subscription tiers. A user on the "creator" tier (150 credits) still sees "X / 10" in the header, creating confusion about actual credit state.

**3. HD vs Fast quality cost difference (2x) isn't always visible**

HD renders cost 2 credits, Fast costs 1. The client pre-check at line 393 uses the current `renderQuality` state, but there's no guard to ensure the quality sent to the server matches what was checked client-side (race condition if user toggles quality between the check and the API call).

### Proposed Fixes

#### Fix 1: Make intent classification deterministic
Replace the LLM-based MINOR/MAJOR classification with a **rule-based regex classifier** on the server. Use the same regex patterns already present for edit pattern tracking (lines 786-795) to determine if an edit is text-only (free) or visual (costs credit). This eliminates the non-deterministic behavior entirely.

#### Fix 2: Fix AppHeader credit display
Update `AppHeader` to use `getTierLimit()` based on the user's `subscription_tier` instead of hardcoding `FREE_TIER_LIMIT = 10`. Query `subscription_tier` alongside the existing profile fields.

#### Fix 3: Lock render quality at submission time
Capture `renderQuality` at the moment the credit check runs and pass that locked value through to the API call, preventing any mismatch.

### Files to Change
- `supabase/functions/design-studio/index.ts` -- Replace LLM classifier with rule-based logic
- `src/components/AppHeader.tsx` -- Use tier-aware credit limit

