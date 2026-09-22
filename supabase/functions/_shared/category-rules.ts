// Deterministic content-category classification.
// One rule table shared by design-studio (canonical ids) and brand-engine
// (which uses "bts" instead of "behind_the_scenes"). Replaces the former
// per-request LLM classification calls — same 10 buckets, no model latency.

export const CANONICAL_CATEGORY_IDS = [
  "announcement",
  "educational",
  "informational",
  "entertainment",
  "promotional",
  "trending",
  "holidays",
  "social_proof",
  "behind_the_scenes",
  "interactive",
] as const;

export type CanonicalCategoryId = typeof CANONICAL_CATEGORY_IDS[number];

export const DEFAULT_CATEGORY: CanonicalCategoryId = "promotional";

/** brand-engine's enum uses "bts"; everything else uses "behind_the_scenes". */
export function toEngineCategory(id: string): string {
  return id === "behind_the_scenes" ? "bts" : id;
}

/** Accept either dialect and normalise to the canonical id. */
export function normaliseCategory(id?: string | null): CanonicalCategoryId | null {
  const v = String(id ?? "").trim().toLowerCase().replace(/[^a-z_]/g, "");
  if (!v) return null;
  const canonical = v === "bts" ? "behind_the_scenes" : v;
  return (CANONICAL_CATEGORY_IDS as readonly string[]).includes(canonical)
    ? (canonical as CanonicalCategoryId)
    : null;
}

// Rules are evaluated in order; the first match wins. Ordering matters:
// stronger, less ambiguous intents are checked before broad ones.
const RULES: Array<{ id: CanonicalCategoryId; re: RegExp }> = [
  // Holidays & greetings — checked first: "happy new year sale" is a holiday post.
  {
    id: "holidays",
    re: /\b(happy|merry|eid|el[- ]?kabir|sallah|christmas|xmas|easter|diwali|hanukkah|new year|valentine|mother'?s day|father'?s day|independence|thanksgiving|ramadan|lent|boxing day|detty december|birthday|anniversary|celebrat\w*|festive|holiday|season'?s greetings|workers'? day|labour day|democracy day|children'?s day|women'?s day|black friday|cyber monday|public holiday)\b/i,
  },
  // Social proof / UGC
  {
    id: "social_proof",
    re: /\b(testimonial|review|reviews|customer said|client said|feedback|case study|success story|user[- ]generated|ugc|social proof|rating|ratings|\d\s*stars?|five[- ]star|recommend(?:ed|ation)?|repost|shout[- ]?out|before and after|results? speak)\b/i,
  },
  // Behind the scenes
  {
    id: "behind_the_scenes",
    re: /\b(behind the scenes|behind[- ]the[- ]scene|bts|meet the team|meet our|day in the life|our process|making of|how we make|workspace|workshop tour|office tour|factory|kitchen|our story|founder story|packing orders|restock day|team spotlight)\b/i,
  },
  // Interactive / engagement
  {
    id: "interactive",
    re: /\b(poll|vote|voting|quiz|this or that|which do you|which one|q&a|ask us|ask me|tell us|would you rather|pick one|choose one|comment below|drop a comment|tag (?:a friend|someone)|caption this|fill in the blank|survey)\b/i,
  },
  // Announcement
  {
    id: "announcement",
    re: /\b(launch\w*|introduc\w+|announc\w+|new (?:feature|product|service|branch|collection|arrival|menu|location)|just dropped|now (?:available|open|live)|coming soon|grand opening|unveil\w*|reveal\w*|we are (?:now|open)|back in stock|restocked|rebrand\w*|partnership with|we'?ve moved|opening soon|milestone|update:)\b/i,
  },
  // Educational
  {
    id: "educational",
    re: /\b(tips?|how to|how[- ]to|guide|learn|tutorial|steps?|hack\w*|lesson|explained|explainer|101|did you know|myth|myths|fact|facts|checklist|mistakes?|avoid|why you should|breakdown|what is|difference between|do'?s and don'?ts|carousel guide)\b/i,
  },
  // Trending
  {
    id: "trending",
    re: /\b(trending|trend|trends|viral|challenge|bandwagon|cultural moment|hot right now|everyone is talking|in the news|this week'?s|meme format|audio trend)\b/i,
  },
  // Entertainment
  {
    id: "entertainment",
    re: /\b(meme|memes|funny|relatable|humor|humour|joke|lol|banter|mood|vibe check|sarcas\w*|skit|gist|no chill|na so|we move)|😂|🤣|😅/i,
  },
  // Informational
  {
    id: "informational",
    re: /\b(hours|opening times|closing time|schedule|address|location|directions|map|policy|policies|faq|faqs|contact|phone number|whatsapp number|price list|pricing list|menu|rate card|return policy|refund|delivery|shipping|payment options|how to order|terms|notice|reminder that we)\b/i,
  },
  // Promotional — last, because promo words sprinkle into every other bucket.
  {
    id: "promotional",
    re: /\b(sale|sales|discount|offer|promo|promotion|deal|deals|bundle|buy|shop|order now|\d+\s*%\s*off|% off|free (?:delivery|shipping|gift)|limited time|limited stock|flash sale|coupon|promo code|checkout|price drop|clearance|bogo|pre[- ]?order|slash\w*|black tag|giveaway)\b/i,
  },
];

/**
 * Classify free text into a content category. Returns null when nothing matches
 * so callers can decide their own default.
 */
export function classifyCategoryByRules(text: string): CanonicalCategoryId | null {
  const value = String(text ?? "");
  if (!value.trim()) return null;
  for (const rule of RULES) {
    if (rule.re.test(value)) return rule.id;
  }
  return null;
}

/** Same as above but always returns a category (DEFAULT_CATEGORY when unmatched). */
export function classifyCategory(
  text: string,
  fallback: CanonicalCategoryId = DEFAULT_CATEGORY,
): CanonicalCategoryId {
  return classifyCategoryByRules(text) ?? fallback;
}

/**
 * Bulk item classification for the planner's backfill path.
 * `isHoliday` forces the holidays bucket (idea_type === "holiday").
 */
export function classifyItems<T extends { text: string; isHoliday?: boolean }>(
  items: T[],
  opts: { dialect?: "canonical" | "engine"; fallback?: CanonicalCategoryId } = {},
): Array<{ index: number; content_category: string }> {
  const dialect = opts.dialect ?? "canonical";
  const fallback = opts.fallback ?? DEFAULT_CATEGORY;
  return items.map((item, i) => {
    const id = item.isHoliday ? "holidays" : classifyCategory(item.text, fallback);
    return {
      index: i + 1,
      content_category: dialect === "engine" ? toEngineCategory(id) : id,
    };
  });
}
