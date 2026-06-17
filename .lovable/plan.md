## Symptom

The "autopilot" (Brandie autonomously creates content on a schedule and emails it) is not aligned with the Blueprint the PRD describes. Today the user sees a `/blueprint` page and a Monday Briefing email, but the actual planner, generator, and daily push behave like three loosely-connected scripts. The result is missed weeks, ideas without a Strategic Arc, no real "approve the week" step, and timezone/timing mismatches between when posts are made and when they're emailed.

## What I found

Tracing `autopilot-planner` → `brand-engine.generate_weekly_ideas` → `content-autopilot` → `daily-execution-push` against the Blueprint UI and `weekly_blueprints` table:

1. **`autopilot-planner` silently skips most brands.** It filters `autopilot_settings.mode = 'autonomous'` only. The DB default for new rows is `'assisted'`, and the autopilot toggle in Settings sets `enabled` but not `mode`. Any brand not explicitly upgraded to `autonomous` gets planned exactly once (during onboarding seed) and then never again — the queue empties and the autopilot quietly dies.

2. **Weekly Blueprint is never created by the planner.** `weekly_blueprints` rows are only created by `monday-briefing` (the email job), after content has already been generated. `autopilot-planner` and `brand-engine` never insert into `weekly_blueprints`, and they never set `content_ideas.blueprint_id`. So:
   - The blueprint is an after-the-fact record, not a plan-of-record.
   - The "approve the week" gate from the PRD doesn't exist — `approval_status` defaults to `'approved'`, so `content-autopilot` and `daily-execution-push` ship whatever's there regardless of user review.

3. **Strategic Arc is dropped on the floor.** `WEEK_ARC` (Hook → Educate → Proof → Offer → Urgency → Lifestyle → Community) is defined in the planner seed path, and the seed loop *tries* to map roles to seeds, but never assigns `seed.arc = role` before insert — so `strategic_arc` is `null` even in the seed week. The weekly path through `brand-engine` doesn't set `strategic_arc`, `day_of_week`, or `playbook_role` at all. The Blueprint UI and Monday Briefing both expect these fields to render the arc.

4. **Two unrelated timing systems disagree.**
   - `autopilot_settings.timezone` + `delivery_time` ("morning"/"afternoon") decides when `content-autopilot` *generates* the design.
   - `profiles.posting_timezone` + `daily_push_hour` decides when `daily-execution-push` *emails* the user.
   These can drift hours apart. The user sees the email say "Today's drop is ready" before the design even exists, or hours after the post should have been sent.

5. **Retry/fill window is brittle.** `content-autopilot` retries failed ideas from the last 3 days, but the planner doesn't backfill missing days, and `fill_empty_days` in `brand-engine` is never invoked from the autopilot path. If a week has gaps (which happens whenever `generate_weekly_ideas` returns fewer than 7 ideas), nothing repairs them before the email goes out.

6. **`mode='autonomous'` filter + `weekly_plan_last_run` advance even on skip.** When the planner sees `queue >= threshold` it stamps `weekly_plan_last_run = now()` and skips. Combined with #1, brands that *should* be planned can be "skipped" because of leftover seed-week ideas and then never re-evaluated.

## Plan

Re-align the autopilot pipeline to the Blueprint model the UI and PRD already assume. No new tables, no breaking changes to existing flows; everything is a fix or an additive setter.

### 1. Make `weekly_blueprints` the plan-of-record

In `autopilot-planner` (weekly sweep) and `brand-engine.generate_weekly_ideas`:

- Before generating ideas, **upsert** the `weekly_blueprints` row for `(brand_id, week_start_date = Monday)` with `status='draft'`, `source='autopilot'`.
- On every inserted `content_ideas` row, set `blueprint_id` to that blueprint's id.
- `monday-briefing` keeps creating a blueprint as a fallback, but uses upsert so we never create two for the same week (`brand_id + week_start_date` already has a UNIQUE constraint — currently the briefing path relies on `maybeSingle` which is racy; switch it to upsert by `brand_id,week_start_date`).

This makes `/blueprint` show one canonical weekly arc, and gives the future "approve the week" gate a real row to flip.

### 2. Fix the mode/queue eligibility logic in `autopilot-planner`

- Eligibility query: `autopilot_settings.enabled = true` (drop the `mode='autonomous'` filter, or accept both `assisted` and `autonomous` — `assisted` users *also* want their week pre-planned; the difference is approval, not planning). Keep `mode='manual'` excluded.
- When skipping because queue ≥ threshold, **only stamp `weekly_plan_last_run` if the existing queue actually covers the upcoming week's date range** (i.e., there's at least one idea scheduled for each weekday of next week). Otherwise leave the timestamp alone so a later sweep can retry.
- After generating, if `brand-engine` returned fewer than 7 ideas for the week, immediately call `brand-engine` with `action='fill_empty_days'` for the same week so the Blueprint isn't ragged.

### 3. Restore the Strategic Arc end-to-end

- `autopilot-planner` seed path: assign `seed.arc = role` inside the role-mapping loop so the seeded week actually persists `strategic_arc`.
- `brand-engine.generate_weekly_ideas`: extend the output schema and insert with `day_of_week` (computed from the resolved `scheduled_for`), `strategic_arc` (mapped from `WEEK_ARC` by day index), and `playbook_role` (use the existing arc role as the default playbook role). Keep the existing `pillar_id` / `content_category` mapping unchanged.
- Add `strategic_arc` and `playbook_role` to the system prompt for the weekly generation so the model writes ideas that *fit* the day's role rather than blindly being labelled.

### 4. Unify the two timing systems behind one source of truth

- Use `autopilot_settings.timezone` + `delivery_time` as the canonical "when do we ship today's drop?" config.
- In `daily-execution-push`, prefer `autopilot_settings.timezone` and a derived push hour from `delivery_time` (morning/afternoon/evening → 8/13/18 local) for any brand that has autopilot enabled. Fall back to `profiles.posting_timezone` + `daily_push_hour` only for brands without autopilot settings.
- Keep both columns on `profiles` for legacy/manual users; no schema change.

### 5. Guarantee the daily email never lies

In `daily-execution-push`, before sending:

- Confirm `content_ideas.design_id IS NOT NULL` **and** the linked design has `image_url`. Today the SELECT requires `design_id` but doesn't guard `image_url`, so users can get an empty card.
- If today's idea is `autopilot=true` and still in `autopilot_status IN ('pending','processing','failed_*')`, skip the email and let `autopilot-retry` re-trigger generation; do not advance `last_daily_push_at` so the next sweep retries.
- Include the blueprint's status in the email payload so the template can show "Approved week 47" once the approval gate (step 6) lands.

### 6. Lay the rail for "approve the week" without breaking current users

Additive only; not toggled on by default:

- `weekly_blueprints.status` already exists (`draft|approved`). The autopilot does not block on it yet, but `monday-briefing` will start including an "Approve this week" CTA that POSTs to a thin `approve-blueprint` edge function (sets `status='approved'`, `approved_at=now()`).
- A follow-up change (out of scope for this fix) will add a per-brand setting `require_blueprint_approval` and gate `content-autopilot` on it.

### 7. Verify

- `supabase--curl_edge_functions` `autopilot-planner` (GET) on a test brand with `mode='assisted', enabled=true` — confirm a `weekly_blueprints` row appears for next Monday and the 7 inserted `content_ideas` carry `blueprint_id`, `day_of_week`, `strategic_arc`, `playbook_role`.
- Manually run `daily-execution-push` with a `test_user_id` for that brand — confirm it picks up the brand's `autopilot_settings.timezone/delivery_time`, skips when the design isn't ready, and only sends once per local day.
- Open `/blueprint` — confirm the week shows the seven days in Hook→Community order with the right pillar/arc badges.

## Out of scope

- No new tables.
- No changes to the Strategist Agent (`strategist-agent`, `agent-tools.ts`, `/agent` pages).
- No live social publishing.
- The full "user must approve the week before anything ships" gate (only the rail is added).

## Files this will touch

- `supabase/functions/autopilot-planner/index.ts` — eligibility, blueprint upsert, arc on seed, fill-empty-days follow-up.
- `supabase/functions/brand-engine/index.ts` — insert `blueprint_id`, `day_of_week`, `strategic_arc`, `playbook_role` in the two `generate_weekly_ideas` insert paths.
- `supabase/functions/daily-execution-push/index.ts` — prefer autopilot timezone, harden design check, don't advance push timestamp on skip.
- `supabase/functions/monday-briefing/index.ts` — switch blueprint create to a real upsert, add approval CTA payload.
- New tiny function: `supabase/functions/approve-blueprint/index.ts` — POST `{ blueprint_id }`, sets `status='approved'`, `approved_at=now()`, RLS-scoped to the brand owner.
