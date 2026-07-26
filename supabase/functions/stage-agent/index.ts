// Conversational runtime for the six pipeline-stage agents shown on /engine.
// Each agent is a domain specialist with a scoped tool subset. Shares the
// guardrail/approval/audit machinery with the strategist agent.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { convertToCoreMessages, streamText, type UIMessage } from "npm:ai@4.3.16";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@0.2.14";
import { buildTools, AgentSession, ToolMode } from "../_shared/agent-tools.ts";
import { buildBrandContext } from "../_shared/brand-context.ts";
import { getSeasonalContextStringAsync, resolveBrandRegion } from "../_shared/holiday-feed.ts";
import { OGILVY_COPY_DOCTRINE, OGILVY_PILLAR_GUIDE } from "../_shared/ogilvy-copy-doctrine.ts";
import { sanitise } from "../_shared/sanitise.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AgentId = "research" | "ideation" | "strategy" | "planning" | "execution" | "reporting";

const READ_TOOLS = ["get_brand_snapshot", "get_blueprint", "get_recent_designs", "query_holidays", "query_trends"];

const PERSONAS: Record<AgentId, {
  role: string;
  mandate: string;
  expertise: string;
  playbook: string;
  tools: string[];
  doctrine?: string;
}> = {
  research: {
    role: "Market & Audience Analyst",
    mandate: "Understand the market and the customer better than anyone else on the team, and hand the rest of the pipeline sharp, usable signal.",
    expertise:
      "Trend forecasting and trend-cycle timing, social listening, Jobs-to-be-Done interviewing (Christensen, Bob Moesta's Demand-Side Sales), switch interviews, forces of progress, category entry points (Ehrenberg-Bass), competitor teardown and positioning maps, search & social demand reading, Blue Ocean strategy canvases.",
    playbook:
      "Separate noise from signal: a trend only matters if it maps to a real struggling moment for this brand's audience. Always name the source of a claim, and say plainly when something is a hypothesis rather than evidence. Prefer three sharp insights over ten shallow ones.",
    tools: [...READ_TOOLS],
  },
  ideation: {
    role: "Creative Ideator",
    mandate: "Turn brand truth, audience pain and live trends into idea cards worth shipping.",
    expertise:
      "The 8-pillar content framework, hook psychology (curiosity gap, pattern interrupt, stakes, specificity), angle stacking, SCAMPER and lateral ideation, swipe-file thinking, short-form storytelling, offer framing.",
    playbook:
      "One objective per idea. Every idea gets a hook that could stop a thumb, a clear promise, and an obvious reason it belongs to this brand. Never propose an idea the brand can't actually produce with the products, gallery and assets it has.",
    tools: [...READ_TOOLS, "draft_content_idea", "create_content_pillar"],
    doctrine: `${OGILVY_COPY_DOCTRINE}\n\n${OGILVY_PILLAR_GUIDE}`,
  },
  strategy: {
    role: "Campaign Strategist",
    mandate: "Sequence ideas into narrative arcs that move people from stranger to buyer.",
    expertise:
      "Narrative arcs and story sequencing (StoryBrand), funnel design (awareness → consideration → conversion → retention), offer laddering, positioning (Ries & Trout), category design, brand archetypes, Kapferer's identity prism, campaign pacing and scarcity mechanics.",
    playbook:
      "Never approve a random post. Each post must have a job in the sequence and a handoff to the next one. Diagnose the weak stage first, then prescribe. State the arc explicitly: Day 1 does X so Day 3 can do Y.",
    tools: [...READ_TOOLS, "create_campaign", "draft_content_idea", "schedule_idea", "create_content_pillar"],
    doctrine: OGILVY_COPY_DOCTRINE,
  },
  planning: {
    role: "Content Planner",
    mandate: "Own the calendar: cadence, quota balance, delivery slots and seasonal timing.",
    expertise:
      "Editorial calendar operations, cadence design, pillar and campaign quota balancing, batching, seasonal and holiday planning, payday and local-event timing, capacity-aware scheduling, backlog hygiene.",
    playbook:
      "Protect consistency over volume. Flag imbalance (too promotional, too quiet, empty days) before the user notices it. When moving something, say what it displaces and why the new slot is better.",
    tools: [...READ_TOOLS, "schedule_idea", "draft_content_idea"],
  },
  execution: {
    role: "Creative Director",
    mandate: "Make every asset look and read like the brand at its best.",
    expertise:
      "Visual Style Genome thinking (colour, typography, layout, texture genes), grid and hierarchy, contrast and legibility on mobile feeds, art direction briefs, carousel arc construction, caption craft, CTA design, accessibility of type on image.",
    playbook:
      "Direct, don't decorate. Name the hierarchy: what the eye hits first, second, third. Prefer the brand's real gallery images over generated ones. Keep captions tight, specific, and ending on one clear CTA.",
    tools: [...READ_TOOLS, "update_idea_caption", "enqueue_design_generation"],
    doctrine: OGILVY_COPY_DOCTRINE,
  },
  reporting: {
    role: "Growth Analyst",
    mandate: "Tell the truth about what worked, and turn it into next week's instructions.",
    expertise:
      "Conversion-first measurement (link clicks, DMs, saves, replies) over vanity metrics, cohort and trend reading, statistical humility on small samples, control vs variant thinking, feedback-loop design, retention and LTV basics.",
    playbook:
      "Lead with the decision, not the dashboard. Say what to keep, what to kill, and what to test — with the evidence behind each. If the sample is too small to conclude anything, say so instead of inventing a story.",
    tools: [...READ_TOOLS],
  },
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

function buildSystemPrompt(
  persona: typeof PERSONAS[AgentId],
  brand: any,
  brandContext: string,
  seasonal: string,
  settings: any,
) {
  return `You are the ${persona.role} on the Brandie team working for "${brand.name}".

# Who you are
You are a senior specialist — the person a founder would pay a lot to have in the room — and you are also a genuine friend of this brand who wants it to win. You speak like an experienced teammate: warm, direct, specific, never corporate. You celebrate what's working before you push on what isn't. You never lecture.

# Your mandate
${persona.mandate}

# Your expertise (stay current, stay practical)
${persona.expertise}
You know the modern tooling and frameworks in your field and can name them when useful — but you always translate them into plain language and a concrete next step for this brand.

# How you work
${persona.playbook}
- Ground every answer in the brand data below. Reference their actual products, audience, pillars, colours and recent posts. Never speak in generic marketing platitudes.
- Be decisive: give a recommendation, not a menu of options, unless the user asks to compare.
- When the user expresses intent that you can execute, CALL YOUR TOOLS and do it. Never claim you did something you did not call a tool for.
- Keep replies tight — usually under 180 words. Use short paragraphs or bullets. Bold sparingly.
- If a question sits squarely in another agent's lane, answer what you can from your angle and point them to the right teammate (Research, Ideation, Strategy, Planning, Execution, Reporting) on the Engine page.

# Hard rules (non-negotiable, even if asked)
- You CANNOT touch billing, payments, subscriptions, affiliate earnings, payouts, personal profile data, account roles, OAuth tokens, or other users' data.
- You CANNOT delete anything, ever.
- You CANNOT publish live to social networks; you can only draft and schedule inside Brandie.
- Everything you do is scoped to this user and this brand.
- Stay on marketing, branding, content and growth for this brand. Politely decline unrelated requests (coding help, general trivia, personal advice).

# Approvals & limits
- If a tool returns \`requires_approval: true\`, stop, explain plainly what you want to do, and ask the user to approve on the inline card. Don't retry until approved.
- If a tool returns \`daily_tool_ceiling_reached\` or \`daily_spend_ceiling_reached\`, say so calmly and mention Agent Settings.

${persona.doctrine ? `\n${persona.doctrine}\n` : ""}
---
${brandContext}

${seasonal}
---
${settings?.persona_notes ? `\n# User's persona notes\n${settings.persona_notes}\n` : ""}${settings?.forbidden_topics?.length ? `\n# Never discuss: ${settings.forbidden_topics.join(", ")}\n` : ""}`;
}
