// Single source of truth for the 10 content categories used across
// pillars, series, campaigns, and content ideas. Backend enum lives in
// supabase/functions/brand-engine/index.ts (CONTENT_CATEGORY_ENUM) — keep IDs in sync.

export type ContentCategoryId =
  | "announcement"
  | "educational"
  | "informational"
  | "entertainment"
  | "promotional"
  | "trending"
  | "holidays"
  | "social_proof"
  | "bts"
  | "interactive";

export interface ContentCategoryMeta {
  id: ContentCategoryId;
  label: string;
  short: string;
  emoji: string;
  /** Tailwind classes (background tint + foreground text + border tint). Uses semantic palette where possible. */
  badgeClass: string;
  /** Tailwind class for the small dot indicator on calendar rows. */
  dotClass: string;
}

export const CONTENT_CATEGORIES: ContentCategoryMeta[] = [
  {
    id: "announcement",
    label: "Announcement",
    short: "Announce",
    emoji: "📢",
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25",
    dotClass: "bg-blue-500",
  },
  {
    id: "educational",
    label: "Educational",
    short: "Educate",
    emoji: "🎓",
    badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
    dotClass: "bg-indigo-500",
  },
  {
    id: "informational",
    label: "Informational",
    short: "Info",
    emoji: "ℹ️",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25",
    dotClass: "bg-sky-500",
  },
  {
    id: "entertainment",
    label: "Entertainment",
    short: "Fun",
    emoji: "🎭",
    badgeClass: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/25",
    dotClass: "bg-pink-500",
  },
  {
    id: "promotional",
    label: "Promotional",
    short: "Promo",
    emoji: "🛒",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25",
    dotClass: "bg-amber-500",
  },
  {
    id: "trending",
    label: "Trending",
    short: "Trend",
    emoji: "🔥",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25",
    dotClass: "bg-rose-500",
  },
  {
    id: "holidays",
    label: "Holidays",
    short: "Holiday",
    emoji: "🎉",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25",
    dotClass: "bg-orange-500",
  },
  {
    id: "social_proof",
    label: "Social Proof",
    short: "Proof",
    emoji: "💬",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    dotClass: "bg-emerald-500",
  },
  {
    id: "bts",
    label: "Behind-the-Scenes",
    short: "BTS",
    emoji: "🎬",
    badgeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25",
    dotClass: "bg-violet-500",
  },
  {
    id: "interactive",
    label: "Interactive",
    short: "Engage",
    emoji: "🗳️",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25",
    dotClass: "bg-teal-500",
  },
];

const META_BY_ID = new Map<string, ContentCategoryMeta>(
  CONTENT_CATEGORIES.map((c) => [c.id, c]),
);

// Loose label → id map so we can absorb legacy free-form values
// like "Educational, Informational" or "Behind-the-Scenes (BTS)".
const LABEL_HINTS: Record<string, ContentCategoryId> = {
  announcement: "announcement",
  educational: "educational",
  education: "educational",
  informational: "informational",
  info: "informational",
  entertainment: "entertainment",
  fun: "entertainment",
  promotional: "promotional",
  promo: "promotional",
  promotion: "promotional",
  trending: "trending",
  trend: "trending",
  trends: "trending",
  holiday: "holidays",
  holidays: "holidays",
  greeting: "holidays",
  greetings: "holidays",
  "social proof": "social_proof",
  social_proof: "social_proof",
  socialproof: "social_proof",
  ugc: "social_proof",
  testimonial: "social_proof",
  bts: "bts",
  "behind the scenes": "bts",
  "behind-the-scenes": "bts",
  behindthescenes: "bts",
  interactive: "interactive",
  engagement: "interactive",
  poll: "interactive",
};

/** Parse a stored content_category value (single id, comma-list, or legacy label string) into ordered ids. */
export function parseCategoryIds(raw: string | null | undefined): ContentCategoryId[] {
  if (!raw) return [];
  const out: ContentCategoryId[] = [];
  const seen = new Set<ContentCategoryId>();
  // Split by comma OR slash so "Promotional / Sales" still resolves.
  const tokens = String(raw)
    .split(/[,/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const tok of tokens) {
    const norm = tok
      .toLowerCase()
      .replace(/\(.*?\)/g, "") // strip parenthetical hints e.g. "(BTS)"
      .replace(/[^a-z0-9 _-]/g, "")
      .trim();
    // direct id?
    if (META_BY_ID.has(norm) && !seen.has(norm as ContentCategoryId)) {
      out.push(norm as ContentCategoryId);
      seen.add(norm as ContentCategoryId);
      continue;
    }
    // exact label hint?
    const direct = LABEL_HINTS[norm];
    if (direct && !seen.has(direct)) {
      out.push(direct);
      seen.add(direct);
      continue;
    }
    // fuzzy contains
    for (const [hint, id] of Object.entries(LABEL_HINTS)) {
      if (norm.includes(hint) && !seen.has(id)) {
        out.push(id);
        seen.add(id);
        break;
      }
    }
  }
  return out;
}

export function getCategoryMeta(id: string): ContentCategoryMeta | undefined {
  return META_BY_ID.get(id);
}

/** Convert a free-form value back to a normalized comma-separated id string for storage. */
export function normalizeCategoryValue(raw: string | null | undefined): string | null {
  const ids = parseCategoryIds(raw);
  return ids.length ? ids.join(",") : null;
}
