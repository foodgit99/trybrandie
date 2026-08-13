import { Heart, Layers, Sparkles, Target, Flag, Rocket, Gem, Compass, type LucideIcon } from "lucide-react";

/**
 * Funnel stage IDs are brand-owned strings. The four IDs below are the built-in
 * stages every brand starts with; users can rename, reorder, remap, remove them,
 * or add their own stages (which get slug IDs).
 */
export type FunnelStageId = string;

export const BUILTIN_STAGE_IDS = ["awareness", "consideration", "conversion", "retention"] as const;
export type BuiltinStageId = (typeof BUILTIN_STAGE_IDS)[number];

export type FunnelStageDef = {
  id: FunnelStageId;
  label: string;
  blurb: string;
  icon: LucideIcon;
  accent: string;
  categories: string[];
  /** Free-text creative direction for the renderer. Built-ins fall back to server defaults. */
  art_direction?: string;
  /** True when the stage was created by the user (not one of the four built-ins). */
  custom?: boolean;
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

/** Stored shape in brands.funnel_stages (JSONB array). Empty array = use defaults. */
export type BrandStageOverride = {
  id: FunnelStageId;
  label?: string;
  blurb?: string;
  categories?: string[];
  art_direction?: string;
  custom?: boolean;
};

/* -------------------- visuals for custom stages -------------------- */

const CUSTOM_ICONS: LucideIcon[] = [Flag, Rocket, Gem, Compass, Layers, Sparkles, Target, Heart];
const CUSTOM_ACCENTS = [
  "from-amber-500/20 to-amber-500/0 text-amber-700 dark:text-amber-300",
  "from-teal-500/20 to-teal-500/0 text-teal-700 dark:text-teal-300",
  "from-fuchsia-500/20 to-fuchsia-500/0 text-fuchsia-700 dark:text-fuchsia-300",
  "from-indigo-500/20 to-indigo-500/0 text-indigo-700 dark:text-indigo-300",
  "from-lime-500/20 to-lime-500/0 text-lime-700 dark:text-lime-300",
  "from-orange-500/20 to-orange-500/0 text-orange-700 dark:text-orange-300",
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic icon + accent so a custom stage always looks the same. */
export function customStageVisuals(id: string): { icon: LucideIcon; accent: string } {
  const h = hashSlug(id);
  return {
    icon: CUSTOM_ICONS[h % CUSTOM_ICONS.length],
    accent: CUSTOM_ACCENTS[h % CUSTOM_ACCENTS.length],
  };
}

/** Turn a user label into a stable, unique stage id. */
export function slugifyStageId(label: string, taken: string[] = []): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "stage";
  let id = base;
  let n = 2;
  while (taken.includes(id) || (BUILTIN_STAGE_IDS as readonly string[]).includes(id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

export function isBuiltinStage(id: string): boolean {
  return (BUILTIN_STAGE_IDS as readonly string[]).includes(id);
}

/* -------------------- resolution -------------------- */

/**
 * Resolve the brand's ordered stage list.
 * - Empty / invalid data → the built-in four.
 * - Stored list wins on order and membership; built-in IDs inherit default
 *   icon/accent/categories for any field the user didn't set.
 */
export function resolveBrandStages(overrides: unknown): FunnelStageDef[] {
  const arr = Array.isArray(overrides) ? (overrides as BrandStageOverride[]) : [];
  const valid = arr.filter((o) => o && typeof o.id === "string" && o.id.trim());
  if (valid.length === 0) return DEFAULT_FUNNEL_STAGES;

  const seen = new Set<string>();
  const out: FunnelStageDef[] = [];
  for (const o of valid) {
    const id = o.id.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    const def = DEFAULT_FUNNEL_STAGES.find((d) => d.id === id);
    const visuals = def
      ? { icon: def.icon, accent: def.accent }
      : customStageVisuals(id);
    const categories = Array.isArray(o.categories)
      ? o.categories.filter((c): c is string => typeof c === "string" && !!c)
      : def?.categories ?? [];
    out.push({
      id,
      label: o.label?.trim() || def?.label || id,
      blurb: o.blurb?.trim() || def?.blurb || "",
      icon: visuals.icon,
      accent: visuals.accent,
      categories,
      art_direction: o.art_direction?.trim() || undefined,
      custom: !def,
    });
  }
  return out.length > 0 ? out : DEFAULT_FUNNEL_STAGES;
}

/** Strip a resolved list back down to the storable JSON shape. */
export function toStoredStages(stages: FunnelStageDef[]): BrandStageOverride[] {
  return stages.map((s) => ({
    id: s.id,
    label: s.label,
    blurb: s.blurb,
    categories: s.categories,
    ...(s.art_direction ? { art_direction: s.art_direction } : {}),
    ...(s.custom ? { custom: true } : {}),
  }));
}

/** Derive stage from content_category using the brand's stage list. */
export function categoryToStage(
  catId?: string | null,
  stages: FunnelStageDef[] = DEFAULT_FUNNEL_STAGES,
): FunnelStageId {
  const list = stages.length ? stages : DEFAULT_FUNNEL_STAGES;
  if (!catId) return list[0].id;
  return list.find((st) => st.categories.includes(catId))?.id ?? list[0].id;
}

/**
 * Effective stage for an idea: an explicit funnel_stage wins, but only if that
 * stage still exists on the brand. Otherwise fall back to category mapping.
 */
export function getEffectiveStage(
  idea: { funnel_stage?: string | null; content_category?: string | null },
  stages: FunnelStageDef[] = DEFAULT_FUNNEL_STAGES,
): FunnelStageId {
  const list = stages.length ? stages : DEFAULT_FUNNEL_STAGES;
  const v = idea.funnel_stage;
  if (v && list.some((s) => s.id === v)) return v;
  return categoryToStage(idea.content_category, list);
}

/** Validate a stage id against the brand's stage list. */
export function normaliseStageId(
  v: unknown,
  stages: FunnelStageDef[] = DEFAULT_FUNNEL_STAGES,
): FunnelStageId | null {
  if (typeof v !== "string" || !v) return null;
  const list = stages.length ? stages : DEFAULT_FUNNEL_STAGES;
  return list.some((s) => s.id === v) ? v : null;
}

export function stageLabel(
  id: string | null | undefined,
  stages: FunnelStageDef[] = DEFAULT_FUNNEL_STAGES,
): string {
  if (!id) return "Unassigned";
  return stages.find((s) => s.id === id)?.label ?? id;
}
