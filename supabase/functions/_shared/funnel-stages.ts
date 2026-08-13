// Server-side mirror of src/lib/funnelStages.ts (no React/lucide imports).
//
// Funnel stages are brand-owned: users can rename, reorder, remap, remove the
// four built-ins and add their own custom stages. `brands.funnel_stages` holds
// the ordered list; an empty array means "use the built-in four".

export type FunnelStageId = string;

export const BUILTIN_STAGE_IDS = ["awareness", "consideration", "conversion", "retention"] as const;
export type BuiltinStageId = (typeof BUILTIN_STAGE_IDS)[number];

export type FunnelStageDef = {
  id: FunnelStageId;
  label: string;
  blurb: string;
  categories: string[];
  art_direction?: string;
  custom?: boolean;
};

export const DEFAULT_FUNNEL_STAGES: FunnelStageDef[] = [
  { id: "awareness", label: "Awareness", blurb: "Get strangers to notice you.", categories: ["educational", "informational", "trending", "entertainment"] },
  { id: "consideration", label: "Consideration", blurb: "Turn lookers into trust.", categories: ["social_proof", "bts", "interactive"] },
  { id: "conversion", label: "Conversion", blurb: "Move trust into sales.", categories: ["promotional", "announcement"] },
  { id: "retention", label: "Retention", blurb: "Keep customers coming back.", categories: ["holidays"] },
];

/** Built-in stage ids, kept for callers that need the canonical four. */
export const STAGE_IDS: FunnelStageId[] = BUILTIN_STAGE_IDS.slice();

export function isBuiltinStage(id: string): boolean {
  return (BUILTIN_STAGE_IDS as readonly string[]).includes(id);
}

/** Resolve the brand's ordered stage list, merging built-in defaults. */
export function resolveBrandStages(overrides: unknown): FunnelStageDef[] {
  const arr = Array.isArray(overrides)
    ? (overrides as Array<{ id?: unknown; label?: unknown; blurb?: unknown; categories?: unknown; art_direction?: unknown }>)
    : [];
  const valid = arr.filter((o) => o && typeof o.id === "string" && (o.id as string).trim());
  if (valid.length === 0) return DEFAULT_FUNNEL_STAGES;

  const seen = new Set<string>();
  const out: FunnelStageDef[] = [];
  for (const o of valid) {
    const id = (o.id as string).trim();
    if (seen.has(id)) continue;
    seen.add(id);
    const def = DEFAULT_FUNNEL_STAGES.find((d) => d.id === id);
    const categories = Array.isArray(o.categories)
      ? (o.categories as unknown[]).filter((c): c is string => typeof c === "string" && !!c)
      : def?.categories ?? [];
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : def?.label || id;
    const blurb = typeof o.blurb === "string" && o.blurb.trim() ? o.blurb.trim() : def?.blurb || "";
    const art = typeof o.art_direction === "string" && o.art_direction.trim() ? o.art_direction.trim() : undefined;
    out.push({ id, label, blurb, categories, art_direction: art, custom: !def });
  }
  return out.length > 0 ? out : DEFAULT_FUNNEL_STAGES;
}

/** Derive stage from a content category using the brand's stage list. */
export function categoryToStage(
  catId?: string | null,
  stages: FunnelStageDef[] = DEFAULT_FUNNEL_STAGES,
): FunnelStageId {
  const list = stages.length ? stages : DEFAULT_FUNNEL_STAGES;
  if (!catId) return list[0].id;
  return list.find((st) => st.categories.includes(catId))?.id ?? list[0].id;
}

/** Validate a stage id against the brand's stage list (defaults when omitted). */
export function normaliseStageId(
  v: unknown,
  stages: FunnelStageDef[] = DEFAULT_FUNNEL_STAGES,
): FunnelStageId | null {
  if (typeof v !== "string" || !v) return null;
  const list = stages.length ? stages : DEFAULT_FUNNEL_STAGES;
  return list.some((s) => s.id === v) ? v : null;
}

export function stageLabel(id: string, stages: FunnelStageDef[] = DEFAULT_FUNNEL_STAGES): string {
  return stages.find((s) => s.id === id)?.label ?? id;
}

/** Fetch + resolve a brand's stages. Never throws; falls back to defaults. */
export async function fetchBrandStages(admin: any, brandId?: string | null): Promise<FunnelStageDef[]> {
  if (!brandId) return DEFAULT_FUNNEL_STAGES;
  try {
    const { data } = await admin.from("brands").select("funnel_stages").eq("id", brandId).maybeSingle();
    return resolveBrandStages((data as any)?.funnel_stages);
  } catch {
    return DEFAULT_FUNNEL_STAGES;
  }
}
