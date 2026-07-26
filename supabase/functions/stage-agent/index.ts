// Conversational runtime for the six pipeline-stage agents shown on /engine.
// Each agent is a domain specialist with a scoped tool subset. Shares the
// guardrail/approval/audit machinery with the strategist agent.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { convertToCoreMessages, streamText, type UIMessage } from "npm:ai@4.3.16";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@0.2.14";
import { buildTools, AgentSession, ToolMode } from "../_shared/agent-tools.ts";
import { buildBrandContext } from "../_shared/brand-context.ts";
import { getSeasonalContextStringAsync, resolveBrandRegion } from "../_shared/holiday-feed.ts";
import { sanitise } from "../_shared/sanitise.ts";
import { PERSONAS, buildSystemPrompt, type AgentId } from "../_shared/stage-personas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonErr(401, "Unauthorized");

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
    const { agent, messages, brand_id, conversation_id, approved_action_ids } = body as {
      agent: AgentId;
      messages: UIMessage[];
      brand_id: string;
      conversation_id?: string;
      approved_action_ids?: string[];
    };

    if (!agent || !(agent in PERSONAS)) return jsonErr(400, "Unknown agent");
    if (!brand_id || !Array.isArray(messages)) return jsonErr(400, "Missing brand_id or messages");

    for (const m of messages as any[]) {
      if (m?.role === "user" && typeof m.content === "string") m.content = sanitise(m.content);
    }

    const ctx = await buildBrandContext(userClient, brand_id);
    if (!ctx) return jsonErr(403, "Brand not accessible");

    // Agent settings row (autonomous by default, same as the strategist).
    let { data: settings } = await serviceClient
      .from("agent_settings").select("*")
      .eq("user_id", userId).eq("brand_id", brand_id).maybeSingle();
    if (!settings) {
      const ins = await serviceClient.from("agent_settings")
        .insert({ user_id: userId, brand_id, autonomy_enabled: true }).select("*").single();
      settings = ins.data;
    }

    const approvedKeys = new Set<string>();
    if (approved_action_ids?.length) {
      const { data: approvedRows } = await serviceClient
        .from("agent_actions").select("id,tool_name,input")
        .in("id", approved_action_ids).eq("user_id", userId);
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
      toolModes: (settings?.tool_modes as Record<string, ToolMode>) ?? {},
      dailyToolCeiling: settings?.daily_tool_ceiling ?? 50,
      dailySpendCeiling: settings?.daily_spend_ceiling ?? 10,
      approvedActionIds: approvedKeys,
    };

    const persona = PERSONAS[agent];
    const allTools = buildTools(session) as Record<string, unknown>;
    const tools: Record<string, unknown> = {};
    for (const name of persona.tools) if (allTools[name]) tools[name] = allTools[name];

    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });

    const seasonal = await getSeasonalContextStringAsync(
      userClient, 14, await resolveBrandRegion(userClient, brand_id),
    );

    const system = buildSystemPrompt(persona, ctx.brand, ctx.context, seasonal, settings);

    console.log("[stage-agent] start", {
      agent,
      brand_id,
      messages: messages.length,
      tools: Object.keys(tools),
      system_chars: system.length,
    });

    const result = streamText({
      model: provider("google/gemini-3-flash-preview"),
      system,
      onError: ({ error }: any) => {
        console.error("[stage-agent] streamText onError", {
          name: error?.name,
          message: error?.message,
          statusCode: error?.statusCode,
          responseBody: typeof error?.responseBody === "string" ? error.responseBody.slice(0, 800) : undefined,
        });
      },
      messages: convertToCoreMessages(messages as any),
      tools: tools as any,
      maxSteps: 50,
    });

    return result.toDataStreamResponse({
      headers: corsHeaders,
      getErrorMessage: (err: any) => {
        console.error("stage-agent stream error", err);
        const msg = err?.message ?? String(err);
        if (/402|payment|credit/i.test(msg)) return "AI credits exhausted. Add credits to keep chatting.";
        if (/429|rate/i.test(msg)) return "The AI is rate limited right now — try again in a moment.";
        return msg.slice(0, 300);
      },
    });
  } catch (e: any) {
    console.error("stage-agent error", e);
    return jsonErr(500, e?.message ?? "Unknown error");
  }
});

function jsonErr(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
