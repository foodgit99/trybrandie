// Per-brand weekly digest. Reads latest competitor snapshots, asks Gemini for
// "what changed" bullets + steal-the-angle content ideas, writes signals, and
// inserts approved ideas into content_ideas for autopilot to schedule.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function weekStartISO(d = new Date()): string {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
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
    if (!brandId) return json({ error: "brand_id required" }, 400);

    const week = weekStartISO();

    const { data: brand } = await supabase
      .from("brands")
      .select("id, user_id, name, description, vibe, tone_of_voice")
      .eq("id", brandId)
      .maybeSingle();
    if (!brand) return json({ error: "Brand not found" }, 404);

    const { data: settings } = await supabase
      .from("autopilot_settings")
      .select("mode, enabled")
      .eq("brand_id", brandId)
      .maybeSingle();
    const autonomous = settings?.mode === "autonomous" && settings?.enabled === true;

    const { data: competitors } = await supabase
      .from("brand_competitors")
      .select("id, name, domain, instagram_handle")
      .eq("brand_id", brandId)
      .eq("is_active", true);
    if (!competitors || competitors.length === 0) {
      return json({ brand_id: brandId, week_start_date: week, signals: 0, note: "no_competitors" });
    }

    const compIds = competitors.map((c: any) => c.id);
    const { data: snapshots } = await supabase
      .from("competitor_snapshots")
      .select("competitor_id, source, extracted, scanned_at")
      .in("competitor_id", compIds)
      .eq("week_start_date", week);

    if (!snapshots || snapshots.length === 0) {
      return json({ brand_id: brandId, week_start_date: week, signals: 0, note: "no_snapshots_yet" });
    }

    // Compose the input for the LLM.
    const byCompetitor: Record<string, any> = {};
    for (const c of competitors) byCompetitor[c.id] = { ...c, sources: {} };
    for (const s of snapshots) {
      const b = byCompetitor[s.competitor_id];
      if (!b) continue;
      b.sources[s.source] = s.extracted;
    }

    const prompt = `You are the competitive-intelligence analyst for the brand "${brand.name}".

BRAND CONTEXT:
${JSON.stringify({ name: brand.name, description: brand.description, vibe: brand.vibe, tone: brand.tone_of_voice }, null, 2)}

WEEKLY COMPETITOR SNAPSHOTS (${Object.keys(byCompetitor).length} rivals):
${JSON.stringify(byCompetitor, null, 2)}

TASK — produce a strict JSON object with:
{
  "signals": [
    {
      "competitor_id": "<uuid from above>",
      "signal_type": "launch"|"offer"|"angle"|"seo_win"|"positioning_shift",
      "summary": "1-sentence what changed / what stood out (max 25 words)",
      "rationale": "1 sentence why this matters to ${brand.name}",
      "sources": ["site"|"instagram", ...],
      "source_urls": ["<any exact URL you observed in the snapshot (post URL, product page URL, etc.) — only include URLs that literally appear in the snapshot data>"]
    }
  ],
  "steal_the_angle": [
    {
      "competitor_id": "<uuid>",
      "title": "Instagram-post-ready title (max 8 words)",
      "prompt": "detailed content brief for the design agent (2-3 sentences)",
      "content_category": "one of: educational, informational, promotional, announcement, trending, social_proof, bts, interactive, holidays, entertainment",
      "rationale": "why lifting this angle wins for ${brand.name} (1 sentence)",
      "sources": ["site"|"instagram", ...],
      "source_urls": ["<same rule: only URLs literally present in the snapshot>"]
    }
  ]
}

Rules:
- 3-6 signals total. Skip competitors that show nothing new.
- 2-3 steal_the_angle ideas. Each MUST reference a real thing you saw in the snapshots, not generic advice.
- Ideas must sound like ${brand.name}'s voice, not a clone of the competitor.
- "sources" MUST list which snapshot channels ("site", "instagram") backed the observation. Never invent a channel.
- "source_urls" MUST only contain URLs that appear verbatim in the snapshot data. If none exist, return an empty array.
- Return ONLY the JSON object.`;

    const aiRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!aiRes.ok) {
      const err = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiRes.status === 402) return json({ error: "Credits exhausted" }, 402);
      return json({ error: "AI request failed", details: err.slice(0, 300) }, 502);
    }

    let parsed: any = {};
    try {
      const content = (await aiRes.json()).choices?.[0]?.message?.content ?? "{}";
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch (e) {
      return json({ error: "AI returned invalid JSON" }, 502);
    }

    const validCompIds = new Set(compIds);
    const signals: any[] = Array.isArray(parsed.signals) ? parsed.signals : [];
    const steals: any[] = Array.isArray(parsed.steal_the_angle) ? parsed.steal_the_angle : [];

    // Clean out any existing signals for this brand+week so re-runs replace cleanly.
    await supabase
      .from("competitor_signals")
      .delete()
      .eq("brand_id", brandId)
      .eq("week_start_date", week)
      .eq("acted_on", false);

    let signalsInserted = 0;
    let ideasInserted = 0;

    for (const s of signals) {
      if (!validCompIds.has(s.competitor_id)) continue;
      const { error } = await supabase.from("competitor_signals").insert({
        competitor_id: s.competitor_id,
        brand_id: brandId,
        week_start_date: week,
        signal_type: ["launch","offer","angle","seo_win","positioning_shift"].includes(s.signal_type) ? s.signal_type : "angle",
        summary: String(s.summary ?? "").slice(0, 500),
        rationale: s.rationale ? String(s.rationale).slice(0, 500) : null,
      });
      if (!error) signalsInserted++;
    }

    for (const s of steals) {
      if (!validCompIds.has(s.competitor_id)) continue;
      if (!s.title || !s.prompt) continue;

      // Insert content idea (unscheduled) — daily top-up planner slots it in.
      const { data: idea, error: ideaErr } = await supabase
        .from("content_ideas")
        .insert({
          brand_id: brandId,
          user_id: brand.user_id,
          title: String(s.title).slice(0, 200),
          prompt: String(s.prompt).slice(0, 1200),
          content_category: s.content_category ?? "trending",
          autopilot: true,
          approval_status: autonomous ? "approved" : "pending",
          status: "suggested",
          idea_type: "single",
          content_format: "graphic",
        })
        .select("id")
        .maybeSingle();

      if (ideaErr || !idea) continue;
      ideasInserted++;

      await supabase.from("competitor_signals").insert({
        competitor_id: s.competitor_id,
        brand_id: brandId,
        week_start_date: week,
        signal_type: "steal_the_angle",
        summary: String(s.title).slice(0, 500),
        rationale: s.rationale ? String(s.rationale).slice(0, 500) : null,
        content_idea_id: idea.id,
      });
    }

    return json({
      brand_id: brandId,
      week_start_date: week,
      signals_inserted: signalsInserted,
      ideas_inserted: ideasInserted,
      autonomous,
    });
  } catch (e) {
    console.error("competitor-digest fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});
