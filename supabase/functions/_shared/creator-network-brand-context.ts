// Creator Network brand-context contract. Wraps buildBrandContext() and returns
// only the fields a Creator Network job needs. Never exposes strategy chats,
// other brands, team info or unrelated Brand Centre intelligence.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildBrandContext } from "./brand-context.ts";
import { clampText } from "./token-budget.ts";

export type CnProjection = "internal" | "external";

export async function getCreatorNetworkBrandContext(sb: SupabaseClient, brandId: string, projection: CnProjection = "internal") {
  const full = await buildBrandContext(sb, brandId);
  if (!full) return null;
  const b = full.brand ?? {};
  const base = {
    brand_id: brandId,
    name: b.name ?? null,
    industry: b.industry ?? null,
    tone: b.tone ?? b.brand_voice ?? null,
    colors: b.colors ?? null,
  };
  if (projection === "external") return base; // privacy-filtered for creator/business-facing output
  return { ...base, summary: clampText(full.context, 2000) };
}
