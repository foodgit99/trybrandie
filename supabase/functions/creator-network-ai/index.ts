// Creator Network — human-triggered AI work. Every call creates a real
// creator_network_ai_runs row (Running → Completed/Needs Review/Failed).
// Uses Brandie's shared AI infrastructure only.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callWithFallback, MODEL_CHAINS } from "../_shared/model-fallback.ts";
import { MAX_TOKENS, compactJson, pickFields } from "../_shared/token-budget.ts";
import { Tracer } from "../_shared/tracer.ts";
import { sanitise } from "../_shared/sanitise.ts";
import { getCreatorNetworkBrandContext } from "../_shared/creator-network-brand-context.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const AGENTS: Record<string, { objective: string; system: string; chain: keyof typeof MODEL_CHAINS }> = {
  creator_research_summary: {
    objective: "Summarise what is known about this creator and list research gaps",
    chain: "fast",
    system:
      "You are Brandie's Creator Network research analyst. Use ONLY the provided records. Never invent facts, metrics, demographics or personal details. " +
      "Never infer private beliefs, protected traits or character. Label every statement with its evidence class (Verified, Estimated, Inferred, Self-reported, Human-confirmed, Unknown). " +
      'Return JSON: {"summary": string, "gaps": string[], "suggested_human_questions": string[], "confidence": "High"|"Medium"|"Low"}',
  },
  outreach_drafter: {
    objective: "Draft a short outreach message for a human to review and send",
    chain: "fast",
    system:
      "You draft B2B outreach for Brandie offering a private, watermarked speculative ad featuring a licensed creator. Max 90 words, warm, Nigerian-business friendly, no hype. " +
      "Never claim the creator personally used the product. Never promise results. Make clear the preview is a private concept. " +
      'Return JSON: {"message": string, "subject": string, "confidence": "High"|"Medium"|"Low"}',
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: allowed } = await userClient.rpc("creator_network_can", { _role: null });
  if (!allowed) return json({ error: "Creator Network is disabled or you are not an operator." }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const agent = AGENTS[body?.agent];
  if (!agent) return json({ error: "Unknown agent" }, 400);
  const entityType = String(body.entity_type ?? "");
  const entityId = String(body.entity_id ?? "");
  if (!["creator", "sale"].includes(entityType) || !entityId) return json({ error: "entity_type/entity_id required" }, 400);

  const admin = createClient(url, service);
  const tracer = new Tracer(user.id);

  // Assemble input from records the operator can already see.
  let input: Record<string, unknown> = {};
  let isTest = false;
  if (entityType === "creator") {
    const { data: c } = await userClient.from("creator_network_creators").select("*").eq("id", entityId).maybeSingle();
    if (!c) return json({ error: "Creator not found" }, 404);
    isTest = !!c.is_test;
    const [{ data: v }, { data: f }, { data: a }] = await Promise.all([
      userClient.from("creator_network_validations").select("validation_type,status,evidence_classification,response").eq("creator_id", entityId),
      userClient.from("creator_network_findings").select("finding,evidence_classification,confidence,source_name").eq("creator_id", entityId).eq("is_current", true).limit(30),
      userClient.from("creator_network_audience_profiles").select("geography,age_range,affluence_segment,evidence_classification").eq("creator_id", entityId),
    ]);
    // contact details & notes deliberately excluded
    input = {
      creator: pickFields(c, ["display_name", "handle", "primary_niche", "secondary_niches", "location", "languages", "content_formats", "status", "licensing_interest", "camera_presence", "ai_likeness_suitability", "content_versatility", "commercial_category_breadth"]),
      validations: v ?? [], findings: f ?? [], audience: a ?? [],
    };
  } else {
    const { data: s } = await userClient.from("creator_network_sales").select("*").eq("id", entityId).maybeSingle();
    if (!s) return json({ error: "Sale not found" }, 404);
    isTest = !!s.is_test;
    const { data: o } = await userClient.from("creator_network_opportunities").select("campaign_objective,creative_angle,recommended_format").eq("id", s.opportunity_id).maybeSingle();
    const { data: cr } = s.creator_id ? await userClient.from("creator_network_creators").select("display_name,primary_niche").eq("id", s.creator_id).maybeSingle() : { data: null };
    let business: unknown = null;
    if (s.brand_id) business = await getCreatorNetworkBrandContext(admin, s.brand_id, "external");
    else if (s.prospect_id) {
      const { data: p } = await userClient.from("creator_network_prospects").select("business_name,category,location,products_summary,observed_content_gap").eq("id", s.prospect_id).maybeSingle();
      business = p;
    }
    input = { opportunity: o, creator: cr, business, channel: s.channel, offer_price: s.offer_price, currency: s.currency };
  }

  const { data: run, error: runErr } = await admin.from("creator_network_ai_runs").insert({
    agent: body.agent, objective: agent.objective, entity_type: entityType, entity_id: entityId, triggered_by: user.id,
    status: "Running", input, started_at: new Date().toISOString(), is_test: isTest,
  }).select().single();
  if (runErr) return json({ error: runErr.message }, 500);

  const fail = async (msg: string, status = 500) => {
    await admin.from("creator_network_ai_runs").update({ status: "Failed", error: msg, ended_at: new Date().toISOString() }).eq("id", run.id);
    return json({ error: msg, run_id: run.id }, status);
  };
  if (!apiKey) return fail("AI is not configured", 503);

  const span = tracer.startSpan(`creator-network:${body.agent}`);
  try {
    const { response, modelUsed } = await callWithFallback(
      MODEL_CHAINS[agent.chain] as any,
      (model) => ({
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS.chat ?? 800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: agent.system },
            { role: "user", content: sanitise(compactJson(input, 6000), 8000) },
          ],
        }),
      }),
      GATEWAY,
      apiKey,
    );
    if (response.status === 402) { span.fail("402"); return fail("AI credits exhausted for the workspace.", 402); }
    if (response.status === 429) { span.fail("429"); return fail("AI is rate limited — try again shortly.", 429); }
    if (!response.ok) { span.fail(String(response.status)); return fail(`AI gateway error ${response.status}`, 503); }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    let output: any;
    try { output = JSON.parse(text); } catch { output = null; }
    if (!output || typeof output !== "object") { span.fail("invalid_output"); return fail("AI returned an invalid response."); }
    span.finish({ status: "ok", metadata: { model: modelUsed } });
    const confidence = typeof output.confidence === "string" ? output.confidence : null;
    await admin.from("creator_network_ai_runs").update({
      status: "Needs Review", output, confidence, model_used: modelUsed, ended_at: new Date().toISOString(),
      evidence: entityType === "creator" ? { findings_used: (input as any).findings?.length ?? 0 } : null,
    }).eq("id", run.id);
    tracer.log();
    return json({ run_id: run.id, output });
  } catch (e) {
    span.fail(String(e));
    return fail(e instanceof Error ? e.message : String(e));
  }
});
