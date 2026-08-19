// The fixed section vocabulary for campaign landing pages.
// There is exactly ONE template — Brandie's default landing page. A campaign
// only chooses which of these sections it carries, in which order, and the copy
// inside them. No custom sections, no uploads, no layout editing.

export const CAMPAIGN_SECTION_KEYS = [
  "hero",
  "features",
  "showcase",
  "how_it_works",
  "testimonials",
  "pricing",
  "faq",
  "cta",
] as const;

export type CampaignSectionKey = (typeof CAMPAIGN_SECTION_KEYS)[number];

export const CAMPAIGN_SECTION_LABELS: Record<CampaignSectionKey, string> = {
  hero: "Hero",
  features: "Feature grid",
  showcase: "Product showcase",
  how_it_works: "How it works",
  testimonials: "Testimonials",
  pricing: "Pricing",
  faq: "FAQ",
  cta: "Closing call to action",
};

export function normaliseSections(input: unknown): CampaignSectionKey[] {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: CampaignSectionKey[] = [];
  for (const raw of arr) {
    const key = String(raw);
    if (seen.has(key)) continue;
    if ((CAMPAIGN_SECTION_KEYS as readonly string[]).includes(key)) {
      seen.add(key);
      out.push(key as CampaignSectionKey);
    }
  }
  // Hero always anchors the page.
  if (!out.includes("hero")) out.unshift("hero");
  return out;
}

/** JSON shape the copy agent must return, described for the model. */
export const CAMPAIGN_COPY_SCHEMA = `{
  "hero": { "badge": string, "headline": string, "subheadline": string, "cta_label": string, "secondary_label": string, "footnote": string },
  "features": { "heading": string, "subheading": string, "items": [{ "title": string, "description": string }] (exactly 6) },
  "showcase": { "heading": string, "body": string, "tags": string[] (3-5) },
  "how_it_works": { "heading": string, "subheading": string, "steps": [{ "title": string, "body": string }] (exactly 3) },
  "testimonials": { "heading": string, "items": [{ "name": string, "role": string, "quote": string }] (exactly 3) },
  "pricing": { "heading": string, "subheading": string },
  "faq": { "heading": string, "items": [{ "q": string, "a": string }] (4-6) },
  "cta": { "heading": string, "body": string, "cta_label": string }
}`;
