# Make the Blueprint mode-aware: auto-plan, auto-approve, and explicit Approve

## Problem

Today is Monday and the week is empty. The Sunday cron (`autopilot-planner`) either didn't fire for this brand (e.g. brand created mid-week, cron skipped, throttled) or its `weekly_plan_last_run` was already stamped. The Blueprint page has no recovery path other than the user typing "plan this week" in the chat composer. There is also no explicit "Approve" button — only an `AutopilotStatusBanner` action that appears in a paused state for the `no_approved` reason and is easy to miss. Mode semantics (Assisted vs Autonomous vs Manual) are not enforced on page load.

## Behaviour we want

| Engine Mode | Empty week on load | Approval | First content |
| --- | --- | --- | --- |
| Autonomous | Auto-generate week silently | Auto-approve every idea | Kick off today's render immediately |
| Assisted | Auto-generate week silently | User clicks **Approve week** | Generation starts after approval |
| Manual | Do nothing | User types in composer | Only on explicit prompt |

## Changes

### 1. `src/hooks/useAutopilotStatus.ts`
- Also select `mode` from `autopilot_settings` and expose it on the returned status object so the UI can branch.

### 2. `src/pages/v2/Blueprint.tsx`
- Read `mode` via `useAutopilotStatus(brand.id)`.
- Add an `autoPlanned` ref + `useEffect` that runs once per brand+week when the ideas query resolves with `ideas.length === 0` and `mode !== 'manual'`:
  - Call `brand-engine` with `action: 'generate_weekly_ideas'`.
  - If `mode === 'autonomous'`:
    - After ideas land, bulk-update this week's rows: `approval_status='approved'`, `status='scheduled'`.
    - Invoke `content-autopilot` (existing fn) for the brand so today's post starts rendering immediately.
  - Toast a single "Brandie is planning your week…" notice while running; suppress for manual.
- Add a prominent **Approve week** button in the header row (next to "Reset week") visible whenever `ideas.length > 0` and at least one idea is not yet approved. Clicking it runs the same bulk-update used by `AutopilotStatusBanner.approveAll`, then kicks `content-autopilot` for today.
- Keep the existing conversational composer and Reset behaviour untouched.
- Empty-state copy becomes mode-aware ("Brandie is drafting your week…" for non-manual; current copy for manual).

### 3. `src/components/v2/AutopilotStatusBanner.tsx`
- No functional change required, but suppress the banner when `mode === 'manual'` (banner is irrelevant there) and let the new Blueprint Approve button be the primary affordance on `/blueprint`.

### 4. Safety / idempotency
- The auto-plan effect guards with a `useRef<Set<string>>` keyed by `${brandId}:${weekStartISO}` so it never double-fires within a session.
- `brand-engine.generate_weekly_ideas` is already idempotent at the DB level (it skips days that already have ideas), so a race with the Sunday cron is safe.
- Auto-approve only touches rows where `approval_status != 'approved'` to stay idempotent.

## Out of scope
- No changes to `autopilot-planner` cron schedule or backend mode semantics.
- No new edge functions; everything reuses `brand-engine`, `content-autopilot`, and direct table updates already permitted by RLS.
