import type { VisualStyleGenome } from "./genomeTypes";

export interface GenomePreset {
  id: string;
  name: string;
  description: string;
  genome: VisualStyleGenome;
}

export const GENOME_PRESETS: GenomePreset[] = [
  {
    id: "minimalist-modern",
    name: "Minimalist Modern",
    description: "Clean lines, generous whitespace, refined simplicity",
    genome: {
      color: { palette_type: "monochrome", temperature: "neutral", contrast: "medium", saturation: "muted", gradient_logic: "flat" },
      typography: { font_personality: "corporate", weight_system: "light", hierarchy_logic: "text_minimal", typography_layout: "centered", text_effect: "none" },
      layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "minimal", content_ratio: "balanced" },
      composition: { visual_direction: "vertical", focal_strategy: "single_focal_point", layering_depth: "flat" },
      texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
      illustration: { style: "none", detail_level: "minimal", line_weight: "thin" },
      image_style: { lighting: "natural", color_grading: "monochrome", framing: "wide" },
      emotion: "calm",
    },
  },
  {
    id: "luxury-editorial",
    name: "Luxury Editorial",
    description: "Sophisticated magazine aesthetic, rich contrasts, editorial elegance",
    genome: {
      color: { palette_type: "complementary", temperature: "warm", contrast: "high", saturation: "balanced", gradient_logic: "metallic_gradient" },
      typography: { font_personality: "editorial", weight_system: "bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "left_editorial", text_effect: "none" },
      layout: { grid_type: "modular_grid", balance: "asymmetrical", spacing_density: "balanced", content_ratio: "image_dominant" },
      composition: { visual_direction: "diagonal", focal_strategy: "dual_focal", layering_depth: "deep_layered" },
      texture: { texture_type: "paper", intensity: "subtle", distortion: "none" },
      illustration: { style: "none", detail_level: "high", line_weight: "thin" },
      image_style: { lighting: "dramatic", color_grading: "cinematic", framing: "portrait" },
      emotion: "luxurious",
    },
  },
  {
    id: "streetwear-alte",
    name: "Streetwear Alté",
    description: "Bold urban culture, raw energy, rule-breaking aesthetics",
    genome: {
      color: { palette_type: "triadic", temperature: "warm", contrast: "extreme", saturation: "vibrant", gradient_logic: "flat" },
      typography: { font_personality: "street", weight_system: "ultra_bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "overlay", text_effect: "outline" },
      layout: { grid_type: "broken_grid", balance: "dynamic", spacing_density: "dense", content_ratio: "text_dominant" },
      composition: { visual_direction: "diagonal", focal_strategy: "distributed", layering_depth: "deep_layered" },
      texture: { texture_type: "grain", intensity: "heavy", distortion: "glitch" },
      illustration: { style: "abstract", detail_level: "medium", line_weight: "bold" },
      image_style: { lighting: "neon", color_grading: "vibrant", framing: "close_crop" },
      emotion: "rebellious",
    },
  },
  {
    id: "neo-brutalism",
    name: "Neo Brutalism",
    description: "High contrast, chunky elements, bold borders, raw digital energy",
    genome: {
      color: { palette_type: "complementary", temperature: "neutral", contrast: "extreme", saturation: "vibrant", gradient_logic: "flat" },
      typography: { font_personality: "street", weight_system: "ultra_bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "left_editorial", text_effect: "drop_shadow" },
      layout: { grid_type: "broken_grid", balance: "asymmetrical", spacing_density: "dense", content_ratio: "text_dominant" },
      composition: { visual_direction: "horizontal", focal_strategy: "single_focal_point", layering_depth: "medium" },
      texture: { texture_type: "grain", intensity: "medium", distortion: "none" },
      illustration: { style: "flat", detail_level: "minimal", line_weight: "bold" },
      image_style: { lighting: "dramatic", color_grading: "vibrant", framing: "wide" },
      emotion: "rebellious",
    },
  },
  {
    id: "retro-futurism",
    name: "Retro Futurism",
    description: "Vintage nostalgia meets sci-fi future, chrome and neon",
    genome: {
      color: { palette_type: "split_complementary", temperature: "cool", contrast: "high", saturation: "neon", gradient_logic: "multi_spectrum" },
      typography: { font_personality: "futuristic", weight_system: "bold", hierarchy_logic: "balanced_hierarchy", typography_layout: "centered", text_effect: "neon" },
      layout: { grid_type: "modular_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" },
      composition: { visual_direction: "radial", focal_strategy: "single_focal_point", layering_depth: "deep_layered" },
      texture: { texture_type: "metallic", intensity: "medium", distortion: "warp" },
      illustration: { style: "3d", detail_level: "high", line_weight: "medium" },
      image_style: { lighting: "neon", color_grading: "cinematic", framing: "wide" },
      emotion: "futuristic",
    },
  },
  {
    id: "organic-natural",
    name: "Organic Natural",
    description: "Earth tones, soft textures, botanical calm, mindful design",
    genome: {
      color: { palette_type: "analogous", temperature: "warm", contrast: "low", saturation: "muted", gradient_logic: "soft_gradient" },
      typography: { font_personality: "friendly", weight_system: "light", hierarchy_logic: "balanced_hierarchy", typography_layout: "centered", text_effect: "none" },
      layout: { grid_type: "freeform", balance: "symmetrical", spacing_density: "minimal", content_ratio: "image_dominant" },
      composition: { visual_direction: "vertical", focal_strategy: "single_focal_point", layering_depth: "medium" },
      texture: { texture_type: "paper", intensity: "subtle", distortion: "none" },
      illustration: { style: "hand_drawn", detail_level: "medium", line_weight: "thin" },
      image_style: { lighting: "natural", color_grading: "vintage", framing: "wide" },
      emotion: "organic",
    },
  },
  {
    id: "tech-futurism",
    name: "Tech Futurism",
    description: "Data-driven aesthetics, dark interfaces, precision engineering",
    genome: {
      color: { palette_type: "monochrome", temperature: "cool", contrast: "high", saturation: "balanced", gradient_logic: "soft_gradient" },
      typography: { font_personality: "futuristic", weight_system: "regular", hierarchy_logic: "text_minimal", typography_layout: "left_editorial", text_effect: "none" },
      layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" },
      composition: { visual_direction: "horizontal", focal_strategy: "distributed", layering_depth: "medium" },
      texture: { texture_type: "digital_noise", intensity: "subtle", distortion: "none" },
      illustration: { style: "3d", detail_level: "high", line_weight: "thin" },
      image_style: { lighting: "dramatic", color_grading: "cinematic", framing: "wide" },
      emotion: "futuristic",
    },
  },
  {
    id: "bold-startup",
    name: "Bold Startup",
    description: "Confident, vibrant, high-energy brand launch energy",
    genome: {
      color: { palette_type: "complementary", temperature: "warm", contrast: "high", saturation: "vibrant", gradient_logic: "soft_gradient" },
      typography: { font_personality: "friendly", weight_system: "bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "centered", text_effect: "none" },
      layout: { grid_type: "modular_grid", balance: "asymmetrical", spacing_density: "balanced", content_ratio: "balanced" },
      composition: { visual_direction: "diagonal", focal_strategy: "single_focal_point", layering_depth: "medium" },
      texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
      illustration: { style: "flat", detail_level: "medium", line_weight: "medium" },
      image_style: { lighting: "natural", color_grading: "vibrant", framing: "wide" },
      emotion: "energetic",
    },
  },
  {
    id: "corporate-clean",
    name: "Corporate Clean",
    description: "Professional, trustworthy, structured, enterprise-grade",
    genome: {
      color: { palette_type: "analogous", temperature: "cool", contrast: "medium", saturation: "balanced", gradient_logic: "flat" },
      typography: { font_personality: "corporate", weight_system: "regular", hierarchy_logic: "balanced_hierarchy", typography_layout: "left_editorial", text_effect: "none" },
      layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" },
      composition: { visual_direction: "horizontal", focal_strategy: "dual_focal", layering_depth: "flat" },
      texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
      illustration: { style: "none", detail_level: "minimal", line_weight: "thin" },
      image_style: { lighting: "soft", color_grading: "vibrant", framing: "wide" },
      emotion: "authoritative",
    },
  },
];

/** Maps existing Trend Lab preset IDs to genome overrides */
export const TREND_TO_GENOME_OVERRIDES: Record<string, Partial<{
  color: Partial<import("./genomeTypes").ColorGenome>;
  typography: Partial<import("./genomeTypes").TypographyGenome>;
  layout: Partial<import("./genomeTypes").LayoutGenome>;
  composition: Partial<import("./genomeTypes").CompositionGenome>;
  texture: Partial<import("./genomeTypes").TextureGenome>;
  illustration: Partial<import("./genomeTypes").IllustrationGenome>;
  image_style: Partial<import("./genomeTypes").ImageStyleGenome>;
  emotion: import("./genomeTypes").EmotionTone;
}>> = {
  "tactile-rebellion": {
    color: { saturation: "muted", temperature: "warm" },
    typography: { font_personality: "editorial", text_effect: "none" },
    layout: { grid_type: "freeform", balance: "dynamic" },
    texture: { texture_type: "paper", intensity: "heavy", distortion: "none" },
    image_style: { color_grading: "vintage" },
    emotion: "warm",
  },
  "hyper-chromatic": {
    color: { saturation: "neon", contrast: "extreme", gradient_logic: "multi_spectrum" },
    typography: { weight_system: "ultra_bold", text_effect: "neon" },
    texture: { texture_type: "digital_noise", intensity: "subtle" },
    image_style: { lighting: "neon", color_grading: "vibrant" },
    emotion: "energetic",
  },
  "technical-mono": {
    color: { saturation: "muted", temperature: "cool", contrast: "high" },
    typography: { font_personality: "futuristic", weight_system: "regular", hierarchy_logic: "text_minimal" },
    layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced" },
    texture: { texture_type: "digital_noise", intensity: "subtle" },
    image_style: { lighting: "dramatic", color_grading: "monochrome" },
    emotion: "futuristic",
  },
  "neo-naturalism": {
    color: { saturation: "muted", temperature: "warm", contrast: "low", gradient_logic: "soft_gradient" },
    typography: { font_personality: "friendly", weight_system: "light" },
    layout: { spacing_density: "minimal" },
    texture: { texture_type: "paper", intensity: "subtle" },
    image_style: { lighting: "natural", color_grading: "vintage" },
    emotion: "calm",
  },
  "kinetic-typography": {
    color: { contrast: "high" },
    typography: { weight_system: "ultra_bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "overlay" },
    layout: { grid_type: "broken_grid", balance: "dynamic" },
    composition: { visual_direction: "diagonal", layering_depth: "deep_layered" },
    texture: { texture_type: "none", distortion: "warp" },
    emotion: "energetic",
  },
};

export function getGenomePresetById(id: string): GenomePreset | undefined {
  return GENOME_PRESETS.find((p) => p.id === id);
}
