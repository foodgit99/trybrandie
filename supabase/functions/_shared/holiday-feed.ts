// Live holiday + cultural-event feed sourced from Firecrawl search,
// parsed by Lovable AI (Flash-Lite), and cached weekly in research_cache.
// Falls back to the hardcoded holiday-calendar.ts on any failure.

import {
import { MAX_TOKENS } from "./token-budget.ts";
  getUpcomingHolidays as fallbackUpcoming,
  getWeekHolidays as fallbackWeek,
  getCurrentSeason,
  type Holiday,
} from "./holiday-calendar.ts";

export interface FeedHoliday {
  name: string;
  date: Date;
  daysUntil: number;
  region: string;
  content_type: string; // promotional | engagement | inspirational
  description?: string;
  source: "firecrawl" | "fallback";
}

const CACHE_CATEGORY = "holiday-feed-v1";
const CACHE_TTL_DAYS = 7;

function isoWeekKey(d = new Date()): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function normaliseRegion(r?: string | null): string {
  const v = (r || "").trim();
  if (!v) return "Global";
  return v.length > 60 ? v.slice(0, 60) : v;
}

async function readCache(supabase: any, hash: string): Promise<FeedHoliday[] | null> {
  try {
    const { data } = await supabase
      .from("research_cache")
      .select("result, expires_at")
      .eq("category_id", CACHE_CATEGORY)
      .eq("query_hash", hash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!data?.result) return null;
    const parsed = JSON.parse(data.result) as Array<Omit<FeedHoliday, "date" | "daysUntil"> & { date: string }>;
    const now = Date.now();
    return parsed.map((p) => {
      const date = new Date(p.date);
      return {
        ...p,
        date,
        daysUntil: Math.ceil((date.getTime() - now) / 86_400_000),
      };
    });
  } catch {
    return null;
  }
}

async function writeCache(supabase: any, hash: string, items: FeedHoliday[], region: string) {
  try {
    const expires = new Date(Date.now() + CACHE_TTL_DAYS * 86_400_000).toISOString();
    const payload = items.map((i) => ({
      name: i.name,
      date: i.date.toISOString().split("T")[0],
      region: i.region,
      content_type: i.content_type,
      description: i.description,
      source: i.source,
    }));
    await supabase.from("research_cache").upsert(
      {
        category_id: CACHE_CATEGORY,
        query_hash: hash,
        query_preview: `holidays:${region}`,
        result: JSON.stringify(payload),
        expires_at: expires,
      },
      { onConflict: "category_id,query_hash" },
    );
  } catch (e) {
    console.log("[holiday-feed] cache write failed:", e instanceof Error ? e.message : e);
  }
}

async function firecrawlSearch(query: string): Promise<string> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 5,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}`);
  const json = await res.json();
  const results = (json?.data?.web || json?.data || json?.web || []) as any[];
  const chunks: string[] = [];
  for (const r of results.slice(0, 5)) {
    const md = r?.markdown || r?.content || r?.description || r?.snippet || "";
    if (md) chunks.push(`# ${r?.title || r?.url || ""}\n${String(md).slice(0, 4000)}`);
  }
  return chunks.join("\n\n---\n\n").slice(0, 18_000);
}

interface ParsedItem {
  name: string;
  date: string;
  region?: string;
  content_type?: string;
  description?: string;
}

async function parseHolidaysWithAI(markdown: string, region: string, today: string, until: string): Promise<ParsedItem[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      max_tokens: MAX_TOKENS.shortJson,
      messages: [
        {
          role: "system",
          content:
            "Extract real public holidays, religious observances, and major cultural/awareness events from the provided web text. Output ONLY valid JSON of shape {\"events\":[{\"name\":string,\"date\":\"YYYY-MM-DD\",\"region\":string,\"content_type\":\"promotional\"|\"engagement\"|\"inspirational\",\"description\":string}]}. Use only dates explicitly stated in the source. Drop any event whose exact date is not stated. Do not invent.",
        },
        {
          role: "user",
          content: `Region focus: ${region}. Only include events between ${today} and ${until} inclusive.\n\nSOURCE TEXT:\n${markdown}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI parse ${res.status}`);
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  const events = Array.isArray(parsed?.events) ? parsed.events : [];
  return events as ParsedItem[];
}

function regionMatches(holidayRegion: string, requested: string): boolean {
  const h = holidayRegion.toLowerCase().trim();
  const r = requested.toLowerCase().trim();
  if (h === "global" || r === "global" || !r) return true;
  // "Lagos, Nigeria" should match a holiday tagged "nigeria" and vice versa.
  return h === r || r.includes(h) || h.includes(r);
}

function fallbackFeed(days: number, region: string): FeedHoliday[] {
  const now = Date.now();
  return fallbackUpcoming(days)
    .filter((h) => regionMatches(h.region, region))
    .map((h) => ({
      name: h.name,
      date: h.date,
      daysUntil: Math.ceil((h.date.getTime() - now) / 86_400_000),
      region: h.region,
      content_type: h.content_type,
      source: "fallback" as const,
    }));
}

/** Main entry — returns upcoming holidays for a region from Firecrawl (cached weekly). */
export async function fetchHolidayFeed(
  supabase: any,
  opts: { region?: string | null; days?: number } = {},
): Promise<FeedHoliday[]> {
  const days = Math.max(1, Math.min(90, opts.days ?? 21));
  const region = normaliseRegion(opts.region);
  const hash = `${region.toLowerCase()}:${isoWeekKey()}:${days}`;

  // 0. Deterministic calendar is the default source. The live web+AI path is
  //    opt-in via HOLIDAY_FEED_LIVE=true (kept for future re-enablement).
  const liveEnabled = (Deno.env.get("HOLIDAY_FEED_LIVE") || "").toLowerCase() === "true";
  if (!liveEnabled) return fallbackFeed(days, region);

  // 1. Cache
  const cached = await readCache(supabase, hash);
  if (cached && cached.length > 0) return cached;

  // 2. Firecrawl + AI parse
  try {
    const today = new Date();
    const until = new Date(today.getTime() + days * 86_400_000);
    const todayIso = today.toISOString().split("T")[0];
    const untilIso = until.toISOString().split("T")[0];
    const regionPhrase = region === "Global" ? "global" : region;
    const query = `public holidays, religious observances and major cultural events in ${regionPhrase} between ${todayIso} and ${untilIso}`;

    const md = await firecrawlSearch(query);
    if (!md || md.length < 100) throw new Error("empty search result");

    const parsed = await parseHolidaysWithAI(md, regionPhrase, todayIso, untilIso);
    const now = today.getTime();
    const seen = new Set<string>();
    const items: FeedHoliday[] = [];
    for (const p of parsed) {
      if (!p?.name || !p?.date) continue;
      const d = new Date(p.date);
      if (isNaN(d.getTime())) continue;
      if (d.getTime() < now - 12 * 3_600_000) continue;
      if (d.getTime() > until.getTime() + 12 * 3_600_000) continue;
      const key = `${p.name.toLowerCase()}-${p.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ct = ["promotional", "engagement", "inspirational"].includes(p.content_type || "")
        ? (p.content_type as string)
        : "engagement";
      items.push({
        name: p.name,
        date: d,
        daysUntil: Math.ceil((d.getTime() - now) / 86_400_000),
        region: p.region || regionPhrase,
        content_type: ct,
        description: p.description,
        source: "firecrawl",
      });
    }
    items.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (items.length > 0) {
      await writeCache(supabase, hash, items, region);
      return items;
    }
    throw new Error("ai returned no events");
  } catch (e) {
    console.log("[holiday-feed] firecrawl/AI failed, using fallback:", e instanceof Error ? e.message : e);
    return fallbackFeed(days, region);
  }
}

/** Filter the feed to a single week (Monday-Sunday). */
export async function getWeekHolidaysAsync(
  supabase: any,
  monday: Date,
  region?: string | null,
): Promise<FeedHoliday[]> {
  const start = new Date(monday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const days = Math.max(7, Math.ceil((end.getTime() - Date.now()) / 86_400_000) + 1);
  const feed = await fetchHolidayFeed(supabase, { region, days });
  return feed.filter((h) => h.date >= start && h.date <= end);
}

/** Drop-in async replacement for getSeasonalContextString. */
export async function getSeasonalContextStringAsync(
  supabase: any,
  daysAhead = 14,
  region?: string | null,
): Promise<string> {
  const now = new Date();
  const season = getCurrentSeason();
  const upcoming = await fetchHolidayFeed(supabase, { region, days: daysAhead });

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let ctx = `\n## Current Date & Seasonal Context\n- **Today**: ${dateStr}\n- **Season**: ${season}\n`;
  if (upcoming.length > 0) {
    ctx += `- **Upcoming Events (next ${daysAhead} days)**:\n`;
    for (const h of upcoming) {
      const dateLabel = h.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const urgency = h.daysUntil <= 0 ? "TODAY" : h.daysUntil === 1 ? "TOMORROW" : `in ${h.daysUntil} days`;
      ctx += `  - ${h.name} — ${dateLabel} (${urgency}) [${h.content_type}]\n`;
    }
  } else {
    ctx += `- No major events in the next ${daysAhead} days.\n`;
  }
  return ctx;
}

/** Helper: resolve a brand's region from target_audiences.raw_inputs.location. */
export async function resolveBrandRegion(supabase: any, brandId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("target_audiences")
      .select("raw_inputs")
      .eq("brand_id", brandId)
      .limit(1)
      .maybeSingle();
    const loc = (data?.raw_inputs as any)?.location;
    if (typeof loc === "string" && loc.trim()) return loc.trim();
  } catch {
    /* noop */
  }
  return "Global";
}

export type { Holiday };
