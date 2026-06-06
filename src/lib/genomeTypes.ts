// Visual Style Genome System (VSGS), Type Definitions

export type PaletteType = "monochrome" | "complementary" | "analogous" | "split_complementary" | "triadic";
export type ColorTemperature = "warm" | "neutral" | "cool";
export type ContrastLevel = "low" | "medium" | "high" | "extreme";
export type Saturation = "muted" | "balanced" | "vibrant" | "neon";
export type GradientLogic = "flat" | "soft_gradient" | "metallic_gradient" | "multi_spectrum";

export interface ColorGenome {
  palette_type: PaletteType;
  temperature: ColorTemperature;
  contrast: ContrastLevel;
  saturation: Saturation;
  gradient_logic: GradientLogic;
}

export type FontPersonality = "corporate" | "friendly" | "futuristic" | "street" | "editorial";
export type WeightSystem = "light" | "regular" | "bold" | "ultra_bold";
export type HierarchyLogic = "strong_headline_dominance" | "balanced_hierarchy" | "text_minimal";
export type TypographyLayout = "centered" | "left_editorial" | "split_text" | "overlay";
export type TextEffect = "none" | "outline" | "drop_shadow" | "gradient" | "glitch" | "neon";

export interface TypographyGenome {
  font_personality: FontPersonality;
  weight_system: WeightSystem;
  hierarchy_logic: HierarchyLogic;
  typography_layout: TypographyLayout;
  text_effect: TextEffect;
}

export type GridType = "strict_grid" | "modular_grid" | "broken_grid" | "freeform";
export type Balance = "symmetrical" | "asymmetrical" | "dynamic";
export type SpacingDensity = "minimal" | "balanced" | "dense";
export type ContentRatio = "image_dominant" | "text_dominant" | "balanced";

export interface LayoutGenome {
  grid_type: GridType;
  balance: Balance;
  spacing_density: SpacingDensity;
  content_ratio: ContentRatio;
}

export type VisualDirection = "vertical" | "horizontal" | "diagonal" | "radial";
export type FocalStrategy = "single_focal_point" | "dual_focal" | "distributed";
export type LayeringDepth = "flat" | "medium" | "deep_layered";

export interface CompositionGenome {
  visual_direction: VisualDirection;
  focal_strategy: FocalStrategy;
  layering_depth: LayeringDepth;
}

export type TextureType = "none" | "grain" | "paper" | "digital_noise" | "plastic" | "metallic";
export type TextureIntensity = "subtle" | "medium" | "heavy";
export type Distortion = "none" | "glitch" | "warp" | "pixel_sort";

export interface TextureGenome {
  texture_type: TextureType;
  intensity: TextureIntensity;
  distortion: Distortion;
}

export type IllustrationStyle = "none" | "3d" | "flat" | "hand_drawn" | "abstract" | "cartoon" | "clay";
export type DetailLevel = "minimal" | "medium" | "high";
export type LineWeight = "thin" | "medium" | "bold";

export interface IllustrationGenome {
  style: IllustrationStyle;
  detail_level: DetailLevel;
  line_weight: LineWeight;
}

export type Lighting = "natural" | "dramatic" | "neon" | "soft";
export type ColorGrading = "cinematic" | "vintage" | "vibrant" | "monochrome";
export type Framing = "close_crop" | "wide" | "portrait";

export interface ImageStyleGenome {
  lighting: Lighting;
  color_grading: ColorGrading;
  framing: Framing;
}

export type EmotionTone =
  | "energetic"
  | "calm"
  | "luxurious"
  | "playful"
  | "rebellious"
  | "authoritative"
  | "warm"
  | "futuristic"
  | "organic";

export interface VisualStyleGenome {
  color: ColorGenome;
  typography: TypographyGenome;
  layout: LayoutGenome;
  composition: CompositionGenome;
  texture: TextureGenome;
  illustration: IllustrationGenome;
  image_style: ImageStyleGenome;
  emotion: EmotionTone;
}

/** Gene locking classification */
export type GeneLockLevel = "locked" | "semi_flexible" | "free";

export interface GeneLockRules {
  color_primary: GeneLockLevel;
  color_palette: GeneLockLevel;
  typography_font: GeneLockLevel;
  typography_weight: GeneLockLevel;
  typography_effect: GeneLockLevel;
  layout: GeneLockLevel;
  composition: GeneLockLevel;
  texture: GeneLockLevel;
  illustration: GeneLockLevel;
  image_style: GeneLockLevel;
  emotion: GeneLockLevel;
}

export const DEFAULT_LOCK_RULES: GeneLockRules = {
  color_primary: "locked",
  color_palette: "semi_flexible",
  typography_font: "locked",
  typography_weight: "semi_flexible",
  typography_effect: "free",
  layout: "free",
  composition: "free",
  texture: "free",
  illustration: "free",
  image_style: "free",
  emotion: "semi_flexible",
};
