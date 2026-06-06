## Goal
On step 0 of `/onboarding` (v2), let users paste a website URL, have Brandie scrape it, and skip directly into the dashboard — bypassing steps 1–3 (Look & Feel, Audience, Offer).

## Current state
Step 0 already has a "Scan" button that calls the `brand-scraper` edge function and pre-fills brand name, description, logo, and the three colour swatches. After scanning, the user still has to walk through steps 1, 2, 3 manually before `handleFinish` runs.

## Change (minimal, frontend-only)
**File:** `src/pages/v2/Onboarding.tsx`

1. **Track scan success** with a new `scanSucceeded` boolean set to `true` in `handleScan` when `data.brand` is returned.

2. **After a successful scan**, render a second primary CTA directly under the Scan input:
   - Label: `✨ Finish with website data`
   - Helper text underneath: *"We'll use what we pulled from your site. You can refine everything later in Brand Centre."*
   - Disabled until `playbookId` is set and `name.trim().length > 1` (same rule as `canNext` for step 0).
   - On click: call the existing `handleFinish()` directly. No new edge function, no schema change.

3. **Defaults already handled** by existing code:
   - Look & feel: `playbook.defaultVibe`, `defaultTone`, `defaultPersonality`, scraped colours (or palette fallback) are already used in the `brands` insert.
   - Audience: `target_audiences` insert is already guarded by `if (audienceWho.trim())` → silently skipped.
   - Products: insert is already guarded by `validProducts.length` → silently skipped.
   - So skipping steps 1–3 produces a valid brand record with no extra logic.

4. **No change** to:
   - Step indicator / progress bar (still shows 4 steps for users who don't skip).
   - The "Continue" flow for users who don't have a website.
   - `brand-scraper`, `autopilot-planner`, or any other edge function.
   - DB schema.

## Out of scope
- Auto-selecting the playbook from scraped content (kept manual to avoid wrong inferences).
- Scraping audience JTBD or products from the site (would need new prompts and would noticeably degrade audience intelligence quality, per earlier memory).
- Any change to v1 `/onboarding`.

## UX notes
- The Skip CTA only appears *after* a successful scan, so it doesn't compete with the regular Continue flow.
- Users can still tweak the auto-filled name/description before clicking Skip.
- A toast already confirms scan success; on Skip, the existing "Your engine is starting." toast + redirect to `/cockpit` handle completion.
