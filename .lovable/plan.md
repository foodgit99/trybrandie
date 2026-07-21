## Why /post carousels are slower than /studio carousels

Both surfaces route through the same pipeline: `startGeneration` → `design-enqueue` → Inngest → `design-studio`. The queue, model chain, concurrency (5 slides in parallel), and heartbeat are identical. The difference is **the payload each page sends**, which unlocks extra pre-render work inside `design-studio`.

### Extra work /post triggers that /studio skips

/post sends `content_idea_id`. /studio does not (it sends a raw prompt). That one field turns on a chain of expensive lookups **before slides start rendering**:

1. **Category-recipe research enrichment** (`enrichWithResearch`, `design-studio` line 1804+). The idea's `content_category` resolves to a recipe. Recipes flagged `needs_fresh_info` (educational, trending, informational, promotional with offers) fire an LLM research call via `ai.gateway.lovable.dev` to fetch fresh sources. A Studio-only prompt has no category → research is skipped (`tracer.setMetric("research_skipped", true)`).
2. **Brand updates fetch + summarisation** (`fetchRecentUpdates`, line 2456+). Only runs when there's an active category. Adds another DB read plus prompt bloat.
3. **`product_ref` anchoring** (lines 1611, 3275). Two extra DB roundtrips for both the single and carousel branch to look up the pinned product for the idea, then re-sort and re-caption the roster.
4. **Category-scoped copy/caption directives, CTA policy, forbidden-copy context** — all injected into the strategist and copywriter prompts, making those LLM calls larger and slower.
5. **Autopilot-only, but relevant for /post's Blueprint-triggered flow**: `candidate_count` can be bumped to 2, doubling renders per slide with a critic pick. Manual clicks on /post don't set this, but jobs triggered via approve-blueprint may.

### Compounding effect

Because these steps happen **serially before** the first slide dispatches, the carousel's clock starts later. On a 5-slide carousel, an extra ~10–25s of research + updates preamble is added on top of the same render time. Studio kicks straight into the strategist step with a bare brand + prompt, so it starts rendering sooner.

### Verify before fixing

- [ ] Compare `design_jobs.stage` timings for a recent /post carousel vs a /studio one (look for how long the job sits in `strategist`/`copywriter` before `render-cover`).
- [ ] Check AI Gateway logs filtered by that job's `run_id`: /post jobs will show a `google/gemini-2.5-flash` research call and possibly a `flash-lite` compression call that /studio jobs don't have.
- [ ] Confirm no /post job is inheriting `candidate_count > 1` from stray Blueprint code paths.

### Proposed fix (once verified)

1. **Parallelise the preamble.** Move `enrichWithResearch`, `fetchRecentUpdates`, and `product_ref` fetch into `Promise.all` alongside the strategist call so they don't block the render dispatch. The research promise is already declared early — audit whether it's actually awaited before strategist runs and hoist the two idea lookups (`product_ref` for single + carousel) into that same batch.
2. **Time-box research.** Wrap `enrichWithResearch` in `withTimeout(TIMEOUTS.SHORT)`; if it exceeds ~6s, drop through with empty sources rather than blocking the whole carousel.
3. **Skip research for carousels.** The carousel arc planner already produces per-slide narrative; fresh web research adds far less value than for a single hero post. Gate `enrichWithResearch` on `action !== "generate_carousel"` (or make it opt-in per recipe).
4. **Cache brand updates per job.** `fetchRecentUpdates` runs once per job today, but its output is re-serialised for both copy and caption prompts. Fine as-is, but confirm it's not re-fetched.
5. **Force `candidate_count = 1`** for any manual /post generation regardless of caller — add a server-side clamp when `contentIdeaId` is set but the request didn't come from `approve-blueprint`/`content-autopilot` (identify by a signed `source` field on the enqueue payload).

After #1–#3, /post carousels should render in roughly the same wall-clock as /studio carousels, with the category-recipe intelligence still applied to the copy/caption but no longer blocking the render clock.