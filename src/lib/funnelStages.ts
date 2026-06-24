import { Heart, Layers, Sparkles, Target, type LucideIcon } from "lucide-react";

export type FunnelStageId = "awareness" | "consideration" | "conversion" | "retention";

export type FunnelStageDef = {
  id: FunnelStageId;
  label: string;
  blurb: string;
  icon: LucideIcon;
  accent: string;
  categories: string[];
};

export const DEFAULT_FUNNEL_STAGES: FunnelStageDef[] = [
  {
    id: "awareness",
    label: "Awareness",
    blurb: "Get strangers to notice you.",
    icon: Sparkles,
    accent: "from-sky-500/20 to-sky-500/0 text-sky-700 dark:text-sky-300",
    categories: ["educational", "informational", "trending", "entertainment"],
  },
  {
    id: "consideration",
    label: "Consideration",
    blurb: "Turn lookers into trust.",
    icon: Layers,
    accent: "from-violet-500/20 to-violet-500/0 text-violet-700 dark:text-violet-300",
    categories: ["social_proof", "bts", "interactive"],
  },
  {
    id: "conversion",
    label: "Conversion",
    blurb: "Move trust into sales.",
    icon: Target,
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-700 dark:text-emerald-300",
    categories: ["promotional", "announcement"],
  },
  {
    id: "retention",
    label: "Retention",
    blurb: "Keep customers coming back.",
    icon: Heart,
    accent: "from-rose-500/20 to-rose-500/0 text-rose-700 dark:text-rose-300",
    categories: ["holidays"],
  },
];

export type BrandStageOverride = { id: FunnelStageId; label?: string; blurb?: string };

/** Merge per-brand stage overrides over the defaults. Safe with null/empty/array data. */
export function resolveBrandStages(overrides: unknown): FunnelStageDef[] {
  const arr = Array.isArray(overrides) ? (overrides as BrandStageOverride[]) : [];
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

/** Derive stage from content_category when no explicit override is set. */
export function categoryToStage(catId?: string | null): FunnelStageId {
  if (!catId) return "awareness";
  return (
    DEFAULT_FUNNEL_STAGES.find((st) => st.categories.includes(catId))?.id ?? "awareness"
  );
}

/** Effective stage for an idea: explicit funnel_stage overrides categoryToStage. */
export function getEffectiveStage(idea: {
  funnel_stage?: string | null;
  content_category?: string | null;
}): FunnelStageId {
  const v = idea.funnel_stage as FunnelStageId | null | undefined;
  if (v === "awareness" || v === "consideration" || v === "conversion" || v === "retention") return v;
  return categoryToStage(idea.content_category);
}
