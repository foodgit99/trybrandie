

# Plan: Products & Services with Type-Specific Forms

## Why separate form fields matter

Services have fundamentally different attributes that matter for content generation:

| Attribute | Product (physical/digital) | Service |
|---|---|---|
| Price display | Fixed price ("$49") | Pricing model ("From $200/hr", "Packages from $500") |
| Key detail | Features list | Deliverables / what's included |
| Time element | N/A | Duration ("1hr session", "4-week program") |
| Visual context | Product image | Could be a portfolio/cover image |
| Content angle | "Get this thing" | "Book this experience / hire this expertise" |

The AI Copywriter and Creative Director would generate very different content knowing "1-hour brand strategy session, $300, includes brand audit + action plan" vs a generic feature list.

## Approach: Single form, conditional fields

No separate table or form needed. The existing `brand_products` table and form structure works — we add conditional fields that appear based on the selected type.

### Database changes

Add 2 columns to `brand_products`:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `duration` | text | `''` | Service duration ("1 hour", "4 weeks", "ongoing") |
| `pricing_model` | text | `''` | How pricing works ("per hour", "per session", "fixed", "packages from") |

The existing `features` column doubles as "deliverables" for services — just relabel it contextually.

### UI changes in `BrandCentre.tsx`

1. Rename section header from "Product Catalogue" to "Products & Services"
2. Rename "Add" button label contextually
3. In the form, when type is "service":
   - Show "Duration" field (e.g., "1 hour session")
   - Show "Pricing Model" selector (per hour / per session / fixed / packages from)
   - Relabel "Features" as "What's Included / Deliverables"
   - Relabel "Description" placeholder to "Describe the service and who it's for"
4. When type is "physical" or "digital": keep current fields as-is

### Pipeline integration

Update the product context string in `design-studio/index.ts` and `brand-engine/index.ts` to include duration and pricing model for services:

```
PRODUCTS & SERVICES:
1. "Brand Strategy Session" (service, $300/session, 1hr) — Deep-dive brand audit. Includes: brand audit, competitor analysis, action plan.
2. "Logo Package" (digital, from $500) — Custom logo design. Features: 3 concepts, unlimited revisions.
```

## Files changed

1. **Migration SQL** — Add `duration` and `pricing_model` columns to `brand_products`
2. **`src/pages/BrandCentre.tsx`** — Rename to "Products & Services", add conditional service fields
3. **`supabase/functions/design-studio/index.ts`** — Enrich context string with service-specific attributes
4. **`supabase/functions/brand-engine/index.ts`** — Same enrichment for content idea generation

