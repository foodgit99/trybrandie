# Real branded banners for the Marketing Kit

Today the Marketing Kit tab shows three CSS gradient placeholders labeled "Brandie / AI Brand Studio" — no actual image file exists, so affiliates have nothing to download. The landing copy ("Approved affiliates get branded banners…") overpromises. This plan ships 6 real banners they can save in one tap.

## What gets generated

Two style families × three sizes each = **6 PNG banners**, all matching the warm Nigerian premium palette (Beige `#FAF8F5`, Charcoal `#2B2D33`, Gold `#C4993B`).

**Style A — "Founder-led, warm editorial"**
Soft beige background, serif headline, a Nigerian founder portrait silhouette on the right, gold underline accent. Headline: *"Your marketing department, on autopilot."* Sub: *"Brandie — AI Brand Studio for African founders."*

**Style B — "Product-led, bold"**
Charcoal background, large serif headline in cream, a stylized Weekly Blueprint phone mockup with 5 post tiles, gold CTA chip. Headline: *"5 posts a week. 10-minute Monday review."* Sub: *"Brandie does the rest."*

Sizes per style:
- `1:1` 1080×1080 — IG/X/LinkedIn feed
- `9:16` 1080×1920 — Stories / Reels covers
- `16:9` 1920×1080 — YouTube end card, X header, blog hero

All 6 are generated with the premium image model, saved to `src/assets/affiliate-banners/`, then converted to Lovable CDN assets so they don't bloat the repo.

## What changes in the dashboard

`src/components/affiliate/MarketingKitTab.tsx` and `src/lib/affiliateAssets.ts`:

- `BANNER_ASSETS` becomes a richer structure grouped by style, each entry carrying `{ id, style, label, ratio, dimensions, imageUrl, fileName }`.
- The Banner kit section gains a small style switcher ("Founder-led" / "Product-led") and renders the actual `<img>` for each size.
- Each tile gets a **Download** button (uses `fetch` → `blob` → anchor with `download` attr so the file lands with a proper name like `brandie-affiliate-square-founder.png` instead of opening in a new tab).
- Helper text updated to: *"Download a banner, post it with your referral link in bio or caption. New styles drop monthly."*
- Remove the "right-click to save" / "generate one in the studio" copy — no longer needed.

No backend, schema, edge function, or pricing changes. Purely frontend + assets.

## Technical details

```text
src/assets/affiliate-banners/
  founder-1x1.jpg.asset.json
  founder-9x16.jpg.asset.json
  founder-16x9.jpg.asset.json
  product-1x1.jpg.asset.json
  product-9x16.jpg.asset.json
  product-16x9.jpg.asset.json
```

Generation: `imagegen--generate_image` with `model: "premium"` (text legibility matters), `transparent_background: false`, each at the exact dimensions above so no client-side resizing is needed.

`affiliateAssets.ts`:
```ts
export type BannerStyle = "founder" | "product";
export interface BannerAsset {
  id: string;
  style: BannerStyle;
  label: string;
  ratio: "1:1" | "9:16" | "16:9";
  dimensions: string;
  imageUrl: string;     // from .asset.json
  fileName: string;     // download filename
}
```

Download helper added to `MarketingKitTab.tsx`:
```ts
async function downloadAsset(url: string, fileName: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}
```

## Verification

- Visually QA each generated banner — confirm legible "Brandie" wordmark, no clipped text, correct aspect ratio, brand palette intact. Regenerate any that fail.
- Open `/affiliate` → Marketing Kit tab in the preview, switch between Founder-led and Product-led, download one banner per size, confirm the saved PNG opens and matches the preview.
- TypeScript check.

## Out of scope (flag, don't build)

- Per-affiliate custom banners with their face/handle baked in — flagged in current copy as a "studio" workflow, can be a follow-up using the existing design pipeline.
- A banner request form for approved affiliates.
