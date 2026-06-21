# Yes — the change makes sense. Here's the analysis + concrete plan.

## Today's reality (matches your diagram)

`autopilot-planner` and `content-autopilot` *do* share state via the `content_ideas` table, but they're loosely coupled:

- Planner writes ideas with `blueprint_id` set and `autopilot=true`.
- `content-autopilot` filters ONLY by `autopilot=true` + `scheduled_for=today` (see `content-autopilot/index.ts:187`). It never checks `blueprint_id` or `weekly_blueprints.status`.
- So any idea anywhere in the system with `autopilot=true` gets rendered, even if:
  - it was created outside the planner (manual add, legacy seed, brand-engine ad-hoc call),
  - its blueprint was never approved,
  - it was edited/removed in `/v2/Blueprint` but the row still exists.

DB snapshot confirms the drift:
- 721 total ideas, **580 with no `blueprint_id`** (orphan ideas).
- 270 with `autopilot=true`, **136 of those have no `blueprint_id`**.
- 295 blueprints, **only 1 is `status='approved'`**.

That last number is the headline: if we flip the switch today, autopilot stops for almost everyone. We need a migration path.

## Proposed target architecture

```text
                    pg_cron
            ┌──────────┴──────────┐
            ▼                     ▼
     autopilot-planner     content-autopilot (3x/day)
            │                     │
            ▼                     │  JOIN weekly_blueprints
       brand-engine               │  WHERE status='approved'
            │                     │  AND content_ideas.blueprint_id = wb.id
            ▼                     │  AND scheduled_for = today
       weekly_blueprints          │
       + content_ideas ───────────┘
            │                     │
            ▼                     ▼
       /v2/Blueprint        design-studio (multi-agent)
       (review + approve)         │
            │                     ▼
            └────────────►   designs + storage
                                  │
                                  ▼
                            /v2/History · /v2/DailyPost
```

Key invariants:
1. **Only the planner creates autopilot ideas.** Every autopilot-eligible `content_ideas` row has a non-null `blueprint_id`.
2. **No render without approval.** `content-autopilot` rejects any idea whose blueprint is not `approved`.
3. `/v2/Blueprint` is the single approval gate; approving it is what releases that week's posts to design-studio.

## Implications (read before approving)

**Behavioural**
- Users who never tap "Approve" get zero posts. Today, autopilot fires even without approval. We must either:
  (a) auto-approve blueprints for brands whose autopilot `mode='auto'` (set `status='approved'` at the end of `autopilot-planner`), or
  (b) keep approval mandatory and make it the centrepiece of the Monday Briefing UX.
  Recommendation: **(a) for `mode='auto'`, (b) for `mode='review'`/`manual`** — matches the existing `autopilot_settings.mode` field and the PRD's "10-minute marketing week".

**Data migration**
- 580 orphan ideas + 136 orphan autopilot ideas need a one-time backfill: assign each to the matching `weekly_blueprints` row by `(brand_id, week_of(scheduled_for))`, creating the blueprint if missing, and mark it `approved` so live brands don't go dark on the next cron tick.

**Code changes (scope is small)**
- `content-autopilot/index.ts` lines 183–198: replace the `.eq('autopilot', true)` filter with a join on `weekly_blueprints` requiring `blueprint_id IS NOT NULL` and `wb.status='approved'`. Keep the retry window logic.
- `autopilot-planner/index.ts`: when `autopilot_settings.mode='auto'`, set the new blueprint to `status='approved'` (with a marker like `approved_by='system'`) the same turn it's created.
- Reconciliation loop (lines 41–95) and `autopilot-retry` already operate on existing `content_ideas`; they keep working — they don't create ideas.
- Remove dead "ad-hoc autopilot=true" insert paths if any are found (none in planner; manual UI inserts on Blueprint already get `blueprint_id`).

**Things that DON'T change**
- `design-studio` interface, multi-agent pipeline, VSGS, copywriter, push notifications.
- `autopilot_runs` / `autopilot_run_events` audit log — these become more meaningful because skips now have a single clear reason ("blueprint_not_approved").
- `/v2/Blueprint` UI — already calls `approve-blueprint`. We may want to surface "auto-approved by system" badge for `mode='auto'` brands.

**Risks**
- One-time migration is destructive-ish (it stamps `approved` on historical weeks). Mitigation: only stamp blueprints whose week is `>= current_week - 1` so we don't retroactively trigger old posts; older ideas get `autopilot=false`.
- If a user is in `mode='review'` and forgets to approve, posting silently stops. Mitigation: the Monday Briefing email/push already exists — extend it to nag if previous week was unapproved.

## Plan to implement (after you approve this)

1. **Migration** (SQL):
   - Backfill `content_ideas.blueprint_id` for current+next week orphans by creating/finding matching `weekly_blueprints`.
   - For `autopilot_settings.mode='auto'` brands, set those blueprints `status='approved'`.
   - For older orphans, set `autopilot=false` so they don't get picked up.
2. **`autopilot-planner`**: auto-approve newly-created blueprint when `mode='auto'`.
3. **`content-autopilot`**: change the ideas query to require `blueprint_id IS NOT NULL` and join `weekly_blueprints.status='approved'`. Add a new `logEvent` reason `skipped_blueprint_not_approved`.
4. **Audit log**: include `blueprint_id` + `blueprint_status` in every event metadata (already partially there via `blueprint_week`).
5. **UX nudge** (small): on `/v2/Blueprint`, show "Auto-approved" badge for `mode='auto'`; show prominent "Approve to publish" CTA otherwise.
6. **Docs**: update `mem://features/content-autopilot` with the new contract.

No new tables; no breaking schema; no design-studio changes.

Reply "approve" to proceed, or tell me which option to pick for the mode='auto' auto-approval question and I'll re-issue the plan.
