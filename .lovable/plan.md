

# Plan: Ensure All Pipelines Pull Products & Services Context

## Current State

| Pipeline | Products & Services Context | Status |
|---|---|---|
| `design-studio` | Full catalogue with all fields | Done |
| `brand-engine` | Full catalogue with all fields | Done |
| `brand-strategist` | Only fetches count (`head: true`) — no actual product data | Needs fix |
| `video-studio` | Not fetched at all | Needs fix |

## Changes

### 1. `supabase/functions/brand-strategist/index.ts`

Currently fetches `brand_products` with `count: "exact", head: true` — only gets the number of products, not their details. The AI strategist sees "Product Images: 3 uploaded" with zero context about what those products are.

**Fix:** Fetch full product records (label, description, product_type, price, features, duration, pricing_model) and inject a formatted `PRODUCTS & SERVICES` section into the brand context string, replacing the shallow "Product Images: N uploaded" line.

### 2. `supabase/functions/video-studio/index.ts`

The `assembleContext` function fetches brand, audience, and trend data but completely skips products. Video scripts would benefit heavily from knowing product names, prices, and features for accurate CTAs and narration.

**Fix:** Add a `brand_products` query to the parallel fetch in `assembleContext`, then append a `PRODUCTS & SERVICES` section to the context string using the same formatting pattern as the other pipelines.

### Files Changed

1. **`supabase/functions/brand-strategist/index.ts`** — Replace count-only product query with full select; add formatted product context to the brand context string
2. **`supabase/functions/video-studio/index.ts`** — Add product fetch to `assembleContext`; append product catalogue to context string

