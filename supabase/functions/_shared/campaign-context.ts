// Campaign context for the design renderer.
//
// A campaign is the planning bucket an idea belongs to (name, category,
// strategy description) plus the funnel stage / rationale the planner assigned.
// The renderer used to be blind to all of it — designs only carried the prompt.
// This helper turns that planning layer into a creative directive so the visual
// style adapts to the campaign the post belongs to.

import {
  DEFAULT_FUNNEL_STAGES,
  fetchBrandStages,
  type FunnelStageDef,
  type FunnelStageId,
} from "./funnel-stages.ts";

export type CampaignContext = {
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_category: string | null;
  funnel_stage: FunnelStageId | null;
  promptText: string;
};

export const EMPTY_CAMPAIGN_CONTEXT: CampaignContext = {
  campaign_id: null,
  campaign_name: null,
  campaign_category: null,
  funnel_stage: null,
  promptText: "",
};

/** Built-in art direction. Custom stages fall back to a generated directive. */
const STAGE_ART_DIRECTION: Record<string, string> = {
  awareness:
    "Awareness stage — the viewer does not know this brand yet. Lead with ONE bold, scroll-stopping visual idea and a single large headline. Maximum contrast, minimum text, no pricing, no hard sell. Brand mark stays small and confident.",
  consideration:
    "Consideration stage — the viewer is weighing trust. Use real, verifiable visuals (gallery photos, product shots, behind-the-scenes, testimonials) with a clear two-tier hierarchy: claim + supporting detail. Calm, editorial layout beats loud promo styling.",
  conversion:
    "Conversion stage — the viewer is close to buying. Make the offer unmistakable: product hero front and centre, price or offer set in a high-contrast block, one dominant CTA element. Urgency is allowed but must stay premium, never bargain-bin.",
  retention:
    "Retention stage — this is for existing customers. Warm, appreciative, human tone. Softer palette weighting, generous whitespace, celebratory or community-led imagery rather than aggressive sales framing.",
};

function stageLabel(id: FunnelStageId, stages: FunnelStageDef[]): string {
  return stages.find((s) => s.id === id)?.label ?? DEFAULT_FUNNEL_STAGES.find((s) => s.id === id)?.label ?? id;
}

/**
 * Art direction precedence: the brand's own note for the stage → built-in
 * direction → a generic directive built from the stage label/blurb so custom
 * stages still give the renderer something concrete to work with.
 */
function stageArtDirection(id: FunnelStageId, stages: FunnelStageDef[]): string {
  const def = stages.find((s) => s.id === id);
  if (def?.art_direction) return def.art_direction;
  if (STAGE_ART_DIRECTION[id]) return STAGE_ART_DIRECTION[id];
  const label = def?.label || id;
  const blurb = def?.blurb ? ` The goal of this stage: ${def.blurb}` : "";
  return `${label} stage — a custom funnel stage defined by this brand.${blurb} Design so the post visibly serves that goal: one clear focal idea, hierarchy that matches the stage's intent, and no selling harder than the stage requires.`;
}

/** A stage id is valid if the brand still has it (custom ids allowed). */
function normaliseStage(v: unknown, stages: FunnelStageDef[]): FunnelStageId | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const id = v.trim();
  return stages.some((s) => s.id === id) ? id : null;
}


/**
 * Resolve the campaign creative context for a design job.
 * Safe: any failure returns EMPTY_CAMPAIGN_CONTEXT so rendering never breaks.
 */
export async function fetchCampaignContext(
  admin: any,
  contentIdeaId?: string | null,
  explicitCampaignId?: string | null,
  explicit?: {
    funnel_stage?: unknown;
    campaign_rationale?: unknown;
    funnel_rationale?: unknown;
    strategic_arc?: unknown;
    /** Brand id so the brand's own funnel stages (incl. custom ones) resolve. */
    brand_id?: string | null;
    /** Already-resolved stages, when the caller has them. */
    brand_stages?: FunnelStageDef[] | null;
  } | null,
): Promise<CampaignContext> {
  try {
    const stages: FunnelStageDef[] =
      explicit?.brand_stages && explicit.brand_stages.length
        ? explicit.brand_stages
        : await fetchBrandStages(admin, explicit?.brand_id ?? null);

    let campaignId: string | null = explicitCampaignId || null;
    // Caller-supplied context wins: the planner/autopilot already knows these,
    // so the renderer should not depend on a DB read to see them.
    let stage: FunnelStageId | null = normaliseStage(explicit?.funnel_stage, stages);
    let campaignRationale: string | null =
      typeof explicit?.campaign_rationale === "string" && explicit.campaign_rationale.trim()
        ? explicit.campaign_rationale.trim()
        : null;
    let funnelRationale: string | null =
      typeof explicit?.funnel_rationale === "string" && explicit.funnel_rationale.trim()
        ? explicit.funnel_rationale.trim()
        : null;
    let strategicArc: string | null =
      typeof explicit?.strategic_arc === "string" && explicit.strategic_arc.trim()
        ? explicit.strategic_arc.trim()
        : null;

    if (contentIdeaId && (!campaignId || !stage || !campaignRationale)) {
      const { data: idea } = await admin
        .from("content_ideas")
        .select("campaign_id, campaign_rationale, funnel_stage, funnel_rationale, strategic_arc")
        .eq("id", contentIdeaId)
        .maybeSingle();
      if (idea) {
        campaignId = campaignId || (idea as any).campaign_id || null;
        stage = stage || normaliseStage((idea as any).funnel_stage, stages);
        campaignRationale = campaignRationale || (idea as any).campaign_rationale || null;
        funnelRationale = funnelRationale || (idea as any).funnel_rationale || null;
        strategicArc = strategicArc || (idea as any).strategic_arc || null;
      }
    }



    let name: string | null = null;
    let category: string | null = null;
    let description: string | null = null;

    if (campaignId) {
      const { data: campaign } = await admin
        .from("campaigns")
        .select("name, content_category, description")
        .eq("id", campaignId)
        .maybeSingle();
      if (campaign) {
        name = (campaign as any).name || null;
        category = (campaign as any).content_category || null;
        description = (campaign as any).description || null;
      }
    }

    if (!name && !stage) return EMPTY_CAMPAIGN_CONTEXT;

    const lines: string[] = [];
    if (name) lines.push(`- Campaign: ${name}${category ? ` (${category})` : ""}`);
    if (description) lines.push(`- Campaign strategy: ${description}`);
    if (strategicArc) lines.push(`- Position in the arc: ${strategicArc}`);
    if (campaignRationale) lines.push(`- Why this post sits in the campaign: ${campaignRationale}`);
    if (stage) {
      lines.push(`- Funnel stage: ${stageLabel(stage, stages)}`);
      if (funnelRationale) lines.push(`- Why this stage: ${funnelRationale}`);
      lines.push(`- Art direction for this stage: ${stageArtDirection(stage, stages)}`);
    }


    const promptText = `\n\nCAMPAIGN CONTEXT (this design is one post inside a running campaign — the visual style MUST serve it):\n${lines.join("\n")}\n\nCAMPAIGN CONSISTENCY RULES:\n1. Designs in the same campaign must feel like siblings: consistent layout logic, type scale and colour weighting, so the campaign reads as a set when viewed on a profile grid.\n2. The funnel stage above dictates how hard the design sells. Never use conversion-style offer blocks on an awareness post, and never bury the offer on a conversion post.\n3. The campaign name is internal strategy — do NOT print it on the design unless the user's request explicitly asks for it.`;

    return {
      campaign_id: campaignId,
      campaign_name: name,
      campaign_category: category,
      funnel_stage: stage,
      promptText,
    };
  } catch (e) {
    console.log("[campaign-context] fetch failed:", e);
    return EMPTY_CAMPAIGN_CONTEXT;
  }
}
