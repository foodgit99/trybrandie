// Brand Updates — first-party "current events" data source.
// Lightweight log of real business activity (testimonials, product news,
// events, CSR, milestones, press, partnerships, customer stories) that
// the AI uses as factual seed material when generating ideas + designs.

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
}

/** Fetch active, non-expired updates for a brand, ranked by category relevance + recency. */
export async function fetchRecentUpdates(
  supabase: any,
  brandId: string,
  opts: FetchUpdatesOptions = {},
): Promise<BrandUpdate[]> {
  const { categoryId, limit = 5, recencyDays = 60 } = opts;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - recencyDays);
  const sinceIso = sinceDate.toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);

  try {
    const { data, error } = await supabase
      .from("brand_updates")
      .select(
        "id, brand_id, update_type, title, content, attribution, image_url, source_url, event_date, expires_at, status, times_used, last_used_at, created_at",
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
    const rows = (data || []) as BrandUpdate[];
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

/** Format updates as a compact bullet block for prompt injection. */
export function formatUpdatesForPrompt(
  updates: BrandUpdate[],
  opts: { heading?: string } = {},
): string {
  if (!updates || updates.length === 0) return "";
  const heading =
    opts.heading ||
    "BUSINESS UPDATES (recent real-world activity from this brand — prefer these as factual seed material; do NOT invent testimonials or events when this list is non-empty):";
  const bullets = updates
    .map((u, i) => {
      const label = TYPE_LABEL[u.update_type] || "Update";
      const dateStr = u.event_date ? ` (${u.event_date})` : "";
      const attr = u.attribution ? ` — ${u.attribution}` : "";
      const headline = u.title?.trim() || u.content.slice(0, 80);
      const body = u.content?.trim() ? ` :: ${u.content.trim().slice(0, 280)}` : "";
      return `${i + 1}. [${label}${dateStr}] ${headline}${attr}${body}`;
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
  }));
}
