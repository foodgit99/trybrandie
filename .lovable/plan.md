## Carousel Creation — Implementation Plan

### Overview

Add multi-slide Instagram carousel generation (2-10 slides) to Design Studio and Content Hub. Each carousel shares a unified visual genome and brand DNA, with per-slide copy that follows a narrative arc (Hook → Value → CTA).

### 1. Database Migration

Add two columns to `designs` table:

```sql
ALTER TABLE public.designs
  ADD COLUMN carousel_id uuid DEFAULT NULL,
  ADD COLUMN slide_index integer DEFAULT NULL;
```

No new RLS policies needed — existing ownership-based RLS covers these rows.

### 2. Edge Function: `design-studio/index.ts`

Add `action: "generate_carousel"` handler alongside existing `generate`/`edit` actions.

**Flow:**

- Accept `slide_count` (2-10) from request body
- Run the existing Brief Agent once to produce a single creative brief covering the narrative arc
- Compose one shared genome for visual consistency
- Run the Copywriter Agent per slide with slide-specific context: "Slide 1/N: Hook", "Slide 2/N: Key benefit", ..., "Slide N/N: CTA"
- Generate one carousel_id (UUID)
- Render each slide image in parallel batches (2 at a time to avoid rate limits), using the shared genome + per-slide copy
- Upload all images, auto-save each as a separate `designs` row with shared `carousel_id` and sequential `slide_index`
- Credit cost: `slide_count × 2` (HD) or `slide_count × 1` (fast)
- Return: `{ carousel_id, slides: [...], explanation, caption, genome, genome_scores }`

### 3. Design Generation Context: `DesignGenerationContext.tsx`

Extend types:

```typescript
// Add to GenerationParams
slide_count?: number;  // 2-10

// Add to GenerationResult
carousel_id?: string;
slides?: Array<{ image_url: string; slide_index: number; copy_structure: any; design_id: string }>;
```

Update `startGeneration` to:

- Pass `slide_count` and `action: "generate_carousel"` to the edge function
- Handle the multi-slide response — save each slide as a separate design row (the edge function does this server-side)
- Set result with the `slides` array

### 4. Design Studio UI: `DesignStudio.tsx`

**New state:**

- `isCarouselMode` — toggled via format pills ("Single" | "Carousel")
- `slideCount` — 2-10, default 5
- `carouselSlides` — array of `{ image_url, slide_index, copy_structure, design_id }`
- `currentSlideIndex` — which slide is displayed
- `carouselId` — shared UUID

**UI changes:**

- Format toggle ("Single" | "Carousel") near canvas size selector
- When carousel mode is active, show slide count selector (dropdown, 2-10)
- Canvas preview shows current slide with left/right arrow navigation + dot indicators
- Horizontal thumbnail strip below preview showing all slides (clickable)
- "Download All" button that sequentially downloads all slides as `slide-1.png`, `slide-2.png`, etc.
- Progress status shows "Generating slide X of N..."
- Credit display shows total cost (e.g. "10 credits for 5 slides")

**Credit check:**

- `checkGenerationLimit` updated to check `slideCount × creditCost` instead of just `creditCost`

### 5. Content Hub: `ContentHub.tsx`

Add a third action button per content idea:

- `Layers` icon button with title "Create carousel"
- On click: `navigate(/studio?mode=carousel&prompt=...&content_idea_id=...)`
- Design Studio reads `mode=carousel` from search params to auto-enable carousel mode

### Files to Modify


| File                                        | Change                                                               |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Database migration                          | Add `carousel_id` and `slide_index` to `designs`                     |
| `supabase/functions/design-studio/index.ts` | Add `generate_carousel` action                                       |
| `src/contexts/DesignGenerationContext.tsx`  | Extend params/result types for carousel                              |
| `src/pages/DesignStudio.tsx`                | Carousel mode toggle, slide navigator, thumbnail strip, download all |
| `src/pages/ContentHub.tsx`                  | Add carousel action button per idea                                  |


### Credit Logic

- Carousel costs `slide_count × 2` (HD) or `slide_count × 1` (fast)
- Single credit check before generation starts
- Watermark logic applies per-slide using existing paid-tier check

### Scope Boundaries (v1)

- No drag-and-drop slide reordering
- No per-slide individual editing (user can regenerate entire carousel)
- No zip download — sequential PNG downloads
- No carousel editing after initial generation (can open individual slides later)