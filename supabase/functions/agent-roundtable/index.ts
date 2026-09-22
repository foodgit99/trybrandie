// Multi-agent roundtable: several stage agents answer the same question in one
// thread, see each other's takes, then a facilitator reconciles conflicts into
// a single call. Read-only tools only — mutations stay in 1:1 chats.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "npm:ai@4.3.16";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@0.2.14";
import { buildTools, AgentSession, ToolMode } from "../_shared/agent-tools.ts";
import { buildBrandContext } from "../_shared/brand-context.ts";
import { getSeasonalContextStringAsync, resolveBrandRegion } from "../_shared/holiday-feed.ts";
import { PERSONAS, READ_TOOLS, buildSystemPrompt, type AgentId } from "../_shared/stage-personas.ts";
import { sanitise } from "../_shared/sanitise.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3.6-flash";

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
    const agents = (body.agents ?? []) as AgentId[];
    const brandId = body.brand_id as string;
    const conversationId = (body.conversation_id ?? null) as string | null;
    const question = sanitise(String(body.question ?? "")).trim();
    const history = (Array.isArray(body.history) ? body.history : []) as {
      role: string;
      speaker?: string;
      text: string;
    }[];

    if (!brandId || !question) return jsonErr(400, "Missing brand_id or question");
    const panel = agents.filter((a) => a in PERSONAS).slice(0, 4);
    if (panel.length < 2) return jsonErr(400, "Pick at least two agents for a roundtable");

    const ctx = await buildBrandContext(userClient, brandId);
    if (!ctx) return jsonErr(403, "Brand not accessible");

    let { data: settings } = await serviceClient
      .from("agent_settings").select("*")
      .eq("user_id", userId).eq("brand_id", brandId).maybeSingle();
    if (!settings) {
      const ins = await serviceClient.from("agent_settings")
        .insert({ user_id: userId, brand_id: brandId, autonomy_enabled: true }).select("*").single();
      settings = ins.data;
    }

    const session: AgentSession = {
      userId,
      brandId,
      conversationId,
      authHeader,
      serviceClient,
      userClient,
      toolModes: (settings?.tool_modes as Record<string, ToolMode>) ?? {},
      dailyToolCeiling: settings?.daily_tool_ceiling ?? 50,
      dailySpendCeiling: settings?.daily_spend_ceiling ?? 10,
      approvedActionIds: new Set<string>(),
    };

    const allTools = buildTools(session) as Record<string, unknown>;
    const readTools: Record<string, unknown> = {};
    for (const name of READ_TOOLS) if (allTools[name]) readTools[name] = allTools[name];

    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const seasonal = await getSeasonalContextStringAsync(
      userClient, 14, await resolveBrandRegion(userClient, brandId),
    );

    const priorTranscript = history
      .slice(-12)
      .map((m) => `${m.role === "user" ? "Founder" : m.speaker ?? "Team"}: ${m.text}`)
      .join("\n\n");

    const turns: { agent: AgentId; role: string; text: string }[] = [];

    // Stream NDJSON events so the client can render each take the moment it lands.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch (_) {
            /* client went away */
          }
        };

        emit({
          type: "start",
          panel: panel.map((id) => ({ id, role: PERSONAS[id].role })),
        });

        try {
          for (const id of panel) {
            const persona = PERSONAS[id];
            emit({ type: "turn_start", agent: id, role: persona.role });

            const others = panel.filter((p) => p !== id).map((p) => PERSONAS[p].role).join(", ");
            const table = turns.length
              ? `\n\nWhat your teammates have already said in this roundtable:\n\n${turns
                  .map((t) => `**${t.role}:** ${t.text}`)
                  .join("\n\n")}\n\nBuild on what you agree with, and say clearly and respectfully where you disagree and why. Do not repeat their points.`
              : "";

            const system = `${buildSystemPrompt(persona, ctx.brand, ctx.context, seasonal, settings)}

# Roundtable mode
You are in a live working session with: ${others}. Speak only from your own lane.
Keep it to 120 words or fewer. No preamble, no greeting — go straight to your take.
End with one line starting with "My call:" giving your single clearest recommendation.
Do not create, schedule or change anything in this mode; you may read data only.`;

            const prompt = `${priorTranscript ? `Earlier in this thread:\n${priorTranscript}\n\n` : ""}The founder asks: ${question}${table}`;

            let text = "";
            let failed = false;
            try {
              const res = await generateText({
                model: provider(MODEL),
                system,
                prompt,
                tools: readTools as any,
                maxSteps: 6,
                maxTokens: MAX_TOKENS.chat,
              });
              text = (res.text ?? "").trim();
            } catch (e: any) {
              console.error("[roundtable] agent failed", id, e?.message);
              failed = true;
              text = `_${persona.role} couldn't weigh in this round (${String(e?.message ?? "error").slice(0, 120)})._`;
            }
            const turn = { agent: id, role: persona.role, text: text || "_No response._" };
            turns.push(turn);
            emit({ type: "turn", ...turn, failed });
          }

          // Facilitator: reconcile the panel into one decision.
          emit({ type: "synthesis_start" });
          const panelText = turns.map((t) => `**${t.role}:**\n${t.text}`).join("\n\n");
          let synthesis = "";
          try {
            const res = await generateText({
              model: provider(MODEL),
              system: `You are the Chief of Staff facilitating a roundtable for the brand "${ctx.brand.name}".
Your job is to reconcile the specialists' takes into one decision the founder can act on today.
Format exactly:
**Where they agree** — 1-2 bullets.
**Where they conflict** — name each disagreement, who holds which position, and rule on it with a reason.
**The call** — 2-4 numbered, concrete next actions, each owned by one of the specialists by role name.
Be decisive. No hedging, no new ideas the panel didn't raise. Under 180 words.`,
              prompt: `Founder's question: ${question}\n\nPanel:\n\n${panelText}`,
            });
            synthesis = (res.text ?? "").trim();
          } catch (e: any) {
            console.error("[roundtable] synthesis failed", e?.message);
            synthesis = "";
          }

          emit({ type: "synthesis", text: synthesis });
          emit({ type: "done", turns, synthesis });
        } catch (e: any) {
          console.error("[roundtable] stream error", e?.message);
          emit({ type: "error", message: String(e?.message ?? "Roundtable failed") });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });

  } catch (e: any) {
    console.error("agent-roundtable error", e);
    const msg = e?.message ?? "Unknown error";
    if (/402|payment|credit/i.test(msg)) return jsonErr(402, "AI credits exhausted. Add credits to keep chatting.");
    if (/429|rate/i.test(msg)) return jsonErr(429, "The AI is rate limited right now — try again in a moment.");
    return jsonErr(500, msg);
  }
});

function jsonErr(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
