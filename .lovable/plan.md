# Expand product image usage across carousel + content hub

Today single designs already use product images well, but carousels and the content-hub ideation lag behind. This plan brings them up to parity, with featured-first ordering and per-slide targeting so product photos land where they actually belong.

## Current gaps

- **Carousel arc planner** (`design-studio` ~line 3192): selects only `label, description, features, product_type, price, image_url, gallery_images` — missing `is_featured`, `pricing_model`, `duration`, sorted by `created_at` (not featured), and the arc plan has no field telling each slide *which* product it's about.
- **Carousel renderer** (`design-studio` ~line 3561): passes the **same flat `productImageUrls`** to every slide. The model can't tell which product belongs to which beat, and refs get capped indiscriminately.
- **Content Hub ideation** (`brand-engine` ~line 146): pulls product text only — no `image_url` / `gallery_images`. Ideas can't flag "uses Product X's photo" so downstream design generation re-discovers it.
- **Strategist / monday-briefing / trend-scout / video-studio**: not in scope here (user asked for carousel + content hub).

## Changes

### 1. Carousel arc planner — richer product context + per-slide product targeting (`supabase/functions/design-studio/index.ts`)

- Expand the product fetch (~L3192) to mirror the single-design fetch: add `is_featured, pricing_model, duration, gallery_images` (already there), and **sort featured-first** before summarising.
- Build a **keyed product roster** `[{ key: "P1", label, images: [image_url, ...gallery_images], price, features, is_featured }]` and inject it into `productsContext` with explicit keys (`P1 ⭐ "Aso Ebi Set" — ₦45k …`).
- Extend the arc-plan schema (`carouselPlan.slides[i]`) with an optional `product_ref: "P1" | null` field. Update the arc-planner system prompt to require: for `value` / `proof` slides that lean on a specific product, set `product_ref` to one of the roster keys; leave `null` for abstract slides. Hook and CTA may also reference a product.
- Build a map `productKeyToImages: Record<string, string[]>` from the roster.

### 2. Carousel per-slide render — targeted product refs (`renderSlide`, ~L3556)

- When `slide.product_ref` is set, pass `productImageUrls: productKeyToImages[slide.product_ref]` (cover image first, then up to 2 gallery shots) to `collectRenderRefs`, and append a line to the slide prompt:  
  `THIS SLIDE FEATURES PRODUCT "${label}" — the attached product reference image(s) must appear as a real, recognisable hero/supporting visual. Honour its actual colours, shape, and details.`
- When `slide.product_ref` is null, fall back to **featured product images only** (top 1–2) instead of the current flat list — keeps brand voice without forcing irrelevant products into every slide.
- Keep user-uploaded image priority unchanged (already enforced by `collectRenderRefs` ordering).

### 3. Content Hub ideation — product image awareness (`supabase/functions/brand-engine/index.ts`)

- Expand fetch at L146 to include `id, image_url, gallery_images, is_featured` and sort featured-first.
- Build the `productContext` with the same `P1 / P2 …` keys used in carousel planner so the schema is consistent across agents.
- Append a note to each generated idea: extend the idea JSON schema with `product_ref: string | null` (one of the roster keys) and `uses_product_image: boolean`. Update the ideation system prompt to set these when the idea is product-anchored (launches, promos, restocks, "behind-the-build", testimonials of a specific product/service).
- Persist `product_ref` onto `content_ideas` rows so downstream design generation (single + carousel) can pre-select the right product images without re-classifying.

### 4. Downstream wiring — honour `content_ideas.product_ref`

- When `/post` triggers a single design from an idea, if `idea.product_ref` is set, pre-rank that product's images first in `productImageUrls` and add the same `THIS DESIGN FEATURES …` instruction so the renderer doesn't ignore it.
- Same for carousel regenerate-from-idea: seed `carouselPlan.slides[*].product_ref` defaults from the idea before the arc planner runs (planner may still re-assign per slide).

## Schema

One migration on `content_ideas`:

```sql
ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS product_ref uuid REFERENCES public.brand_products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_content_ideas_product_ref ON public.content_ideas(product_ref);
```

(Keying ideas by `brand_products.id` is more robust than the `P1` shorthand used inside the agent prompt — we translate at the boundary.)

No grant/RLS changes needed; `content_ideas` already has the right policies.

## Out of scope

- UI changes on `/brand/editor` (already shows products).
- Strategist / monday-briefing / video-studio agents — separate ask if you want them on the same roster.
- Letting users hand-pick a product per design from the UI (could be a follow-up — the `product_ref` field this plan adds makes it trivial).

## Risks / mitigations

- **More refs per render → cost + token risk:** `collectRenderRefs` already caps total refs; we keep that cap. Per-slide we send at most 3 product images (1 cover + 2 gallery).
- **Arc planner may set `product_ref` for every slide:** prompt explicitly says "only when the slide leans on a specific product"; we also validate against the roster keys and drop unknowns silently.
- **Old ideas without `product_ref`:** column is nullable, falls back to today's behaviour.
