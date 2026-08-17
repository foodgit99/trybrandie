# Renderer must always prioritise gallery & product images

Goal: whenever a brand has real gallery photos or product/service photos, the renderer uses those actual pixels — either exactly as supplied, or integrated/adapted into a scene that supports the post's content — instead of generating a substitute.

## What's limiting this today

In `supabase/functions/_shared/render-refs.ts` (the module that downloads and orders reference images for the image model):

- Gallery photos are capped at 2, product photos at 2, total refs at 5.
- Product photos are attached **only when no user-uploaded image exists**.
- In `design-studio`, product photos are attached only when the brief looks "product-relevant" (keyword/product-name/pinned match). A brand-awareness or educational post about the business therefore gets zero product refs even when photos exist.
- The reference legend tells the model to use gallery pixels "when relevant" — soft language that lets the model quietly generate its own version instead.

## Changes

1. **Reference selection (render-refs.ts)**
   - Raise the ref budget so real brand assets aren't crowded out: logo, previous render (edit mode), user image, then up to 3 gallery photos and up to 2 product photos.
   - Stop suppressing product photos when a user image is present — the user image stays the hero subject, products come after it as supporting refs.
   - Keep the current priority order (logo → previous → user → gallery → product) so prompt indices stay stable.

2. **Attach product photos more broadly (design-studio)**
   - Keep the existing relevance detection for *hero* treatment, but attach available product photos as supporting refs on all renders unless the brand has disabled product imagery.
   - Preserve the existing pinned-product / `product_ref` behaviour for carousels — a slide pinned to a product still gets that product's photos first.

3. **Harden the instruction language (`buildRefLegend` + the gallery block in design-studio)**
   Replace "when relevant" with an explicit two-option rule:
   - **Option A — use as-is:** place the supplied photo in the composition with its pixels unchanged (crop/scale only).
   - **Option B — adapt in:** if the post's content doesn't allow the photo as a standalone hero, integrate it into the scene (mockup, in-context placement, framed panel, collage tile) while keeping the actual product/subject recognisably the same pixels.
   - Forbidden: generating a look-alike replacement, redrawing, restyling, or recolouring a supplied gallery/product photo.
   - Generating imagery from scratch is allowed only for elements no supplied reference covers (backgrounds, textures, abstract shapes).

4. **Telemetry**
   Existing `refs_attached` / `refs_skipped` metrics already record what was used — no schema change. This lets us check after deploy that gallery/product refs are actually attaching on non-product briefs.

## Notes

- Behaviour is unchanged for brands with no gallery and no product photos.
- `prefer_gallery_first` stays as the stronger "gallery is mandatory hero" switch; this change raises the floor for everyone else.
- More attached references slightly increases render input cost and latency per image; the caps above keep it bounded (max ~6 refs) and stay well inside the model's quality sweet spot.
- Single-image, variation, and carousel-slide render paths all go through `collectRenderRefs`, so all three inherit the change.
