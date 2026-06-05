## Findings

I traced the caption pipeline end-to-end and confirmed there is a real bug for **carousels** produced by the autonomous engine. Single-graphic autopilot posts are fine.

**Evidence (live DB):**
- Last 20 autopilot-completed ideas: every single post (`carousel_id = null`) has a caption persisted. Every carousel cover (`slide_index = 0`) has `caption = NULL`.
- `content_ideas.whatsapp_dm` is `NULL` for all of them, so the UI fallback in `DailyPost.tsx` also produces nothing.
- The idea you're currently viewing (`8d947b3d…`) is one of these carousels — that's why the caption box is empty.

**Root cause:**
1. `supabase/functions/design-studio/index.ts` carousel branch generates a caption (line ~3290) and returns it in the response, but **never writes it onto any slide row** in `designs`. The per-slide `insert` (line ~3260) has no `caption` field.
2. `supabase/functions/content-autopilot/index.ts` only persists `designData.caption` in the **single-post** branch (line ~386). The carousel branch (line ~350) just reads the cover `design_id` and never updates `designs.caption`.
3. `src/pages/v2/DailyPost.tsx` reads caption only from the cover `design` row (line ~141), so a missing caption shows the empty placeholder.

## Plan

### 1. Persist carousel caption at generation time
In `supabase/functions/design-studio/index.ts`, after `captionText` is generated for the carousel (right before the response is returned), update the cover slide row:
- `UPDATE designs SET caption = captionText WHERE carousel_id = carouselId AND slide_index = 0` (only when `captionText` is non-empty).
- This fixes manual carousel renders too.

### 2. Defense-in-depth in autopilot
In `supabase/functions/content-autopilot/index.ts` carousel branch, after resolving `coverDesignId`, if `designData.caption` is present run an `update designs set caption=... where id = coverDesignId`. This guarantees the autopilot-produced cover always carries the caption even if design-studio's write fails.

### 3. UI fallback hardening (small)
In `src/pages/v2/DailyPost.tsx`, when the active design is a carousel and the cover has no caption, also look at sibling slides for the first non-null caption before falling back to the placeholder. Cheap safety net for any historical rows.

### 4. No schema or RLS changes
`designs.caption` already exists and is writable by the service role; no migration needed.

### 5. Out of scope
- Backfilling captions on the ~3 historical autopilot carousels already in the DB (they were generated before the fix; regenerating would cost credits). I'll note this to you instead of silently doing it.
- The brief/lock change from the previous turn stays as-is.

### Verification
After deploying the edge functions:
- Trigger one autopilot carousel (or wait for the next cron tick) and confirm via `select id, slide_index, caption is not null from designs where carousel_id = …` that the cover row has a caption.
- Open `/post/<idea_id>` for that idea and confirm the Caption box is pre-filled.
