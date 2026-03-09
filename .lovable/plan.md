

## Current Data Sources for Design Generation

Here are all the data sources that feed into the AI agent pipeline, listed with their effective priority/weight:

| # | Data Source | Weight / Priority | Used By | Where Stored |
|---|---|---|---|---|
| 1 | **User Prompt** (intent) | HIGHEST — overrides everything | Brief Agent, Copywriter, Renderer | Chat message |
| 2 | **Brand Centre** (colors, fonts, tone, vibe, personality, logo) | SECOND HIGHEST — always enforced | Brief Agent, Copywriter, Creative Director, Renderer | `brands` table |
| 3 | **User Attached Image** | PRIMARY visual element when present — overrides other imagery | Brief Agent, Renderer | Uploaded per-message, passed as `user_image_url` |
| 4 | **Audience Intelligence (JTBD)** | HIGH — shapes copy persuasion and visual energy | Copywriter (emotional drivers, messaging angles), Brief Agent (visual strategy) | `target_audiences` table |
| 5 | **Trend Lab** (trend preset + intensity 0–100) | MEDIUM — styling overlay, never overrides brand | Creative Director genome overrides, Copywriter tone hints, Renderer styling | `brand_trend_preferences` table |
| 6 | **RAG Preferences** (top 8 past designs weighted by votes) | MEDIUM — 60% bias toward preferred gene values | Genome Mutation Engine | Queried from `designs` table at generation time |
| 7 | **Visual Style Genome** (8 gene categories, deterministic) | MEDIUM — precise styling instructions for renderer | Renderer prompt, Genome Scoring, Stability Gate | Generated per-design, stored in `designs.genome` |
| 8 | **Brand Inspiration Images** (up to 2 passed to renderer) | LOW-MEDIUM — visual style reference | Renderer (passed as image references) | `brand_inspiration` table + `brand-inspiration` storage bucket |
| 9 | **Canvas Format** (square/portrait/landscape) | STRUCTURAL — affects layout and copy length | Brief Agent, Copywriter, Renderer | Selected per-design |
| 10 | **Session/Edit Context** (previous prompt + image for edits) | CONTEXTUAL — preserves continuity | Brief Agent, Renderer | Passed from frontend |

---

## Plan: Product Images Data Source

### Concept

Add a **Product Gallery** section to the Brand Centre where users upload photos of their actual products/services. These images become a new data source for the agents — used **contextually** (not always) based on the design brief's relevance to product promotion.

### Database Changes

**New table: `brand_products`**

```sql
CREATE TABLE public.brand_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  label text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;
```

RLS policies mirroring `brand_inspiration` (owner CRUD via brand ownership check + admin access).

**Storage**: Reuse the existing `brand-inspiration` bucket (or create a dedicated `brand-products` bucket for cleaner separation).

### Brand Centre UI

Add a **"Product Images"** section in the Brand Centre, positioned between the Logo section and the Inspiration section. It follows the same pattern as inspiration uploads:
- Grid of uploaded product photos with delete buttons
- Upload button accepting multiple images
- Optional label/name per product image
- Same upload flow as inspiration (storage upload → insert row → display)

### Agent Integration (Edge Function)

In `design-studio/index.ts`:

1. **Fetch product images** alongside brand data (query `brand_products` for the brand, limit 6)
2. **Brief Agent awareness**: Add to the brand context a note like: "The brand has N product image(s) available. When the design is promoting, showcasing, or related to the brand's products, incorporate a product image as a supporting visual element — but do NOT make it the hero of every design. Use product images when contextually relevant (e.g., product launches, promotions, offers, showcases). For motivational, informational, or brand-awareness posts, product images are optional."
3. **Renderer image references**: When the Brief Agent's output mentions products or when the user prompt relates to products/offers/promotions, pass up to 2 product images as additional image references to the renderer (same pattern as inspiration images and logo)
4. **Intent-based inclusion**: Use the Brief Agent's design brief text to determine relevance — if the brief mentions product, promotion, offer, sale, showcase, launch, or similar terms, include product images. Otherwise, omit them.

### Priority / Weight

Product images sit at **LOW-MEDIUM** priority — same tier as inspiration images but with contextual gating:
- They are NOT always included (unlike brand colors/fonts which are always enforced)
- They are included when the design context is product-related
- They serve as supporting visual references, not the hero element
- The user's attached image (if any) always takes priority over product images

### Files Changed

| File | Change |
|---|---|
| Database migration | Create `brand_products` table with RLS |
| `src/pages/BrandCentre.tsx` | Add Product Images section (upload, display, delete) |
| `src/pages/Onboarding.tsx` | Optionally add product upload step (or defer to post-onboarding) |
| `supabase/functions/design-studio/index.ts` | Fetch product images, add to brand context, conditionally pass to renderer |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

