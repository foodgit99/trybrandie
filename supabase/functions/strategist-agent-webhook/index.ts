// Public webhook for the Brand Strategist Agent.
// Authenticates via per-user bearer token. Runs a single-shot agent turn and returns text + actions taken.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "npm:ai@4.3.16";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@0.2.14";
import { buildTools, AgentSession, ToolMode } from "../_shared/agent-tools.ts";
import { trimHistory } from "../_shared/chat-history.ts";
import { MAX_TOKENS } from "../_shared/token-budget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")?.trim()
    ?? req.headers.get("X-Agent-Token");
  if (!bearer) return j(401, { error: "Missing token" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return j(500, { error: "AI not configured" });

  const serviceClient = createClient(SUPABASE_URL, SERVICE);
  const hash = await sha256(bearer);
  const { data: tokenRow } = await serviceClient
    .from("agent_api_tokens").select("*").eq("token_hash", hash).is("revoked_at", null).maybeSingle();
  if (!tokenRow) return j(401, { error: "Invalid token" });

  await serviceClient.from("agent_api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenRow.id);

  const body = await req.json().catch(() => ({}));
  const { message, brand_id, channel = "api", external_thread_id } = body as any;
  if (!message || typeof message !== "string") return j(400, { error: "Missing message" });

  // Pick brand: explicit > first owned active brand.
  let activeBrandId = brand_id as string | undefined;
  if (!activeBrandId) {
    const { data: brands } = await serviceClient.from("brands")
      .select("id").eq("user_id", tokenRow.user_id).eq("is_archived", false)
      .order("created_at").limit(1);
    activeBrandId = brands?.[0]?.id;
  }
  if (!activeBrandId) return j(400, { error: "No brand available for this user" });

  // Load / autoprovision settings.
  let { data: settings } = await serviceClient.from("agent_settings")
    .select("*").eq("user_id", tokenRow.user_id).eq("brand_id", activeBrandId).maybeSingle();
  if (!settings) {
    const ins = await serviceClient.from("agent_settings").insert({
      user_id: tokenRow.user_id, brand_id: activeBrandId, autonomy_enabled: false,
    }).select("*").single();
    settings = ins.data;
  }
  if (!settings?.autonomy_enabled) {
    return j(403, { error: "Autonomous mode is disabled for this brand. Enable it in the Brandie app first." });
  }

  // External calls always run as the user via the service key — RLS bypassed for the user's own rows only.
  // We pass the service-role auth header so callEdge can invoke trend-scout/holiday-feed.
  const fakeAuthHeader = `Bearer ${SERVICE}`;
  const session: AgentSession = {
    userId: tokenRow.user_id,
    brandId: activeBrandId,
    conversationId: null,
    authHeader: fakeAuthHeader,
    serviceClient,
    userClient: serviceClient, // service client — guardrails still enforced by tool denylist + scoping
    toolModes: (settings.tool_modes as Record<string, ToolMode>) ?? {},
    dailyToolCeiling: settings.daily_tool_ceiling ?? 50,
    dailySpendCeiling: settings.daily_spend_ceiling ?? 10,
    approvedActionIds: new Set(),
  };

  // Create / reuse conversation for this external thread.
  let convId: string | null = null;
  if (external_thread_id) {
    const { data: existing } = await serviceClient.from("agent_conversations")
      .select("id").eq("user_id", tokenRow.user_id).eq("channel", channel)
      .eq("external_thread_id", external_thread_id).maybeSingle();
    convId = existing?.id ?? null;
  }
  if (!convId) {
    const { data: conv } = await serviceClient.from("agent_conversations").insert({
      user_id: tokenRow.user_id, brand_id: activeBrandId, channel,
      external_thread_id, title: message.slice(0, 80),
    }).select("id").single();
    convId = conv?.id ?? null;
  }
  session.conversationId = convId;

  const tools = buildTools(session);
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  // Pull last 10 messages from this conv for context.
  const { data: history } = await serviceClient.from("agent_messages")
    .select("role,parts").eq("conversation_id", convId!).order("created_at").limit(20);
  const priorMessages = (history ?? []).map((m: any) => ({
    role: m.role,
    content: m.parts?.[0]?.text ?? "",
  }));

  await serviceClient.from("agent_messages").insert({
    conversation_id: convId, user_id: tokenRow.user_id,
    role: "user", parts: [{ type: "text", text: message }],
  });

  const startActionId = await getLastActionId(serviceClient, tokenRow.user_id);

  let assistantText = "";
  try {
    const r = await generateText({
      model: provider("google/gemini-3.6-flash"),
      system: `You are the Autonomous Brand Strategist. You are answering via an external channel (${channel}). Be concise — fit under 600 characters when possible. Use tools to act, then summarize crisply.`,
      messages: [...trimHistory(priorMessages, 6), { role: "user", content: message }],
      tools: tools as any,
      maxSteps: 25,
      maxTokens: MAX_TOKENS.chat,
    });
    assistantText = r.text;
  } catch (e: any) {
    assistantText = `Sorry, I hit an error: ${e?.message ?? "unknown"}`;
  }

  await serviceClient.from("agent_messages").insert({
    conversation_id: convId, user_id: tokenRow.user_id,
    role: "assistant", parts: [{ type: "text", text: assistantText }],
  });
  await serviceClient.from("agent_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId!);

  const actions = await getActionsSince(serviceClient, tokenRow.user_id, startActionId);
  return j(200, {
    reply: assistantText,
    conversation_id: convId,
    actions_taken: actions.map((a: any) => ({ tool: a.tool_name, status: a.status, summary: a.output })),
  });
});

async function getLastActionId(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb.from("agent_actions").select("id").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}
async function getActionsSince(sb: any, userId: string, sinceId: string | null) {
  let q = sb.from("agent_actions").select("tool_name,status,output").eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (sinceId) {
    const { data: ref } = await sb.from("agent_actions").select("created_at").eq("id", sinceId).single();
    if (ref?.created_at) q = q.gt("created_at", ref.created_at);
  }
  const { data } = await q;
  return data ?? [];
}

function j(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
