

## Plan: Navigate Carousel Designs to Studio with Full Carousel View

### Problem
Clicking a carousel on the dashboard opens a `DesignViewer` overlay instead of navigating to the Design Studio. The studio currently only supports loading a single design via `?design=ID` and has no way to load an existing carousel by its `carousel_id`.

### Solution

**1. `src/pages/DesignStudio.tsx`** — Add carousel loading via URL param `?carousel=CAROUSEL_ID`

- In the reset effect (line ~328), also check for `carousel` param — don't reset if present
- Add a new `useEffect` that reads `searchParams.get("carousel")`:
  - Fetches all designs with that `carousel_id`, ordered by `slide_index`
  - Populates `carouselSlides`, `carouselId`, `currentSlideIndex`, `currentImage`, `currentDesignId`
  - Sets `isCarouselMode = true`
  - Loads chat history from the first slide's `design_id`

**2. `src/pages/Index.tsx`** — Change carousel click to navigate instead of opening overlay

- In `openDesignViewer`, when a design has `_carouselSlides`, navigate to `/studio?carousel=CAROUSEL_ID` instead of opening the `DesignViewer`
- The `DesignViewer` state and component can remain for any other use, or be removed if no longer needed on this page

### Files
- `src/pages/DesignStudio.tsx` — new carousel loading effect
- `src/pages/Index.tsx` — update navigation handler

