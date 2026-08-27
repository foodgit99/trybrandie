# Nigerian casting & setting by default in all designs

Every design Brandie renders should show Nigerian people in Nigerian settings by default. Special Instructions on the brand stay the only way to override it (e.g. "use European models", "no people at all").

## What changes for the user

- Any generated graphic or carousel slide that includes people shows Nigerian/West African people, styling and environments (Lagos/Abuja streets, Nigerian markets, homes, offices, salons, signage, currency, plates of food) instead of generic Western stock imagery.
- Product photos and gallery images already uploaded by the brand are untouched — they are still used exactly as-is; the rule only governs imagery Brandie invents.
- If a brand's Special Instructions ask for a different look, location or cast, that wins — no behaviour change for those brands.

## Technical approach

1. New shared module `supabase/functions/_shared/locale-doctrine.ts` exporting a short, prompt-budget-friendly `NIGERIAN_CASTING_DOCTRINE` block:
   - Default cast: Nigerian / West African people, authentic skin tones, hair, dress.
   - Default environment: recognisably Nigerian settings and props; no generic Western suburbia.
   - Explicit carve-outs: real product/gallery reference photos are never restyled; abstract/typographic designs with no people are unaffected.
   - Explicit precedence line: SPECIAL BRAND INSTRUCTIONS override this block.

2. Inject it in `supabase/functions/design-studio/index.ts` (the only image-rendering pipeline):
   - Single render: append to the `intentHeader` block (after the special-instructions block, so instructions read as higher priority) in `renderVariation` (~line 3009).
   - Carousel slides: append to the per-slide `PRIMARY CREATIVE INTENT` prompt (~line 3997).
   - Creative Director / layout-schema and design-brief prompts (~lines 1810, 2704, 2800) get the same one-liner so the art direction it plans is already Nigerian-aware.
   - It sits in the "keep" section of the prompt assembly, not in `stylisticContext`, so the 3500-char budget trim cannot drop it; the block is kept to ~2 short sentences to protect the budget.

3. Logo generation (`logo-designer`) is left alone — logos are marks, not scenes.

No schema, UI or credit changes.
