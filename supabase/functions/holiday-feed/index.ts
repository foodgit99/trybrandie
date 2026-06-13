// Public client endpoint: returns the live (Firecrawl-sourced, weekly-cached)
// holiday feed for a brand. Falls back to hardcoded calendar internally.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchHolidayFeed, resolveBrandRegion } from "../_shared/holiday-feed.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const brandId = url.searchParams.get("brand_id");
    const region = url.searchParams.get("region");
    const daysRaw = Number(url.searchParams.get("days") || "21");
    const days = Math.max(1, Math.min(60, Number.isFinite(daysRaw) ? daysRaw : 21));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const resolvedRegion = brandId ? await resolveBrandRegion(supabase, brandId) : (region || "Global");
    const feed = await fetchHolidayFeed(supabase, { region: resolvedRegion, days });

    return new Response(
      JSON.stringify({
        region: resolvedRegion,
        days,
        events: feed.map((h) => ({
          name: h.name,
          date: h.date.toISOString().split("T")[0],
          daysUntil: h.daysUntil,
          region: h.region,
          content_type: h.content_type,
          description: h.description,
          source: h.source,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.log("[holiday-feed] error:", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "feed_failed", events: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
