
# Switch renderer to gpt-image-2 `/edits` (reference-aware) for ALL designs

## Goal
Remove the text-only `/v1/images/generations` path entirely. Every render goes through `/v1/images/edits` with real image references attached:
- Brand **logo** (always, when `brand.logo_url` exists)
- Brand **inspiration_examples** (up to 2)
- **User-uploaded image** (when present in the job payload)
- **Previous render** (on edits, to preserve layout)

Result: the logo appears pixel-exact (not redrawn), inspiration steers composition/palette visually, and user images are actually used instead of described.

## Why this is safe
- gpt-image-2 stays as the model — no model migration.
- Same Lovable AI Gateway, same auth, same credit cost (1 credit).
- Same SSE response shape (`image_generation.partial_image` / `image_generation.completed`) → no client changes.
- If a brand has no logo and no inspiration, we synthesize a 1024×1024 transparent PNG as a "blank canvas" reference so `/edits` still accepts the request. This removes the need to keep two render paths.

## Scope of changes

### 1. New shared helper — `supabase/functions/_shared/render-refs.ts`
- `fetchAndNormalizeRef(url)` → downloads, validates content-type, resizes/pads to 1024×1024 PNG ≤4MB, returns `Blob`. 5s timeout per ref.
- `buildBlankCanvas()` → returns a 1024×1024 transparent PNG `Blob` (fallback when no refs exist).
- `collectRefs({ brand, userImage, previousRender })` → returns ordered array `[{ role, blob, label }]` capped at 4 entries (logo + 2 inspirations + 1 user/prior). Logo always first when present.

### 2. Replace renderer in `supabase/functions/design-studio/index.ts`
- Delete `renderWithGenerations()` (or rename + repurpose as the new edits caller).
- New `renderWithEdits({ prompt, refs, size, stream })`:
  - Build `multipart/form-data` with `model=openai/gpt-image-2`, `prompt`, `size=1024x1024`, `quality=low`, `stream=true`, `partial_images=1`, and one `image[]` field per ref blob.
  - POST to `https://ai.gateway.lovable.dev/v1/images/edits` with `Authorization: Bearer ${LOVABLE_API_KEY}`.
  - Stream SSE back to caller (unchanged downstream parsing).
- Rewrite the prompt-builder block:
  - Drop "place the logo in bottom-right at 12%..." textual logo instructions.
  - Add explicit reference index legend: `"Reference 1 = brand logo (use EXACTLY as provided, do not redraw, place at <position>). Reference 2 = inspiration (style/composition only, do not copy content). Reference 3 = user image (use as hero subject)."`
  - Keep all upstream agents (Brief, Copywriter, Genome, Category Bias, Stability Gate) untouched.

### 3. Job payload
- `design-enqueue` already accepts `user_image_url` (if not, add optional pass-through). Forward to `design-studio` via `design_jobs.input`.
- No new DB columns required for Phase 1. (Persisting `layout_schema` + `final_render_url` for edit-mode masking is a separate later phase.)

### 4. Error handling & fallback
- `/edits` 4xx (content policy, invalid mask, oversized ref): retry once **without** the offending ref (drop user image first, then inspiration, keep logo). If still failing, retry with only the blank canvas. Surface clear error if all attempts fail.
- `/edits` 429/5xx: existing `retryFetch` semantics apply.
- Ref download failure: skip that ref, continue with remaining + blank canvas if needed. Log to `design_traces`.

### 5. Telemetry
- Add `render_mode: "edits"`, `refs_used: ["logo","inspiration","user"]`, `refs_skipped: [...]` to the trace payload so admin can see ref attachment rates.

## What stays exactly the same
- All agents upstream of the renderer.
- Credit deduction, Inngest dispatch, job locking, seeded RNG, category recipes, trend presets.
- Client UI, streaming preview, blur-on-partial, FloatingDesignStatus.
- Watermarking on free tier.

## Out of scope (separate future phase)
- Mask-based partial edits (preserve previous layout on copy-only tweaks) — requires persisting `layout_schema` + final render URL. Noted but not built here.
- Carousel multi-slide ref strategy — current carousel orchestrator calls the renderer per slide; this change applies uniformly.

## Rollout
- Single deploy. No feature flag (user wants to remove text-only entirely).
- Smoke test path: generate a design for a brand with logo + 2 inspirations → verify logo pixel-match in output and inspiration influence in palette/composition.
- Monitor `design_traces` for `refs_skipped` rate and `/edits` failure rate over first 50 jobs.

## Files touched
- `supabase/functions/_shared/render-refs.ts` — **new**
- `supabase/functions/design-studio/index.ts` — replace renderer + prompt block
- `supabase/functions/design-enqueue/index.ts` — pass through `user_image_url` if not already
- `.lovable/plan.md` — update audit doc

## Risks
- Inspiration images skew output too literally → mitigated by explicit "style/composition only, do not copy content" prompt language + capping at 2.
- Logo placement still imperfect (gpt-image-2 may scale/recolor) → reinforced by "use EXACTLY as provided, do not redraw, do not recolor" + place-position hint in prompt.
- Latency: +1-3s for ref downloads (parallelized, capped at 5s each).

## Estimated effort
~3-4 hours of edits + test. Single migration-free deploy.
