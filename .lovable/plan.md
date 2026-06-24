# Carousel Story Arc — Audit & Fix Plan

## What I found

Carousels feel disjointed and incomplete for two distinct reasons. The arc planner produces a thin, isolated plan, and the per-slide renderer has no shared anchors or error isolation. Both are fixable without changing the user-facing flow.

### 1. Why slides feel disjointed (low cohesion)

`design-studio` plans the carousel once with Gemini Flash (`set_carousel_plan`, lines 3171–3238) and then renders each slide independently with no visual or narrative reference to the others.

The biggest cohesion leaks:

- **No previous-slide image passed to the renderer.** Each slide starts from a blank canvas — the model re-invents background, lighting, palette intensity and composition every time. `previousImageUrl: null` is hardcoded at line 3318.
- **No previous-slide copy in the render prompt.** The renderer can't write a headline that continues from the prior slide.
- **The arc plan is invisible to the renderer.** Each slide prompt only contains its own scene plus a free-text `creative_direction` paragraph — the renderer never sees the other slides' headlines or scenes.
- **The plan schema has no body/supporting copy field.** Interior "value" slides only carry a 3–8 word headline plus a 1–2 sentence scene. The model invents the rest at render time without a plan anchor.
- **The arc planner is starved of context.** It doesn't get products, recent brand updates, trend context, or seasonal/holiday context — all of which exist in the single-graphic path. So interior slides have nothing concrete to thread through.
- **The Flash-tier model plans the arc** (`gemini-3-flash-preview`), not Pro. Narrative coherence is the most reasoning-heavy step but uses the lightest model.

### 2. Why some carousels feel incomplete (missing or empty slides)

- **Pad-loop creates ghost slides.** If the planner returns fewer slides than requested, lines 3241–3244 silently top up with `headline: brand.name`, `scene_description: "Continuation slide"`, and no arc role. These render as real slides but read as filler.
- **No per-slide error isolation.** A single render or upload failure inside `Promise.all` (lines 3341–3377) collapses the batch and aborts the rest of the carousel. Already-saved slides become orphans with no cleanup, and the autopilot only validates the cover slide's `design_id`.
- **Silent empty `design_id`.** When a DB insert fails for a slide, the loop swallows the error and returns `design_id: ""` (line 3372). The carousel response includes the broken slide, and the autopilot path only checks the cover.
- **No CTA enforcement on slide N.** The arc prompt asks for a CTA, but there's no schema constraint, no post-plan validation, and no special render-prompt injection — if the model emits an empty `cta` for the last slide, it silently disappears.
- **No quality gate on carousels.** The `scoreDesignImage` critic that catches blank/failed renders in the single-graphic path is not called on carousel slides.
- **No per-slide arc metadata persisted.** `slide_label` (Hook, Benefit, CTA) is only embedded in the `title` text. We can't query for arc completeness or detect missing CTAs after the fact.

---

## Proposed fixes

Ordered by impact. Each fix is small and contained.

### Fix 1 — Enrich the arc planner (cohesion + completeness foundation)
File: `supabase/functions/design-studio/index.ts` around lines 3155–3238.

- Use Pro-tier reasoning for the arc plan: switch from `gemini-3-flash-preview` to the `MODEL_CHAINS.reasoning` fallback chain that the single-graphic path already uses.
- Inject the same context the single path enjoys: products list (names + key features), recent brand updates (RAG), trend context, seasonal/holiday context.
- Extend the `set_carousel_plan` schema:
  - Add `body` (10–25 words) per slide so interior value beats have anchored supporting copy.
  - Add `arc_role` enum (`hook` / `value` / `proof` / `cta`) per slide.
  - Add `narrative_thread` at the plan level — one sentence describing the through-line every slide must reinforce.
  - Add `visual_motif` at the plan level — one short string (e.g. "centred product hero on warm beige with thin gold rule") locked across all slides.
- Validate the returned plan: enforce exactly `numSlides` slides (no padding), require `arc_role: "cta"` and non-empty `cta` on the last slide; if missing, do a single targeted retry asking the model to fix only those fields.

### Fix 2 — Lock visual continuity across slides
File: `supabase/functions/design-studio/index.ts` around lines 3326–3382.

- Pass the previous slide's rendered image as a reference into the next slide's render call (use the existing `previousImageUrl` field that the single-graphic edit path already supports). This forces the renderer to inherit palette, lighting, type lockup and background motif from slide N-1.
- Render slides **sequentially** instead of in batches of 2, so each slide can see the previous one's pixels. (Cost is identical; latency rises modestly. Acceptable for an automated background job and a small UX cost for Studio.)
- Inject the plan's `visual_motif` and `narrative_thread` into every slide's render prompt.
- Show the renderer a compact "what came before / what's next" map: prior slide's headline and the next slide's `arc_role`, so copy can lead into the following beat.
- Special-case the first and last slides: cover slide gets a "this is the cover — establish the visual system" instruction; final slide gets a "this is the CTA — make `{cta}` the dominant element" instruction.

### Fix 3 — Per-slide error isolation + completeness guarantee
File: `supabase/functions/design-studio/index.ts` around lines 3341–3382, and `supabase/functions/content-autopilot/index.ts` around lines 515–541.

- Wrap each slide render+upload+insert in a try/catch so one failure doesn't kill the batch.
- On a slide failure, do one targeted retry (re-render that single slide). If still failing, abort the whole carousel with a clear error and clean up any slides already saved for that `carousel_id` (so we never leave orphan partials in the DB).
- Stop emitting `design_id: ""` — treat a DB save error as a slide failure and trigger the retry/abort path.
- In `content-autopilot`, validate that every returned slide has a non-empty `design_id`, not just the cover.

### Fix 4 — Score and gate carousels too
File: `supabase/functions/design-studio/index.ts` (carousel block) and `_shared/design-scorer.ts` (existing).

- After all slides render, score each slide with the existing critic. Persist `quality_score` and `quality_signals` on every carousel slide row.
- Compute a `carousel_quality` aggregate (overall = min of slide scores so a single weak slide is visible). Return it in the response so the cockpit can surface it.
- If any slide scores `verdict: "fail"`, retry that one slide once before returning. Same best-of-N pattern as single graphics, but capped at 1 retry per slide to control cost.

### Fix 5 — Persist arc metadata on slide rows
Schema change: add columns to `designs`.

- `arc_role text` — `hook` | `value` | `proof` | `cta`.
- `slide_label text` — verbatim from the plan ("Benefit 1", "How it works", etc.) so the title field stops carrying mixed concerns.
- `narrative_thread text` — copied onto every slide of the same `carousel_id` so the through-line is queryable.
- Also persist `copy_structure` on carousel slide rows (currently only single graphics get it).

---

## Implications

- **Fix 1** is the biggest cohesion lift. Cost: one Pro call per carousel (already paid in the single-graphic path). Latency: +2–3s on plan.
- **Fix 2** is the biggest "feels like one piece" lift. Cost: zero extra renders. Latency: ~Nx instead of ~(N/2)x because slides become sequential. For a 5-slide carousel that's roughly +20–30s — acceptable for background jobs and tolerable in Studio.
- **Fix 3** eliminates the silent partial-carousel failure mode entirely. No new model cost.
- **Fix 4** adds one critic call per slide (cheap Flash multimodal) plus an occasional single-slide retry. Same per-slide cost shape as the single-graphic best-of-N.
- **Fix 5** is a small migration; downstream UI work to surface arc role can come later. None of these changes touch the public API shape — clients keep working as-is and just get richer fields.

---

## Order of operations

1. Fix 1 (richer plan + Pro model + validation) — biggest cohesion + completeness lift.
2. Fix 2 (previous-slide image reference, sequential render, motif/thread injection, cover/CTA branching).
3. Fix 3 (per-slide try/catch, retry, partial cleanup, full design_id validation in autopilot).
4. Fix 5 (migration for arc_role / slide_label / narrative_thread / copy_structure on carousels).
5. Fix 4 (scoring + per-slide retry gate). Last because it depends on the other fixes producing recoverable inputs.

Want me to proceed with all five, or start with 1 + 2 + 3 (the core quality + reliability fixes) and defer 4 + 5?
