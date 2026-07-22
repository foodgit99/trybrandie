## Goal
Let users tag each gallery image with an optional short label (e.g. "Product hero shot", "Team photo", "Storefront") so Brandie's design agents get richer context about what each image is.

## Changes

### 1. Database
Add `label text` column to `public.brand_inspiration` (nullable, no default). No RLS or grant changes needed — existing policies cover it.

### 2. Gallery UI — `src/components/brands/BrandGalleryPanel.tsx`
- Add a small text input under each gallery thumbnail (placeholder: "Add a label (optional)", e.g. "Product hero", "Team", "Storefront").
- Debounced save on blur / Enter → `update({ label }).eq('id', item.id)`.
- Show label as caption below the image in the "Next design preview" pills too.
- Include `label` in the initial `select` and reorder update flow.

### 3. Design agents — `supabase/functions/design-studio/index.ts`
In both spots that load `brand_inspiration` (lines ~1578 and ~3262):
- Also select `label`.
- Build a keyed list `[{ url, label }]` instead of a flat URL array.
- When labels are present, pass a short brief block to the renderer/planner prompt like:
  ```
  Gallery references (use these real assets when relevant):
  1. <url> — Product hero shot
  2. <url> — Team photo
  ```
  Unlabeled entries render as `— (unlabeled)`.

### 4. Types
Rely on regenerated Supabase types after migration; no manual edits.

## Out of scope
- No label taxonomy / dropdown — free-form only.
- No changes to upload flow (label starts empty, user fills in after upload).
- No search/filter by label.
