# Make the End-to-end pipeline live

Right now the pipeline on `/engine` is a static map of six stages with status inferred only from the on/off toggle. I'll replace that with a real telemetry-driven component that breathes with the actual autonomous engine.

## What changes for the user

- Each of the 6 stages (Research → Ideation → Strategy → Planning → Execution → Reporting) shows a **live relative timestamp** ("just now", "2m ago", "yesterday") sourced from the last real event for the current brand.
- Each stage shows a **status pill**: `Running`, `Healthy`, `Idle`, `Error`, or `Waiting`, derived from telemetry rather than the toggle.
- Tapping a stage opens a **Stage Logs sheet** listing the last ~20 telemetry events for that stage with timestamp, idea title, status, and any error message. A "View full run" link jumps to `/admin/autopilot` (admins only) or the relevant Blueprint/Content Hub row.
- A subtle dot pulses on the currently-running stage; completed earlier stages keep a check; later ones stay muted — but now driven by actual events, not the toggle.
- The component **auto-refreshes** every 20s and subscribes to `autopilot_run_events` realtime so a run in progress visibly walks across the pipeline.

## Telemetry mapping (real signals → stages)

| Stage      | Source of truth                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Research   | `brand_trend_intel.generated_at` (latest row for brand)                                                  |
| Ideation   | `content_ideas.created_at` where `autopilot = true` (latest)                                             |
| Strategy   | `content_ideas.strategic_arc IS NOT NULL` (latest `created_at`)                                          |
| Planning   | `autopilot_settings.weekly_plan_last_run` + latest `content_ideas.blueprint_id`                          |
| Execution  | `autopilot_run_events` joined to `content_ideas` for this brand (latest, plus any with status=processing)|
| Reporting  | `autopilot_runs.completed_at` (latest)                                                                   |

Status rules per stage:
- `Running` — event within last 90s OR an `autopilot_run_events.status = 'processing'` row exists for the stage.
- `Error`   — latest event for the stage has `status` containing `failed` or non-null `error_message`.
- `Healthy` — latest event succeeded within the last 7 days.
- `Idle`    — no events in the last 7 days but engine is enabled.
- `Waiting` — engine disabled.

## Implementation

1. **New component** `src/components/v2/PipelineTelemetry.tsx`
   - Takes `brandId`, `enabled`.
   - One `useQuery` (`v2-pipeline-telemetry`) that runs 5 small parallel selects (trend intel, ideas, settings, runs, events) and folds them into a `StageState[]`.
   - `refetchInterval: 20_000` + a `supabase.channel('pipeline-events')` postgres_changes subscription on `autopilot_run_events` filtered by `brand_id` to invalidate the query on insert.
   - Renders the existing pipeline visual (lifted from `Engine.tsx` lines ~360–410) but each `<li>` becomes a `<button>` that opens the stage sheet.
   - Relative time helper (local, no dayjs dep) updates via a 30s interval state tick.

2. **New component** `src/components/v2/StageLogsSheet.tsx`
   - Uses existing `@/components/ui/sheet`.
   - Lists the last 20 `autopilot_run_events` relevant to that stage (or the fallback signal rows for Research/Reporting which don't emit events) with: timestamp, idea title, status badge, error text if present.
   - Footer button "Open full run logs" → `/admin/autopilot` when `has_role('admin')`, otherwise "Open Blueprint" → `/blueprint` for planning/strategy or "Open Content Hub" for execution.

3. **Edit** `src/pages/v2/Engine.tsx`
   - Replace the static pipeline block (lines ~360–410) with `<PipelineTelemetry brandId={brand.id} enabled={merged.enabled} />`.
   - Remove the now-unused `activeStageIdx`, keep `PIPELINE` constant by moving it into the new component.

4. **No schema changes.** All required tables (`autopilot_runs`, `autopilot_run_events`, `brand_trend_intel`, `content_ideas`, `autopilot_settings`) already exist with RLS that lets the owner read their own rows.

## Out of scope

- Emitting *new* telemetry events for Research/Strategy/Reporting from edge functions. For V1 we infer those stages from existing row timestamps; we can layer in dedicated events later without changing the UI contract.
- Admin-only deep traces beyond the existing `/admin/autopilot` route.
