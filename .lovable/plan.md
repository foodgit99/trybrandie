

# Carousel Feature — Status Audit

## What's Working

1. **Backend generation pipeline** — The `design-studio` edge function has a complete `generate_carousel` action: creative brief via AI, parallel slide rendering in batches of 2, storage upload, design row saving with `carousel_id` + `slide_index`, caption generation, and credit billing (slide_count × base cost).

2. **Studio carousel mode activation** — Entering via `?mode=carousel` correctly sets `isCarouselMode`, shows the carousel indicator badge, and exposes the slide count selector (2–10).

3. **Generation context flow** — `DesignGenerationContext` properly handles the `generate_carousel` action, returns `carousel_id` and `slides` array, and the Studio syncs them into local state.

4. **Slide navigator UI** — After generation, the Studio shows: prev/next arrows overlaid on the image, dot indicators, a thumbnail strip, and a "Download All" button.

5. **Content Hub → Carousel routing** — When a content idea has `content_format: "carousel"`, clicking the action button navigates to `/studio?mode=carousel&prompt=...&content_idea_id=...`. Content idea status is marked "created" after generation.

6. **Credit billing** — Correctly multiplies base cost by slide count both client-side (for the pre-check) and server-side.

---

## What's Partially Working / Has Gaps

1. **No carousel editing** — After generating a carousel, subsequent chat messages use the standard `generate` or `edit` action. There's no way to edit individual slides or regenerate a single slide. The edit flow treats it as a single-image workflow.

2. **Design History doesn't group carousels** — Each slide is saved as a separate `designs` row with `carousel_id` and `slide_index`, but `DesignHistory.tsx` has zero carousel-aware logic. Slides appear as individual ungrouped designs, which is confusing.

3. **No carousel re-opening** — If you navigate away and come back, there's no way to reload a carousel from history. The Studio only enters carousel mode via the `?mode=carousel` search param, not from a saved carousel.

4. **DesignViewer doesn't handle carousels** — The `DesignViewer` component (used in history) shows one image at a time with no slide navigation.

5. **Chat messages for carousel** — Only the first slide's design_id is saved via `design_messages`. The chat history doesn't reference the full carousel context.

---

## What's Not Working At All

1. **No format toggle in the Studio itself** — There's no way to switch between single/carousel mode from within the Studio UI. You can only enter carousel mode via URL params (from Content Hub or direct link). A user in the Studio has no carousel button.

2. **No carousel preview on the canvas panel** — The right-side canvas panel (`currentImage` display) doesn't have carousel-specific UI. It just shows whichever single slide is selected, with no visual indicator that it's part of a set.

3. **No carousel export** — Beyond the "Download All" button (which downloads individual PNGs), there's no combined PDF/ZIP export or shareable carousel preview.

---

## Recommended Next Steps (Priority Order)

### Phase 1 — Core Usability
1. **Add a carousel/single toggle in the Studio toolbar** so users can switch modes without going through Content Hub
2. **Group carousels in Design History** — show carousel sets as a single card with a slide count badge; clicking opens a carousel viewer with slide navigation
3. **Enable carousel re-opening** — clicking a carousel in history should open the Studio in carousel mode with all slides loaded

### Phase 2 — Editing & Polish
4. **Single-slide regeneration** — allow editing/regenerating one slide while keeping the rest
5. **Carousel-aware DesignViewer** — add slide navigation (arrows, dots, thumbnails) to the viewer component
6. **Combined download** — ZIP archive of all slides

### Technical Details
- Phase 1 changes touch: `DesignStudio.tsx` (toolbar toggle), `DesignHistory.tsx` (grouping query + carousel card component), `DesignViewer.tsx` (slide navigation)
- The database schema already supports carousels (`carousel_id`, `slide_index` columns on `designs` table) — no migrations needed
- Grouping query: `SELECT DISTINCT ON (COALESCE(carousel_id, id)) ...` or group client-side by `carousel_id`

