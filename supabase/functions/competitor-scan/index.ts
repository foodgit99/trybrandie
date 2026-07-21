// Per-competitor weekly scan. Firecrawls the domain (branding + summary + links),
// optionally scrapes the Instagram profile URL, and writes competitor_snapshots.
// Idempotent per (competitor_id, week_start_date, source) via upsert.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function weekStartISO(d = new Date()): string {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

async function firecrawlScrape(
  apiKey: string,
  url: string,
  formats: string[],
): Promise<{ ok: boolean; data?: any; error?: string; status?: number }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats,
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body?.error || res.statusText, status: res.status };
    return { ok: true, data: body?.data ?? body };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY");
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const competitorId: string | undefined = body.competitor_id;
    if (!competitorId) return json({ error: "competitor_id required" }, 400);

    const { data: comp } = await supabase
      .from("brand_competitors")
      .select("id, brand_id, name, domain, instagram_handle, logo_url")
      .eq("id", competitorId)
      .maybeSingle();
    if (!comp) return json({ error: "Competitor not found" }, 404);

    const week = weekStartISO();
    const results: Record<string, any> = {};

    // --- Site scan ---
    if (FIRECRAWL && comp.domain) {
      const url = comp.domain.startsWith("http") ? comp.domain : `https://${comp.domain}`;
      const site = await firecrawlScrape(FIRECRAWL, url, ["markdown", "summary", "links"]);
      const extracted = site.ok
        ? {
            title: site.data?.metadata?.title ?? null,
            description: site.data?.metadata?.description ?? null,
            hero_copy:
              (site.data?.markdown as string | undefined)?.split("\n").slice(0, 12).join("\n") ?? null,
            summary: site.data?.summary ?? null,
            source_url: site.data?.metadata?.sourceURL ?? url,
            og_image: site.data?.metadata?.ogImage ?? null,
            top_links: (site.data?.links ?? []).slice(0, 20),
          }
        : null;

      // Detect logo from og:image or favicon for future card display
      if (site.ok && !comp.logo_url && extracted?.og_image) {
        await supabase
          .from("brand_competitors")
          .update({ logo_url: extracted.og_image })
          .eq("id", comp.id);
      }

      await supabase.from("competitor_snapshots").upsert(
        {
          competitor_id: comp.id,
          brand_id: comp.brand_id,
          week_start_date: week,
          source: "site",
          raw: site.ok ? { has_data: true } : null, // don't store bulky markdown by default
          extracted,
          error: site.ok ? null : site.error?.slice(0, 300),
          scanned_at: new Date().toISOString(),
        },
        { onConflict: "competitor_id,week_start_date,source" },
      );
      results.site = { ok: site.ok, error: site.error };
    } else {
      results.site = { ok: false, error: "no_firecrawl_or_domain" };
    }

    // --- Instagram scan (best-effort — many providers block IG scraping) ---
    if (FIRECRAWL && comp.instagram_handle) {
      const ig = await firecrawlScrape(
        FIRECRAWL,
        `https://www.instagram.com/${comp.instagram_handle.replace(/^@/, "")}/`,
        ["markdown", "summary"],
      );
      const extracted = ig.ok
        ? {
            bio_and_recent:
              (ig.data?.markdown as string | undefined)?.split("\n").slice(0, 30).join("\n") ?? null,
            summary: ig.data?.summary ?? null,
            handle: comp.instagram_handle,
          }
        : null;
      await supabase.from("competitor_snapshots").upsert(
        {
          competitor_id: comp.id,
          brand_id: comp.brand_id,
          week_start_date: week,
          source: "instagram",
          raw: null,
          extracted,
          error: ig.ok ? null : ig.error?.slice(0, 300),
          scanned_at: new Date().toISOString(),
        },
        { onConflict: "competitor_id,week_start_date,source" },
      );
      results.instagram = { ok: ig.ok, error: ig.error };
    }

    await supabase
      .from("brand_competitors")
      .update({ last_scanned_at: new Date().toISOString() })
      .eq("id", comp.id);

    return json({ competitor_id: comp.id, week_start_date: week, results });
  } catch (e) {
    console.error("competitor-scan fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});
