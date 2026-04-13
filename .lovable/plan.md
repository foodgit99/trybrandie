

## Plan: Single Generation Per Call — Maximum Quality Focus

### Problem
Currently, new designs generate **two variations** (A and B) in parallel, costing 2 credits per standard generation. The user wants to reduce this to **one generation per call** and focus all pipeline effort on producing the highest-quality single output.

### Changes

**1. `supabase/functions/design-studio/index.ts`** — Backend: Single render for new generations

- **Credit cost** (line ~976): Change `(isNewGeneration ? 2 : 1)` to `1` — new generations now cost 1 credit (or 2 for HD)
- **Remove dual variation logic** (lines ~2182-2247): Instead of creating variation B, mutating its genome, and rendering both in parallel, just apply the stability gate to the single genome and render once (reuse the existing single-variation path at lines 2249-2289)
- **Remove `mutateGenomeCopy` helper** (lines ~1994-2060): No longer needed
- **Remove `variations` array from response**: The response for new generations will match the edit response shape (single `image_url`, no `variations` array)

**2. `src/pages/DesignStudio.tsx`** — Frontend: Remove variation picker UI

- **Credit cost display** (line ~498): Change `isEdit ? baseCost : baseCost * 2` to just `baseCost` — both new and edit cost the same
- **Remove variation state usage**: The variation picker (A/B thumbnails) below the generated image becomes unnecessary. Remove the conditional rendering of the variation picker and simplify the image display to always use `msg.imageUrl`
- **Clean up variation state**: Keep `variations` state for backward compatibility but it will always be empty for new designs

### Quality Focus
The existing pipeline already maximizes quality through:
- Brief Agent (structured creative direction)
- Genome Composer with stability gate (score threshold < 55 triggers fixes)
- Brand lock enforcement
- RAG preference learning
- Copywriter + Caption agents

By rendering one image instead of two, the pipeline concentrates the same intelligence into a single output without splitting attention.

### Files
- `supabase/functions/design-studio/index.ts`
- `src/pages/DesignStudio.tsx`

