# Fix: Designs Are Not Aspect-Ratio Aware

## Problem

For non-square canvases (LinkedIn cover 1584×396, Facebook cover, stories, landscapes), the rendered design gets significant text and visual elements clipped — clearly visible in the screenshot where "Pixels. Start Building Your Empire." has its left edge chopped off.

Root cause is in `supabase/functions/design-studio/index.ts`:

1. The image renderer call (Gemini `gemini-3-pro-image-preview`) is invoked **without** an `image_config.aspect_ratio` parameter. Gemini therefore returns its default ~1:1 image regardless of what we ask for in the prompt.
2. `enforceCanvasDimensions()` then **center-crops** that square down to the target aspect (e.g. 1584×396). For an extreme banner ratio that means we keep only a thin horizontal slice of the original render — the headline composed for a square layout gets sliced through.
3. The text prompt mentions the dimensions but the model has no structural way to honor them; "safe zone" guidance is also too weak (only 4%) for banner ratios.

## Fix

### 1. Pass aspect ratio to the image model (primary fix)

In `renderVariation()` add `image_config.aspect_ratio` derived from the resolved canvas. Gemini image preview supports: `"1:1"`, `"4:5"`, `"9:16"`, `"16:9"`, `"3:4"`, `"4:3"`, `"2:3"`, `"3:2"`, `"21:9"`. Add a small helper that maps `(w, h)` to the closest supported ratio:

- 1080×1080 → `1:1`
- 1080×1350 → `4:5`
- 1080×1920, fb/tt stories → `9:16`
- 1920×1080, 1600×900, 1200×630, 1200×627 → `16:9`
- 1640×924 (FB cover) → `16:9`
- 1584×396 (LinkedIn cover, ~4:1) → `21:9` (closest supported wide format)
- 1000×1500 → `2:3`

Apply to both the initial fetch and the retry fetch inside `renderVariation`.

### 2. Replace center-crop with safer fit logic

Update `enforceCanvasDimensions()`:
- If source aspect already matches target within ~2% → just resize (current behavior).
- Otherwise, **scale-to-fit and pad** with a sampled edge color (or solid black/white based on average luminance) instead of cropping. This guarantees no design element is lost even if the model returns a slightly off ratio.
- Keep current center-crop only as a last-resort fallback when the model is wildly off (>30% ratio mismatch) — but with `image_config.aspect_ratio` this branch should rarely trigger.

### 3. Strengthen the prompt's safe-zone guidance per format

Update `buildDimensionEnforcement()` so the safe-zone percentage scales with how extreme the aspect is:
- Square / near-square → 4% (current)
- Wide landscape (>2:1) and tall portrait (>1:2) → 8% on the long axis, 12% on the short axis
- Ultra-wide banners (LinkedIn cover, >3:1) → "all critical text and the logo must sit within the central 70% of the width, vertically centered, with no element closer than 8% to any edge"

Also add an explicit instruction reminding the model that text must be composed for the FULL canvas aspect (not for a square that will be cropped).

## Technical Details

Files to edit:
- `supabase/functions/design-studio/index.ts`
  - Add `mapToGeminiAspectRatio(w, h): string` helper.
  - In `renderVariation()`, include `image_config: { aspect_ratio: <ratio> }` in the JSON body of both `retryFetch` calls to `ai.gateway.lovable.dev`.
  - Update `enforceCanvasDimensions()` to fit-and-pad instead of always cropping (use `imagescript` `Image.new(w, h, color)` and `composite` of the resized source).
  - Update `buildDimensionEnforcement()` to emit aspect-aware safe-zone copy.

No frontend changes required. No new dependencies. Behavior is fully backwards compatible for square canvases.

## Verification

After deploy, regenerate the LinkedIn cover that produced the screenshot and confirm:
- The full headline ("Pixels. Start Building Your Empire.") renders within the canvas.
- No element bleeds off any edge.
- Square Instagram posts still look identical to before.
