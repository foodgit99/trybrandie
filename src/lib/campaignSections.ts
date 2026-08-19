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

export const CAMPAIGN_SECTION_HINTS: Record<CampaignSectionKey, string> = {
  hero: "Always on. Badge, headline, sub-headline and the main call to action.",
  features: "Six capability cards with Brandie's product imagery.",
  showcase: "Editorial block: one claim, supporting body, capability tags.",
  how_it_works: "Three steps from signup to a full week of content.",
  testimonials: "Three founder quotes.",
  pricing: "Real Brandie plans. Only the heading is campaign copy.",
  faq: "Four to six questions, indexed as FAQ structured data.",
  cta: "Closing headline plus the final signup button.",
};

export type CampaignCopy = {
  hero?: {
    badge?: string;
    headline?: string;
    subheadline?: string;
    cta_label?: string;
    secondary_label?: string;
    footnote?: string;
  };
  features?: { heading?: string; subheading?: string; items?: { title?: string; description?: string }[] };
  showcase?: { heading?: string; body?: string; tags?: string[] };
  how_it_works?: { heading?: string; subheading?: string; steps?: { title?: string; body?: string }[] };
  testimonials?: { heading?: string; items?: { name?: string; role?: string; quote?: string }[] };
  pricing?: { heading?: string; subheading?: string };
  faq?: { heading?: string; items?: { q?: string; a?: string }[] };
  cta?: { heading?: string; body?: string; cta_label?: string };
};

export type CampaignStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "active"
  | "paused"
  | "archived"
  | "rejected";

export type CampaignPage = {
  id: string;
  user_id: string;
  partner_id: string | null;
  name: string;
  slug: string;
  goal: string | null;
  audience: string | null;
  offer_text: string | null;
  status: CampaignStatus;
  sections: CampaignSectionKey[];
  copy: CampaignCopy;
  review_note: string | null;
  starts_at: string;
  ends_at: string | null;
  views_count: number;
  clicks_count: number;
  signups_count: number;
  created_at: string;
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  pending_review: "Awaiting approval",
  approved: "Approved",
  active: "Live",
  paused: "Paused",
  archived: "Ended",
  rejected: "Rejected",
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
  if (!out.includes("hero")) out.unshift("hero");
  return out;
}

export function campaignSlugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function campaignPageUrl(slug: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://trybrandie.com";
  return `${origin}/c/${slug}`;
}
