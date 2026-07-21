## What's actually slow

I traced the two paths in `supabase/functions/design-studio/index.ts`:

- **Single post** (`/post`): each render calls `renderWithGptImageEdits` (line 309), which tries `google/gemini-3-pro-image-preview` first — the slowest image model in the stack. After render, a quality critic scores it; on a "fail" verdict it deletes the design and renders again. Realistic wall time today: ~45–120s per post.
- **Carousel** (line 3106+): the same render function runs, but slides are generated **strictly one at a time** in a `for` loop (line 3769), because each slide attaches the previous slide's rendered image as a continuity reference. For 5–10 slides × ~60–120s each × up to 2 quality-critic retries per slide, the worst-case time balloons well past an hour. A single stalled gateway call blocks everything after it because there is no per-slide deadline.

The quality wins from the Pro model and the critic loop are real, but they compound the wrong way: they multiply across slides that are already sequential.

## The plan

### 1. Parallelize carousel slides (biggest win)

- Render **slide 1 (the cover)** first, on its own. It establishes the palette, type lockup and motif that all other slides must inherit.
- Render **slides 2..N in parallel** with bounded concurrency (max 3 at once) using the cover image as the shared continuity anchor instead of the immediately-previous slide. The visual motif, genome, brand lock, and per-slide plan already encode consistency — the pixel-level "previous slide" ref is redundant when every slide inherits from the cover.
- Persist and return slides as they finish so the UI can show progress, not a blank spinner.

Expected impact: 5-slide carousel drops from ~10–15 min to ~2–3 min; 10-slide from >30 min to ~4–5 min.

### 2. Slim the quality-critic loop

- Run the critic on the **cover slide only** for carousels (it anchors the whole set). Skip scoring on inner slides — they inherit the cover's approved system.
- For single posts, keep scoring but cap the "fail → regenerate" path at **one** retry (current code already caps at one, but combined with the model cascade + `retryFetch` it can still snowball). Also skip the second scoring call after the retry — trust the retry.

### 3. Add a per-slide deadline

- Wrap each image call in a 90-second timeout. On timeout, fall through to the next model in the cascade immediately instead of waiting on `retryFetch`'s backoff. Reduce `retryFetch` retries from 2 → 1 for image generation only.

### 4. Faster feedback on /post

- Return the render result as soon as the image + copy are saved; run the critic/score update as a fire-and-forget background write (the score field is used later on the design record, not blocking the response).

### 5. UI: progressive carousel

- On `/post`, when generating a carousel, poll or subscribe to `designs` filtered by `carousel_id` and show slides as they land instead of holding one spinner until the whole set is done. This makes even the worst case feel responsive.

## Files touched

- `supabase/functions/design-studio/index.ts` — reorder cover→parallel slides, swap default model, gate the critic loop, add per-call timeout, background score update.
- `supabase/functions/_shared/render-refs.ts` — allow passing a "cover image" as the continuity ref for parallel slides (small addition, existing `previousImageUrl` slot can be reused).
- `src/pages/v2/DailyPost.tsx` (and the carousel composer entry) — add "Highest quality" toggle, wire progressive slide subscription for carousels.

## Explicitly NOT changing

- Brand genome, plan/arc validation, product-ref routing, gallery-first logic, copy structure gates — all preserved. Only the render orchestration changes.
- Nothing about credit deduction or pricing changes.

## How I'll verify

- Time a 5-slide carousel before/after (target: under 3 min).
- Confirm all slides share cover palette/type by eyeballing 3 generations.
- Watch `edge_function_logs` for `[render] ... ok` lines to confirm Flash is the primary path and Pro is fallback-only.