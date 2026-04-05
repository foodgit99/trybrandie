

# Plan: Weekly Credit Gate for Trend Intel Refresh

## What Changes

Add weekly credit tracking to the trend-scout flow, mirroring the existing content generation pattern: first refresh per week is free, subsequent refreshes cost 2 credits with a confirmation dialog.

## Implementation

### 1. Database Migration

Add two columns to `profiles` table:
- `trend_intel_gen_count` (integer, default 0)
- `trend_intel_gen_reset_at` (timestamptz, default now)

Same pattern as the existing `content_hub_gen_count` / `content_hub_gen_reset_at`.

### 2. Edge Function: `supabase/functions/trend-scout/index.ts`

Add the same credit-checking logic from `brand-engine`:
- `getISOWeekStart()` helper
- Fetch profile's `trend_intel_gen_count` and `trend_intel_gen_reset_at`
- If count is 0 this week → free (no credit deduction)
- If count ≥ 1 → require 2 credits, deduct using the same free→bonus→paid waterfall
- Add a `check_only` mode: when `{ brand_id, check_only: true }` is sent, return `{ is_free, credits_required, available_credits }` without running the AI — this lets the frontend show the confirmation dialog before committing
- After successful generation, increment `trend_intel_gen_count` and update `trend_intel_gen_reset_at`

### 3. Frontend: `src/pages/ContentHub.tsx`

- Before calling `refreshTrendIntel`, call the trend-scout with `check_only: true`
- If `is_free` → proceed directly
- If not free → reuse the existing `creditDialogOpen` / `pendingAction` pattern to show the "This will cost 2 credits" confirmation dialog
- Handle 402 errors (not enough credits) with a toast

### Files to Modify
1. **New migration** — add `trend_intel_gen_count` and `trend_intel_gen_reset_at` to profiles
2. **`supabase/functions/trend-scout/index.ts`** — add credit check, deduction, and `check_only` mode
3. **`src/pages/ContentHub.tsx`** — wrap `refreshTrendIntel` in credit check flow

