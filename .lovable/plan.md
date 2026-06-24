
# Autonomous Mode — Campaign Fallback

## Goal
When Autonomous Mode generates an idea, it must always land in **a valid campaign** that matches the user's **default funnel stage**, even if:
- `default_campaign_id` was never set, OR
- the referenced campaign was deleted, OR
- the AI couldn't resolve a campaign name from the idea.

No idea should ever be saved with a `NULL`/orphaned `campaign_id` when Autonomous Mode is on.

## Resolution Order (deterministic)
For each generated idea, resolve `campaign_id` in this order:

1. **AI-resolved campaign** — if the LLM matched the idea to an existing campaign name for this brand, use it (must still exist).
2. **User default** — `autopilot_settings.default_campaign_id`, but only if the row still exists in `campaigns` for this brand.
3. **Stage-matched existing campaign** — first campaign for this brand whose `funnel_stage` (or primary category mapped via `funnelStages.ts`) equals the user's `default_funnel_stage`. Ordered by `created_at ASC` for stability.
4. **Auto-create stage campaign** — create a campaign named after the stage (e.g. "Awareness", "Consideration", "Conversion", "Retention") for this brand, tagged with that funnel stage, then use it. Idempotent: re-use if one with that name already exists.
5. **Last resort** — create/use a brand-level "General" campaign so the idea is never orphaned.

Steps 4–5 also **self-heal** `autopilot_settings.default_campaign_id`: if it was null or pointed to a deleted campaign, update it to the resolved/created one so future runs short-circuit at step 2.

## Where to Apply
A single shared helper, used everywhere Autonomous Mode writes ideas:

- New file: `supabase/functions/_shared/resolve-autopilot-campaign.ts`
  - `resolveAutopilotCampaign({ supabase, brandId, defaultCampaignId, defaultFunnelStage, aiResolvedCampaignName? }) → { campaignId, funnelStage }`
  - Handles lookup, stage matching, auto-create, and self-heal of `autopilot_settings`.

Call sites updated to use the helper instead of trusting `default_campaign_id` directly:
- `supabase/functions/brand-engine/index.ts` — `generate_weekly_ideas` and `fill_empty_days`
- `supabase/functions/autopilot-planner/index.ts` — seeding logic
- `supabase/functions/content-autopilot/index.ts` — any idea inserts during scheduled runs

## Frontend (light touch)
- `src/pages/v2/Settings.tsx`: if the currently selected `default_campaign_id` no longer exists in the campaigns list, show a small inline hint under the dropdown ("Previous campaign was deleted — Autonomous Mode will use your default funnel stage until you pick a new one") and reset the local select value to "None". No forced DB write from the client — the edge helper self-heals on the next run.

## Out of Scope
- No schema changes (columns from the previous migration are sufficient).
- No changes to manual/Assisted Mode flows.
- No change to funnel-stage logic itself.

## Verification
- Unit-style check via `supabase--read_query`: confirm no `content_ideas` rows are inserted with `campaign_id IS NULL` after an Autonomous Mode run.
- Manually trigger `brand-engine` with `default_campaign_id` set to a deleted UUID and confirm: (a) ideas land in a stage-matched campaign, (b) `autopilot_settings.default_campaign_id` is updated to the resolved one.
