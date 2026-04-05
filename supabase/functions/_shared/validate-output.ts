// Output schema validation for AI agent responses
// Validates structured JSON outputs from Copywriter, Creative Director, and other agents

/**
 * Validate Copywriter output structure.
 * Returns the validated object or null if invalid.
 */
export function validateCopyStructure(data: unknown): CopyStructure | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  // headline is required
  if (!d.headline || typeof d.headline !== "string" || d.headline.trim().length === 0) {
    return null;
  }

  return {
    headline: String(d.headline).trim(),
    subheadline: typeof d.subheadline === "string" ? d.subheadline.trim() : undefined,
    cta: typeof d.cta === "string" ? d.cta.trim() : undefined,
    supporting_text: typeof d.supporting_text === "string" ? d.supporting_text.trim() : undefined,
    emotional_tone: typeof d.emotional_tone === "string" ? d.emotional_tone.trim() : undefined,
    hook: typeof d.hook === "string" ? d.hook.trim() : undefined,
    post_type: typeof d.post_type === "string" ? d.post_type.trim() : undefined,
  };
}

export interface CopyStructure {
  headline: string;
  subheadline?: string;
  cta?: string;
  supporting_text?: string;
  emotional_tone?: string;
  hook?: string;
  post_type?: string;
}

// Valid enum values for genome fields
const VALID_ENUMS = {
  palette_type: ["monochrome", "complementary", "analogous", "split_complementary", "triadic"],
  temperature: ["warm", "neutral", "cool"],
  contrast: ["low", "medium", "high", "extreme"],
  saturation: ["muted", "balanced", "vibrant", "neon"],
  gradient_logic: ["flat", "soft_gradient", "metallic_gradient", "multi_spectrum"],
  font_personality: ["corporate", "friendly", "futuristic", "street", "editorial"],
  weight_system: ["light", "regular", "bold", "ultra_bold"],
  hierarchy_logic: ["strong_headline_dominance", "balanced_hierarchy", "text_minimal"],
  typography_layout: ["centered", "left_editorial", "split_text", "overlay"],
  text_effect: ["none", "outline", "drop_shadow", "gradient", "glitch", "neon"],
  grid_type: ["strict_grid", "modular_grid", "broken_grid", "freeform"],
  balance: ["symmetrical", "asymmetrical", "dynamic"],
  spacing_density: ["minimal", "balanced", "dense"],
  content_ratio: ["image_dominant", "text_dominant", "balanced"],
  visual_direction: ["vertical", "horizontal", "diagonal", "radial"],
  focal_strategy: ["single_focal_point", "dual_focal", "distributed"],
  layering_depth: ["flat", "medium", "deep_layered"],
  texture_type: ["none", "grain", "paper", "digital_noise", "plastic", "metallic"],
  intensity: ["subtle", "medium", "heavy"],
  distortion: ["none", "glitch", "warp", "pixel_sort"],
  style: ["none", "3d", "flat", "hand_drawn", "abstract", "cartoon", "clay"],
  detail_level: ["minimal", "medium", "high"],
  line_weight: ["thin", "medium", "bold"],
  lighting: ["natural", "dramatic", "neon", "soft"],
  color_grading: ["cinematic", "vintage", "vibrant", "monochrome"],
  framing: ["close_crop", "wide", "portrait"],
  emotion: ["energetic", "calm", "luxurious", "playful", "rebellious", "authoritative", "warm", "futuristic", "organic"],
} as const;

/**
 * Validate a Visual Style Genome object.
 * Fixes invalid enum values by replacing with defaults.
 * Returns the cleaned genome and a list of fixes applied.
 */
export function validateGenome(data: unknown): { genome: Record<string, any>; fixes: string[] } | null {
  if (!data || typeof data !== "object") return null;
  const genome = data as Record<string, any>;
  const fixes: string[] = [];

  // Required top-level categories
  const requiredCategories = ["color", "typography", "layout", "composition", "texture"];
  for (const cat of requiredCategories) {
    if (!genome[cat] || typeof genome[cat] !== "object") {
      return null; // Missing critical category — genome is unusable
    }
  }

  // Validate and fix enum fields
  const fieldMap: Record<string, Record<string, string>> = {
    color: { palette_type: "complementary", temperature: "neutral", contrast: "high", saturation: "balanced", gradient_logic: "flat" },
    typography: { font_personality: "corporate", weight_system: "bold", hierarchy_logic: "balanced_hierarchy", typography_layout: "centered", text_effect: "none" },
    layout: { grid_type: "modular_grid", balance: "asymmetrical", spacing_density: "balanced", content_ratio: "balanced" },
    composition: { visual_direction: "vertical", focal_strategy: "single_focal_point", layering_depth: "medium" },
    texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
    illustration: { style: "none", detail_level: "medium", line_weight: "medium" },
    image_style: { lighting: "natural", color_grading: "vibrant", framing: "wide" },
  };

  for (const [category, fields] of Object.entries(fieldMap)) {
    if (!genome[category]) continue;
    for (const [field, defaultValue] of Object.entries(fields)) {
      const currentValue = genome[category][field];
      const validValues = VALID_ENUMS[field as keyof typeof VALID_ENUMS];
      if (validValues && currentValue && !validValues.includes(currentValue as any)) {
        genome[category][field] = defaultValue;
        fixes.push(`${category}.${field}: "${currentValue}" → "${defaultValue}"`);
      }
    }
  }

  // Validate emotion (top-level)
  if (genome.emotion && !VALID_ENUMS.emotion.includes(genome.emotion)) {
    const old = genome.emotion;
    genome.emotion = "energetic";
    fixes.push(`emotion: "${old}" → "energetic"`);
  }

  return { genome, fixes };
}
