// Brand Updates — first-party "current events" data source.
// Lightweight log of real business activity (testimonials, product news,
// events, CSR, milestones, press, partnerships, customer stories) that
// the AI uses as factual seed material when generating ideas + designs.
//
// Confidence-aware: each update can carry a 0–100 confidence score
// (computed by the summarise-update editorial agent). The score controls
// how strongly the generation pipeline relies on the update:
//   • HIGH  (>= 75) → quote facts verbatim, treat as ground truth
//   • MED   (45–74) → use as soft inspiration only; do NOT invent specifics
//                     (no fabricated names, numbers, dates, quotes)
//   • LOW   (<  45 or null) → excluded from generation prompts; surfaced
//                              instead as a follow-up question to the user
//
// missing_fields is a per-update list of details the user could add to
// raise confidence (e.g. "customer name", "specific outcome"). It powers
// the follow-up question UX after planning.

export interface BrandUpdate {
  id: string;
  brand_id: string;
  update_type: string;
  title: string;
  content: string;
  attribution: string | null;
  image_url: string | null;
  source_url: string | null;
  event_date: string;
  expires_at: string | null;
  status: string;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  confidence: number | null;
  missing_fields: string[] | null;
}

export type UpdateType =
  | "testimonial"
  | "product"
  | "event"
  | "csr"
  | "milestone"
  | "press"
  | "partnership"
  | "customer_story"
  | "other";

export type ConfidenceTier = "high" | "medium" | "low";

export const HIGH_CONFIDENCE_THRESHOLD = 75;
export const MED_CONFIDENCE_THRESHOLD = 45;

export function tierFor(confidence: number | null | undefined): ConfidenceTier {
  if (confidence === null || confidence === undefined) return "low";
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return "high";
  if (confidence >= MED_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

// Per-category preference order. Items earlier in the list are preferred.
const CATEGORY_TYPE_PREFS: Record<string, UpdateType[]> = {
  social_proof: ["testimonial", "customer_story", "press", "milestone"],
  bts: ["event", "csr", "milestone", "product"],
  announcement: ["product", "milestone", "press", "partnership"],
  trending: ["press", "event", "product", "milestone"],
  promotional: ["product", "milestone", "partnership"],
  educational: ["product", "milestone", "customer_story"],
  informational: ["press", "milestone", "product"],
  entertainment: ["event", "csr", "customer_story"],
  holidays: ["event", "csr"],
  interactive: ["customer_story", "event"],
};

export function getPreferredTypes(categoryId?: string | null): UpdateType[] {
  if (!categoryId) return [];
  return CATEGORY_TYPE_PREFS[categoryId] || [];
}

export interface FetchUpdatesOptions {
  categoryId?: string | null;
  limit?: number;
  /** Only consider updates within this many days. Default 60. */
  recencyDays?: number;
  /**
   * Lowest tier eligible for the prompt. Defaults to "medium" — LOW
   * confidence updates are NOT injected into generation prompts, but they
   * are still returned by `fetchAllUpdatesForPlanning` so the planner can
   * raise follow-up questions.
   */
  minTier?: ConfidenceTier;
}

const TIER_RANK: Record<ConfidenceTier, number> = { low: 0, medium: 1, high: 2 };

/** Fetch active, non-expired updates for a brand, ranked by category relevance + recency + confidence. */
export async function fetchRecentUpdates(
  supabase: any,
  brandId: string,
  opts: FetchUpdatesOptions = {},
): Promise<BrandUpdate[]> {
  const { categoryId, limit = 5, recencyDays = 60, minTier = "medium" } = opts;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - recencyDays);
  const sinceIso = sinceDate.toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);

  try {
    const { data, error } = await supabase
      .from("brand_updates")
      .select(
        "id, brand_id, update_type, title, content, attribution, image_url, source_url, event_date, expires_at, status, times_used, last_used_at, created_at, confidence, missing_fields",
      )
      .eq("brand_id", brandId)
      .eq("status", "active")
      .gte("event_date", sinceIso)
      .or(`expires_at.is.null,expires_at.gte.${todayIso}`)
      .order("event_date", { ascending: false })
      .limit(40);
    if (error) {
      console.log("[brand-updates] fetch error:", error.message);
      return [];
    }
    let rows = (data || []) as BrandUpdate[];
    if (rows.length === 0) return [];

    // Confidence gate: drop tiers below the requested minimum.
    const minRank = TIER_RANK[minTier];
    rows = rows.filter((u) => TIER_RANK[tierFor(u.confidence)] >= minRank);
    if (rows.length === 0) return [];

    const prefs = getPreferredTypes(categoryId);
    const now = Date.now();

    const scored = rows.map((u) => {
      let score = 0;
      // Category match boost (earlier in pref list = higher boost)
      if (prefs.length > 0) {
        const idx = prefs.indexOf(u.update_type as UpdateType);
        if (idx >= 0) score += (prefs.length - idx) * 10;
      } else {
        score += 2;
      }
      // Confidence boost — scales linearly so a 95-conf update outranks a 60-conf one.
      const conf = typeof u.confidence === "number" ? u.confidence : 50;
      score += (conf - 50) * 0.3; // -15 .. +15 swing
      // Recency boost (more recent = higher)
      const ageDays = (now - new Date(u.event_date).getTime()) / 86_400_000;
      score += Math.max(0, 14 - ageDays);
      // Soft-deprioritise items used very recently to keep variety
      if (u.last_used_at) {
        const usedAgo = (now - new Date(u.last_used_at).getTime()) / 86_400_000;
        if (usedAgo < 7) score -= 6;
        else if (usedAgo < 21) score -= 2;
      }
      // Slightly penalise overused items
      score -= Math.min(5, (u.times_used || 0) * 0.5);
      return { u, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.u);
  } catch (e) {
    console.log("[brand-updates] fetch threw:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Fetch ALL active, non-expired updates regardless of confidence (for planning + follow-ups). */
export async function fetchAllUpdatesForPlanning(
  supabase: any,
  brandId: string,
  recencyDays = 60,
  hardLimit = 25,
): Promise<BrandUpdate[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - recencyDays);
  const sinceIso = sinceDate.toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);

  try {
    const { data, error } = await supabase
      .from("brand_updates")
      .select(
        "id, brand_id, update_type, title, content, attribution, image_url, source_url, event_date, expires_at, status, times_used, last_used_at, created_at, confidence, missing_fields",
      )
      .eq("brand_id", brandId)
      .eq("status", "active")
      .gte("event_date", sinceIso)
      .or(`expires_at.is.null,expires_at.gte.${todayIso}`)
      .order("event_date", { ascending: false })
      .limit(hardLimit);
    if (error) {
      console.log("[brand-updates] fetch-all error:", error.message);
      return [];
    }
    return (data || []) as BrandUpdate[];
  } catch (e) {
    console.log("[brand-updates] fetch-all threw:", e instanceof Error ? e.message : e);
    return [];
  }
}

const TYPE_LABEL: Record<string, string> = {
  testimonial: "Testimonial",
  product: "Product update",
  event: "Event",
  csr: "CSR / community",
  milestone: "Milestone",
  press: "Press mention",
  partnership: "Partnership",
  customer_story: "Customer story",
  other: "Update",
};

/**
 * Format updates as a confidence-tagged block for prompt injection.
 * Each line is annotated with a confidence tier so the downstream agent
 * knows whether to quote facts verbatim (HIGH) or treat the update as
 * loose inspiration (MED). LOW-confidence updates are filtered upstream.
 */
export function formatUpdatesForPrompt(
  updates: BrandUpdate[],
  opts: { heading?: string } = {},
): string {
  if (!updates || updates.length === 0) return "";
  const heading =
    opts.heading ||
    `BUSINESS UPDATES (recent real-world activity from this brand).
RELIANCE RULES — read the [HIGH]/[MED] tag on each item:
  • [HIGH] = strong, specific, ready-to-use. Quote facts (names, numbers, dates, quotes) verbatim. Prefer these as the primary seed.
  • [MED]  = thin or partial. Use ONLY as a soft thematic prompt. Do NOT invent specific names, numbers, dates, outcomes, or fabricate quotes. If a strong post would need a fact you don't have, omit it or keep the copy abstract.
  • Never blend two updates into a single fictional event.
  • Never fabricate testimonials when no [HIGH] testimonial exists in the list.`;
  const bullets = updates
    .map((u, i) => {
      const tier = tierFor(u.confidence).toUpperCase();
      const label = TYPE_LABEL[u.update_type] || "Update";
      const dateStr = u.event_date ? ` (${u.event_date})` : "";
      const attr = u.attribution ? ` — ${u.attribution}` : "";
      const headline = u.title?.trim() || u.content.slice(0, 80);
      const body = u.content?.trim() ? ` :: ${u.content.trim().slice(0, 280)}` : "";
      const gaps =
        Array.isArray(u.missing_fields) && u.missing_fields.length > 0 && tier !== "HIGH"
          ? ` :: missing → ${u.missing_fields.slice(0, 3).join(", ")}`
          : "";
      return `${i + 1}. [${tier}] [${label}${dateStr}] ${headline}${attr}${body}${gaps}`;
    })
    .join("\n");
  return `\n\n${heading}\n${bullets}`;
}

/** Increment times_used + stamp last_used_at on a list of update ids (fire-and-forget). */
export async function markUpdatesUsed(supabase: any, ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  try {
    // Read current counters then write back. Best-effort, no transaction needed.
    const { data } = await supabase
      .from("brand_updates")
      .select("id, times_used")
      .in("id", ids);
    const rows = (data || []) as Array<{ id: string; times_used: number }>;
    const nowIso = new Date().toISOString();
    await Promise.all(
      rows.map((r) =>
        supabase
          .from("brand_updates")
          .update({ times_used: (r.times_used || 0) + 1, last_used_at: nowIso })
          .eq("id", r.id),
      ),
    );
  } catch (e) {
    console.log("[brand-updates] markUsed failed:", e instanceof Error ? e.message : e);
  }
}

/** Lightweight projection for returning to the client UI. */
export function summariseForClient(updates: BrandUpdate[]) {
  return updates.map((u) => ({
    id: u.id,
    title: u.title || u.content.slice(0, 80),
    type: u.update_type,
    event_date: u.event_date,
    confidence: u.confidence,
    tier: tierFor(u.confidence),
  }));
}
