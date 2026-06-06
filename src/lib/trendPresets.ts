export interface TrendPreset {
  id: string;
  name: string;
  description: string;
  visual_characteristics: string;
  typography_style: string;
  color_profile: string;
  texture_elements: string;
  copy_tone_hint: string;
}

export const TREND_PRESETS: TrendPreset[] = [
  {
    id: "tactile-rebellion",
    name: "Tactile Rebellion",
    description: "Paper textures, hand-drawn marks, grain overlays, scrapbook feel",
    visual_characteristics: "Paper textures, grain overlays, hand-drawn marks, imperfect alignment, scrapbook-style collage layouts, torn edges, stamp effects",
    typography_style: "Handwritten or rough serif fonts, irregular baselines, ink-stamp lettering, slightly rotated text blocks",
    color_profile: "Muted earth tones layered with the brand palette, cream/kraft paper backgrounds, ink-wash colour effects",
    texture_elements: "Heavy grain, paper fibre texture, ink splatter, tape/sticker overlays, pencil scribbles",
    copy_tone_hint: "More expressive and human - use imperfect, authentic, conversational language",
  },
  {
    id: "hyper-chromatic",
    name: "Hyper Chromatic",
    description: "Vibrant colour contrasts, neon accents, bold gradients, energetic layouts",
    visual_characteristics: "Extremely vibrant colour contrasts, neon accents, bold gradients, energetic compositions, light leak effects, prismatic colour splits",
    typography_style: "Heavy bold sans-serif, oversized display type, colour-filled text, glow effects on headlines",
    color_profile: "Saturated neon accents blended with brand colours, vivid gradients, high-contrast complementary pairings",
    texture_elements: "Light leaks, chromatic aberration, glass refraction, holographic sheen, subtle noise on gradients",
    copy_tone_hint: "High-energy promotional language - bold, punchy, exclamatory, confident",
  },
  {
    id: "technical-mono",
    name: "Technical Mono",
    description: "Monospaced typography, clean grids, industrial aesthetic, futuristic UI",
    visual_characteristics: "Monospaced typography, clean grid structures, industrial aesthetic, futuristic UI elements, data-visualization motifs, blueprint feel",
    typography_style: "Monospaced fonts for all text, fixed-width grid alignment, code-editor aesthetic, minimal font-weight variation",
    color_profile: "Desaturated palette with single brand-colour accent, dark backgrounds, terminal-green or cyan highlights",
    texture_elements: "Dot grids, scan lines, subtle noise, circuit-board patterns, thin rule lines",
    copy_tone_hint: "Shorter and sharper copy - precise, technical, no-nonsense, data-driven",
  },
  {
    id: "neo-naturalism",
    name: "Neo Naturalism",
    description: "Calm palettes, organic textures, nature-inspired imagery, breathable spacing",
    visual_characteristics: "Calm colour palettes, organic textures, nature-inspired imagery, generous breathing space, soft rounded shapes, botanical motifs",
    typography_style: "Elegant thin serifs or rounded sans-serif, generous letter-spacing, light font weights, organic flow",
    color_profile: "Soft greens, warm terracottas, sky blues blended with brand palette, low saturation, natural harmony",
    texture_elements: "Watercolour washes, linen textures, leaf shadows, soft bokeh, natural light effects",
    copy_tone_hint: "Calm and soothing tone - gentle, reassuring, mindful, nurturing",
  },
  {
    id: "kinetic-typography",
    name: "Kinetic Typography",
    description: "Motion-oriented layouts, elastic typography, strong hierarchy, energetic composition",
    visual_characteristics: "Motion-oriented layouts, elastic typography, strong visual hierarchy, energetic diagonal compositions, speed lines, dynamic angles",
    typography_style: "Elastic/stretched display fonts, extreme size contrasts, slanted baselines, overlapping text layers, variable font weight animation feel",
    color_profile: "High-contrast brand colours with motion blur accents, speed gradients, directional colour transitions",
    texture_elements: "Motion blur streaks, speed lines, dynamic shadows, perspective distortion, wind effects",
    copy_tone_hint: "Energetic and dynamic - action-oriented verbs, short punchy phrases, momentum-building",
  },
];

export function getTrendById(id: string): TrendPreset | undefined {
  return TREND_PRESETS.find((t) => t.id === id);
}
