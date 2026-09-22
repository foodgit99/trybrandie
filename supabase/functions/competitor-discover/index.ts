// Autonomous competitor discovery. Given a brand, uses its industry/website/audience
// signals to propose 3-5 rivals and inserts them into brand_competitors.
// Idempotent: skips domains already tracked. Respects tier caps via the insert trigger.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { compactJson, MAX_TOKENS } from "../_shared/token-budget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  try {
    const url = input.match(/^https?:\/\//) ? new URL(input) : new URL(`https://${input}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return input.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase() || null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) return json({ error: "AI service not configured" }, 500);

    const supabase = createClient(SUPABASE_URL, SERVICE);
    const body = await req.json().catch(() => ({}));
    const brandId: string | undefined = body.brand_id;
    const requestedBy: string | undefined = body.user_id;
    if (!brandId) return json({ error: "brand_id required" }, 400);

    // Load brand context
    const { data: brand, error: brandErr } = await supabase
      .from("brands")
      .select("id, user_id, name, description, tagline, website_url, playbook_id, personality_traits, vibe")
      .eq("id", brandId)
      .maybeSingle();
    if (brandErr || !brand) return json({ error: "Brand not found" }, 404);

    // Load audience for extra context (optional)
    const { data: audience } = await supabase
      .from("target_audiences")
      .select("audience_data")
      .eq("brand_id", brandId)
      .maybeSingle();

    // Existing tracked domains — dedupe
    const { data: existing } = await supabase
      .from("brand_competitors")
      .select("domain")
      .eq("brand_id", brandId)
      .eq("is_active", true);
    const existingDomains = new Set(
      (existing ?? []).map((r: any) => normalizeDomain(r.domain)).filter(Boolean),
    );

    // Ask Gemini to propose 5 realistic competitors.
    const brandContext = {
      name: brand.name,
      description: brand.description ?? null,
      tagline: brand.tagline ?? null,
      website: brand.website_url ?? null,
      playbook: brand.playbook_id ?? null,
      vibe: brand.vibe ?? null,
      audience: (audience?.audience_data as any) ?? null,
    };

    const prompt = `You are a market research analyst. Given this brand, propose 5 realistic, currently-operating COMPETITORS — brands that sell to the same audience with a similar core offer.

BRAND:
${compactJson(brandContext, 4000)}

Rules:
- Only real companies you're confident exist. If you can't name 5, return fewer.
- Mix a couple of direct competitors with 1-2 aspirational/category leaders.
- Prefer brands active on Instagram.
- Return a strict JSON object with a "competitors" array.

Each competitor: { "name": string, "domain": string (bare host, no protocol), "instagram_handle": string | null, "rationale": string (why this is a competitor, 1 sentence) }`;

    const aiRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You return strict JSON only. No prose." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errBody);
      if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiRes.status === 402) return json({ error: "Credits exhausted" }, 402);
      return json({ error: "AI request failed", details: errBody.slice(0, 300) }, 502);
    }

    const aiJson = await aiRes.json();
    let proposed: Array<{ name: string; domain?: string; instagram_handle?: string | null; rationale?: string }> = [];
    try {
      const content = aiJson.choices?.[0]?.message?.content ?? "{}";
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      proposed = Array.isArray(parsed?.competitors) ? parsed.competitors : [];
    } catch (e) {
      console.error("Failed to parse AI JSON", e);
      return json({ error: "AI returned invalid JSON" }, 502);
    }

    // Insert one by one so trigger enforces tier cap gracefully
    const inserted: any[] = [];
    const skipped: any[] = [];
    for (const c of proposed) {
      const dom = normalizeDomain(c.domain);
      if (!c.name || !dom) {
        skipped.push({ ...c, reason: "missing_name_or_domain" });
        continue;
      }
      if (existingDomains.has(dom)) {
        skipped.push({ ...c, reason: "already_tracked" });
        continue;
      }
      const handle = c.instagram_handle?.replace(/^@/, "").trim() || null;
      const { data, error } = await supabase
        .from("brand_competitors")
        .insert({
          brand_id: brandId,
          name: c.name.trim(),
          domain: dom,
          instagram_handle: handle,
          discovery_source: "auto",
          discovery_rationale: c.rationale ?? null,
        })
        .select()
        .maybeSingle();
      if (error) {
        // Tier cap hit — stop cleanly.
        if (String(error.message).includes("COMPETITOR_LIMIT_REACHED")) {
          skipped.push({ ...c, reason: "tier_limit" });
          break;
        }
        skipped.push({ ...c, reason: error.message });
        continue;
      }
      if (data) {
        existingDomains.add(dom);
        inserted.push(data);
      }
    }

    return json({
      brand_id: brandId,
      requested_by: requestedBy ?? null,
      proposed: proposed.length,
      inserted: inserted.length,
      skipped: skipped.length,
      competitors: inserted,
      skipped_details: skipped,
    });
  } catch (e) {
    console.error("competitor-discover fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});
