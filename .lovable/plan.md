

## Visual Style Genome System (VSGS) — Implementation Plan

The VSGS introduces a structured "design DNA" layer between the user's intent and the image renderer. Instead of passing loose style descriptions, Brandie will decompose every design into atomic **style genes** across 8 categories, enabling precise control, trend adaptation, and brand consistency enforcement.

### Architecture Overview

```text
User Prompt
  ↓
Brief Agent (existing)
  ↓
Genome Composer (NEW) ← Brand data + Trend tokens + Audience signals
  ↓ outputs structured genome JSON
Copywriter Agent (existing, receives genome context)
  ↓
Image Renderer (existing, receives genome as structured styling instructions)
  ↓
Design Output + Genome stored alongside design
```

### What Gets Built

**1. Genome Type Definitions** (`src/lib/genomeTypes.ts` — new file)

Define TypeScript interfaces for the full genome structure: `ColorGenome`, `TypographyGenome`, `LayoutGenome`, `CompositionGenome`, `TextureGenome`, `IllustrationGenome`, `ImageStyleGenome`, `EmotionGenome`, and the top-level `VisualStyleGenome` that combines them all. Each gene has enumerated parameter values (e.g., palette_type: "monochrome" | "complementary" | "analogous" | ...).

**2. Genome Preset Library** (`src/lib/genomePresets.ts` — new file)

Define 9 complete genome presets matching the spec: Minimalist Modern, Luxury Editorial, Streetwear Alte, Neo Brutalism, Retro Futurism, Organic Natural, Tech Futurism, Bold Startup, Corporate Clean. Each is a full `VisualStyleGenome` object.

Also define a mapping from existing Trend Lab presets to genome overrides — so selecting "Hyper Chromatic" in Trend Lab automatically sets the relevant genes (color saturation → neon, contrast → extreme, texture → light leaks, etc.).

**3. Genome Composer Agent** (inside `supabase/functions/design-studio/index.ts`)

Add a new agent step between the Brief Agent and Copywriter. The Genome Composer:
- Receives: the design brief, brand data, audience JTBD profile, selected trend, trend intensity
- Uses a structured tool call (like the Copywriter) to output a `VisualStyleGenome` JSON
- Applies **gene locking rules**: brand primary colors and fonts are "locked" genes that cannot be overridden; texture, layout, composition are "free" genes
- Applies **mutation** (15% randomization on free genes) to keep outputs fresh
- The genome is then serialized into the Copywriter prompt (for tone/density awareness) and the image prompt (as precise styling instructions)

This replaces the current loose `trendContext` string with structured, precise gene instructions.

**4. Genome-Aware Prompts** (inside `supabase/functions/design-studio/index.ts`)

Refactor the image generation prompt to include structured genome instructions instead of (or in addition to) the current free-text trend/brand descriptions. Example output injected into the renderer:

```
VISUAL STYLE GENOME:
- Color: Analogous palette, warm temperature, high contrast, vibrant saturation, soft gradient
- Typography: Friendly personality, bold weight, strong headline dominance, centered layout
- Layout: Modular grid, asymmetrical balance, balanced density, image dominant
- Composition: Diagonal direction, single focal point, medium layering
- Texture: Paper grain, medium intensity, no distortion
- Image Style: Natural lighting, vibrant grading, wide framing
- Emotion: Energetic
```

**5. Store Genome with Design** (database migration)

Add a `genome` JSONB column to the `designs` table to store the genome used for each design. This enables:
- Learning from upvoted/downvoted genomes over time
- Reproducing exact styles
- Future genome analytics

```sql
ALTER TABLE public.designs ADD COLUMN genome jsonb DEFAULT NULL;
```

**6. Brand Consistency Layer** (inside Genome Composer logic)

Before finalizing the genome, enforce brand locks:
- **Locked genes**: color primary values, font families — pulled directly from Brand Centre, never overridden
- **Semi-flexible genes**: typography weight/effects, color temperature — can shift within brand-compatible range
- **Free genes**: texture, layout grid, composition, illustration style — fully controlled by trend/prompt/mutation

### What Does NOT Change

- The existing Trend Lab UI and presets remain — trends now map to genome overrides internally
- The Copywriter Agent and image renderer pipelines stay the same — they just receive richer, structured context
- No new UI pages or components needed for MVP — the genome operates as an invisible intelligence layer
- The feedback engine (upvote/downvote) continues working — genome data stored alongside enables future learning

### File Changes Summary

| File | Action |
|---|---|
| `src/lib/genomeTypes.ts` | Create — genome interfaces |
| `src/lib/genomePresets.ts` | Create — 9 presets + trend-to-genome mapping |
| `supabase/functions/design-studio/index.ts` | Edit — add Genome Composer agent step, refactor prompt injection |
| Database migration | Add `genome` JSONB column to `designs` table |

### Risk Mitigation

- The Genome Composer uses a structured tool call (like the existing Copywriter), so output is always valid JSON
- If the Genome Composer fails, fall back to the current prompt-based approach (no regression)
- Gene locking prevents brand drift even with high trend intensity or mutation
- No additional API calls beyond one extra LLM call for the Genome Composer (lightweight, uses flash model)

