Investigation found the latest `/post/238b1767-103c-45e9-aed2-d57a1347a4f5` render was enqueued as a single design, not a carousel:

- The content idea is marked as `content_format = carousel` with `slide_count = 4`.
- The latest design job still has `action = generate`, `kind = single`, and no `slide_count`.
- The saved design has no `carousel_id` or `slide_index`, so `/post` can only show one image.
- This was not a renderer failure; the carousel renderer was never called for that job.

Plan to fix:

1. Harden `/post` carousel detection
   - Treat a post as carousel when any of these are true:
     - `content_format === "carousel"`
     - `slide_count >= 2`
     - the prompt/title clearly says carousel or `N-slide`
   - This prevents strict field mismatch/stale data from silently falling back to a single image.

2. Pass the content idea ID into generation
   - Include `content_idea_id` in the `/post` generation request.
   - The backend carousel path already knows how to save all slide rows and link the cover slide back to the content idea when this ID is present.

3. Improve result linking on `/post`
   - When a carousel result completes, link the cover slide to the content idea, invalidate/refetch the design and slide queries, and show the slide carousel immediately.
   - Keep single-image behavior unchanged for normal posts.

4. Add recovery for mistaken single renders
   - If an idea is a carousel but the linked design has no `carousel_id`, show a “Regenerate carousel” action so the user can replace the mistaken single image with proper separate slides.
   - This directly fixes the current affected post without needing manual database cleanup.

5. Validate with the affected record
   - Confirm the next click enqueues `action = generate_carousel` with the expected `slide_count` and `content_idea_id`.
   - Confirm the resulting designs have the same `carousel_id`, ordered `slide_index`, and `/post` displays slide navigation/download-all.