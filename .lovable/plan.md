

## Fix: Carousel Slide Preview in Design Studio

### Problem
When a user clicks on a carousel slide in the Design Studio, a fullscreen overlay opens showing only that single image. There are no previous/next buttons or slide indicators, so the user is stuck viewing one slide with no navigation. The expected behavior is a full viewer with prev/next controls, dot indicators, and thumbnail strip — identical to how `DesignViewer` works in Design History.

### Root Cause
The Design Studio uses a simple `previewImage` string state (lines 1895-1923) that renders a single `<img>` in a modal overlay. It has no awareness of the carousel slides array.

### Solution
Replace the simple single-image preview overlay with the existing `DesignViewer` component when carousel slides are present. `DesignViewer` already supports prev/next navigation, dot indicators, thumbnail strip, keyboard shortcuts, and download — exactly what's needed.

### Changes

**`src/pages/DesignStudio.tsx`**:
1. Import `DesignViewer` component
2. Add a `viewerOpen` boolean state and `viewerIndex` number state
3. When clicking a carousel slide image, instead of `setPreviewImage(url)`, set `viewerOpen = true` and `viewerIndex` to the clicked slide's index
4. Replace the carousel preview overlay section (lines 1895-1923) with a conditional: if `carouselSlides.length > 0 && viewerOpen`, render `DesignViewer` with the carousel slides mapped to its expected format; otherwise keep the existing single-image preview for non-carousel designs
5. Map `carouselSlides` to the `Design` shape that `DesignViewer` expects (id, title, prompt, image_url, created_at, canvas_size)

This reuses the existing, well-tested `DesignViewer` component rather than duplicating navigation logic.

### Files
- `src/pages/DesignStudio.tsx`

