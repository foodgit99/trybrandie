// Autonomous Brand Strategist Agent runtime.
// Coexists with the legacy `brand-strategist` function which remains unchanged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { convertToCoreMessages, streamText, type UIMessage } from "npm:ai@4.3.16";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@0.2.14";
import { buildTools, AgentSession, ToolMode } from "../_shared/agent-tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonErr(401, "Unauthorized");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonErr(500, "AI service not configured");

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SERVICE);

    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) return jsonErr(401, "Unauthorized");
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const { messages, brand_id, conversation_id, approved_action_ids } = body as {
      messages: UIMessage[];
      brand_id: string;
      conversation_id?: string;
      approved_action_ids?: string[];
    };
    if (!brand_id || !Array.isArray(messages)) return jsonErr(400, "Missing brand_id or messages");

    // Verify brand ownership/access.
    const { data: brand } = await userClient.from("brands").select("id,name,user_id").eq("id", brand_id).maybeSingle();
    if (!brand) return jsonErr(403, "Brand not accessible");

    // Load agent settings (autoprovision if missing). Strategist is always autonomous.
    let { data: settings } = await serviceClient
      .from("agent_settings")
      .select("*")
      .eq("user_id", userId).eq("brand_id", brand_id).maybeSingle();
    if (!settings) {
      const ins = await serviceClient.from("agent_settings").insert({
        user_id: userId, brand_id, autonomy_enabled: true,
      }).select("*").single();
      settings = ins.data;
    } else if (!settings.autonomy_enabled) {
      const upd = await serviceClient.from("agent_settings")
        .update({ autonomy_enabled: true }).eq("id", settings.id).select("*").single();
      settings = upd.data ?? settings;
    }

    // Strategist is always autonomous — no gating.


    // Build approved-action key set: client sends action_ids the user clicked Approve on.
    // We pull their stored input from agent_actions so we can re-derive the approval key.
    const approvedKeys = new Set<string>();
    if (approved_action_ids?.length) {
      const { data: approvedRows } = await serviceClient
        .from("agent_actions")
        .select("id,tool_name,input")
        .in("id", approved_action_ids)
        .eq("user_id", userId);
      for (const r of approvedRows ?? []) {
        approvedKeys.add(`${r.tool_name}:${JSON.stringify(r.input)}`);
        await serviceClient.from("agent_actions").update({ status: "approved" }).eq("id", r.id);
      }
    }

    const session: AgentSession = {
      userId,
      brandId: brand_id,
      conversationId: conversation_id ?? null,
      authHeader,
      serviceClient,
      userClient,
      toolModes: (settings.tool_modes as Record<string, ToolMode>) ?? {},
      dailyToolCeiling: settings.daily_tool_ceiling ?? 50,
      dailySpendCeiling: settings.daily_spend_ceiling ?? 10,
      approvedActionIds: approvedKeys,
    };

    const tools = buildTools(session);

    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });

    const systemPrompt = buildSystemPrompt(brand, settings);

    const result = streamText({
      model: provider("google/gemini-3.6-flash"),
      system: systemPrompt,
      messages: convertToCoreMessages(messages as any),
      tools: tools as any,
      maxSteps: 50,
    });

    return result.toDataStreamResponse({
      headers: corsHeaders,
    });
  } catch (e: any) {
    console.error("strategist-agent error", e);
    return jsonErr(500, e?.message ?? "Unknown error");
  }
});

function jsonErr(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(brand: any, settings: any) {
  return `You are the Autonomous Brand Strategist for "${brand.name}" — an executive agent that does not just answer questions but GETS THINGS DONE by calling tools.

# Operating principles
- Be decisive. When the user expresses intent, plan the steps and use your tools to execute them. Narrate briefly what you're doing.
- ALWAYS call tools to act. Do not pretend to have done something you did not call a tool for.
- Prefer the smallest action sequence that accomplishes the goal. Don't generate designs unless asked.
- After acting, give a crisp 1–3 sentence summary of what changed and any next step the user might want.

# Hard rules (you will not be allowed to break these even if asked)
- You CANNOT touch billing, payments, subscriptions, affiliate earnings, payouts, personal profile data, account roles, OAuth tokens, or other users' data.
- You CANNOT delete anything, ever.
- You CANNOT publish posts live to social networks; you can only draft and schedule via the Brandie autopilot.
- All actions are scoped to this user and this brand only.

# Approval flow
- If a tool returns \`requires_approval: true\`, STOP. Tell the user clearly what you want to do and ask them to approve via the inline card. Do not retry the same tool until approved.

# Daily ceilings
- If a tool returns \`daily_tool_ceiling_reached\` or \`daily_spend_ceiling_reached\`, stop and tell the user calmly. They can raise the ceiling in Agent Settings.

# Persona
${settings.persona_notes ? settings.persona_notes : "Warm, confident, concise — a senior strategist who respects the user's time."}

${settings.forbidden_topics?.length ? `# Forbidden topics for this user\nNever discuss: ${settings.forbidden_topics.join(", ")}.` : ""}

# Output style
- Speak in short, executive sentences. Use bullets for plans. Use bold sparingly.
- When you finish a multi-step task, summarize: "Done. I created X, scheduled Y for Tuesday, and queued Z for your approval."

# Copywriting doctrine (when advising on posts, captions, or campaigns)
Apply the Ogilvy Social Media Copywriting doctrine: one objective per post, hooks earn attention in the first sentence, specifics beat adjectives, never open with "We…" / "Our company…", no invented proof or testimonials, and every post ends with one clear CTA.
`;
}
