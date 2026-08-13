// Visual Style Genome -> concrete art direction for the structured design engine.
//
// Two jobs:
//   1. Translate a genome (+ Brand Centre) into an explicit brief the Creative
//      Director must obey, so designs carry shapes, texture, depth and imagery
//      instead of bare type on a flat fill.
//   2. Deterministic beautification pass: if the returned document still has no
//      artwork and no decorative geometry, inject genome-consistent decor using
//      ONLY brand colours, always behind the copy.

export interface ArtGenome {
  color: {
    palette_type: string;
    temperature: string;
    contrast: string;
    saturation: string;
    gradient_logic: string;
  };
  typography: {
    font_personality: string;
    weight_system: string;
    hierarchy_logic: string;
    typography_layout: string;
    text_effect: string;
  };
  layout: { grid_type: string; balance: string; spacing_density: string; content_ratio: string };
  composition: { visual_direction: string; focal_strategy: string; layering_depth: string };
  texture: { texture_type: string; intensity: string; distortion: string };
  illustration?: { style: string; detail_level: string; line_weight: string };
  image_style?: { lighting: string; color_grading: string; framing: string };
  emotion: string;
}

const VIBE_EMOTION: Record<string, string> = {
  bold: "energetic",
  luxury: "luxurious",
  premium: "luxurious",
  playful: "playful",
  fun: "playful",
  minimal: "calm",
  clean: "calm",
  modern: "futuristic",
  tech: "futuristic",
  warm: "warm",
  natural: "organic",
  professional: "authoritative",
  corporate: "authoritative",
};

const TONE_PERSONALITY: Record<string, string> = {
  professional: "corporate",
  formal: "corporate",
  friendly: "friendly",
  conversational: "friendly",
  playful: "friendly",
  bold: "street",
  street: "street",
  witty: "street",
  luxurious: "editorial",
  elegant: "editorial",
  editorial: "editorial",
  futuristic: "futuristic",
  technical: "futuristic",
};

function pick<T>(map: Record<string, T>, key: unknown, fallback: T): T {
  const k = String(key || "").toLowerCase();
  for (const [needle, value] of Object.entries(map)) {
    if (k.includes(needle)) return value;
  }
  return fallback;
}

/**
 * Builds a usable genome: caller override first, then a deterministic genome
 * derived from the Brand Centre (vibe / tone / colour count).
 */
// deno-lint-ignore no-explicit-any
export function resolveGenome(brand: any, override?: any): ArtGenome {
  const emotion = pick(VIBE_EMOTION, brand?.vibe, "authoritative");
  const personality = pick(TONE_PERSONALITY, brand?.tone_of_voice, "corporate");
  const accents: string[] = Array.isArray(brand?.accent_colors) ? brand.accent_colors : [];

  const base: ArtGenome = {
    color: {
      palette_type: accents.length > 1 ? "complementary" : "analogous",
      temperature: emotion === "warm" || emotion === "organic" ? "warm" : "neutral",
      contrast: "high",
      saturation: emotion === "energetic" || emotion === "playful" ? "vibrant" : "balanced",
      gradient_logic: emotion === "futuristic" ? "metallic_gradient" : "soft_gradient",
    },
    typography: {
      font_personality: personality,
      weight_system: "bold",
      hierarchy_logic: "strong_headline_dominance",
      typography_layout: emotion === "luxurious" ? "centered" : "left_editorial",
      text_effect: "none",
    },
    layout: {
      grid_type: emotion === "playful" || emotion === "rebellious" ? "broken_grid" : "modular_grid",
      balance: "asymmetrical",
      spacing_density: emotion === "calm" || emotion === "luxurious" ? "minimal" : "balanced",
      content_ratio: "balanced",
    },
    composition: {
      visual_direction: "vertical",
      focal_strategy: "single_focal_point",
      layering_depth: emotion === "calm" ? "flat" : "medium",
    },
    texture: {
      texture_type: emotion === "organic" || emotion === "warm" ? "paper" : "grain",
      intensity: "subtle",
      distortion: "none",
    },
    illustration: { style: "none", detail_level: "medium", line_weight: "medium" },
    image_style: {
      lighting: emotion === "luxurious" ? "dramatic" : "natural",
      color_grading: emotion === "luxurious" ? "cinematic" : "vibrant",
      framing: "wide",
    },
    emotion,
  };

  if (!override || typeof override !== "object") return base;
  // Shallow-merge each category so a partial override still yields a full genome.
  const out: any = { ...base, emotion: override.emotion || base.emotion };
  for (const key of ["color", "typography", "layout", "composition", "texture", "illustration", "image_style"]) {
    out[key] = { ...(base as any)[key], ...(override[key] && typeof override[key] === "object" ? override[key] : {}) };
  }
  return out as ArtGenome;
}

const GRADIENT_NOTE: Record<string, string> = {
  flat: "Background stays a flat solid — carry depth with geometry instead.",
  soft_gradient: "Background is a soft two-stop gradient between brand colours.",
  metallic_gradient: "Background is a tight metallic gradient (deep base to a lighter tint of the same hue).",
  multi_spectrum: "Background is a bold multi-stop gradient across the brand palette.",
};

const DEPTH_NOTE: Record<string, string> = {
  flat: "one decorative shape, no overlaps",
  medium: "two or three layered decorative shapes with clear overlap",
  deep_layered: "three or four layered shapes plus an image, creating real foreground/background separation",
};

const TEXTURE_NOTE: Record<string, string> = {
  none: "clean surfaces, no texture",
  grain: "fine photographic grain across the artwork",
  paper: "soft paper / risograph texture",
  digital_noise: "subtle digital noise and scanline feel",
  plastic: "glossy plastic, soft specular highlights",
  metallic: "brushed metallic sheen",
};

/** The mandatory art-direction brief injected into the Creative Director call. */
export function genomeDirective(genome: ArtGenome, w: number, h: number): string {
  const g = genome;
  return `VISUAL STYLE GENOME (this is the design concept — obey every line, but only ever use Brand Centre colours):
- Emotion: ${g.emotion}. Palette: ${g.color.palette_type}, ${g.color.temperature}, ${g.color.saturation} saturation, ${g.color.contrast} contrast.
- ${GRADIENT_NOTE[g.color.gradient_logic] || GRADIENT_NOTE.soft_gradient}
- Typography: ${g.typography.font_personality} personality, ${g.typography.weight_system} weights, ${g.typography.hierarchy_logic.replace(/_/g, " ")}, ${g.typography.typography_layout.replace(/_/g, " ")} arrangement.
- Layout: ${g.layout.grid_type.replace(/_/g, " ")}, ${g.layout.balance}, ${g.layout.spacing_density} spacing, ${g.layout.content_ratio.replace(/_/g, " ")}.
- Composition: ${g.composition.visual_direction} flow, ${g.composition.focal_strategy.replace(/_/g, " ")}, depth = ${DEPTH_NOTE[g.composition.layering_depth] || DEPTH_NOTE.medium}.
- Surface: ${TEXTURE_NOTE[g.texture.texture_type] || TEXTURE_NOTE.grain} (${g.texture.intensity}).
- Imagery: ${g.image_style?.lighting || "natural"} lighting, ${g.image_style?.color_grading || "vibrant"} grade, ${g.image_style?.framing || "wide"} framing.${g.illustration && g.illustration.style !== "none" ? ` Illustration style: ${g.illustration.style}, ${g.illustration.detail_level} detail.` : ""}

NON-NEGOTIABLE RICHNESS RULES:
- A design made only of text on a flat fill is a FAILURE. Every design must carry visual craft.
- Include AT LEAST 3 non-text elements: shapes (rect/ellipse/line) used as colour blocks, scrims, accent bars, rules, badges or offset frames — plus imagery.
- Include IMAGERY: use a gallery/product asset key when one is available; otherwise emit an asset_request (bg_art for a full-bleed background, hero_art for a focal subject) matching the genome above. Never leave a design with zero imagery unless the genome texture is "none" AND the layout is type-led — in that case use bold colour blocking with at least 4 shapes.
- Decorative shapes must sit behind copy (lower z), use brand colours (tints/low opacity allowed), and must never reduce text legibility.
- Bleed at least one shape or image off a canvas edge for tension (still within 0,0 → ${w},${h} bounds after clamping).`;
}

/** Style suffix appended to every generated art prompt so assets match the genome. */
export function artStyleSuffix(genome: ArtGenome, brand: any): string {
  const colours = [
    ...(Array.isArray(brand?.primary_colors) ? brand.primary_colors.slice(0, 3) : []),
    ...(Array.isArray(brand?.accent_colors) ? brand.accent_colors.slice(0, 2) : []),
  ].filter(Boolean);
  return [
    `Art direction: ${genome.emotion} mood, ${genome.color.saturation} saturation, ${genome.color.contrast} contrast,`,
    `${genome.image_style?.lighting || "natural"} lighting, ${genome.image_style?.color_grading || "vibrant"} colour grade,`,
    `${genome.image_style?.framing || "wide"} framing, ${TEXTURE_NOTE[genome.texture.texture_type] || "fine grain"} (${genome.texture.intensity}).`,
    genome.illustration && genome.illustration.style !== "none"
      ? `Rendered as ${genome.illustration.style} illustration with ${genome.illustration.detail_level} detail.`
      : "",
    colours.length ? `Palette must stay within: ${colours.join(", ")}.` : "",
    "Keep composition uncluttered with calm negative space for typography.",
  ]
    .filter(Boolean)
    .join(" ");
}

// ------------------------------------------------------- beautification pass

function isDecorShape(e: any): boolean {
  return e?.type === "shape";
}

function hasImagery(schema: any): boolean {
  if (schema?.background?.type === "image" && schema.background.source) return true;
  return (schema?.elements || []).some((e: any) => e?.type === "image");
}

/**
 * Deterministic safety net: guarantees every design carries geometry and depth
 * even when the model returns a bare layout. Purely additive — existing
 * elements are never moved, and all injected colour comes from the brand.
 */
export function applyGenomeDecor(
  // deno-lint-ignore no-explicit-any
  schemaInput: any,
  genome: ArtGenome,
  // deno-lint-ignore no-explicit-any
  brand: any,
): { schema: any; injected: string[] } {
  const schema = schemaInput;
  const w = schema?.canvas?.width || 1080;
  const h = schema?.canvas?.height || 1080;
  const elements: any[] = Array.isArray(schema.elements) ? schema.elements : (schema.elements = []);
  const injected: string[] = [];

  const primary: string[] = Array.isArray(brand?.primary_colors) ? brand.primary_colors.filter(Boolean) : [];
  const accents: string[] = Array.isArray(brand?.accent_colors) ? brand.accent_colors.filter(Boolean) : [];
  const accent = accents[0] || primary[1] || primary[0] || "#C4993B";
  const secondary = accents[1] || primary[0] || accent;

  // Genome-driven background depth: never leave a flat fill when the genome asks
  // for gradient logic and the model ignored it.
  if (
    schema.background?.type === "solid" &&
    genome.color.gradient_logic !== "flat" &&
    primary.length + accents.length > 0
  ) {
    const from = schema.background.color || primary[0] || "#111111";
    const to = from.toLowerCase() === secondary.toLowerCase() ? accent : secondary;
    if (to && to.toLowerCase() !== from.toLowerCase()) {
      schema.background = { type: "gradient", color: from, color2: to, angle: 165 };
      injected.push("gradient background");
    }
  }

  const existingDecor = elements.filter(isDecorShape).length;
  const imagery = hasImagery(schema);
  const target = genome.composition.layering_depth === "flat" ? 2 : imagery ? 2 : 3;

  const minZ = Math.min(1, ...elements.map((e: any) => Number(e?.z) || 1));
  let z = Math.min(0, minZ - 1);
  const push = (el: any, note: string) => {
    elements.push({ z: z--, ...el });
    injected.push(note);
  };

  if (existingDecor < target) {
    // Soft focal glow bleeding off a corner — creates depth on any background.
    push(
      {
        id: `decor_glow_${elements.length + 1}`,
        type: "shape",
        role: "decor",
        shape: "ellipse",
        x: Math.round(w * 0.42),
        y: Math.round(h * 0.55),
        w: Math.round(w * 0.85),
        h: Math.round(h * 0.75),
        fill: accent,
        opacity: 0.16,
      },
      "accent glow",
    );

    if (existingDecor + 1 < target) {
      // Counter-weight block on the opposite corner, following genome balance.
      const diagonal = genome.composition.visual_direction === "diagonal";
      push(
        {
          id: `decor_block_${elements.length + 1}`,
          type: "shape",
          role: "decor",
          shape: diagonal ? "rect" : "ellipse",
          x: Math.round(-w * 0.18),
          y: Math.round(-h * 0.14),
          w: Math.round(w * 0.6),
          h: Math.round(h * 0.42),
          fill: secondary,
          opacity: 0.12,
          radius: diagonal ? Math.round(w * 0.06) : 0,
          rotation: diagonal ? -12 : 0,
        },
        "counter-weight block",
      );
    }

    if (existingDecor + 2 < target) {
      // Accent rule anchored to the headline (or the top margin as a fallback).
      const headline = elements.find((e: any) => e?.role === "headline" && e?.type === "text");
      const barY = headline ? Math.max(24, Math.round(headline.y - h * 0.035)) : Math.round(h * 0.12);
      const barX = headline ? Math.round(headline.x) : Math.round(w * 0.08);
      push(
        {
          id: `decor_rule_${elements.length + 1}`,
          type: "shape",
          role: "decor",
          shape: "rect",
          x: barX,
          y: barY,
          w: Math.round(w * 0.11),
          h: Math.max(8, Math.round(h * 0.011)),
          radius: 999,
          fill: accent,
          opacity: 1,
        },
        "accent rule",
      );
    }
  }

  // A structured grid genome reads as intentional with a hairline frame.
  if (
    ["strict_grid", "modular_grid"].includes(genome.layout.grid_type) &&
    !elements.some((e: any) => e?.id?.startsWith?.("decor_frame"))
  ) {
    const inset = Math.round(w * 0.045);
    push(
      {
        id: `decor_frame_${elements.length + 1}`,
        type: "shape",
        role: "decor",
        shape: "rect",
        x: inset,
        y: inset,
        w: w - inset * 2,
        h: h - inset * 2,
        fill: "none",
        stroke: accent,
        strokeWidth: 2,
        opacity: 0.35,
        radius: Math.round(w * 0.02),
      },
      "hairline frame",
    );
  }

  return { schema, injected };
}
