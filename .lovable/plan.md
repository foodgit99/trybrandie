# Plan: Blueprint planner becomes funnel- and campaign-aware

Today, `generate_weekly_ideas` in `brand-engine` plans the 7-day arc from brand, audience, products, trends and history — then stamps every idea with the user's *default* funnel stage and *default* campaign. The LLM never sees the funnel structure or the open campaign quotas, so it can't deliberately spread posts across stages or fill specific campaigns.

This plan feeds both structures into the planner so the LLM assigns `funnel_stage` and `campaign_id` *per idea*, with the existing defaults acting only as a safety net.

## What changes

### 1. Context assembly (brand-engine, `generate_weekly_ideas`)
Pull two new context blocks before the planner call:

- **Funnel stages** — `resolveBrandStages(brand.funnel_stages)` from `src/lib/funnelStages.ts` (replicated server-side). Pass id, label, blurb, and a rolling 4-week coverage count per stage (from `content_ideas` joined to `weekly_blueprints`) so the agent knows which stages are under-served.
- **Active campaigns + quotas** — for the target brand, fetch open campaigns with: id, name, description, `post_count` target, posts already assigned, posts already scheduled in prior weeks, and remaining slots. Mark campaigns whose `end_date` falls inside or before the planning week as "must-fill this week."

### 2. Planner prompt + schema
Extend the `generate_weekly_ideas` system prompt with a "Funnel & Campaign rules" section:

- The 7 ideas must cover **at least 3 of 4 funnel stages**, weighted toward under-served stages from the coverage counts.
- Any campaign with `remaining_slots > 0` and `end_date <= week_end` must receive at least one idea this week (up to remaining slots).
- Each idea must justify its `funnel_stage` in a one-line `stage_rationale` and (if assigned) its `campaign_id` in `campaign_rationale`.

Update the JSON output schema for each idea to require:
- `funnel_stage`: one of the resolved stage ids
- `campaign_id`: uuid of an active campaign, or `null`
- `stage_rationale`, `campaign_rationale`

### 3. Validation + fallback (insert path)
Before insert in `brand-engine`:

- Validate `funnel_stage` against resolved stages; if invalid/missing → fall back to `autopilot_settings.default_funnel_stage`.
- Validate `campaign_id` belongs to the brand and is active; if invalid/missing → run existing `resolveAutopilotCampaign` with the idea's chosen stage as `funnelStage` input (so fallback respects the planner's intent, not just the user default).
- Log validation drift to `autopilot_run_events` so we can monitor how often the planner picks valid vs. fallback values.

### 4. `fill_empty_days` parity
Mirror the same context + schema in `fill_empty_days` so single-day repairs respect funnel coverage and campaign quotas already established by the rest of the week (pass the existing week's stage/campaign distribution as "already covered" context).

### 5. UI surface (read-only this round)
On `/blueprint`, show each idea's resolved `funnel_stage` chip and `campaign` chip on the day card (data already exists post-insert). No editor changes — `FunnelsEditableTab` and `CampaignsEditableTab` already let users move things after the fact.

## Out of scope
- No schema migration. `content_ideas.funnel_stage` and `campaign_id` already exist; campaigns already have `post_count`.
- Trends, products, audience context untouched.
- Autopilot defaults stay as the last-resort fallback, not the primary signal.

## Files touched
- `supabase/functions/brand-engine/index.ts` — context fetch, prompt, schema, validation, both actions.
- `supabase/functions/_shared/resolve-autopilot-campaign.ts` — accept an explicit `funnelStage` arg already supported; verify signature.
- `src/pages/v2/Blueprint.tsx` — render stage + campaign chips on each day card.

## Validation
- Manual smoke: trigger `generate_weekly_ideas` on a brand with 2 active campaigns and an under-covered "conversion" stage; confirm at least one idea per active campaign and conversion-stage representation.
- Inspect `autopilot_run_events` for drift counters after the run.
