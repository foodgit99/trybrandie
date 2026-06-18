## What's actually wrong

The Blueprint (`Thursday → "The Single Sale ROI Proof"`) and History (`Today → "The Hook" 5-slide carousel`) are showing different things because the autopilot's design generation is silently de-linking from its source idea.

Evidence from the live DB for your brand (`3624409c…`), week of Jun 15:

| Day | Idea | autopilot_status | design_id |
|---|---|---|---|
| Mon Jun 15 | Monday Mood | completed | linked |
| Tue Jun 16 | Happy Youth Day | **processing** | linked (but status never finalised) |
| Wed Jun 17 | The Strategy Behind the Sale | **processing** | **NULL** |
| Thu Jun 18 | The Single Sale ROI Proof | null (not run yet) | NULL |

Meanwhile, the only designs created today (`06:02–06:03 UTC`) are a 5-slide carousel under `carousel_id 0048b384…` whose slide titles ("The Hook → The Body → The CTA Strategy → Visual Hierarchy → The Solution") match Wednesday's idea, not Thursday's. So:

1. Wednesday's carousel was generated overnight, but the link back to `content_ideas.design_id` was never written → Blueprint shows Wed with no thumbnail.
2. History sorts by `created_at` only, so it labels Wed's late-night carousel as "Today".
3. Thursday's idea hasn't been generated yet, so nothing on Thursday's Blueprint card matches anything in History.

### Root causes in `content-autopilot/index.ts`

- For carousels, `design-studio` inserts each slide as it renders. When generation overruns the function's request budget, the fetch returns/aborts before line 442–446 runs, so `design_id` + `autopilot_status='completed'` never get written even though the slides successfully landed in `designs`.
- Slides are inserted with no FK back to `content_ideas` (no `content_idea_id` on `designs`), so once the cover-link write is lost there is no way to reconcile the orphan carousel to its idea.
- Tuesday's row proves the same race in the other direction: `design_id` was written but `autopilot_status` stayed `processing`, meaning the update was split or partially failed.

## Plan (additive, no schema-breaking changes)

### 1. Make the idea ↔ design link durable
- Add a nullable `content_idea_id uuid` column to `public.designs` (FK to `content_ideas(id) ON DELETE SET NULL`) plus an index on `(brand_id, content_idea_id)`. Existing rows stay `NULL`; nothing else changes.
- Update `design-studio` (carousel + single paths) to accept an optional `content_idea_id` in its payload and stamp every inserted `designs` row with it.
- Update `content-autopilot` to pass `content_idea_id: idea.id` into the `design-studio` payload so all slides — not just the cover — carry the link from creation.

### 2. Finalise the idea row even if the autopilot call is interrupted
- In `design-studio`, when the carousel finishes (or the single design is saved) and `content_idea_id` was provided, write `content_ideas { design_id = cover, status='created', autopilot_status='completed' }` from inside `design-studio` itself. The `content-autopilot` post-update becomes a no-op safety net.
- Add a one-time reconciliation step at the top of `content-autopilot`'s run loop: for any idea older than 1 hour stuck in `autopilot_status='processing'`, look up its newest `designs` rows by `content_idea_id` (or, for legacy rows, by `brand_id` + same-day `created_at` + carousel cover) and either finalise it (`completed`) or mark it `failed_error` so the retry path picks it up.

### 3. Group History by idea/day, not by raw timestamp
- In `src/pages/v2/History.tsx`, fetch `content_idea_id` alongside the design, and when present join in `content_ideas.scheduled_for` + `title`. Use `scheduled_for` (falling back to `created_at`) for the "Today/Yesterday/…" grouping label, and surface the idea title + day on the card so a carousel rendered after midnight still shows up under the Blueprint day it belongs to.
- No visual redesign, just the existing card with one extra small-caps line (e.g. `WED · JUN 17`) and the idea title overriding the cover slide's title when available.

### 4. Make the Blueprint show what already exists
- `Blueprint.tsx`'s query already pulls `design:design_id(image_url, caption)`. Once step 2 backfills `design_id` for stuck rows, the Wednesday card will populate its thumbnail without further changes. No change to the Blueprint component required beyond verifying the backfill ran.

### 5. Verify
- Run the autopilot reconciliation once manually (`supabase--curl_edge_functions` → `content-autopilot` with a `{ reconcile_only: true }` flag) and re-query the table above; expect all `processing` rows for past days to flip to `completed` or `failed_error` and `design_id` to populate where slides exist.
- Reload Blueprint and History in the preview: Wed should show its carousel thumbnail; History's "Today" group should only contain designs whose `scheduled_for` is today.

### Out of scope
- No changes to the planner, `brand-engine`, or the weekly arc logic (those were aligned in the previous turn).
- No UI redesign of either page.
- No changes to billing, credits, or the strategist agent.

### Files to touch
- `supabase/migrations/<new>.sql` — add `designs.content_idea_id` + index.
- `supabase/functions/design-studio/index.ts` — accept + persist `content_idea_id`; finalise the idea on completion.
- `supabase/functions/content-autopilot/index.ts` — pass `content_idea_id`; add reconciliation pass; treat the post-call update as idempotent safety net.
- `src/pages/v2/History.tsx` — fetch + display `content_idea_id` → `scheduled_for` and idea title; group by `scheduled_for` when present.
