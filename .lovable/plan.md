## Goal

Replace the "Made with Brandie" text watermark on free-tier design downloads with a faint, monochrome silhouette of the Brandie logo mark only — no wording.

## Scope

Single file: `src/pages/DesignStudio.tsx` — the `addWatermark` helper (lines 848–860), invoked during `downloadAs` for free users.

## Changes

1. **Import the logo** as a module asset:
   ```ts
   import brandieLogo from "@/assets/brandie-logo.png";
   ```

2. **Preload the logo image once** via a module-level cached `HTMLImageElement` promise so the watermark draw stays synchronous-feeling and doesn't re-fetch on every download.

3. **Rewrite `addWatermark`** to:
   - Make it `async` and await the cached logo image.
   - Compute a target size of ~10% of the canvas width (clamped min 64px, max 200px), preserving aspect ratio.
   - Position bottom-right with a margin of ~2.5% of width.
   - Render at low opacity (`globalAlpha ≈ 0.35`) with a desaturation/monochrome effect: draw the logo into an offscreen canvas, then use `globalCompositeOperation = "source-in"` filled with white (`#ffffff`) to produce a white silhouette. A subtle drop shadow (`shadowColor rgba(0,0,0,0.35)`, `shadowBlur ~ width/200`) keeps it readable on light backgrounds.
   - No text drawn anywhere.

4. **Update the call site** at line 901 to `await addWatermark(...)` since it becomes async. The surrounding `downloadAs` is already async.

## Notes / non-goals

- No change to when the watermark is applied (still free-tier only, still on `downloadAs`).
- No change to other components or to upload/storage paths.
- If the logo PNG fails to load, the watermark is silently skipped (try/catch around the await) so downloads never break.
