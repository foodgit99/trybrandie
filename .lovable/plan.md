

## Plan: Dual Design Variations (Same Copy, Two Visual Treatments)

### How It Works

The system generates **one copy structure** (headline, subheadline, CTA) and then branches into **two genome/render passes** — producing two visually distinct designs with identical text. The user picks their preferred variation.

### Cost & Credits

- Charges **2 credits** per generation (1 per variation) — or 1.5 if you prefer a discount model
- The shared pipeline stages (context assembly, brief, copywriter, caption) run **once**
- Only the genome composition + image render run **twice**

### Implementation

#### Step 1 — Edge Function (`design-studio/index.ts`)

In the `action === "generate"` branch, after the copywriter and caption agents complete (line ~1948):

- **Run the Genome Composer twice** with different random seeds (the mutation engine already uses `Math.random()`, so two calls naturally produce different genomes)
- **Run two image renders in parallel** — each with a different genome context but the same copy injection, brand context, and brief
- **Upload both images** to storage
- **Return both variations** in the response:

```json
{
  "image_url": "variation_a_url",
  "variations": [
    { "image_url": "...", "genome": {...}, "genome_scores": {...} },
    { "image_url": "...", "genome": {...}, "genome_scores": {...} }
  ],
  "copy_structure": { ... },
  "caption": "...",
  "explanation": "...",
  "design_prompt": "..."
}
```

- `image_url` remains the first variation (backwards compatible)
- Credit deduction changes from `1` to `2` for standard quality, `2` to `4` for HD
- The edit flow (`action === "edit"`) stays single-variation (no change)

#### Step 2 — Generation Context (`DesignGenerationContext.tsx`)

- Add `variations` array to the `GenerationResult` interface
- Update the `startGeneration` callback to handle the new response shape
- When auto-saving: save variation A as the primary design, save variation B as a linked design (same `title` with " (B)" suffix, or a `variation_of` column)

#### Step 3 — Database Migration

Add a column to link variations:

```sql
ALTER TABLE designs ADD COLUMN variation_of uuid REFERENCES designs(id) ON DELETE SET NULL;
```

This lets variation B point to variation A, keeping the design history clean.

#### Step 4 — Design Studio UI (`DesignStudio.tsx`)

- When `result.variations` exists (length 2), show a **variation picker** below the canvas:
  - Two thumbnail cards side by side (A and B)
  - Clicking a thumbnail swaps the main canvas image
  - The selected variation's genome and scores are displayed
- The "Download" and "Edit" actions apply to the currently selected variation
- Subsequent edits work on the selected variation's design ID

#### Step 5 — Autopilot (`content-autopilot/index.ts`)

- Autopilot continues generating **single variations** (no change) to keep credit costs predictable for background tasks
- A future enhancement could let users opt into dual variations for autopilot

---

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/design-studio/index.ts` | Duplicate genome + render for `generate` action, return `variations` array, double credit cost |
| `src/contexts/DesignGenerationContext.tsx` | Add `variations` to `GenerationResult`, handle new response shape |
| Migration SQL | Add `variation_of` column to `designs` |
| `src/pages/DesignStudio.tsx` | Variation picker UI (two thumbnails below canvas) |

### Performance Notes

- Two renders run **in parallel** (`Promise.all`), so latency increases by only ~10-15% (not 2x)
- The shared stages (brief, copywriter, caption, context assembly) are unchanged
- Net token cost increase: ~1.4-1.5x (genome composer is deterministic/free, only the render calls double)

