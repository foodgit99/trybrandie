// Shared tool definitions for the autonomous strategist agent.
// Every tool is scoped to a single (user_id, brand_id) session.
// Guardrails are enforced in code, never just in the system prompt.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tool } from "npm:ai@4.3.16";
import { z } from "npm:zod@3.23.8";

// Tables the agent must NEVER read or write.
export const TABLE_DENYLIST = new Set([
  "subscriptions",
  "subscription_charges",
  "subscription_credits",
  "subscription_plans",
  "payment_transactions",
  "affiliates",
  "affiliate_commissions",
  "affiliate_payouts",
  "affiliate_referrals",
  "profiles",
  "user_roles",
  "google_oauth_tokens",
  "google_oauth_states",
  "agent_api_tokens",
]);

export type ToolMode = "auto" | "confirm" | "off";
export type ToolKind = "read" | "write" | "spend";

export interface AgentSession {
  userId: string;
  brandId: string;
  conversationId: string | null;
  authHeader: string;
  serviceClient: SupabaseClient;
  userClient: SupabaseClient;
  toolModes: Record<string, ToolMode>;
  dailyToolCeiling: number;
  dailySpendCeiling: number;
  approvedActionIds: Set<string>;
}

export function getMode(session: AgentSession, toolName: string, kind: ToolKind): ToolMode {
  const explicit = session.toolModes[toolName];
  if (explicit) return explicit;
  // Strategist is always autonomous — reads, writes, and spend all default to auto.
  return "auto";
}

async function checkCeilings(session: AgentSession, kind: ToolKind): Promise<string | null> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await session.serviceClient
    .from("agent_actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId)
    .gte("created_at", since.toISOString())
    .eq("status", "completed");
  if ((count ?? 0) >= session.dailyToolCeiling) return "daily_tool_ceiling_reached";
  if (kind === "spend") {
    const { data: spendRows } = await session.serviceClient
      .from("agent_actions")
      .select("spend_units")
      .eq("user_id", session.userId)
      .gte("created_at", since.toISOString())
      .eq("status", "completed");
    const totalSpend = (spendRows ?? []).reduce((a: number, r: any) => a + (r.spend_units ?? 0), 0);
    if (totalSpend >= session.dailySpendCeiling) return "daily_spend_ceiling_reached";
  }
  return null;
}

async function logAction(
  session: AgentSession,
  toolName: string,
  input: any,
  output: any,
  opts: { status?: string; isReversible?: boolean; reversePayload?: any; spendUnits?: number; mode?: ToolMode } = {},
) {
  const { data } = await session.serviceClient
    .from("agent_actions")
    .insert({
      user_id: session.userId,
      brand_id: session.brandId,
      conversation_id: session.conversationId,
      tool_name: toolName,
      mode: opts.mode ?? "auto",
      input,
      output,
      status: opts.status ?? "completed",
      is_reversible: opts.isReversible ?? false,
      reverse_payload: opts.reversePayload ?? null,
      spend_units: opts.spendUnits ?? 0,
    })
    .select("id")
    .single();
  return data?.id as string | undefined;
}

// Wrap any tool execution with guardrails: mode gate + ceiling check + audit log.
function guarded<TInput>(
  session: AgentSession,
  name: string,
  kind: ToolKind,
  run: (input: TInput) => Promise<any>,
  describe: (input: TInput) => string,
) {
  return async (input: TInput) => {
    const mode = getMode(session, name, kind);
    if (mode === "off") {
      return { ok: false, error: "tool_disabled", message: `The "${name}" tool is disabled in agent settings.` };
    }

    if (mode === "confirm") {
      // Has this specific call been pre-approved by the user?
      const approvalKey = `${name}:${JSON.stringify(input)}`;
      const approved = session.approvedActionIds.has(approvalKey);
      if (!approved) {
        const pendingId = await logAction(session, name, input, null, {
          status: "awaiting_approval",
          mode,
        });
        return {
          ok: false,
          requires_approval: true,
          action_id: pendingId,
          tool: name,
          summary: describe(input),
          message: `This action needs your approval. Reply "approve ${pendingId?.slice(0, 8)}" to proceed.`,
        };
      }
    }

    const ceilingErr = await checkCeilings(session, kind);
    if (ceilingErr) {
      return { ok: false, error: ceilingErr, message: "Daily action limit reached. Raise it in Agent Settings if needed." };
    }

    try {
      return await run(input);
    } catch (e: any) {
      await logAction(session, name, input, { error: e?.message ?? String(e) }, {
        status: "failed",
        mode,
      });
      return { ok: false, error: "tool_failed", message: e?.message ?? "Tool execution failed." };
    }
  };
}

// Helper: invoke another edge function as the user (passes through auth header).
async function callEdge(session: AgentSession, name: string, body: any) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: session.authHeader,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

// ---------- Tool implementations ----------

export function buildTools(session: AgentSession) {
  const sb = session.userClient;
  const brandId = session.brandId;

  return {
    get_brand_snapshot: tool({
      description: "Get the current brand profile, target audiences, content pillars, and series.",
      parameters: z.object({}),
      execute: guarded(session, "get_brand_snapshot", "read", async () => {
        const [brand, audiences, pillars, series, campaigns, products] = await Promise.all([
          sb.from("brands").select("name,tagline,description,vibe,tone_of_voice,personality_traits,primary_colors,secondary_colors,accent_colors,typography_primary,special_instructions").eq("id", brandId).single(),
          sb.from("target_audiences").select("label,jtbd_profile").eq("brand_id", brandId),
          sb.from("content_pillars").select("name,description").eq("brand_id", brandId).order("sort_order"),
          sb.from("post_series").select("name,description,recurrence,preferred_day").eq("brand_id", brandId),
          sb.from("campaigns").select("id,name,description,post_count").eq("brand_id", brandId),
          sb.from("brand_products").select("label,product_type,price,description,is_featured").eq("brand_id", brandId),
        ]);
        const out = {
          brand: brand.data,
          audiences: audiences.data ?? [],
          pillars: pillars.data ?? [],
          series: series.data ?? [],
          campaigns: campaigns.data ?? [],
          products: products.data ?? [],
        };
        await logAction(session, "get_brand_snapshot", {}, { keys: Object.keys(out) });
        return { ok: true, ...out };
      }, () => "Read brand profile and strategy"),
    }),

    get_blueprint: tool({
      description: "Get scheduled/draft content ideas for a date range (defaults to next 14 days).",
      parameters: z.object({
        days_ahead: z.number().int().min(1).max(60).default(14),
      }),
      execute: guarded(session, "get_blueprint", "read", async ({ days_ahead }: any) => {
        const start = new Date(); start.setUTCHours(0, 0, 0, 0);
        const end = new Date(start); end.setUTCDate(end.getUTCDate() + days_ahead);
        const { data, error } = await sb
          .from("content_ideas")
          .select("id,title,caption,pillar,category,scheduled_for,autopilot_status,status")
          .eq("brand_id", brandId)
          .gte("scheduled_for", start.toISOString())
          .lte("scheduled_for", end.toISOString())
          .order("scheduled_for");
        if (error) throw error;
        await logAction(session, "get_blueprint", { days_ahead }, { count: data?.length ?? 0 });
        return { ok: true, ideas: data ?? [] };
      }, ({ days_ahead }: any) => `Read blueprint for next ${days_ahead} days`),
    }),

    get_recent_designs: tool({
      description: "Get the most recent designs with prompts and vote scores.",
      parameters: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
      execute: guarded(session, "get_recent_designs", "read", async ({ limit }: any) => {
        const { data, error } = await sb.from("designs")
          .select("id,title,prompt,vote,created_at,trend_used")
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        await logAction(session, "get_recent_designs", { limit }, { count: data?.length ?? 0 });
        return { ok: true, designs: data ?? [] };
      }, ({ limit }: any) => `Read last ${limit} designs`),
    }),

    query_holidays: tool({
      description: "Fetch upcoming regional holidays and cultural events for this brand.",
      parameters: z.object({ days: z.number().int().min(1).max(60).default(30) }),
      execute: guarded(session, "query_holidays", "read", async ({ days }: any) => {
        const r = await callEdge(session, "holiday-feed", { brand_id: brandId, days });
        await logAction(session, "query_holidays", { days }, { status: r.status });
        return { ok: r.status === 200, holidays: (r.data as any)?.holidays ?? [] };
      }, ({ days }: any) => `Query holidays for next ${days} days`),
    }),

    query_trends: tool({
      description: "Get the latest trend intelligence stored for this brand.",
      parameters: z.object({}),
      execute: guarded(session, "query_trends", "read", async () => {
        const { data } = await sb.from("brand_trend_intel").select("trends_data,generated_at").eq("brand_id", brandId).maybeSingle();
        await logAction(session, "query_trends", {}, { has_data: !!data });
        return { ok: true, trends: data?.trends_data ?? [], generated_at: data?.generated_at };
      }, () => "Query trend intelligence"),
    }),

    create_campaign: tool({
      description: "Create a new campaign (draft) for this brand.",
      parameters: z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(800).optional(),
        post_count: z.number().int().min(1).max(30).default(5),
      }),
      execute: guarded(session, "create_campaign", "write", async (input: any) => {
        const { data, error } = await sb.from("campaigns").insert({
          brand_id: brandId,
          user_id: session.userId,
          name: input.name,
          description: input.description ?? null,
          post_count: input.post_count,
        }).select("id,name").single();
        if (error) throw error;
        await logAction(session, "create_campaign", input, data, {
          isReversible: true,
          reversePayload: { table: "campaigns", row_id: data!.id },
        });
        return { ok: true, campaign: data };
      }, (i: any) => `Create campaign "${i.name}"`),
    }),

    create_content_pillar: tool({
      description: "Add a new content pillar for the brand.",
      parameters: z.object({
        name: z.string().min(1).max(80),
        description: z.string().max(500),
      }),
      execute: guarded(session, "create_content_pillar", "write", async (input: any) => {
        const { data, error } = await sb.from("content_pillars").insert({
          brand_id: brandId, user_id: session.userId,
          name: input.name, description: input.description,
        }).select("id,name").single();
        if (error) throw error;
        await logAction(session, "create_content_pillar", input, data, {
          isReversible: true,
          reversePayload: { table: "content_pillars", row_id: data!.id },
        });
        return { ok: true, pillar: data };
      }, (i: any) => `Add pillar "${i.name}"`),
    }),

    draft_content_idea: tool({
      description: "Draft a single content idea (caption + pillar) for the brand. Does NOT generate the design.",
      parameters: z.object({
        title: z.string().min(1).max(200),
        caption: z.string().min(1).max(2000),
        pillar: z.string().optional(),
        category: z.string().optional(),
        scheduled_for: z.string().datetime().optional(),
      }),
      execute: guarded(session, "draft_content_idea", "write", async (input: any) => {
        const { data, error } = await sb.from("content_ideas").insert({
          brand_id: brandId,
          user_id: session.userId,
          title: input.title,
          caption: input.caption,
          pillar: input.pillar ?? null,
          category: input.category ?? null,
          scheduled_for: input.scheduled_for ?? null,
          status: "draft",
        }).select("id,title").single();
        if (error) throw error;
        await logAction(session, "draft_content_idea", input, data, {
          isReversible: true,
          reversePayload: { table: "content_ideas", row_id: data!.id },
        });
        return { ok: true, idea: data };
      }, (i: any) => `Draft idea "${i.title}"`),
    }),

    schedule_idea: tool({
      description: "Schedule an existing draft idea to be posted at a specific time.",
      parameters: z.object({
        idea_id: z.string().uuid(),
        scheduled_for: z.string().datetime(),
      }),
      execute: guarded(session, "schedule_idea", "write", async (input: any) => {
        const { data: prev } = await sb.from("content_ideas").select("scheduled_for").eq("id", input.idea_id).eq("brand_id", brandId).single();
        const { data, error } = await sb.from("content_ideas")
          .update({ scheduled_for: input.scheduled_for })
          .eq("id", input.idea_id).eq("brand_id", brandId)
          .select("id,title,scheduled_for").single();
        if (error) throw error;
        await logAction(session, "schedule_idea", input, data, {
          isReversible: true,
          reversePayload: { table: "content_ideas", row_id: input.idea_id, prev: { scheduled_for: prev?.scheduled_for ?? null } },
        });
        return { ok: true, idea: data };
      }, (i: any) => `Schedule idea ${i.idea_id.slice(0, 8)} for ${i.scheduled_for}`),
    }),

    update_idea_caption: tool({
      description: "Edit the caption of an existing draft idea.",
      parameters: z.object({
        idea_id: z.string().uuid(),
        caption: z.string().min(1).max(2000),
      }),
      execute: guarded(session, "update_idea_caption", "write", async (input: any) => {
        const { data: prev } = await sb.from("content_ideas").select("caption").eq("id", input.idea_id).eq("brand_id", brandId).single();
        const { data, error } = await sb.from("content_ideas")
          .update({ caption: input.caption })
          .eq("id", input.idea_id).eq("brand_id", brandId)
          .select("id,title").single();
        if (error) throw error;
        await logAction(session, "update_idea_caption", input, data, {
          isReversible: true,
          reversePayload: { table: "content_ideas", row_id: input.idea_id, prev: { caption: prev?.caption ?? "" } },
        });
        return { ok: true, idea: data };
      }, (i: any) => `Edit caption on idea ${i.idea_id.slice(0, 8)}`),
    }),

    enqueue_design_generation: tool({
      description: "Generate a branded design from a prompt. Costs credits.",
      parameters: z.object({
        prompt: z.string().min(5).max(2000),
        idea_id: z.string().uuid().optional(),
      }),
      execute: guarded(session, "enqueue_design_generation", "spend", async (input: any) => {
        const r = await callEdge(session, "design-enqueue", {
          brand_id: brandId,
          prompt: input.prompt,
          source: "strategist-agent",
          idea_id: input.idea_id,
        });
        await logAction(session, "enqueue_design_generation", input, r.data, {
          isReversible: false,
          spendUnits: 1,
        });
        return r.status === 200 ? { ok: true, result: r.data } : { ok: false, error: r.data };
      }, (i: any) => `Generate design: "${i.prompt.slice(0, 60)}..."`),
    }),
  };
}
