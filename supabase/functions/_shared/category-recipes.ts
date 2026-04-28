// CATEGORY RECIPES — single source of truth for per-category enrichment.
// Used by design-studio (rendering pipeline) and brand-engine (idea generation).
import { getUpcomingHolidays, getCurrentSeason } from "./holiday-calendar.ts";

//
// Each recipe enriches a content category across 5 dimensions:
//   1. brief_directive   — concrete art-direction spec
//   2. copy_directive    — concrete copy spec (length, tone, words to avoid)
//   3. caption_directive — emoji/hashtag/length policy
//   4. layout_recipe     — structured layout intent (merged into renderer prompt)
//   5. image_style       — medium/lighting/grading/framing + infographic flag
//   6. cta_policy        — required | optional | forbidden
//   7. genome_bias       — soft overrides for VSGS free/semi-flexible genes
//   8. needs_fresh_info  — whether to invoke research enrichment
//   9. research_focus    — what to look up
//
// IMPORTANT: All category IDs must match the keys used in design-studio CONTENT_CATEGORIES.

export type CtaPolicy = "required" | "optional" | "forbidden";

export interface LayoutRecipe {
  grid: "strict_grid" | "modular_grid" | "broken_grid" | "freeform";
  focal: "single_focal_point" | "dual_focal" | "distributed";
  hierarchy_ratio: "headline_dominant" | "balanced" | "cta_dominant" | "image_dominant";
  cta_position: "top" | "bottom" | "right" | "center" | "none";
  type_personality: "corporate" | "friendly" | "futuristic" | "street" | "editorial";
  palette_bias: "warm" | "cool" | "neutral" | "high_contrast" | "festive" | "muted";
  info_density: "minimal" | "balanced" | "dense";
}

export interface ImageStylePreset {
  medium: "photo" | "illustration" | "mixed" | "infographic" | "typography_only";
  lighting: "natural" | "dramatic" | "neon" | "soft" | "studio";
  color_grading: "cinematic" | "vintage" | "vibrant" | "monochrome" | "warm_festive";
  framing: "close_crop" | "wide" | "portrait" | "split";
  illustration_override: "none" | "flat" | "hand_drawn" | "schematic" | "meme" | "3d";
  infographic_mode: boolean; // if true, instruct renderer to use numbered blocks/icons/data viz
}

export interface GenomeBias {
  typography?: { font_personality?: string; hierarchy_logic?: string; weight_system?: string };
  layout?: { grid_type?: string; balance?: string; content_ratio?: string; spacing_density?: string };
  composition?: { focal_strategy?: string; visual_direction?: string };
  texture?: { texture_type?: string; intensity?: string };
  image_style?: { lighting?: string; color_grading?: string; framing?: string };
  emotion?: string;
}

export interface CategoryRecipe {
  id: string;
  name: string;
  brief_directive: string;
  copy_directive: string;
  caption_directive: string;
  layout_recipe: LayoutRecipe;
  image_style: ImageStylePreset;
  cta_policy: CtaPolicy;
  caption_cta_policy: CtaPolicy;
  genome_bias: GenomeBias;
  needs_fresh_info: boolean;
  research_focus?: string;
  // Words/phrases the copywriter should avoid for this category (enforced post-hoc).
  forbidden_copy_phrases?: string[];
}

export const CATEGORY_RECIPES: Record<string, CategoryRecipe> = {
  announcement: {
    id: "announcement",
    name: "Announcement",
    brief_directive:
      "ANNOUNCEMENT content. Hero element = the news itself. Use single dominant focal point with confident, declarative composition. Headline is the largest typographic element on the canvas (60–70% of vertical space). Convey newness through dynamic angles or bold framing. Visual hierarchy: headline > supporting visual > brand mark.",
    copy_directive:
      "ANNOUNCEMENT copy. 8–14 words total. Headline opens with declarative verb ('Introducing', 'Now Available', 'Just Launched', 'Meet'). Be specific about WHAT is new — never vague. Subheadline (optional) adds the why or when in 4–8 words. CTA optional — only if the user can act now.",
    caption_directive:
      "ANNOUNCEMENT caption. 2–3 sentences. Build hype, share what's new, invite engagement. 1 emoji max. 3–5 hashtags mixing brand + category.",
    layout_recipe: {
      grid: "strict_grid",
      focal: "single_focal_point",
      hierarchy_ratio: "headline_dominant",
      cta_position: "bottom",
      type_personality: "editorial",
      palette_bias: "high_contrast",
      info_density: "balanced",
    },
    image_style: {
      medium: "photo",
      lighting: "dramatic",
      color_grading: "cinematic",
      framing: "wide",
      illustration_override: "none",
      infographic_mode: false,
    },
    cta_policy: "optional",
    caption_cta_policy: "optional",
    genome_bias: {
      typography: { hierarchy_logic: "strong_headline_dominance", weight_system: "ultra_bold" },
      composition: { focal_strategy: "single_focal_point" },
      emotion: "energetic",
    },
    needs_fresh_info: false,
  },

  educational: {
    id: "educational",
    name: "Educational",
    brief_directive:
      "EDUCATIONAL content (status-builder). When the topic implies steps, lists, statistics, or 'how to', use INFOGRAPHIC composition: numbered/sectioned blocks, icons, data viz, or step-by-step visual hierarchy. Use a clean modular grid with clear sections. Visual authority through structured layout, generous whitespace, and consistent iconography. Avoid stock-photo cliches — use schematic illustration, diagrams, or minimal photography that supports the lesson.",
    copy_directive:
      "EDUCATIONAL copy. 12–20 words total. Headline promises specific value ('How to…', '5 ways to…', 'The X mistake everyone makes…'). Subheadline distils the takeaway. CTA optional and educational ('Save this', 'Read more', 'Try it'). Authority-building tone — never sales-y.",
    caption_directive:
      "EDUCATIONAL caption. 3–5 sentences. Expand on the insight, position the brand as authority, end with save/share invitation. 0–1 emoji. 4–7 hashtags including educational/niche tags.",
    layout_recipe: {
      grid: "modular_grid",
      focal: "distributed",
      hierarchy_ratio: "balanced",
      cta_position: "bottom",
      type_personality: "editorial",
      palette_bias: "neutral",
      info_density: "dense",
    },
    image_style: {
      medium: "infographic",
      lighting: "soft",
      color_grading: "vibrant",
      framing: "wide",
      illustration_override: "schematic",
      infographic_mode: true,
    },
    cta_policy: "optional",
    caption_cta_policy: "optional",
    genome_bias: {
      typography: { font_personality: "editorial", hierarchy_logic: "balanced_hierarchy" },
      layout: { grid_type: "modular_grid", content_ratio: "text_dominant", spacing_density: "balanced" },
      texture: { intensity: "subtle" },
      emotion: "authoritative",
    },
    needs_fresh_info: false,
    forbidden_copy_phrases: ["shop now", "buy now", "limited time", "% off"],
  },

  informational: {
    id: "informational",
    name: "Informational",
    brief_directive:
      "INFORMATIONAL content (utility, NOT persuasion). Pure clarity. Use INFOGRAPHIC composition for hours/locations/policies/menus/FAQs: clear sections, generous spacing, scannable hierarchy. Strict grid, text-dominant, minimal decoration. Typography is the hero — no busy backgrounds, no decorative imagery competing with the information. Treat the design as a public notice or signage system.",
    copy_directive:
      "INFORMATIONAL copy. 10–25 words depending on content. Be purely factual — hours, locations, dates, processes, policies. Zero persuasion language. Zero CTAs. Direct and complete. Structure as label → value pairs when applicable.",
    caption_directive:
      "INFORMATIONAL caption. 1–3 sentences. Factual additional details and where to go for more. 0 emoji. 0–2 hashtags max. Never sales language.",
    layout_recipe: {
      grid: "strict_grid",
      focal: "distributed",
      hierarchy_ratio: "balanced",
      cta_position: "none",
      type_personality: "corporate",
      palette_bias: "neutral",
      info_density: "dense",
    },
    image_style: {
      medium: "typography_only",
      lighting: "soft",
      color_grading: "monochrome",
      framing: "wide",
      illustration_override: "flat",
      infographic_mode: true,
    },
    cta_policy: "forbidden",
    caption_cta_policy: "forbidden",
    genome_bias: {
      typography: { font_personality: "corporate", hierarchy_logic: "balanced_hierarchy" },
      layout: { grid_type: "strict_grid", content_ratio: "text_dominant", spacing_density: "balanced" },
      composition: { focal_strategy: "distributed" },
      texture: { texture_type: "none", intensity: "subtle" },
      emotion: "calm",
    },
    needs_fresh_info: true,
    research_focus: "current operational details, dates, or factual specifics relevant to the user's prompt",
    forbidden_copy_phrases: ["shop now", "buy now", "learn more", "sign up", "limited time", "% off", "don't miss", "today only"],
  },

  entertainment: {
    id: "entertainment",
    name: "Entertainment",
    brief_directive:
      "ENTERTAINMENT content. MEME-LIKE, humorous, scroll-stopping. ZERO promotional undertone. The composition should feel like a meme — bold punchline as hero, unexpected visual juxtaposition, exaggerated framing or expression. Use playful broken-grid or freeform layout. High-saturation colours. Candid or absurd imagery. Type personality: street/friendly, often oversized. The viewer should laugh, smile, or feel seen — NOT feel pitched to.",
    copy_directive:
      "ENTERTAINMENT copy. 6–14 words total. Punchline-first writing. Witty, relatable, observational, or absurd. Conversational language, cultural references, internal monologues. NEVER use marketing words. NEVER use CTAs. Treat this like a tweet or meme caption that happens to be a graphic.",
    caption_directive:
      "ENTERTAINMENT caption. 1–2 sentences, conversational. 0–1 emoji. 0–2 hashtags max. Encourage tagging/sharing through humour, never through 'click', 'shop', or 'learn'. Sound like a friend posting, not a brand.",
    layout_recipe: {
      grid: "broken_grid",
      focal: "single_focal_point",
      hierarchy_ratio: "headline_dominant",
      cta_position: "none",
      type_personality: "street",
      palette_bias: "high_contrast",
      info_density: "minimal",
    },
    image_style: {
      medium: "mixed",
      lighting: "natural",
      color_grading: "vibrant",
      framing: "close_crop",
      illustration_override: "meme",
      infographic_mode: false,
    },
    cta_policy: "forbidden",
    caption_cta_policy: "forbidden",
    genome_bias: {
      typography: { font_personality: "street", weight_system: "ultra_bold" },
      layout: { grid_type: "broken_grid", balance: "dynamic" },
      composition: { focal_strategy: "single_focal_point", visual_direction: "diagonal" },
      emotion: "playful",
    },
    needs_fresh_info: true,
    research_focus: "currently viral meme formats, cultural moments, or jokes relevant to the brand's niche this week",
    forbidden_copy_phrases: [
      "shop now", "buy now", "order now", "learn more", "sign up", "subscribe",
      "limited time", "% off", "discount", "sale", "today only", "click", "get yours",
      "don't miss", "book now", "register", "download", "try it free",
    ],
  },

  promotional: {
    id: "promotional",
    name: "Promotional",
    brief_directive:
      "PROMOTIONAL content (direct ask). The CTA must be the most prominent button or visual element on the canvas. Dual focal: product/offer + CTA. High-contrast composition with strong colour blocking. Product or offer occupies the visual centre. Create urgency through bold colour and dynamic angles. Brand colours used at full saturation.",
    copy_directive:
      "PROMOTIONAL copy. 12–20 words total. Headline = the offer or value prop ('20% off everything', 'Free shipping today'). Subheadline = urgency or benefit. CTA is REQUIRED and specific ('Shop the sale', 'Get 20% off', 'Order today'). Every word should drive action.",
    caption_directive:
      "PROMOTIONAL caption. 2–4 sentences. Reinforce the offer, add urgency, clear CTA with link/code/deadline. 1–2 emoji. 4–6 hashtags including offer-related tags.",
    layout_recipe: {
      grid: "modular_grid",
      focal: "dual_focal",
      hierarchy_ratio: "cta_dominant",
      cta_position: "bottom",
      type_personality: "friendly",
      palette_bias: "warm",
      info_density: "balanced",
    },
    image_style: {
      medium: "photo",
      lighting: "studio",
      color_grading: "vibrant",
      framing: "close_crop",
      illustration_override: "none",
      infographic_mode: false,
    },
    cta_policy: "required",
    caption_cta_policy: "required",
    genome_bias: {
      typography: { hierarchy_logic: "strong_headline_dominance", weight_system: "bold" },
      layout: { content_ratio: "image_dominant", balance: "dynamic" },
      composition: { focal_strategy: "dual_focal" },
      image_style: { lighting: "dramatic", color_grading: "vibrant" },
      emotion: "energetic",
    },
    needs_fresh_info: false,
  },

  trending: {
    id: "trending",
    name: "Trending",
    brief_directive:
      "TRENDING content (algorithmic reach play). Format-aware design that mirrors what is currently performing on social platforms. Use the visual language of the moment — current colour trends, current typography fads, current composition patterns. Stay on-brand but lean into discoverable visual cues. The design should feel like it belongs in the For You / Explore feed today.",
    copy_directive:
      "TRENDING copy. 8–16 words total. Reference the current cultural moment naturally — never try-hard. Use language that signals 'we get it'. Headline hooks via novelty or relevance. CTA optional and soft.",
    caption_directive:
      "TRENDING caption. 2–3 sentences. Ride the trend, use trending hashtags, optimise for reach. 1–2 emoji. 5–8 hashtags including the trending ones.",
    layout_recipe: {
      grid: "broken_grid",
      focal: "single_focal_point",
      hierarchy_ratio: "balanced",
      cta_position: "bottom",
      type_personality: "street",
      palette_bias: "high_contrast",
      info_density: "balanced",
    },
    image_style: {
      medium: "mixed",
      lighting: "natural",
      color_grading: "vibrant",
      framing: "close_crop",
      illustration_override: "none",
      infographic_mode: false,
    },
    cta_policy: "optional",
    caption_cta_policy: "optional",
    genome_bias: {
      typography: { font_personality: "street" },
      layout: { balance: "dynamic" },
      emotion: "energetic",
    },
    needs_fresh_info: true,
    research_focus: "currently viral social media trends, formats, sounds, hashtags, and cultural moments this week relevant to the brand's industry",
  },

  holidays: {
    id: "holidays",
    name: "Holidays & Greetings",
    brief_directive:
      "HOLIDAYS & GREETINGS content. Warm, festive, celebratory composition. Use traditional/cultural visual motifs appropriate to the specific occasion (seasonal colours, festive elements, regional symbols). Centered or symmetrical layout that feels like a card. Soft, warm lighting. Brand stays present but the celebration leads. NOT a promotional moment unless explicitly combined with an offer.",
    copy_directive:
      "HOLIDAYS copy. 6–14 words total. Lead with the greeting itself ('Happy Eid', 'Merry Christmas', 'Season's Greetings'). Heartfelt, inclusive, brand-warm. NEVER salesy. NO CTA unless the user explicitly combines with a promo. Mention the specific occasion by name.",
    caption_directive:
      "HOLIDAYS caption. 2–3 sentences. Warm and celebratory, connect brand to the moment, foster community. 1–2 emoji aligned with the holiday. 3–5 hashtags. NO sales language.",
    layout_recipe: {
      grid: "strict_grid",
      focal: "single_focal_point",
      hierarchy_ratio: "headline_dominant",
      cta_position: "none",
      type_personality: "editorial",
      palette_bias: "festive",
      info_density: "minimal",
    },
    image_style: {
      medium: "photo",
      lighting: "soft",
      color_grading: "warm_festive",
      framing: "wide",
      illustration_override: "none",
      infographic_mode: false,
    },
    cta_policy: "forbidden",
    caption_cta_policy: "forbidden",
    genome_bias: {
      composition: { focal_strategy: "single_focal_point" },
      image_style: { lighting: "soft", color_grading: "warm_festive" as any },
      texture: { texture_type: "paper", intensity: "subtle" },
      emotion: "warm",
    },
    needs_fresh_info: true,
    research_focus: "today's or this week's relevant holidays, observances, or cultural moments — including regional ones — and the traditional motifs/colours associated with them",
    forbidden_copy_phrases: ["shop now", "buy now", "limited time", "% off", "sale", "discount", "today only", "don't miss"],
  },

  social_proof: {
    id: "social_proof",
    name: "Social Proof",
    brief_directive:
      "SOCIAL PROOF content (affiliation play). Quote or testimonial as the visual hero. Single focal point on the customer voice. Authentic visual cues — quote marks, real photos when available, subtle star ratings, attribution. Clean composition with the testimonial occupying 60% of vertical space. Avoid stock-photo feel — this should read as REAL.",
    copy_directive:
      "SOCIAL PROOF copy. 12–22 words total. Headline = a verbatim quote or punchy customer-voice statement. Subheadline = attribution (name, role, or context). Optional CTA soft and trust-oriented ('See more reviews', 'Join them').",
    caption_directive:
      "SOCIAL PROOF caption. 2–3 sentences. Reinforce trust, share the customer story briefly, invite others to share theirs. 0–1 emoji. 3–5 hashtags.",
    layout_recipe: {
      grid: "strict_grid",
      focal: "single_focal_point",
      hierarchy_ratio: "headline_dominant",
      cta_position: "bottom",
      type_personality: "editorial",
      palette_bias: "neutral",
      info_density: "balanced",
    },
    image_style: {
      medium: "photo",
      lighting: "natural",
      color_grading: "cinematic",
      framing: "portrait",
      illustration_override: "none",
      infographic_mode: false,
    },
    cta_policy: "optional",
    caption_cta_policy: "optional",
    genome_bias: {
      typography: { font_personality: "editorial", hierarchy_logic: "strong_headline_dominance" },
      composition: { focal_strategy: "single_focal_point" },
      emotion: "authoritative",
    },
    needs_fresh_info: false,
  },

  behind_the_scenes: {
    id: "behind_the_scenes",
    name: "Behind-the-Scenes",
    brief_directive:
      "BEHIND-THE-SCENES content. Authentic, raw, candid. The composition should feel UN-staged — natural framing, real environments, real people, real process. Image-dominant with low text density. Avoid corporate polish; embrace warmth and humanity. Soft natural lighting. Off-centre framing. Documentary feel.",
    copy_directive:
      "BTS copy. 6–14 words total. Casual, conversational, first-person when natural. Share the human side ('How we made this…', 'Meet the team', 'A day in our studio'). NEVER salesy. NO CTA by default.",
    caption_directive:
      "BTS caption. 3–4 sentences, personal and storytelling. Share an authentic anecdote. 1–2 emoji. 3–5 hashtags including team/process tags.",
    layout_recipe: {
      grid: "freeform",
      focal: "single_focal_point",
      hierarchy_ratio: "image_dominant",
      cta_position: "none",
      type_personality: "friendly",
      palette_bias: "warm",
      info_density: "minimal",
    },
    image_style: {
      medium: "photo",
      lighting: "natural",
      color_grading: "vintage",
      framing: "close_crop",
      illustration_override: "none",
      infographic_mode: false,
    },
    cta_policy: "forbidden",
    caption_cta_policy: "optional",
    genome_bias: {
      typography: { font_personality: "friendly", weight_system: "regular" },
      layout: { grid_type: "freeform", balance: "asymmetrical", content_ratio: "image_dominant" },
      image_style: { lighting: "natural", framing: "close_crop" },
      emotion: "warm",
    },
    needs_fresh_info: false,
    forbidden_copy_phrases: ["shop now", "buy now", "limited time", "% off", "sale", "discount"],
  },

  interactive: {
    id: "interactive",
    name: "Interactive / Engagement",
    brief_directive:
      "INTERACTIVE content (conversation starter). Design for participation. For polls/this-or-that, use SPLIT layout with two clear visual choices. For questions, use a bold question-mark visual or open canvas inviting reply. Layout must make participation feel obvious and easy. Bright, playful colours. Clear visual call to interact (vs/ choice arrows, question hierarchy).",
    copy_directive:
      "INTERACTIVE copy. 8–18 words total. Frame everything as a question or choice ('This or that?', 'Which would you pick?', 'Tell us…'). The headline IS the question. CTA required but conversational ('Vote below', 'Comment your answer', 'Tell us'). Make replying feel effortless.",
    caption_directive:
      "INTERACTIVE caption. 2–3 sentences. Restate the question, make it easy to reply in comments. 1–2 emoji. 3–5 hashtags.",
    layout_recipe: {
      grid: "modular_grid",
      focal: "dual_focal",
      hierarchy_ratio: "balanced",
      cta_position: "bottom",
      type_personality: "friendly",
      palette_bias: "high_contrast",
      info_density: "balanced",
    },
    image_style: {
      medium: "infographic",
      lighting: "soft",
      color_grading: "vibrant",
      framing: "split",
      illustration_override: "flat",
      infographic_mode: true,
    },
    cta_policy: "required",
    caption_cta_policy: "required",
    genome_bias: {
      typography: { font_personality: "friendly", hierarchy_logic: "balanced_hierarchy" },
      layout: { grid_type: "modular_grid", balance: "symmetrical" },
      composition: { focal_strategy: "dual_focal" },
      emotion: "playful",
    },
    needs_fresh_info: false,
  },
};

// --- HELPER: Apply category-bias soft overrides to a genome ---
// Only mutates free / semi-flexible genes per VSGS lock rules.
// Locked genes (brand colour primary, brand font) are never touched.
const SEMI_FLEX_OR_FREE_GENES: Record<string, Set<string>> = {
  typography: new Set(["weight_system", "hierarchy_logic", "typography_layout", "text_effect", "font_personality"]), // font_personality is "locked" globally but biasable
  layout: new Set(["grid_type", "balance", "spacing_density", "content_ratio"]),
  composition: new Set(["focal_strategy", "visual_direction", "layering_depth"]),
  texture: new Set(["texture_type", "intensity", "distortion"]),
  illustration: new Set(["style", "detail_level", "line_weight"]),
  image_style: new Set(["lighting", "color_grading", "framing"]),
};

export function applyCategoryBias(
  // deno-lint-ignore no-explicit-any
  genome: any,
  categoryId: string,
  // Probability that each biased gene is actually applied (soft mutation)
  applyChance = 0.7,
  // If true, treat font_personality as locked and skip it (default: false — typography font_personality
  // is documented as "locked" but for category-bias we allow override since it's stylistic, not brand identity).
  respectFontLock = false,
  // deno-lint-ignore no-explicit-any
): any {
  const recipe = CATEGORY_RECIPES[categoryId];
  if (!recipe || !genome || !recipe.genome_bias) return genome;

  const bias = recipe.genome_bias;
  let appliedCount = 0;

  for (const [section, fields] of Object.entries(bias)) {
    if (section === "emotion") {
      if (typeof fields === "string" && Math.random() < applyChance) {
        genome.emotion = fields;
        appliedCount++;
      }
      continue;
    }
    if (typeof fields !== "object" || !fields) continue;
    if (!genome[section]) continue;
    const allowedFields = SEMI_FLEX_OR_FREE_GENES[section];
    if (!allowedFields) continue;

    for (const [field, value] of Object.entries(fields as Record<string, string>)) {
      if (!allowedFields.has(field)) continue;
      if (respectFontLock && section === "typography" && field === "font_personality") continue;
      if (Math.random() < applyChance) {
        genome[section][field] = value;
        appliedCount++;
      }
    }
  }

  if (appliedCount > 0) {
    genome._category_bias_applied = appliedCount;
  }
  return genome;
}

// --- HELPER: Compute Category Fit Score (0-100) ---
// Measures how well the genome aligns with the category's preferred genes.
export function computeCategoryFit(
  // deno-lint-ignore no-explicit-any
  genome: any,
  categoryId: string,
): number {
  const recipe = CATEGORY_RECIPES[categoryId];
  if (!recipe || !genome) return 70;

  const bias = recipe.genome_bias;
  let total = 0;
  let matched = 0;

  for (const [section, fields] of Object.entries(bias)) {
    if (section === "emotion") {
      total++;
      if (genome.emotion === fields) matched++;
      continue;
    }
    if (typeof fields !== "object" || !fields) continue;
    if (!genome[section]) continue;
    for (const [field, value] of Object.entries(fields as Record<string, string>)) {
      total++;
      if (genome[section][field] === value) matched++;
    }
  }

  if (total === 0) return 75;
  return Math.round(40 + (matched / total) * 60);
}

// --- HELPER: Build the category-specific render injection block ---
// Appended to the image prompt AFTER brand colours/fonts (brand always wins),
// BEFORE trend overlay. Returns empty string for unknown categories.
export function buildCategoryRenderInjection(categoryId: string): string {
  const recipe = CATEGORY_RECIPES[categoryId];
  if (!recipe) return "";

  const lr = recipe.layout_recipe;
  const img = recipe.image_style;
  const ctaLine =
    recipe.cta_policy === "forbidden"
      ? " Do NOT include any CTA button, action prompt, or transactional language anywhere in this design."
      : recipe.cta_policy === "required"
      ? " The CTA element must be visually prominent and unmistakable."
      : "";

  const infographicLine = img.infographic_mode
    ? ` INFOGRAPHIC MODE: Render content as structured visual information — use numbered or sectioned blocks, icons, simple data visualisations, or step-by-step layout where appropriate. Prioritise clarity and scannability over decorative imagery.`
    : "";

  const mediumLine =
    img.medium === "typography_only"
      ? " Use a TYPOGRAPHY-LED design — minimal or no photography, let the text and layout carry the design."
      : img.medium === "infographic"
      ? " Use INFOGRAPHIC composition — structured blocks, icons, and supporting graphics rather than a single hero photo."
      : img.medium === "illustration"
      ? " Use ILLUSTRATION rather than photography for the primary visual."
      : img.medium === "mixed"
      ? " Mix photography with graphic/illustrative elements for a playful, layered feel."
      : ` Use real photography (${img.lighting} lighting, ${img.color_grading.replace(/_/g, " ")} grading, ${img.framing.replace(/_/g, " ")} framing).`;

  const memeLine =
    img.illustration_override === "meme"
      ? " The visual energy should feel meme-like — exaggerated, witty, scroll-stopping. Treat it like a high-end meme, not an ad."
      : img.illustration_override === "schematic"
      ? " Use schematic/diagrammatic illustration style — clean lines, clear icons, infographic feel."
      : "";

  const layoutLine = ` Layout intent: ${lr.grid.replace(/_/g, " ")} grid, ${lr.focal.replace(/_/g, " ")}, ${lr.hierarchy_ratio.replace(/_/g, " ")} hierarchy, ${lr.info_density} information density. CTA position: ${lr.cta_position}. Type personality: ${lr.type_personality}.`;

  return `\n\nCATEGORY ART DIRECTION (${recipe.name}): ${recipe.brief_directive}${layoutLine}${mediumLine}${memeLine}${infographicLine}${ctaLine}`;
}

// --- HELPER: Enforce CTA policy on copy structure ---
// Strips CTA-style language for "forbidden" categories, ensures CTA exists for "required".
const CTA_PATTERNS = [
  /\bshop now\b/gi, /\bbuy now\b/gi, /\border now\b/gi, /\blearn more\b/gi,
  /\bsign up\b/gi, /\bsubscribe\b/gi, /\bget yours\b/gi, /\bbook now\b/gi,
  /\bregister\b/gi, /\bdownload\b/gi, /\btry it free\b/gi, /\bclick here\b/gi,
  /\bdon'?t miss\b/gi, /\btoday only\b/gi,
];

export function enforceCTAPolicy(
  copy: { headline: string; subheadline: string; cta: string; supporting_text: string } | null,
  categoryId: string,
): { headline: string; subheadline: string; cta: string; supporting_text: string } | null {
  if (!copy) return copy;
  const recipe = CATEGORY_RECIPES[categoryId];
  if (!recipe) return copy;

  const out = { ...copy };

  if (recipe.cta_policy === "forbidden") {
    out.cta = "";
    // Strip CTA-flavoured phrases from headline/subheadline/supporting_text
    for (const field of ["headline", "subheadline", "supporting_text"] as const) {
      let v = out[field] || "";
      for (const pattern of CTA_PATTERNS) {
        v = v.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
      }
      // Apply category-specific forbidden phrases
      if (recipe.forbidden_copy_phrases) {
        for (const phrase of recipe.forbidden_copy_phrases) {
          const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
          v = v.replace(re, "").replace(/\s{2,}/g, " ").trim();
        }
      }
      // Clean up trailing punctuation / dangling words
      v = v.replace(/[,;:.\-—–]\s*$/g, "").trim();
      out[field] = v;
    }
  } else if (recipe.cta_policy === "required" && (!out.cta || out.cta.trim().length === 0)) {
    // Inject a sensible default CTA based on category
    const defaults: Record<string, string> = {
      promotional: "Shop now",
      interactive: "Tell us below",
    };
    out.cta = defaults[categoryId] || "Learn more";
  }

  return out;
}

// --- HELPER: Build a copy directive supplement that lists forbidden phrases ---
export function buildCopyForbiddenContext(categoryId: string): string {
  const recipe = CATEGORY_RECIPES[categoryId];
  if (!recipe?.forbidden_copy_phrases?.length) return "";
  const phrases = recipe.forbidden_copy_phrases.map((p) => `"${p}"`).join(", ");
  return `\n\nFORBIDDEN PHRASES for this category — DO NOT use any of: ${phrases}.`;
}

// --- HELPER: Research enrichment via Firecrawl Search (degrades gracefully) ---
// Uses Firecrawl's /v2/search endpoint with time-bound `tbs` filter to pull current
// web context for time-sensitive categories (trending, entertainment, holidays, etc.).
// Returns 3-5 bullet-style snippets distilled from result titles + descriptions.
//
// CACHING: two-layer cache keyed by (categoryId, query_hash):
//   1. In-memory Map (warm function instance) — instant, free.
//   2. Postgres `research_cache` table (cross-instance) — survives cold starts.
// TTL matches the category's recency window so cache freshness can never exceed
// what the underlying search filter would have returned anyway.

export type ResearchMode = "fast" | "accurate";
export type ResearchRecency = "24h" | "7d" | "30d";

export interface ResearchOverride {
  mode?: ResearchMode;        // fast = fewer results, lower latency; accurate = more results
  recency?: ResearchRecency;  // overrides category default `tbs` window
  enabled?: boolean;          // false disables research even for fresh-info categories
}

export interface BrandResearchContext {
  brandName?: string;
  industry?: string;
  vibeKeywords?: string[];          // e.g. ["bold", "playful", "minimal"]
  toneOfVoice?: string;             // e.g. "warm and witty"
  audienceDescriptor?: string;      // short JTBD persona summary
  postType?: string;                // resolved category name (human label)
  platform?: string;                // e.g. "Instagram", "TikTok"
  region?: string;                  // for location-relevant searches
  override?: ResearchOverride;      // per-brand, per-category research tuning
}

const RECENCY_TO_TBS: Record<ResearchRecency, string> = {
  "24h": "qdr:d",
  "7d":  "qdr:w",
  "30d": "qdr:m",
};

const RECENCY_TO_TTL_MS: Record<ResearchRecency, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d":  7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

// Optional persistent cache adapter — pass an admin Supabase client to enable.
// Kept as a loose type so this shared file doesn't pull a Supabase import.
export interface ResearchCacheClient {
  from: (table: string) => any;
}

// Cache TTLs per category (ms). Aligned with Firecrawl `tbs` recency filters.
const CACHE_TTL_MS: Record<string, number> = {
  trending: 6 * 60 * 60 * 1000,         // 6h — viral cycles move fast
  entertainment: 24 * 60 * 60 * 1000,   // 24h
  holidays: 24 * 60 * 60 * 1000,        // 24h
  informational: 7 * 24 * 60 * 60 * 1000, // 7d
  interactive: 24 * 60 * 60 * 1000,     // 24h
};
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// Structured representation of a single research result surfaced to the UI.
export interface ResearchSource {
  title: string;
  url: string;
  description: string;
}

export interface ResearchEnrichment {
  promptText: string;            // text injected into agent system prompts
  sources: ResearchSource[];     // structured list for UI display
  query?: string;                // the query Firecrawl was asked
  categoryId?: string;
}

// In-memory cache (per warm function instance).
const memCache = new Map<string, { payload: ResearchEnrichment; expiresAt: number }>();
const MEM_CACHE_MAX = 200;

const EMPTY_ENRICHMENT: ResearchEnrichment = { promptText: "", sources: [] };

// Tiny stable hash (FNV-1a 32-bit, hex). Sufficient for cache keys (collision-resistant
// enough for our scale; not cryptographic).
function hashQuery(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE HEURISTIC FALLBACK
// Used whenever live web research is unavailable (no API key, network/HTTP
// error, 0 results, or exception). Synthesizes plausible grounding context
// from the category recipe + calendar + brand signals so generation NEVER
// stalls waiting on Firecrawl.
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildOfflineHeuristic(
  categoryId: string,
  recipe: CategoryRecipe,
  ctx: BrandResearchContext,
  reason: string,
): ResearchEnrichment {
  const now = new Date();
  const monthName = MONTHS[now.getMonth()];
  const season = getCurrentSeason();
  const brand = ctx.brandName || "the brand";
  const industry = ctx.industry ? ` in ${ctx.industry}` : "";
  const audience = ctx.audienceDescriptor ? ` for ${ctx.audienceDescriptor}` : "";
  const vibe = (ctx.vibeKeywords || []).filter(Boolean).slice(0, 3).join(", ");

  const lines: string[] = [];

  switch (categoryId) {
    case "holidays": {
      const upcoming = getUpcomingHolidays(21).slice(0, 5);
      if (upcoming.length > 0) {
        for (const h of upcoming) {
          const when = h.daysUntil === 0
            ? "today"
            : h.daysUntil === 1
            ? "tomorrow"
            : `in ${h.daysUntil} days`;
          lines.push(`- ${h.name} — ${when} (${h.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })})${h.description ? ` — ${h.description}` : ""}`);
        }
      } else {
        lines.push(`- No major holidays in the next 3 weeks — lean into ${season} seasonal themes for ${brand}${industry}.`);
      }
      break;
    }
    case "trending": {
      lines.push(`- It is currently ${monthName} (${season}) — anchor visuals to what feels current right now${industry}.`);
      lines.push(`- Use bold, attention-grabbing composition typical of viral ${ctx.platform || "social"} content${audience}.`);
      if (vibe) lines.push(`- Stay in the brand vibe: ${vibe} — avoid generic stock-trend looks.`);
      lines.push(`- Lead with motion, big type, or a single arresting subject — trending posts reward instant comprehension.`);
      break;
    }
    case "entertainment": {
      lines.push(`- ${monthName} entertainment cadence: pop-culture references work best when relatable and timely${audience}.`);
      lines.push(`- Use playful, conversational tone — memes and humour outperform polished corporate copy in this category.`);
      if (vibe) lines.push(`- Keep the brand vibe (${vibe}) recognisable even in a meme-format post.`);
      lines.push(`- Avoid copyrighted character likenesses; build on universal cultural moments instead.`);
      break;
    }
    case "informational": {
      lines.push(`- Evergreen ${recipe.name.toLowerCase()} content${industry} performs best with clear data points or 3–5 numbered takeaways.`);
      lines.push(`- Lean on widely-accepted best practices for ${brand}'s space rather than time-sensitive claims.`);
      if (audience) lines.push(`- Frame insights specifically${audience} — concrete > abstract.`);
      lines.push(`- Use infographic structure: one big number + supporting label, or a short list with icons.`);
      break;
    }
    case "interactive": {
      lines.push(`- Interactive prompts (polls, this-or-that, fill-in-the-blank) work year-round — pick one format and make it visually obvious.`);
      lines.push(`- Frame the question around ${brand}${industry} so engagement also reinforces brand association.`);
      if (audience) lines.push(`- Tailor the question to a real decision${audience} actually faces.`);
      break;
    }
    default: {
      lines.push(`- Anchor the design in ${brand}'s established visual identity${industry}.`);
      lines.push(`- It is currently ${monthName} (${season}) — let seasonal context inform palette and mood subtly.`);
      if (vibe) lines.push(`- Brand vibe to honour: ${vibe}.`);
    }
  }

  const promptText =
    `\n\nFALLBACK RESEARCH CONTEXT (live web search unavailable: ${reason} — using offline heuristics tuned to brand "${brand}" / ${recipe.name}, ${monthName} ${now.getFullYear()}, ${season}). Treat these as grounded defaults, NOT verbatim claims:\n` +
    lines.join("\n");

  return {
    promptText,
    sources: [], // explicitly empty — UI panel hides, signaling "no live sources"
    query: undefined,
    categoryId,
  };
}

// Backward-compatible signature: 3rd arg may be either the api key string (legacy)
// or a BrandResearchContext object containing the api key + brand signals.
// 5th arg (optional) enables the persistent cache.
export async function enrichWithResearch(
  categoryId: string,
  userPrompt: string,
  brandCtxOrName: BrandResearchContext | string | undefined,
  firecrawlApiKey: string | undefined,
  cacheClient?: ResearchCacheClient,
): Promise<ResearchEnrichment> {
  const recipe = CATEGORY_RECIPES[categoryId];
  if (!recipe?.needs_fresh_info || !recipe.research_focus) return EMPTY_ENRICHMENT;

  const ctx: BrandResearchContext =
    typeof brandCtxOrName === "string" || brandCtxOrName === undefined
      ? { brandName: typeof brandCtxOrName === "string" ? brandCtxOrName : undefined }
      : brandCtxOrName;

  const override = ctx.override || {};
  if (override.enabled === false) {
    // User explicitly disabled research for this category — respect that, no fallback.
    console.log(`[research] disabled by brand override for category=${categoryId}`);
    return EMPTY_ENRICHMENT;
  }

  if (!firecrawlApiKey) {
    console.log(`[research] no FIRECRAWL_API_KEY — using offline heuristic for category=${categoryId}`);
    return buildOfflineHeuristic(categoryId, recipe, ctx, "no API key configured");
  }

  // Resolve recency: brand override > category default
  const recencyMap: Record<string, string> = {
    trending: "qdr:d",
    entertainment: "qdr:w",
    holidays: "qdr:w",
    informational: "qdr:m",
    interactive: "qdr:w",
  };
  const tbs = override.recency ? RECENCY_TO_TBS[override.recency] : (recencyMap[categoryId] || "qdr:w");
  const ttlMs = override.recency ? RECENCY_TO_TTL_MS[override.recency] : (CACHE_TTL_MS[categoryId] || DEFAULT_TTL_MS);

  // Resolve aggressiveness: fast = fewer results / shorter snippets, accurate = more results
  const mode: ResearchMode = override.mode || "fast";
  const searchLimit = mode === "accurate" ? 8 : 3;

  const vibe = (ctx.vibeKeywords || []).slice(0, 3).filter(Boolean).join(", ");
  const postTypeLabel = ctx.postType || recipe.name;
  const platformLabel = ctx.platform || "social media";

  const queryBits = [
    recipe.research_focus,
    `for a ${postTypeLabel.toLowerCase()} ${platformLabel.toLowerCase()} post`,
    ctx.brandName ? `brand: "${ctx.brandName}"` : "",
    ctx.industry ? `industry: ${ctx.industry}` : "",
    vibe ? `brand vibe: ${vibe}` : "",
    ctx.toneOfVoice ? `tone: ${ctx.toneOfVoice}` : "",
    ctx.audienceDescriptor ? `audience: ${ctx.audienceDescriptor}` : "",
    ctx.region ? `region: ${ctx.region}` : "",
    userPrompt ? `topic: ${userPrompt}` : "",
  ].filter(Boolean);

  const query = queryBits.join(" — ").slice(0, 380);

  const dayBucket = Math.floor(Date.now() / ttlMs);
  const cacheKey = `${categoryId}:${mode}:${tbs}:${hashQuery(query)}:${dayBucket}`;

  // --- LAYER 1: In-memory cache ---
  const memHit = memCache.get(cacheKey);
  if (memHit && memHit.expiresAt > Date.now()) {
    console.log(`[research] CACHE HIT (mem) category=${categoryId}`);
    return memHit.payload;
  }
  if (memHit) memCache.delete(cacheKey);

  // --- LAYER 2: Postgres cache ---
  if (cacheClient) {
    try {
      const { data: row } = await cacheClient
        .from("research_cache")
        .select("result, expires_at")
        .eq("category_id", categoryId)
        .eq("query_hash", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (row?.result) {
        console.log(`[research] CACHE HIT (db) category=${categoryId}`);
        // result column may be a stringified ResearchEnrichment (new) or a plain
        // prompt string (legacy entries). Normalize either shape.
        let payload: ResearchEnrichment;
        try {
          const parsed = typeof row.result === "string" ? JSON.parse(row.result) : row.result;
          if (parsed && typeof parsed === "object" && "promptText" in parsed) {
            payload = parsed as ResearchEnrichment;
          } else {
            payload = { promptText: String(row.result), sources: [], query, categoryId };
          }
        } catch {
          payload = { promptText: String(row.result), sources: [], query, categoryId };
        }
        memCache.set(cacheKey, {
          payload,
          expiresAt: new Date(row.expires_at).getTime(),
        });
        cacheClient
          .from("research_cache")
          .update({ hit_count: (row as any).hit_count ? (row as any).hit_count + 1 : 1 })
          .eq("category_id", categoryId)
          .eq("query_hash", cacheKey)
          .then(() => {}, () => {});
        return payload;
      }
    } catch (e) {
      console.log(`[research] db cache lookup failed:`, e instanceof Error ? e.message : e);
    }
  }

  // --- MISS: Call Firecrawl ---
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: searchLimit,
        tbs,
        ...(ctx.region ? { country: ctx.region.slice(0, 2).toLowerCase() } : {}),
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[research] firecrawl returned ${response.status} for category=${categoryId} — falling back to offline heuristic`);
      return buildOfflineHeuristic(categoryId, recipe, ctx, `firecrawl HTTP ${response.status}`);
    }
    const data = await response.json();

    const results: Array<{ title?: string; description?: string; url?: string }> =
      (Array.isArray(data?.data) ? data.data : null) ||
      (Array.isArray(data?.web) ? data.web : null) ||
      (Array.isArray(data?.data?.web) ? data.data.web : null) ||
      [];

    if (results.length === 0) {
      console.log(`[research] firecrawl returned 0 results for category=${categoryId} query="${query.slice(0, 120)}" — falling back to offline heuristic`);
      return buildOfflineHeuristic(categoryId, recipe, ctx, "no live results");
    }

    const sources: ResearchSource[] = results
      .slice(0, searchLimit)
      .map((r) => ({
        title: (r.title || "").trim().slice(0, 140),
        url: (r.url || "").trim(),
        description: (r.description || "").trim().slice(0, 220),
      }))
      .filter((s) => (s.title || s.description) && s.url);

    if (sources.length === 0) {
      console.log(`[research] firecrawl results all unusable for category=${categoryId} — falling back to offline heuristic`);
      return buildOfflineHeuristic(categoryId, recipe, ctx, "live results lacked usable URLs");
    }

    const bullets = sources
      .map((s) => `- ${s.title}${s.title && s.description ? " — " : ""}${s.description}`.slice(0, 280))
      .join("\n");

    const promptText = `\n\nCURRENT RESEARCH CONTEXT (live web search, ${tbs}, tuned to brand "${ctx.brandName || "n/a"}" / ${postTypeLabel} — use to ground copy and visuals in what is true/relevant right now):\n${bullets}`;

    const payload: ResearchEnrichment = { promptText, sources, query, categoryId };

    const expiresAt = Date.now() + ttlMs;

    if (memCache.size >= MEM_CACHE_MAX) {
      const firstKey = memCache.keys().next().value;
      if (firstKey) memCache.delete(firstKey);
    }
    memCache.set(cacheKey, { payload, expiresAt });

    if (cacheClient) {
      cacheClient
        .from("research_cache")
        .upsert(
          {
            category_id: categoryId,
            query_hash: cacheKey,
            query_preview: query.slice(0, 200),
            result: JSON.stringify(payload),
            expires_at: new Date(expiresAt).toISOString(),
            hit_count: 0,
          },
          { onConflict: "category_id,query_hash" },
        )
        .then(() => {}, (e: unknown) => {
          console.log(`[research] db cache write failed:`, e instanceof Error ? e.message : e);
        });
    }

    console.log(`[research] CACHE MISS — fetched category=${categoryId} via firecrawl with ${sources.length} results (brand=${ctx.brandName || "n/a"})`);
    return payload;
  } catch (e) {
    console.log(`[research] firecrawl failed for category=${categoryId}:`, e instanceof Error ? e.message : e);
    return EMPTY_ENRICHMENT;
  }
}
