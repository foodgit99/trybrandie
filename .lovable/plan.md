

## Plan: Drop Fast/HD toggle, route everyone to Gemini's best image models

### Model strategy (per your selection)
- **Single design** → `google/gemini-3-pro-image-preview` (highest fidelity)
- **Carousel slides** → `google/gemini-3.1-flash-image-preview` (Nano Banana 2 — pro-level quality at flash speed, keeps multi-slide generation snappy)

### Pricing (unchanged)
- **Single** = 2 credits flat
- **Carousel** = `floor(slides × 1.5)` credits

### Changes

**1. `src/pages/DesignStudio.tsx`** — remove toggle UI and state
- Delete the `renderQuality` state (line 143) and all references
- Remove the Fast/HD toggle JSX (lines 1159–1183)
- Remove the Fast/HD popover content (lines 1190–1210ish); replace with a single info popover explaining: "Single = 2 credits. Carousel = 1.5 credits per slide (rounded down)."
- Update credit-cost calc (lines 523–526) to: `const creditCost = isCarouselMode ? Math.floor(slideCount * 1.5) : 2;`
- Stop sending `render_quality` in the edge function payload (line 617) — or send a constant `"hd"` for backward-compat. We'll just remove it.

**2. `src/contexts/DesignGenerationContext.tsx`** — drop the field
- Remove `render_quality: "fast" | "hd"` from `GenerationParams` interface (line 38)

**3. `supabase/functions/design-studio/index.ts`** — pin models, simplify pricing
- Stop destructuring `render_quality` from the body (line 371)
- Single-design credit cost (line 1098): change to `const creditCost = 2;`
- Single-design model selection (lines 2218, 2249): hardcode `"google/gemini-3-pro-image-preview"`
- Carousel slide model selection (lines 2551, 2570): hardcode `"google/gemini-3.1-flash-image-preview"`
- Carousel credit cost (line 2331): unchanged — already `Math.floor(numSlides * 1.5)`

**4. `supabase/functions/content-autopilot/index.ts`** — align background jobs
- Line 280: remove `render_quality: "fast"` from the autopilot payload (or leave it; the edge function will ignore it after change #3). Cleanest: remove the line.

### What does NOT change
- Database schema, deduction order (Free → Bonus → Reward → Paid), credit-balance queries
- Carousel slide count range (2–10)
- Prompt construction, genome system, copy pipeline
- Brand Strategist / Plan mode

### Verification after build
- Studio toolbar no longer shows the Fast/HD pill — only canvas size, slide count (carousel mode), and the info icon
- Generating a single design deducts **2 credits** and uses Pro Image
- Generating a 5-slide carousel deducts **7 credits** and uses Nano Banana 2 per slide
- Autopilot-generated designs still succeed end-to-end

