// Deterministic campaign resolver for Autonomous Mode.
// Guarantees every generated idea lands in a valid campaign aligned to the
// user's funnel stage, even if default_campaign_id is missing or stale.
//
// Funnel stages are brand-owned: labels, order, category mappings and custom
// stages all come from brands.funnel_stages, so this resolver reads the brand's
// resolved stage list rather than a hardcoded four.

import {
  DEFAULT_FUNNEL_STAGES,
  fetchBrandStages,
  type FunnelStageDef,
} from "./funnel-stages.ts";

type SupabaseLike = any;

export type FunnelStage = string;

export interface ResolveArgs {
  supabase: SupabaseLike;
  brandId: string;
  userId: string;
  defaultCampaignId?: string | null;
  defaultFunnelStage?: string | null;
  aiResolvedCampaignId?: string | null; // already mapped from name → id by caller
  /** Pre-resolved brand stages, when the caller already fetched them. */
  brandStages?: FunnelStageDef[] | null;
}

export interface ResolveResult {
  campaignId: string;
  funnelStage: FunnelStage;
}

function pickStage(stages: FunnelStageDef[], requested: string | null | undefined): FunnelStageDef {
  const list = stages.length ? stages : DEFAULT_FUNNEL_STAGES;
  if (requested) {
    const hit = list.find((s) => s.id === requested);
    if (hit) return hit;
  }
  return list[0];
}

export async function resolveAutopilotCampaign(args: ResolveArgs): Promise<ResolveResult> {
  const { supabase, brandId, userId } = args;

  const stages =
    args.brandStages && args.brandStages.length
      ? args.brandStages
      : await fetchBrandStages(supabase, brandId);
  const stageDef = pickStage(stages, args.defaultFunnelStage);
  const stage = stageDef.id;

  // 1. AI-resolved campaign — verify it still exists for this brand.
  if (args.aiResolvedCampaignId) {
    const { data } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", args.aiResolvedCampaignId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (data?.id) return { campaignId: data.id, funnelStage: stage };
  }

  // 2. User default — verify still exists.
  if (args.defaultCampaignId) {
    const { data } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", args.defaultCampaignId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (data?.id) return { campaignId: data.id, funnelStage: stage };
  }

  // 3. Stage-matched existing campaign (by content_category on the brand's stage mapping).
  const stageCats = stageDef.categories.length ? stageDef.categories : [];
  if (stageCats.length > 0) {
    const { data: stageMatch } = await supabase
      .from("campaigns")
      .select("id, content_category, created_at")
      .eq("brand_id", brandId)
      .in("content_category", stageCats)
      .order("created_at", { ascending: true })
      .limit(1);
    if (stageMatch && stageMatch[0]?.id) {
      await healDefault(supabase, brandId, stageMatch[0].id);
      return { campaignId: stageMatch[0].id, funnelStage: stage };
    }
  }

  // 4. Auto-create stage campaign (idempotent by name).
  const stageName = stageDef.label;
  const { data: existingByName } = await supabase
    .from("campaigns")
    .select("id")
    .eq("brand_id", brandId)
    .eq("name", stageName)
    .maybeSingle();
  if (existingByName?.id) {
    await healDefault(supabase, brandId, existingByName.id);
    return { campaignId: existingByName.id, funnelStage: stage };
  }

  const { data: created, error: createErr } = await supabase
    .from("campaigns")
    .insert({
      brand_id: brandId,
      user_id: userId,
      name: stageName,
      description: `Auto-created by Autonomous Mode for the ${stageName} funnel stage.`,
      content_category: stageCats[0] ?? null,
    })
    .select("id")
    .single();

  if (!createErr && created?.id) {
    await healDefault(supabase, brandId, created.id);
    return { campaignId: created.id, funnelStage: stage };
  }

  // 5. Last resort — a brand-level "General" campaign.
  const { data: generalExisting } = await supabase
    .from("campaigns")
    .select("id")
    .eq("brand_id", brandId)
    .eq("name", "General")
    .maybeSingle();
  if (generalExisting?.id) {
    await healDefault(supabase, brandId, generalExisting.id);
    return { campaignId: generalExisting.id, funnelStage: stage };
  }
  const { data: generalCreated } = await supabase
    .from("campaigns")
    .insert({
      brand_id: brandId,
      user_id: userId,
      name: "General",
      description: "Default catch-all campaign.",
    })
    .select("id")
    .single();
  if (generalCreated?.id) {
    await healDefault(supabase, brandId, generalCreated.id);
    return { campaignId: generalCreated.id, funnelStage: stage };
  }

  // Shouldn't reach here; throw to make orphaning impossible silently.
  throw new Error("resolveAutopilotCampaign: failed to resolve or create a campaign");
}

async function healDefault(supabase: SupabaseLike, brandId: string, campaignId: string) {
  try {
    // Caller only invokes this after determining the user's stored default is
    // missing or stale, so it's safe to overwrite with the resolved campaign.
    await supabase
      .from("autopilot_settings")
      .update({ default_campaign_id: campaignId })
      .eq("brand_id", brandId);
  } catch {
    // best-effort; never block insertion
  }
}
