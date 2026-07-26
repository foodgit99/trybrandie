## Goal

Phase 0 of the audit roadmap: cut image renders **without changing model providers**. Image rendering is ~93% of AI spend, so every avoided render is real money. Target: ~12–15 credits saved per active brand per month, zero new integrations, no quality risk from unproven models.

## What the code does today (verified)

- `design-studio/index.ts` line ~338: **every** render — single designs, carousel cover, and every inner slide — starts on `google/gemini-3-pro-image-preview`, with the Flash variants used only as failure fallbacks.
- Line ~680: `candidate_count` defaults to 1, clamped to 3. `content-autopilot/index.ts` line 516 passes `candidate_count: 2` for all non-carousel autopilot designs → **every autonomous single design renders twice, unconditionally**, then both are scored by the critic.
- Retries stack multiplicatively today: `retryFetch(..., 1)` inside the render call, a 3-model fallback chain, a slide-level `catch → renderSlide(attempt 1)`, and a critic `verdict === "fail"` cover retry. A bad cover can consume 4+ image calls; there is no per-job ceiling.
- Inner carousel slides already skip critic scoring (cover-only gate) — that part is already disciplined and stays as is.

## Changes

**1. Hero vs non-hero model routing**

Add a `tier: "hero" | "support"` argument to the image render helper and pick the model ladder from it:
- `hero` (single designs, carousel cover slide): unchanged — Pro first, Flash fallbacks.
- `support` (carousel slides 2..N): `gemini-3.1-flash-image-preview` first, `gemini-2.5-flash-image` second, Pro as last-resort fallback only.

Justified by the existing design: the cover establishes palette, type lockup and motif, and inner slides inherit it from the cover reference image, so they are the lowest-risk place to drop a tier. A brand-level override (`always_hero_render`) stays available for anyone who reports a quality drop.

**2. Adaptive best-of-N instead of unconditional 2×**

Replace the fixed second candidate with a score-gated second render:
- Always render candidate A and score it (scoring already happens even at N=1).
- Render candidate B **only** if A's verdict is `fail`, or its weighted overall falls below a threshold (start at 70).
- Keep the `candidate_count` request field working as an explicit override so Studio and admin tooling can still force N.

On current pass rates this removes most of the second render while retaining the safety net exactly where it matters. `content-autopilot` keeps sending `candidate_count: 2`, which becomes "up to 2" rather than "always 2".

**3. Hard per-job render budget**

Introduce a single counter threaded through the job:
- Budget = `2 + slide_count` image calls for carousels, `3` for single designs.
- Every call to the render helper decrements it; at zero, remaining retries are refused and the job finishes with what it has (or fails cleanly) instead of burning credits.
- Drop `retryFetch`'s internal retry for image calls to 0 — the model fallback chain already provides the redundancy, so the inner retry is a duplicate cost path.
- Collapse the cover's fail-verdict retry and the generic cover catch-retry into one attempt governed by the same budget.

**4. Telemetry so the saving is measurable**

Record on the tracer / `design_jobs`: `render_calls_used`, `render_budget`, `hero_renders`, `support_renders`, `second_candidate_fired`, and the model actually used per slide. Without this, Phase 0's effect can't be confirmed against the AI Gateway logs, and Phases 1–5 have no baseline.

## Technical notes

- Files touched: `supabase/functions/design-studio/index.ts` (render helper signature, `renderVariation`, `renderSlide`, best-of-N block, carousel retry paths), `supabase/functions/content-autopilot/index.ts` (comment/semantics only), plus a small migration if the render counters are persisted to `design_jobs`.
- No schema change is required if telemetry lives only on the tracer; persisting to `design_jobs` needs two integer columns.
- No change to the copy pipeline, genome, gallery handling, or credit deduction logic. Credits are still deducted only after a successful render.

## Rollout

Ship behind a per-brand escape hatch, watch `quality_winner_overall` and cover fail-verdict rate for one autopilot week, and compare gateway image-call volume before/after. If cover quality holds and support-slide scores don't regress, Phase 1 (OSS pilot on `brand-strategist`) becomes the next step.
