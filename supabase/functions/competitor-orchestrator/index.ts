// Weekly orchestrator. Fanned out by pg_cron every Sunday 22:00 UTC.
// Walks every brand that has active competitors, kicks off competitor-scan for
// each competitor (bounded concurrency), then triggers competitor-digest.

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

async function invoke(url: string, service: string, path: string, body: unknown) {
  return fetch(`${url}/functions/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${service}`,
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const brandFilter: string | undefined = body.brand_id;

    // Load active competitors, optionally filtered.
    let query = supabase
      .from("brand_competitors")
      .select("id, brand_id")
      .eq("is_active", true);
    if (brandFilter) query = query.eq("brand_id", brandFilter);
    const { data: comps } = await query;

    const competitors = comps ?? [];
    const byBrand = new Map<string, string[]>();
    for (const c of competitors) {
      const arr = byBrand.get(c.brand_id) ?? [];
      arr.push(c.id);
      byBrand.set(c.brand_id, arr);
    }

    let scanned = 0;
    let scanErrors = 0;

    // Bounded concurrency across ALL competitors — Firecrawl + rate limits.
    const CONCURRENCY = 3;
    const ids = competitors.map((c) => c.id);
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const batch = ids.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((id) =>
          invoke(SUPABASE_URL, SERVICE, "competitor-scan", { competitor_id: id }).then((r) => r.ok),
        ),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) scanned++;
        else scanErrors++;
      }
      // Small pause between batches to be kind to providers.
      if (i + CONCURRENCY < ids.length) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    // Then trigger digest per brand — sequential to keep AI cost predictable.
    let digestOk = 0;
    let digestErr = 0;
    for (const [brandId] of byBrand.entries()) {
      try {
        const r = await invoke(SUPABASE_URL, SERVICE, "competitor-digest", { brand_id: brandId });
        if (r.ok) digestOk++;
        else digestErr++;
      } catch {
        digestErr++;
      }
    }

    return json({
      brands: byBrand.size,
      competitors: ids.length,
      scanned,
      scan_errors: scanErrors,
      digested: digestOk,
      digest_errors: digestErr,
    });
  } catch (e) {
    console.error("competitor-orchestrator fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});
