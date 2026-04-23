

## Plan: Carousel pricing → 1.5 credits per slide (rounded down)

### New pricing
- **Single — unchanged**: Fast = 1, HD = 2
- **Carousel — new**: `floor(slideCount × 1.5)` credits, regardless of Fast/HD quality

| Slides | Old (Fast / HD) | New (any quality) |
|--------|-----------------|-------------------|
| 2      | 2 / 4           | **3**             |
| 3      | 3 / 6           | **4**             |
| 4      | 4 / 8           | **6**             |
| 5      | 5 / 10          | **7**             |
| 6      | 6 / 12          | **9**             |
| 7      | 7 / 14          | **10**            |
| 8      | 8 / 16          | **12**            |
| 9      | 9 / 18          | **13**            |
| 10     | 10 / 20         | **15**            |

Quality toggle still controls render quality of carousel images, but no longer affects price (carousels become significantly cheaper on HD, slightly cheaper on Fast).

### Implementation

A single shared formula introduced in both frontend and backend so they can't drift:

```ts
carouselCost = Math.floor(slideCount * 1.5)
singleCost   = renderQuality === "hd" ? 2 : 1
```

### Files to edit

**1. `src/pages/DesignStudio.tsx`** (line ~525)
- Replace `creditCost = isCarouselMode ? baseCost * slideCount : baseCost` with the new formula
- Update any UI label that displays carousel cost (e.g. "X credits" preview near the Generate button) to use the same formula

**2. `supabase/functions/design-studio/index.ts`** (line 2330)
- Replace `const creditCost = (render_quality === "hd" ? 2 : 1) * numSlides` with `const creditCost = Math.floor(numSlides * 1.5)`
- Error message text stays accurate (uses the variable)

**3. Search & sync any other carousel cost displays**
- Check `HeroChatInput.tsx`, `ContentHub.tsx`, and any pricing tooltip/help text that hardcodes carousel cost; update to the new formula or static table above

### What does NOT change
- Database schema (credits remain integers — `floor` keeps it that way)
- Deduction order (Free → Bonus → Reward → Paid)
- Single-design pricing
- Carousel slide count range (2–10)
- Render quality toggle behaviour for output quality

### Verification after build
Confirm in Studio:
- 5-slide carousel shows **7 credits** (Fast or HD)
- 10-slide carousel shows **15 credits**
- Single Fast still shows **1**, Single HD still shows **2**
- Backend rejects with the same number it gated on

