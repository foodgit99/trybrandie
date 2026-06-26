// Generates subject, preheader, body, and CTA for an email_broadcast using
// Lovable AI Gateway. Re-uses brand + JTBD audience context.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scoreDeliverability } from "../_shared/marketing-email-render.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { broadcast_id, prompt } = await req.json();
    if (!broadcast_id) throw new Error("broadcast_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: broadcast, error: bErr } = await supabase
      .from("email_broadcasts").select("*").eq("id", broadcast_id).single();
    if (bErr || !broadcast) throw new Error(bErr?.message || "broadcast not found");

    const { data: brand } = await supabase
      .from("brands").select("name,industry,tone_of_voice,colors,primary_font,logo_url,target_customer")
      .eq("id", broadcast.brand_id).single();
    const { data: audience } = await supabase
      .from("target_audiences").select("*").eq("brand_id", broadcast.brand_id).maybeSingle();
    const { data: products } = await supabase
      .from("brand_products").select("name,description,price").eq("brand_id", broadcast.brand_id).limit(6);
    const { data: campaign } = broadcast.campaign_id
      ? await supabase.from("campaigns").select("name,description").eq("id", broadcast.campaign_id).maybeSingle()
      : { data: null };
    const { data: stage } = broadcast.funnel_stage_id
      ? await supabase.from("content_pillars").select("name,description").eq("id", broadcast.funnel_stage_id).maybeSingle()
      : { data: null };

    const sys = `You are a senior email copywriter for ${brand?.name || "the brand"}.
Write a transactional-style marketing email that respects best practices:
- Subject under 50 chars, curiosity or benefit driven, no clickbait, no ALL CAPS, max 1 emoji.
- Preheader under 90 chars, complementary to subject (don't repeat it).
- Body: 80-150 words. One clear takeaway. One call to action. Conversational tone.
- Use markdown: paragraphs, **bold** sparingly, ONE markdown link [label](url) if a CTA url is provided.
- No spammy phrases ("free!", "act now", "100% guarantee").
- End with a single CTA. Suggest cta_label (2-4 words).
Return strict JSON: {"subject":"","preheader":"","body_md":"","cta_label":"","cta_url":"","alt_subjects":["",""]}`;

    const userMsg = JSON.stringify({
      brand: { name: brand?.name, industry: brand?.industry, tone: brand?.tone_of_voice, target_customer: brand?.target_customer },
      audience: audience ? { struggles: audience.struggles, desired_outcomes: audience.desired_outcomes, emotional_drivers: audience.emotional_drivers } : null,
      products: products || [],
      funnel_stage: stage?.name,
      campaign: campaign?.name,
      author_brief: prompt || broadcast.subject || "Write the next email in our nurture sequence.",
      current_subject_hint: broadcast.subject || null,
      current_cta_url: broadcast.cta_url || null,
    });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "credit_limit_reached" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI gateway ${aiResp.status}: ${t.slice(0, 200)}`);
    }

    const ai = await aiResp.json();
    const content = ai.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const subject = (parsed.subject || "").slice(0, 80).trim();
    const preheader = (parsed.preheader || "").slice(0, 140).trim();
    const body_md = (parsed.body_md || "").trim();
    const cta_label = (parsed.cta_label || "").slice(0, 32).trim();
    const cta_url = (parsed.cta_url || broadcast.cta_url || "").trim();
    const alt_subjects = Array.isArray(parsed.alt_subjects) ? parsed.alt_subjects.slice(0, 3) : [];

    const { score, warnings } = scoreDeliverability(subject, body_md);

    const { error: upErr } = await supabase
      .from("email_broadcasts")
      .update({
        subject, preheader, body_md, cta_label, cta_url,
        ai_alt_subjects: alt_subjects,
        deliverability_score: score,
        metadata: { ...(broadcast.metadata || {}), generation_warnings: warnings },
        status: broadcast.status === "draft" ? "planned" : broadcast.status,
      })
      .eq("id", broadcast_id);
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true, subject, preheader, body_md, cta_label, cta_url, alt_subjects, deliverability_score: score, warnings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-marketing-generate", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
