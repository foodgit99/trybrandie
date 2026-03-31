

# Plan: Enrich Product Gallery with Detailed Product Information

## Why This Is Useful

Currently, products are just images with auto-extracted filenames as labels. The AI pipeline sees: *"The brand has 3 product image(s) (coffee-bag, mug, gift-set)"* — almost no context. Adding structured product details would dramatically improve output quality:

1. **Copywriter Agent** — Knowing a product is a "premium single-origin coffee, 250g bag, $18" lets the AI write specific CTAs ("Get yours for $18"), accurate descriptions, and relevant hooks instead of generic copy.
2. **Creative Director Agent** — Knowing a product is physical vs. digital changes the visual strategy (physical products benefit from lifestyle photography styling; software benefits from UI mockup framing).
3. **Content Hub** — The idea generator can create product-specific content ideas: "Showcase the new Espresso Blend" rather than generic "promotional post."
4. **Caption Agent** — Can name-drop specific products, mention features, and use accurate pricing in captions.

This is one of the highest-impact Brand Centre improvements possible because it closes the gap between "generic brand awareness" and "product-specific marketing" — which is what most small businesses actually need.

## Database Changes

**Alter `brand_products` table** — add columns:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `description` | text | `''` | What the product does / key selling points |
| `product_type` | text | `'physical'` | `physical`, `digital`, `service` |
| `price` | text | `''` | Display price (text to handle currency flexibility) |
| `features` | text[] | `'{}'` | Key features/benefits list |

No new RLS policies needed — existing policies already cover the table.

## Brand Centre UI Changes (`BrandCentre.tsx`)

- Replace the current image-only grid with **expandable product cards** that show:
  - Product image (existing)
  - Name/label (existing, make editable inline)
  - Description (new textarea)
  - Type selector: Physical / Digital / Service (new)
  - Price (new input)
  - Features (new tag-style input, up to 5)
- Add an **"Edit product"** flow — clicking a product card opens an inline edit panel below the image
- Keep the existing upload flow but after upload, prompt the user to fill in details

## Orchestration Pipeline Integration

### `design-studio/index.ts`
Update the product fetch (line ~930) to select the new columns and build a richer context string:

```
PRODUCT CATALOGUE:
1. "Espresso Blend" (physical, $18) — Premium single-origin coffee. Features: organic, fair-trade, bold flavor.
2. "Brand Kit" (digital, $49) — Complete branding template package. Features: editable, Canva-compatible.
```

This replaces the current shallow label-only context.

### `brand-engine/index.ts`
When generating weekly content ideas, inject the product catalogue so the AI can create product-specific content ideas (e.g., "Showcase Espresso Blend — highlight organic sourcing" as a graphic post).

## Files Changed

1. **Migration SQL** — ALTER `brand_products` to add 4 new columns
2. **`src/pages/BrandCentre.tsx`** — Expand product card UI with edit capability for new fields
3. **`supabase/functions/design-studio/index.ts`** — Enrich product context string with new fields
4. **`supabase/functions/brand-engine/index.ts`** — Inject product catalogue into content idea generation

