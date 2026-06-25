// Server-side mirror of src/lib/funnelStages.ts (no React/lucide imports).

export type FunnelStageId = "awareness" | "consideration" | "conversion" | "retention";

export type FunnelStageDef = {
  id: FunnelStageId;
  label: string;
  blurb: string;
  categories: string[];
};

export const DEFAULT_FUNNEL_STAGES: FunnelStageDef[] = [
  { id: "awareness", label: "Awareness", blurb: "Get strangers to notice you.", categories: ["educational", "informational", "trending", "entertainment"] },
  { id: "consideration", label: "Consideration", blurb: "Turn lookers into trust.", categories: ["social_proof", "bts", "interactive"] },
  { id: "conversion", label: "Conversion", blurb: "Move trust into sales.", categories: ["promotional", "announcement"] },
  { id: "retention", label: "Retention", blurb: "Keep customers coming back.", categories: ["holidays"] },
];

export const STAGE_IDS: FunnelStageId[] = ["awareness", "consideration", "conversion", "retention"];

export function resolveBrandStages(overrides: unknown): FunnelStageDef[] {
  const arr = Array.isArray(overrides) ? (overrides as Array<{ id: FunnelStageId; label?: string; blurb?: string }>) : [];
  return DEFAULT_FUNNEL_STAGES.map((s) => {
    const o = arr.find((x) => x && x.id === s.id);
    if (!o) return s;
    return {
      ...s,
      label: o.label?.trim() ? o.label.trim() : s.label,
      blurb: o.blurb?.trim() ? o.blurb.trim() : s.blurb,
    };
  });
}

export function categoryToStage(catId?: string | null): FunnelStageId {
  if (!catId) return "awareness";
  return DEFAULT_FUNNEL_STAGES.find((st) => st.categories.includes(catId))?.id ?? "awareness";
}

export function normaliseStageId(v: unknown): FunnelStageId | null {
  if (typeof v !== "string") return null;
  return (STAGE_IDS as string[]).includes(v) ? (v as FunnelStageId) : null;
}
