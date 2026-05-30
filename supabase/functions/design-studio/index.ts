import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { getSeasonalContextString } from "../_shared/holiday-calendar.ts";
import { sanitise } from "../_shared/sanitise.ts";
import { Tracer } from "../_shared/tracer.ts";
import { withTimeout, TIMEOUTS, TimeoutError } from "../_shared/timeout.ts";
import { isCircuitOpen, recordSuccess, recordFailure } from "../_shared/circuit-breaker.ts";
import { callWithFallback, MODEL_CHAINS } from "../_shared/model-fallback.ts";
import { validateCopyStructure, validateGenome } from "../_shared/validate-output.ts";
import { fetchRecentUpdates, formatUpdatesForPrompt, summariseForClient, markUpdatesUsed } from "../_shared/brand-updates.ts";
import {
  CATEGORY_RECIPES,
  applyCategoryBias,
  computeCategoryFit,
  buildCategoryRenderInjection,
  enforceCTAPolicy,
  buildCopyForbiddenContext,
  enrichWithResearch,
} from "../_shared/category-recipes.ts";

// --- PLATFORM CANVAS PRESETS ---
// Strict pixel dimensions per social platform. The renderer is forced to
// output EXACTLY these dimensions via center-crop + resize (see enforceCanvasDimensions).
const CANVAS_PRESETS: Record<string, { w: number; h: number; label: string; platform: string }> = {
  // Instagram
  "1080x1080":     { w: 1080, h: 1080, label: "Instagram square post",        platform: "Instagram" },
  "1080x1350":     { w: 1080, h: 1350, label: "Instagram portrait post",      platform: "Instagram" },
  "1080x1920":     { w: 1080, h: 1920, label: "Instagram story / reel",       platform: "Instagram" },
  // Facebook
  "1200x630":      { w: 1200, h: 630,  label: "Facebook feed post",           platform: "Facebook" },
  "fb-1080x1920":  { w: 1080, h: 1920, label: "Facebook story",               platform: "Facebook" },
  "1640x924":      { w: 1640, h: 924,  label: "Facebook cover",               platform: "Facebook" },
  // TikTok
  "tt-1080x1920":  { w: 1080, h: 1920, label: "TikTok vertical",              platform: "TikTok" },
  // LinkedIn
  "1200x627":      { w: 1200, h: 627,  label: "LinkedIn post",                platform: "LinkedIn" },
  "1584x396":      { w: 1584, h: 396,  label: "LinkedIn cover banner",        platform: "LinkedIn" },
  // YouTube / Twitter
  "1920x1080":     { w: 1920, h: 1080, label: "YouTube / landscape",          platform: "YouTube" },
  "1600x900":      { w: 1600, h: 900,  label: "Twitter / X post",             platform: "Twitter / X" },
  // Pinterest
  "1000x1500":     { w: 1000, h: 1500, label: "Pinterest pin",                platform: "Pinterest" },
};

function resolveCanvas(size: string | undefined | null) {
  const key = size || "1080x1080";
  const preset = CANVAS_PRESETS[key];
  if (preset) return { key, ...preset };
  // Fallback: parse "WxH" if anything unexpected is sent.
  const m = /^(\d+)x(\d+)$/.exec(key);
  if (m) {
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    return { key, w, h, label: `${w}x${h}`, platform: "Custom" };
  }
  return { key: "1080x1080", w: 1080, h: 1080, label: "Instagram square post", platform: "Instagram" };
}

function describeAspect(w: number, h: number): string {
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.02) return "perfectly SQUARE (1:1)";
  if (ratio > 1.05) return `WIDE LANDSCAPE (${w}:${h}, aspect ratio ${(ratio).toFixed(2)}:1)`;
  return `TALL PORTRAIT (${w}:${h}, aspect ratio 1:${(1 / ratio).toFixed(2)})`;
}

function buildCanvasFormatBrief(w: number, h: number, label: string): string {
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.02) {
    return `\n\nCANVAS FORMAT: SQUARE (${w}×${h} — ${label}). Plan a centered, compact, symmetrical composition. All elements balanced around the center. Avoid wide horizontal layouts — keep content compact and vertically centered.`;
  }
  if (ratio > 1.05) {
    return `\n\nCANVAS FORMAT: WIDE LANDSCAPE (${w}×${h} — ${label}, aspect ratio ${ratio.toFixed(2)}:1). Plan a horizontally spread composition. Content can span the full width. Use horizontal balance and side-by-side element placement. Do NOT design for a square or portrait canvas.`;
  }
  return `\n\nCANVAS FORMAT: TALL PORTRAIT (${w}×${h} — ${label}, aspect ratio 1:${(1 / ratio).toFixed(2)}). Plan a vertically stacked composition with elements flowing top-to-bottom. Use strong vertical hierarchy. Avoid wide horizontal spreads — stack elements vertically.`;
}

function buildCanvasFormatCopy(w: number, h: number): string {
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.02) {
    return "\n\nCANVAS FORMAT: SQUARE (1:1). Keep copy SHORT and COMPACT — fewer text elements, tight word count. Prefer a strong headline with minimal supporting text.";
  }
  if (ratio > 1.05) {
    return "\n\nCANVAS FORMAT: LANDSCAPE. You have HORIZONTAL space. Copy can be slightly more expansive. Side-by-side text elements work well. Keep good horizontal balance.";
  }
  return "\n\nCANVAS FORMAT: PORTRAIT. Copy should follow a VERTICAL HIERARCHY — headline at top, supporting text in middle, CTA at bottom. Stacked text blocks work well, but keep each block concise.";
}

function buildDimensionEnforcement(w: number, h: number, label: string): string {
  const ratio = w / h;
  const aspectLabel = describeAspect(w, h);
  let safeZoneRule: string;
  if (Math.abs(ratio - 1) < 0.05) {
    // Square / near-square
    safeZoneRule = `Compose every element so nothing important sits within 4% of any edge.`;
  } else if (ratio >= 3 || ratio <= 1 / 3) {
    // Ultra-wide banner or ultra-tall — most extreme case (e.g. LinkedIn cover 4:1)
    safeZoneRule = `EXTREME ASPECT RATIO. ALL critical text, the logo, and the focal subject MUST sit within the central 70% along the long axis and the central 80% along the short axis. Headlines must be sized to fully fit on a single line within those bounds — do NOT let any glyph extend past 12% from the left or right edges. Compose for the FULL ${w}×${h} canvas, not for a square.`;
  } else if (ratio >= 2 || ratio <= 0.5) {
    // Strong wide/tall (e.g. 16:9, 2:3, 9:16 stories handled here too)
    safeZoneRule = `Keep all critical text and the logo at least 8% inset from the long-axis edges and 12% inset from the short-axis edges. Compose for the FULL ${w}×${h} canvas, not for a square that would be cropped.`;
  } else {
    safeZoneRule = `Keep critical text and the logo at least 6% inset from every edge. Compose for the FULL ${w}×${h} canvas.`;
  }
  return `CRITICAL DIMENSION REQUIREMENT: This image MUST be EXACTLY ${w}×${h} pixels — ${aspectLabel} — designed for a ${label}. ${safeZoneRule} Do NOT design for a square and assume it will be re-cropped — the model output IS the final canvas.`;
}

// Map a target (w, h) to the closest aspect ratio supported by Gemini's
// image preview model. Defaults to "1:1" when unsure.
function mapToGeminiAspectRatio(w: number, h: number): string {
  const supported: { label: string; ratio: number }[] = [
    { label: "1:1",  ratio: 1 / 1 },
    { label: "4:5",  ratio: 4 / 5 },
    { label: "3:4",  ratio: 3 / 4 },
    { label: "2:3",  ratio: 2 / 3 },
    { label: "9:16", ratio: 9 / 16 },
    { label: "4:3",  ratio: 4 / 3 },
    { label: "3:2",  ratio: 3 / 2 },
    { label: "16:9", ratio: 16 / 9 },
    { label: "21:9", ratio: 21 / 9 },
  ];
  const target = w / h;
  let best = supported[0];
  let bestDelta = Math.abs(Math.log(target / best.ratio));
  for (const s of supported) {
    const delta = Math.abs(Math.log(target / s.ratio));
    if (delta < bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  return best.label;
}

// --- STRICT CANVAS ENFORCEMENT (post-render) ---
// 1) If the source already matches the target aspect (~2%), just resize.
// 2) If the source is close to the target (within ~30% ratio mismatch),
//    scale-to-FIT inside the target canvas and pad with a sampled background
//    color so NO design elements get cropped away.
// 3) Only as a last-resort fallback for wildly-off ratios do we center-crop.
async function enforceCanvasDimensions(
  inputBytes: Uint8Array,
  targetW: number,
  targetH: number,
): Promise<Uint8Array> {
  try {
    const img = await Image.decode(inputBytes);
    const srcW = img.width;
    const srcH = img.height;

    if (srcW === targetW && srcH === targetH) return inputBytes;

    const targetRatio = targetW / targetH;
    const srcRatio = srcW / srcH;
    const ratioDelta = Math.abs(Math.log(srcRatio / targetRatio));

    // Case 1: aspect ratios already match (<= ~2% off). Pure resize — but
    // never upscale (upscaling softens the image). If source is already at or
    // above the target resolution, keep native resolution to preserve quality.
    if (ratioDelta < 0.02) {
      if (srcW >= targetW && srcH >= targetH) {
        return inputBytes;
      }
      const resized = img.resize(targetW, targetH);
      return await resized.encode();
    }

    // Case 3: wildly off (>~35%) — fall back to center-crop to avoid huge bars.
    // log(1.42) ≈ 0.35 → roughly 42% ratio mismatch.
    if (ratioDelta > 0.35) {
      let cropW = srcW;
      let cropH = srcH;
      if (srcRatio > targetRatio) cropW = Math.round(srcH * targetRatio);
      else cropH = Math.round(srcW / targetRatio);
      const cropX = Math.floor((srcW - cropW) / 2);
      const cropY = Math.floor((srcH - cropH) / 2);
      const cropped = img.crop(cropX, cropY, cropW, cropH);
      // Only downscale to target — never upscale beyond cropped resolution.
      if (cropW <= targetW && cropH <= targetH) {
        return await cropped.encode();
      }
      const resized = cropped.resize(targetW, targetH);
      return await resized.encode();
    }

    // Case 2: scale-to-fit + pad. Sample average of edge pixels to pick a
    // background color that blends with the image (fall back to neutral grey).
    let scaledW: number;
    let scaledH: number;
    if (srcRatio > targetRatio) {
      // Source wider → fit to width.
      scaledW = targetW;
      scaledH = Math.max(1, Math.round(targetW / srcRatio));
    } else {
      scaledH = targetH;
      scaledW = Math.max(1, Math.round(targetH * srcRatio));
    }
    const scaled = img.resize(scaledW, scaledH);

    // Sample 4 corners + 4 mid-edge pixels for the pad color.
    // imagescript uses 1-indexed pixel coordinates and packed 0xRRGGBBAA ints.
    const samplePoints: Array<[number, number]> = [
      [1, 1], [srcW, 1], [1, srcH], [srcW, srcH],
      [Math.max(1, Math.floor(srcW / 2)), 1],
      [Math.max(1, Math.floor(srcW / 2)), srcH],
      [1, Math.max(1, Math.floor(srcH / 2))],
      [srcW, Math.max(1, Math.floor(srcH / 2))],
    ];
    let r = 0, g = 0, b = 0;
    for (const [x, y] of samplePoints) {
      const packed = img.getPixelAt(x, y); // 0xRRGGBBAA
      r += (packed >>> 24) & 0xff;
      g += (packed >>> 16) & 0xff;
      b += (packed >>> 8) & 0xff;
    }
    const n = samplePoints.length;
    const avgR = Math.round(r / n);
    const avgG = Math.round(g / n);
    const avgB = Math.round(b / n);
    const padColor = (((avgR & 0xff) << 24) | ((avgG & 0xff) << 16) | ((avgB & 0xff) << 8) | 0xff) >>> 0;

    const canvas = new Image(targetW, targetH);
    canvas.fill(padColor);
    const dx = Math.floor((targetW - scaledW) / 2);
    const dy = Math.floor((targetH - scaledH) / 2);
    canvas.composite(scaled, dx, dy);
    return await canvas.encode();
  } catch (err) {
    console.error("enforceCanvasDimensions failed, returning original bytes:", err);
    return inputBytes;
  }
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- RETRY HELPER (exponential backoff for transient failures) ---
async function retryFetch(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Don't retry on 429/402 (rate limit / payment) — these are intentional
      if (response.ok || response.status === 429 || response.status === 402) {
        return response;
      }
      // Retry only on server errors
      if ([500, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s
        console.log(`retryFetch: attempt ${attempt + 1} failed with ${response.status}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response; // Non-retryable error, return as-is
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`retryFetch: attempt ${attempt + 1} threw error, retrying in ${delay}ms...`, e);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error("retryFetch: all attempts failed");
}

// --- GPT-IMAGE-2 RENDERER ---
// gpt-image-2 uses /v1/images/generations (NOT chat completions). Text-only prompt
// (no reference images), supports sizes 1024x1024 / 1024x1536 / 1536x1024.
// Returns raw base64 (no data: prefix). enforceCanvasDimensions handles final
// crop/resize to exact target dims afterward.
function mapToGptImageSize(w: number, h: number): "1024x1024" | "1024x1536" | "1536x1024" {
  const ratio = w / h;
  if (ratio > 1.15) return "1536x1024";
  if (ratio < 0.87) return "1024x1536";
  return "1024x1024";
}

async function renderWithGptImage(prompt: string, w: number, h: number): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const size = mapToGptImageSize(w, h);
  // quality: "low" — keeps render well under the 150s edge function idle limit.
  // "high" routinely exceeded 150s (especially for multi-slide carousels) and
  // caused IDLE_TIMEOUT 504s. enforceCanvasDimensions still upscales/crops to
  // the final target size afterward.
  const body = JSON.stringify({
    model: "openai/gpt-image-2",
    prompt,
    size,
    quality: "low",
    n: 1,
  });

  const callOnce = () => retryFetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body,
  });

  let resp = await callOnce();
  if (!resp.ok) {
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    const errText = await resp.text();
    console.error("gpt-image-2 error:", resp.status, errText);
    throw new Error("Failed to generate image");
  }
  let data = await resp.json();
  let b64: string | undefined = data?.data?.[0]?.b64_json;
  if (!b64) {
    console.log("gpt-image-2: no image in response, retrying once...");
    await new Promise(r => setTimeout(r, 1500));
    resp = await callOnce();
    if (resp.ok) {
      data = await resp.json();
      b64 = data?.data?.[0]?.b64_json;
    }
  }
  if (!b64) throw new Error("No image generated");
  return b64;
}

// --- CONTENT CATEGORIES ---
// CONTENT_CATEGORIES is now derived from the shared CATEGORY_RECIPES module.
// This adapter preserves the existing { name, brief_directive, copy_directive, caption_directive }
// shape used throughout this file while sourcing the enriched directives from the recipes.
const CONTENT_CATEGORIES: Record<string, {
  name: string;
  brief_directive: string;
  copy_directive: string;
  caption_directive: string;
}> = Object.fromEntries(
  Object.entries(CATEGORY_RECIPES).map(([id, r]) => [
    id,
    {
      name: r.name,
      brief_directive: r.brief_directive,
      copy_directive: r.copy_directive,
      caption_directive: r.caption_directive,
    },
  ]),
);

// --- CONTENT CATEGORY CLASSIFIER (deterministic-first, LLM fallback) ---
function classifyCategoryByRules(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  // Announcement
  if (/\b(launch|launching|introducing|announce|announcing|new feature|just dropped|now available|coming soon|grand opening|unveil|reveal)\b/i.test(lower)) return "announcement";
  // Educational
  if (/\b(tips?|how to|guide|learn|tutorial|steps?|hack|lesson|explained|101|did you know|myth|fact)\b/i.test(lower)) return "educational";
  // Informational
  if (/\b(hours|schedule|address|location|policy|faq|contact|directions|pricing list|menu|opening times|return policy|delivery)\b/i.test(lower)) return "informational";
  // Entertainment
  if (/\b(meme|funny|relatable|humor|humour|joke|lol|😂|mood|vibe check|sarcas)/i.test(lower)) return "entertainment";
  // Promotional
  if (/\b(sale|discount|offer|promo|deal|buy|shop|order|% off|\bfree\b|limited time|flash sale|coupon|code|checkout|price drop|clearance)\b/i.test(lower)) return "promotional";
  // Trending
  if (/\b(trending|viral|trend|challenge|bandwagon|cultural moment)\b/i.test(lower)) return "trending";
  // Holidays & Greetings
  if (/\b(happy|merry|eid|christmas|easter|diwali|new year|valentine|mother'?s day|father'?s day|independence|thanksgiving|ramadan|birthday|anniversary|celebration|festive|holiday|season'?s greetings|workers day|labour day|democracy day|women'?s day)\b/i.test(lower)) return "holidays";
  // Social Proof / UGC
  if (/\b(testimonial|review|customer said|feedback|case study|success story|user generated|ugc|social proof|rating|star|recommend)\b/i.test(lower)) return "social_proof";
  // Behind-the-Scenes
  if (/\b(behind the scenes|bts|meet the team|day in the life|process|making of|workspace|office tour|our story)\b/i.test(lower)) return "behind_the_scenes";
  // Interactive / Engagement
  if (/\b(poll|vote|quiz|this or that|which do you|question|q&a|ask us|tell us|would you rather|choose|pick one|comment below|tag someone)\b/i.test(lower)) return "interactive";
  return null;
}

async function classifyCategoryWithLLM(prompt: string, apiKey: string): Promise<string> {
  try {
    const categoryIds = Object.keys(CONTENT_CATEGORIES);
    const { response } = await callWithFallback(
      MODEL_CHAINS.fast,
      (model) => ({
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You classify social media content prompts into categories. Return ONLY the category ID." },
            { role: "user", content: `Classify this social media design request into exactly ONE of these categories: ${categoryIds.join(", ")}.\n\nPrompt: "${prompt}"\n\nReturn ONLY the category ID (e.g. "promotional"), nothing else.` },
          ],
        }),
      }),
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      apiKey,
    );
    if (response.ok) {
      const data = await response.json();
      const raw = (data.choices?.[0]?.message?.content || "").trim().toLowerCase().replace(/[^a-z_]/g, "");
      if (CONTENT_CATEGORIES[raw]) return raw;
    }
  } catch (e) {
    console.log("Category LLM classification failed, defaulting:", e);
  }
  return "promotional"; // safe default
}

// --- GENOME SCORING FUNCTION (extracted for reuse) ---
function computeGenomeScores(
  genomeData: any,
  brand: any,
  trend: string | undefined,
  trend_intensity: number | undefined,
  copyStructure: any
): Record<string, number> {
  const scores: Record<string, number> = {};

  // 1. Brand Alignment Score (0-100)
  let brandScore = 60;
  const brandVibe = (brand?.vibe || "").toLowerCase();
  const vibeEmotionMap: Record<string, string[]> = {
    cinematic: ["luxurious", "authoritative", "futuristic"],
    minimal: ["calm", "authoritative"],
    bold: ["energetic", "rebellious"],
    playful: ["playful", "warm", "energetic"],
    luxury: ["luxurious", "calm", "authoritative"],
    corporate: ["authoritative", "calm"],
  };
  if (vibeEmotionMap[brandVibe]?.includes(genomeData.emotion)) brandScore += 15;
  const tonePersonalityMap: Record<string, string[]> = {
    professional: ["corporate", "editorial"],
    humourous: ["friendly", "street"],
    formal: ["corporate", "editorial"],
    casual: ["friendly", "street"],
    inspirational: ["editorial", "friendly"],
  };
  const brandTone = (brand?.tone_of_voice || "").toLowerCase();
  if (tonePersonalityMap[brandTone]?.includes(genomeData.typography.font_personality)) brandScore += 10;
  if (["high", "extreme"].includes(genomeData.color.contrast)) brandScore += 10;
  if (genomeData.texture.distortion !== "none" && brandVibe !== "bold") brandScore -= 5;
  scores.brand_alignment = Math.max(0, Math.min(100, brandScore + 5));

  // 2. Trend Balance Score (0-100)
  let trendScore = 70;
  if (trend && trend !== "none") {
    const intensity = trend_intensity ?? 40;
    const trendExpectations: Record<string, Record<string, any>> = {
      "tactile-rebellion": { texture_type: "paper", emotion: "warm", balance: "dynamic" },
      "hyper-chromatic": { saturation: "neon", contrast: "extreme", emotion: "energetic" },
      "technical-mono": { saturation: "muted", grid_type: "strict_grid", emotion: "futuristic" },
      "neo-naturalism": { texture_type: "paper", emotion: "calm", contrast: "low" },
      "kinetic-typography": { balance: "dynamic", hierarchy_logic: "strong_headline_dominance", emotion: "energetic" },
    };
    const expected = trendExpectations[trend] || {};
    let matches = 0;
    const total = Object.keys(expected).length;
    for (const [key, val] of Object.entries(expected)) {
      for (const cat of Object.values(genomeData)) {
        if (typeof cat === "object" && cat !== null && (cat as any)[key] === val) matches++;
      }
      if (genomeData[key] === val) matches++;
    }
    const matchRatio = total > 0 ? matches / total : 0;
    const idealMatchRatio = intensity / 100;
    const deviation = Math.abs(matchRatio - idealMatchRatio);
    trendScore = Math.round(85 - deviation * 60);
  }
  scores.trend_balance = Math.max(0, Math.min(100, trendScore));

  // 3. Visual Clarity Score (0-100)
  let clarityScore = 50;
  if (["high", "extreme"].includes(genomeData.color.contrast)) clarityScore += 20;
  else if (genomeData.color.contrast === "medium") clarityScore += 10;
  if (genomeData.typography.hierarchy_logic === "strong_headline_dominance") clarityScore += 15;
  else if (genomeData.typography.hierarchy_logic === "balanced_hierarchy") clarityScore += 10;
  if (genomeData.layout.spacing_density === "minimal") clarityScore += 10;
  else if (genomeData.layout.spacing_density === "balanced") clarityScore += 5;
  if (genomeData.composition.focal_strategy === "single_focal_point") clarityScore += 10;
  if (genomeData.texture.distortion !== "none") clarityScore -= 10;
  if (genomeData.texture.intensity === "heavy") clarityScore -= 5;
  scores.visual_clarity = Math.max(0, Math.min(100, clarityScore));

  // 4. Conversion Score (0-100)
  let conversionScore = 40;
  if (copyStructure?.cta && copyStructure.cta.length > 0) conversionScore += 20;
  if (genomeData.composition.focal_strategy === "single_focal_point") conversionScore += 15;
  if (genomeData.typography.hierarchy_logic === "strong_headline_dominance") conversionScore += 10;
  if (["energetic", "authoritative", "rebellious"].includes(genomeData.emotion)) conversionScore += 10;
  if (genomeData.layout.content_ratio === "balanced") conversionScore += 5;
  scores.conversion = Math.max(0, Math.min(100, conversionScore));

  // 5. Visual Balance Score (0-100)
  let balanceScore = 50;
  if (genomeData.layout.balance === "symmetrical") balanceScore += 20;
  else if (genomeData.layout.balance === "asymmetrical") balanceScore += 15;
  else if (genomeData.layout.balance === "dynamic") balanceScore += 10;
  if (genomeData.composition.layering_depth === "medium") balanceScore += 15;
  else if (genomeData.composition.layering_depth === "flat") balanceScore += 10;
  if (genomeData.layout.spacing_density === "balanced") balanceScore += 10;
  if (genomeData.color.gradient_logic !== "multi_spectrum") balanceScore += 5;
  scores.visual_balance = Math.max(0, Math.min(100, balanceScore));

  // Overall score (weighted average)
  scores.overall = Math.round(
    scores.brand_alignment * 0.30 +
    scores.trend_balance * 0.15 +
    scores.visual_clarity * 0.25 +
    scores.conversion * 0.15 +
    scores.visual_balance * 0.15
  );

  return scores;
}

// --- BRAND COLOR ANALYSIS HELPER ---
function analyzeBrandColors(primaryColors: string[]): { temperature: string; saturation: string } {
  if (!primaryColors || primaryColors.length === 0) return { temperature: "neutral", saturation: "balanced" };
  
  // Simple heuristic: analyze hex colors for warmth/coolness and saturation
  let warmCount = 0, coolCount = 0, highSat = 0, lowSat = 0;
  for (const hex of primaryColors) {
    const clean = hex.replace("#", "");
    if (clean.length < 6) continue;
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    // Warm = reds/yellows/oranges dominate, Cool = blues/greens dominate
    if (r > b) warmCount++;
    else if (b > r) coolCount++;
    // Saturation approximation
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const satRatio = max > 0 ? (max - min) / max : 0;
    if (satRatio > 0.5) highSat++;
    else if (satRatio < 0.2) lowSat++;
  }
  const temperature = warmCount > coolCount ? "warm" : coolCount > warmCount ? "cool" : "neutral";
  const saturation = highSat > lowSat ? "vibrant" : lowSat > highSat ? "muted" : "balanced";
  return { temperature, saturation };
}

// --- FONT-TO-PERSONALITY MAP ---
function mapFontToPersonality(fontName: string): string | null {
  if (!fontName) return null;
  const lower = fontName.toLowerCase();
  // Corporate fonts
  if (/arial|helvetica|inter|roboto|open\s?sans|lato|source\s?sans|nunito\s?sans/i.test(lower)) return "corporate";
  // Editorial/serif fonts
  if (/playfair|merriweather|georgia|times|garamond|libre\s?baskerville|cormorant|lora|dm\s?serif/i.test(lower)) return "editorial";
  // Friendly fonts
  if (/poppins|nunito|quicksand|rounded|comic|baloo|fredoka|patrick/i.test(lower)) return "friendly";
  // Street/display fonts
  if (/impact|bebas|anton|black\s?ops|bangers|permanent\s?marker|rubik\s?mono/i.test(lower)) return "street";
  // Futuristic fonts
  if (/orbitron|rajdhani|exo|audiowide|space\s?grotesk|jost|outfit|syne/i.test(lower)) return "futuristic";
  return null;
}

async function runFullHandler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Check if the caller is using the service role key (internal autopilot calls)
    const token = authHeader?.replace("Bearer ", "") ?? "";
    const isServiceRole = token === serviceRoleKey;

    let user: { id: string; email?: string } | null = null;

    if (isServiceRole) {
      // Service role call — expect user_id in body (parsed below after req.json)
      // We'll set user after parsing the body
      const bodyText = await req.text();
      const body = JSON.parse(bodyText);
      if (!body.user_id) {
        return new Response(JSON.stringify({ error: "Service role calls require user_id in body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = { id: body.user_id };
      // Re-attach body for downstream parsing (store parsed body)
      (req as any)._parsedBody = body;
    } else {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader! } },
      });
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !authUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = authUser;
    }

    // Initialize tracer for this request
    const tracer = new Tracer(user.id);

    const { messages, brand, action, canvas_size, previous_prompt, previous_image_url, user_image_url, audience_id, trend, trend_intensity, slide_count } = (req as any)._parsedBody || await req.json();

    // Sanitise user-provided text inputs
    if (messages && Array.isArray(messages)) {
      for (const msg of messages) {
        if (msg.role === "user" && typeof msg.content === "string") {
          msg.content = sanitise(msg.content);
        }
      }
    }

    // === CONTEXT COMPRESSION ===
    // When conversation exceeds 15 messages, summarise older messages
    // to reduce token usage while preserving context
    const COMPRESSION_THRESHOLD = 15;
    const RECENT_MESSAGES_TO_KEEP = 6; // Keep the last 6 messages verbatim

    async function compressMessages(
      msgs: Array<{ role: string; content: string }>,
      apiKey: string
    ): Promise<Array<{ role: string; content: string }>> {
      if (!msgs || msgs.length <= COMPRESSION_THRESHOLD) return msgs;

      const olderMessages = msgs.slice(0, msgs.length - RECENT_MESSAGES_TO_KEEP);
      const recentMessages = msgs.slice(msgs.length - RECENT_MESSAGES_TO_KEEP);

      // Build a transcript of older messages for summarisation
      const transcript = olderMessages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      try {
        const summaryResponse = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a conversation summariser. Produce a concise summary of the conversation below, preserving: 1) key design decisions (colours, layout, style choices), 2) user preferences and feedback, 3) brand/audience context mentioned, 4) the most recent design state. Be factual and brief — max 200 words. Output only the summary, no preamble.",
                },
                {
                  role: "user",
                  content: `Summarise this design conversation:\n\n${transcript}`,
                },
              ],
            }),
          }
        );

        if (!summaryResponse.ok) {
          console.warn("Context compression failed, using uncompressed messages");
          return msgs;
        }

        const summaryData = await summaryResponse.json();
        const summary =
          summaryData.choices?.[0]?.message?.content || "";

        if (!summary) return msgs;

        console.log(
          `Context compression: ${olderMessages.length} older messages → summary (${summary.length} chars). Keeping ${recentMessages.length} recent.`
        );

        // Return a synthetic "system" message with the summary + recent messages
        return [
          {
            role: "user",
            content: `[Conversation context — summarised from ${olderMessages.length} earlier messages]\n${summary}`,
          },
          {
            role: "assistant",
            content:
              "Understood, I have the context from our earlier conversation. Let's continue.",
          },
          ...recentMessages,
        ];
      } catch (e) {
        console.warn("Context compression error, falling back to full messages:", e);
        return msgs;
      }
    }

    // Apply compression if needed
    let compressedMessages = messages;
    if (messages && Array.isArray(messages) && messages.length > COMPRESSION_THRESHOLD) {
      compressedMessages = await compressMessages(messages, LOVABLE_API_KEY);
      console.log(`Messages compressed: ${messages.length} → ${compressedMessages.length}`);
    }

    // === CHAT ACTION (with brand context) ===
    if (action === "chat") {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // Fetch brand context for chat
      let chatBrandContext = "";
      let chatAudienceContext = "";
      let chatTrendContext = "";

      if (brand?.id) {
        // Build brand context
        chatBrandContext = `
BRAND CONTEXT (use this to give brand-aware advice):
- Brand name: ${brand.name || "Unknown"}
- Tagline: ${brand.tagline || "None"}
- Description: ${brand.description || "None"}
- Vibe: ${brand.vibe || "Modern"}
- Tone of voice: ${brand.tone_of_voice || "Professional"}
- Personality traits: ${(brand.personality_traits || []).join(", ") || "None"}
- Primary colours: ${(brand.primary_colors || []).join(", ") || "None specified"}
- Secondary colours: ${(brand.secondary_colors || []).join(", ") || "None specified"}
- Primary font: ${brand.typography_primary || "Not set"}
- Secondary font: ${brand.typography_secondary || "Not set"}`;

        // Fetch audience data
        try {
          const { data: audienceData } = await adminClient
            .from("target_audiences")
            .select("jtbd_profile, label")
            .eq("brand_id", brand.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (audienceData?.jtbd_profile) {
            const p = audienceData.jtbd_profile as any;
            chatAudienceContext = `
AUDIENCE INTELLIGENCE:
- Target persona: ${p.persona_summary || "N/A"}
- Core job: ${p.core_job_statement || "N/A"}
- Key struggles: ${(p.struggling_moments || []).slice(0, 3).join("; ")}
- Emotional drivers: ${(p.emotional_outcomes || []).slice(0, 3).join("; ")}`;
          }
        } catch (e) {
          console.log("Chat: audience fetch failed:", e);
        }

        // Fetch trend preferences
        try {
          const { data: trendPref } = await adminClient
            .from("brand_trend_preferences")
            .select("selected_trend, default_trend_intensity, trend_enabled")
            .eq("brand_id", brand.id)
            .maybeSingle();

          if (trendPref?.trend_enabled && trendPref.selected_trend && trendPref.selected_trend !== "none") {
            chatTrendContext = `
TREND CONTEXT: The brand currently has "${trendPref.selected_trend}" trend active at ${trendPref.default_trend_intensity}% intensity.`;
          }
        } catch (e) {
          console.log("Chat: trend fetch failed:", e);
        }
      }

      const seasonalContext = getSeasonalContextString(14);
      const chatSystemPrompt = `You are Brandie, a senior creative director with deep brand strategy expertise. You help users refine their design ideas before generating. Be confident, professional, calm. Never apologise excessively. Suggest improvements. Keep responses concise (2-3 sentences max). When advising on designs, always recommend photorealistic imagery and clean, modern aesthetics unless the user explicitly wants something different. Prioritise the user's intent and their Brand Centre settings (colours, fonts, tone, personality, inspiration) above all else.${chatBrandContext}${chatAudienceContext}${chatTrendContext}

${seasonalContext}

When you have brand context, reference it naturally in your advice — suggest using specific brand colours, recommend copy that matches the tone of voice, and consider the target audience when discussing design strategy. If an upcoming holiday or event is relevant to the user's brand, proactively suggest timely content ideas.`;

      // Circuit breaker check for chat
      if (isCircuitOpen("ai-gateway")) {
        return new Response(JSON.stringify({ error: "Our design engine is temporarily busy, please try again in a moment." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { response } = await callWithFallback(
          MODEL_CHAINS.chat,
          (model) => ({
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: chatSystemPrompt },
                ...compressedMessages,
              ],
            }),
          }),
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          LOVABLE_API_KEY,
        );

        recordSuccess("ai-gateway");

        if (!response.ok) {
          if (response.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (response.status === 402) {
            return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw new Error("Chat failed");
        }

        const chatData = await response.json();
        const content = chatData.choices?.[0]?.message?.content || "";

        return new Response(JSON.stringify({ message: content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (chatErr) {
        recordFailure("ai-gateway");
        throw chatErr;
      }

      return new Response(JSON.stringify({ message: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate" || action === "edit") {
      // Circuit breaker check for AI gateway
      if (isCircuitOpen("ai-gateway")) {
        return new Response(JSON.stringify({ error: "Our design engine is temporarily busy, please try again in a moment." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // Fetch audience intelligence for the brand
      let audienceContext = "";
      let audienceProfile: any = null;
      if (brand?.id || audience_id) {
        try {
          let query = adminClient.from("target_audiences").select("jtbd_profile");
          if (audience_id) {
            query = query.eq("id", audience_id);
          } else {
            query = query.eq("brand_id", brand.id).order("created_at", { ascending: true }).limit(1);
          }
          const { data: audienceData } = await query.maybeSingle();
          
          const profile = audienceData?.jtbd_profile;
          if (profile && typeof profile === "object" && Object.keys(profile).length > 0) {
            const p = profile as any;
            audienceProfile = p;
            audienceContext = `

AUDIENCE INTELLIGENCE (use to sharpen copy and visual strategy):
- Target persona: ${p.persona_summary || "N/A"}
- Core job: ${p.core_job_statement || "N/A"}
- Key struggles: ${(p.struggling_moments || []).join("; ")}
- Emotional drivers: ${(p.emotional_outcomes || []).slice(0, 3).join("; ")}
- Buying triggers: ${(p.buying_triggers || []).join("; ")}
- Hesitation factors: ${(p.hesitation_factors || []).join("; ")}
- Top messaging angles: ${(p.messaging_angles || []).slice(0, 3).join("; ")}
- Conversion levers: ${(p.conversion_levers_ranked || []).slice(0, 3).join("; ")}

CONVERSION RULES:
1. Select top 1-2 emotional drivers and weave them into the headline/copy
2. Reference a struggling moment the audience relates to
3. Amplify the desired outcome
4. Neutralise the top anxiety/hesitation factor
5. Visual strategy should match emotional driver (Status→bold/luxury, Security→calm/soft, Growth→energetic)`;
          }
        } catch (e) {
          console.log("No audience data found, proceeding without:", e);
        }
      }

      // --- RAG PERSONALISATION ENGINE ---
      // Query user's top-rated past designs with genomes to build preference signals
      let preferenceContext = "";
      let preferenceWeights: Record<string, Record<string, number>> = {};
      let copyPreferenceContext = "";
      try {
        const { data: pastDesigns } = await adminClient
          .from("designs")
          .select("genome, vote, copy_structure, trend_used")
          .eq("user_id", user.id)
          .not("genome", "is", null)
          .order("vote", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(20);

        if (pastDesigns && pastDesigns.length >= 2) {
          // Tally gene values weighted by vote: upvoted=3, neutral=1, downvoted=0
          const tally: Record<string, Record<string, Record<string, number>>> = {};
          for (const d of pastDesigns) {
            const g = d.genome as any;
            if (!g) continue;
            const weight = d.vote === 1 ? 3 : d.vote === -1 ? 0 : 1;
            for (const [cat, val] of Object.entries(g)) {
              if (cat === "_scores" || cat === "emotion" || cat === "_refined") continue;
              if (typeof val === "object" && val !== null) {
                if (!tally[cat]) tally[cat] = {};
                for (const [field, fv] of Object.entries(val as any)) {
                  if (typeof fv !== "string") continue;
                  if (!tally[cat][field]) tally[cat][field] = {};
                  tally[cat][field][fv] = (tally[cat][field][fv] || 0) + weight;
                }
              }
            }
            // emotion (top-level string)
            if (g.emotion && typeof g.emotion === "string") {
              if (!tally["_emotion"]) tally["_emotion"] = { value: {} };
              tally["_emotion"]["value"][g.emotion] = (tally["_emotion"]["value"][g.emotion] || 0) + weight;
            }
          }

          // Find top value per gene
          const topGenes: string[] = [];
          for (const [cat, fields] of Object.entries(tally)) {
            for (const [field, counts] of Object.entries(fields)) {
              // Store weights for mutation bias
              if (!preferenceWeights[cat]) preferenceWeights[cat] = {};
              const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
              if (sorted.length > 0 && sorted[0][1] >= 3) {
                const label = cat === "_emotion" ? "emotion" : `${cat}.${field}`;
                topGenes.push(`${label}=${sorted[0][0]}`);
                preferenceWeights[cat][field] = sorted[0][1];
                // Store preferred value for mutation bias
                preferenceWeights[cat][`_preferred_${field}`] = sorted[0][0] as any;
              }
            }
          }

          if (topGenes.length > 0) {
            preferenceContext = `\n\nUSER STYLE PREFERENCES (from ${pastDesigns.length} past designs, weighted by upvotes — bias toward these when appropriate but don't force them):\n${topGenes.join(", ")}`;
            console.log("RAG preference context:", preferenceContext);
          }

          // --- COPY PATTERN LEARNING ---
          // Track copy density preferences from upvoted designs
          const upvotedWithCopy = pastDesigns.filter(d => d.vote === 1 && d.copy_structure);
          if (upvotedWithCopy.length >= 2) {
            let headlineOnly = 0;
            let fullCopy = 0;
            let avgFieldsUsed = 0;
            for (const d of upvotedWithCopy) {
              const cs = d.copy_structure as any;
              if (!cs) continue;
              const fieldsUsed = [cs.headline, cs.subheadline, cs.cta, cs.supporting_text].filter(f => f && f.trim() !== "").length;
              avgFieldsUsed += fieldsUsed;
              if (fieldsUsed <= 1) headlineOnly++;
              else if (fieldsUsed >= 3) fullCopy++;
            }
            avgFieldsUsed = Math.round(avgFieldsUsed / upvotedWithCopy.length);
            const copyDensity = headlineOnly > fullCopy ? "minimal (headline-focused)" : fullCopy > headlineOnly ? "rich (headline + subheadline + CTA)" : "balanced";
            copyPreferenceContext = `\nUSER COPY PREFERENCE: User tends to prefer ${copyDensity} copy density (avg ${avgFieldsUsed} text fields used in upvoted designs).`;
            console.log("Copy preference context:", copyPreferenceContext);
          }

          // --- TREND AFFINITY LEARNING ---
          const trendCounts: Record<string, number> = {};
          for (const d of pastDesigns) {
            if (d.vote === 1 && d.trend_used && d.trend_used !== "none") {
              trendCounts[d.trend_used] = (trendCounts[d.trend_used] || 0) + 1;
            }
          }
          const topTrend = Object.entries(trendCounts).sort((a, b) => b[1] - a[1])[0];
          if (topTrend && topTrend[1] >= 2) {
            preferenceContext += `\nPREFERRED TREND: User's upvoted designs frequently use "${topTrend[0]}" trend.`;
          }
        }
      } catch (e) {
        console.log("RAG preference retrieval failed, proceeding without:", e);
      }

      // --- CHAT HISTORY RAG (cached LLM-summarised preference tags) ---
      let chatHistoryContext = "";
      let cachedPrefs: any = null; // Hoisted so edit pattern bias can reuse it
      try {
        // Count current user messages to check against cache
        const { count: currentMsgCount } = await adminClient
          .from("design_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("role", "user");

        const msgCount = currentMsgCount ?? 0;

        // Always fetch cache (needed for edit_patterns even if msgCount < 3)
        const { data: cached } = await adminClient
          .from("chat_preference_cache")
          .select("tags, message_count, edit_patterns")
          .eq("user_id", user.id)
          .maybeSingle();
        cachedPrefs = cached;

        if (msgCount >= 3) {

          let tags: any = null;
          let cacheHit = false;

          if (cached && cached.message_count === msgCount && cached.tags && Object.keys(cached.tags).length > 0) {
            tags = cached.tags;
            cacheHit = true;
            console.log(`Chat RAG cache HIT (${msgCount} messages)`);
          } else if (msgCount >= 5) {
            // Cache miss or stale — run LLM extraction
            console.log(`Chat RAG cache MISS (cached: ${cached?.message_count ?? 0}, current: ${msgCount})`);

            // Fetch messages with their parent design's vote score
            const { data: recentMessages } = await adminClient
              .from("design_messages")
              .select("content, design_id")
              .eq("user_id", user.id)
              .eq("role", "user")
              .order("created_at", { ascending: false })
              .limit(40);

            if (recentMessages && recentMessages.length >= 5) {
              // Batch-fetch vote scores for all related designs
              const designIds = [...new Set(recentMessages.map((m: any) => m.design_id))];
              const { data: designVotes } = await adminClient
                .from("designs")
                .select("id, vote")
                .in("id", designIds);

              const voteMap: Record<string, number> = {};
              if (designVotes) {
                for (const d of designVotes) {
                  voteMap[d.id] = d.vote ?? 0;
                }
              }

              // Weight messages: upvoted design msgs repeated 3x, neutral 1x, downvoted skipped
              const weightedMessages: string[] = [];
              for (const m of recentMessages) {
                const vote = voteMap[m.design_id] ?? 0;
                if (vote < 0) continue; // skip messages from downvoted designs
                const text = m.content.trim().substring(0, 150);
                const repeats = vote > 0 ? 3 : 1;
                for (let i = 0; i < repeats; i++) {
                  weightedMessages.push(text);
                }
              }

              const rawMessages = weightedMessages.slice(0, 45).join("\n- ");

              const extractionSpan = tracer.startSpan("chat-preference-extraction");
              try {
                const { response: extractResponse, modelUsed } = await callWithFallback(
                  MODEL_CHAINS.fast,
                  (model) => ({
                    body: JSON.stringify({
                      model,
                      messages: [
                        {
                          role: "system",
                          content: `You are a design preference analyst. Given a user's recent chat messages from a brand design tool, extract structured preference tags.

Output ONLY a JSON object with these fields (use empty arrays if no clear pattern):
{
  "visual_styles": ["up to 3 recurring visual style preferences, e.g. 'minimalist', 'bold gradients', 'dark backgrounds'"],
  "color_preferences": ["up to 3 color tendencies, e.g. 'warm tones', 'neon accents', 'monochrome'"],
  "typography_preferences": ["up to 2, e.g. 'large headlines', 'serif fonts', 'handwritten feel'"],
  "content_topics": ["up to 3 recurring topics/industries, e.g. 'product launches', 'motivational quotes', 'food photography'"],
  "tone_preferences": ["up to 2, e.g. 'professional', 'playful', 'luxury', 'casual'"],
  "layout_preferences": ["up to 2, e.g. 'text-heavy', 'image-dominant', 'centered layout'"],
  "recurring_requests": ["up to 2 specific patterns, e.g. 'always asks for CTA buttons', 'prefers short copy'"]
}

Be concise. Only include tags with clear evidence from multiple messages. Output valid JSON only.`,
                        },
                        {
                          role: "user",
                          content: `Recent user messages:\n- ${rawMessages}`,
                        },
                      ],
                    }),
                  }),
                  "https://ai.gateway.lovable.dev/v1/chat/completions",
                  LOVABLE_API_KEY,
                );

                recordSuccess("ai-gateway");

                if (extractResponse.ok) {
                  const extractData = await extractResponse.json();
                  const rawContent = extractData.choices?.[0]?.message?.content || "";
                  try {
                    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) tags = JSON.parse(jsonMatch[0]);
                  } catch { /* ignore parse errors */ }

                  // Persist to cache (upsert by user_id) — preserve existing edit_patterns
                  if (tags && typeof tags === "object") {
                    const existingEditPatterns = cached?.edit_patterns || [];
                    await adminClient
                      .from("chat_preference_cache")
                      .upsert(
                        { user_id: user.id, tags, message_count: msgCount, edit_patterns: existingEditPatterns, updated_at: new Date().toISOString() },
                        { onConflict: "user_id" }
                      );
                    console.log(`Chat RAG: extracted and cached preference tags (model: ${modelUsed})`);
                  }
                } else {
                  console.log("Chat RAG extraction call failed:", extractResponse.status);
                }
                extractionSpan.finish({ metadata: { model: modelUsed } });
              } catch (extractErr) {
                recordFailure("ai-gateway");
                extractionSpan.fail(extractErr instanceof Error ? extractErr.message : String(extractErr));
                console.log("Chat RAG extraction failed:", extractErr);
              }
            }
          }

          // Build context string from tags (cached or freshly extracted)
          if (tags && typeof tags === "object") {
            const tagLines: string[] = [];
            const tagMap: Record<string, string[]> = {
              "Visual styles": tags.visual_styles,
              "Color preferences": tags.color_preferences,
              "Typography": tags.typography_preferences,
              "Content topics": tags.content_topics,
              "Tone": tags.tone_preferences,
              "Layout": tags.layout_preferences,
              "Patterns": tags.recurring_requests,
            };
            for (const [label, values] of Object.entries(tagMap)) {
              if (Array.isArray(values) && values.length > 0) {
                tagLines.push(`- ${label}: ${values.join(", ")}`);
              }
            }
            if (tagLines.length > 0) {
              chatHistoryContext = `\n\nUSER STYLE PREFERENCE TAGS (extracted from recent conversations${cacheHit ? ", cached" : ""} — use to inform decisions but ALWAYS prioritise the current prompt):\n${tagLines.join("\n")}`;
            }
          } else if (msgCount >= 3 && msgCount < 5) {
            // Fallback for 3-4 messages: simple condensation
            const { data: fewMessages } = await adminClient
              .from("design_messages")
              .select("content")
              .eq("user_id", user.id)
              .eq("role", "user")
              .order("created_at", { ascending: false })
              .limit(5);
            if (fewMessages) {
              const condensed = fewMessages.map((m: any) => m.content.trim().substring(0, 120)).join(" | ");
              chatHistoryContext = `\n\nCONVERSATION HISTORY INSIGHTS (recent user requests — look for recurring patterns):\n${condensed}`;
            }
          }
        }
      } catch (e) {
        console.log("Chat history RAG failed, proceeding without:", e);
      }

      // --- EDIT PATTERN BIAS ---
      // Reuse edit_patterns already fetched from cache (line 480) instead of a second DB query
      let editBiasContext = "";
      try {
        const cachedEditPatterns = cachedPrefs?.edit_patterns;

        if (cachedEditPatterns && Array.isArray(cachedEditPatterns) && cachedEditPatterns.length >= 3) {
          const patterns = cachedEditPatterns as Array<{ type: string; timestamp: string }>;
          // Count pattern types from recent edits (last 20)
          const recentPatterns = patterns.slice(-20);
          const patternCounts: Record<string, number> = {};
          for (const p of recentPatterns) {
            patternCounts[p.type] = (patternCounts[p.type] || 0) + 1;
          }
          // Build bias string for patterns that appear 3+ times
          const biases: string[] = [];
          if ((patternCounts["less_text"] || 0) >= 3) biases.push("User frequently requests LESS text — prefer minimal, headline-focused copy");
          if ((patternCounts["more_text"] || 0) >= 3) biases.push("User frequently requests MORE text — include subheadline and supporting text");
          if ((patternCounts["bigger_text"] || 0) >= 3) biases.push("User frequently requests BIGGER text — use larger, bolder typography");
          if ((patternCounts["smaller_text"] || 0) >= 3) biases.push("User frequently requests SMALLER text — use more refined, smaller typography");
          if ((patternCounts["layout_change"] || 0) >= 3) biases.push("User frequently changes layout — try more varied compositions");
          if ((patternCounts["color_change"] || 0) >= 3) biases.push("User frequently changes colors — ensure strong color contrast and bold palette");
          if ((patternCounts["style_change"] || 0) >= 3) biases.push("User frequently changes visual style — be more experimental with visual direction");

          if (biases.length > 0) {
            editBiasContext = `\n\nEDIT PATTERN INSIGHTS (learned from user's frequent edit requests — pre-apply these preferences):\n- ${biases.join("\n- ")}`;
            console.log("Edit bias context:", editBiasContext);
          }
        }
      } catch (e) {
        console.log("Edit pattern bias retrieval failed, proceeding without:", e);
      }

      // Build trend context
      let trendContext = "";
      if (trend && trend !== "none") {
        const trendPresets: Record<string, any> = {
          "tactile-rebellion": {
            name: "Tactile Rebellion",
            visual_characteristics: "Paper textures, grain overlays, hand-drawn marks, imperfect alignment, scrapbook-style collage layouts, torn edges, stamp effects",
            typography_style: "Handwritten or rough serif fonts, irregular baselines, ink-stamp lettering, slightly rotated text blocks",
            color_profile: "Muted earth tones layered with the brand palette, cream/kraft paper backgrounds, ink-wash colour effects",
            texture_elements: "Heavy grain, paper fibre texture, ink splatter, tape/sticker overlays, pencil scribbles",
            copy_tone_hint: "More expressive and human — use imperfect, authentic, conversational language",
          },
          "hyper-chromatic": {
            name: "Hyper Chromatic",
            visual_characteristics: "Extremely vibrant colour contrasts, neon accents, bold gradients, energetic compositions, light leak effects, prismatic colour splits",
            typography_style: "Heavy bold sans-serif, oversized display type, colour-filled text, glow effects on headlines",
            color_profile: "Saturated neon accents blended with brand colours, vivid gradients, high-contrast complementary pairings",
            texture_elements: "Light leaks, chromatic aberration, glass refraction, holographic sheen, subtle noise on gradients",
            copy_tone_hint: "High-energy promotional language — bold, punchy, exclamatory, confident",
          },
          "technical-mono": {
            name: "Technical Mono",
            visual_characteristics: "Monospaced typography, clean grid structures, industrial aesthetic, futuristic UI elements, data-visualization motifs, blueprint feel",
            typography_style: "Monospaced fonts for all text, fixed-width grid alignment, code-editor aesthetic, minimal font-weight variation",
            color_profile: "Desaturated palette with single brand-colour accent, dark backgrounds, terminal-green or cyan highlights",
            texture_elements: "Dot grids, scan lines, subtle noise, circuit-board patterns, thin rule lines",
            copy_tone_hint: "Shorter and sharper copy — precise, technical, no-nonsense, data-driven",
          },
          "neo-naturalism": {
            name: "Neo Naturalism",
            visual_characteristics: "Calm colour palettes, organic textures, nature-inspired imagery, generous breathing space, soft rounded shapes, botanical motifs",
            typography_style: "Elegant thin serifs or rounded sans-serif, generous letter-spacing, light font weights, organic flow",
            color_profile: "Soft greens, warm terracottas, sky blues blended with brand palette, low saturation, natural harmony",
            texture_elements: "Watercolour washes, linen textures, leaf shadows, soft bokeh, natural light effects",
            copy_tone_hint: "Calm and soothing tone — gentle, reassuring, mindful, nurturing",
          },
          "kinetic-typography": {
            name: "Kinetic Typography",
            visual_characteristics: "Motion-oriented layouts, elastic typography, strong visual hierarchy, energetic diagonal compositions, speed lines, dynamic angles",
            typography_style: "Elastic/stretched display fonts, extreme size contrasts, slanted baselines, overlapping text layers, variable font weight animation feel",
            color_profile: "High-contrast brand colours with motion blur accents, speed gradients, directional colour transitions",
            texture_elements: "Motion blur streaks, speed lines, dynamic shadows, perspective distortion, wind effects",
            copy_tone_hint: "Energetic and dynamic — action-oriented verbs, short punchy phrases, momentum-building",
          },
        };

        const t = trendPresets[trend];
        if (t) {
          const intensity = trend_intensity ?? 40;
          trendContext = `

TREND STYLING (blend with brand, never override):
- Active trend: ${t.name}
- Intensity: ${intensity}/100 (0=pure brand, 100=full trend)
- Visual characteristics: ${t.visual_characteristics}
- Typography influence: ${t.typography_style}
- Color treatment: ${t.color_profile}
- Texture elements: ${t.texture_elements}

TREND RULES:
1. Brand colours, fonts, and voice ALWAYS take priority
2. At intensity <25, apply only subtle hints of the trend aesthetic
3. At intensity 50, balance brand and trend equally
4. At intensity >75, trend styling is dominant but brand colours remain
5. Adapt copy tone slightly: ${t.copy_tone_hint}`;
        }
      }
      // --- Intent classification for edits ---
      let isFreeEdit = false;
      const userPrompt = messages[messages.length - 1]?.content || "";

      if (action === "edit" && previous_prompt) {
        // Deterministic rule-based intent classification (replaces non-deterministic LLM call)
        const editPromptLowerClassify = userPrompt.toLowerCase();

        // MINOR (free) patterns: text-only changes
        const minorPatterns = [
          /change\s+(the\s+)?(headline|title|heading|text|copy|cta|call.to.action|subhead|caption|wording|slogan)/i,
          /rewrite|rephrase|reword|shorten|lengthen|make\s+(it\s+)?(shorter|longer|punchier|snappier|casual|formal|friendly|professional)/i,
          /fix\s+(the\s+)?(typo|spelling|grammar|text)/i,
          /update\s+(the\s+)?(text|copy|headline|cta|wording)/i,
          /less\s+text|fewer\s+words|more\s+text|add\s+text|remove\s+text|reduce\s+copy/i,
          /change\s+(the\s+)?tone/i,
          /^(make|change|update|edit|fix)\s+(the\s+)?(headline|title|text|copy|cta|caption)\s/i,
        ];

        // MAJOR (costs credit) patterns: visual/layout changes
        const majorPatterns = [
          /layout|composition|reposition|rearrange|move\s+(the\s+)?/i,
          /colou?r|palette|shade|hue|darker|lighter|brighter|background/i,
          /style|aesthetic|vibe|look|feel|mood|theme|visual|design/i,
          /font|typography|typeface/i,
          /image|photo|picture|illustration|icon|graphic|logo\s/i,
          /resize|bigger|smaller|larger|scale/i,
          /completely\s+different|start\s+over|redesign|new\s+design/i,
          /add\s+(a\s+)?(border|shadow|gradient|texture|element|shape|icon|image)/i,
          /remove\s+(the\s+)?(border|shadow|gradient|texture|element|shape|icon|image)/i,
        ];

        const matchesMinor = minorPatterns.some((p) => p.test(editPromptLowerClassify));
        const matchesMajor = majorPatterns.some((p) => p.test(editPromptLowerClassify));

        // If it matches minor patterns and NOT major patterns, it's free
        // If ambiguous (matches both or neither), charge to be safe
        isFreeEdit = matchesMinor && !matchesMajor;
        const classification = isFreeEdit ? "MINOR" : "MAJOR";
        console.log(`Intent classification (rule-based): ${classification} (isFreeEdit: ${isFreeEdit})`);

        // --- EDIT PATTERN TRACKING ---
        try {
          const editPromptLower = userPrompt.toLowerCase();
          let editType: string | null = null;
          if (/less text|fewer words|shorter|remove text|too much text|reduce copy/i.test(editPromptLower)) editType = "less_text";
          else if (/more text|add text|longer|more copy|more detail|add description/i.test(editPromptLower)) editType = "more_text";
          else if (/bigger text|larger text|bigger font|increase.*size|make.*text.*big/i.test(editPromptLower)) editType = "bigger_text";
          else if (/smaller text|reduce.*size|make.*text.*small|subtle.*text/i.test(editPromptLower)) editType = "smaller_text";
          else if (/layout|move|reposition|rearrange|alignment|spacing|composition/i.test(editPromptLower)) editType = "layout_change";
          else if (/colou?r|palette|shade|hue|darker|lighter|brighter/i.test(editPromptLower)) editType = "color_change";
          else if (/style|aesthetic|vibe|look|feel|mood|theme|visual/i.test(editPromptLower)) editType = "style_change";

          if (editType) {
            const existingPatterns = ((cachedPrefs?.edit_patterns as any[]) || []).slice(-49);
            existingPatterns.push({ type: editType, timestamp: new Date().toISOString() });

            await adminClient
              .from("chat_preference_cache")
              .upsert(
                { user_id: user.id, edit_patterns: existingPatterns, updated_at: new Date().toISOString() },
                { onConflict: "user_id" }
              );
            console.log(`Edit pattern tracked: ${editType}`);
          }
        } catch (e) {
          console.log("Edit pattern tracking failed, proceeding:", e);
        }
      }

      // Pre-check credits — actual deduction happens AFTER successful generation.
      // This prevents users from being charged for failed designs.
      let pendingDeduction: null | (() => Promise<void>) = null;
      if (!isFreeEdit) {
        // Single generation: 2 credits flat (always HD via Pro Image model)
        const creditCost = 2;
        const { data: profile } = await adminClient
          .from("profiles")
          .select("generations_count, generations_reset_at, bonus_credits, referral_code, subscription_tier, paid_credits")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          const resetAt = new Date(profile.generations_reset_at);
          const now = new Date();
          const needsReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();

          const FREE_MONTHLY = 5;
          const currentCount = needsReset ? 0 : profile.generations_count;
          const freeRemaining = Math.max(0, FREE_MONTHLY - currentCount);
          const bonusCredits = profile.bonus_credits || 0;
          const paidCredits = (profile as any).paid_credits || 0;

          // Query active reward credits
          const { data: rewardRows } = await adminClient
            .from("credit_rewards")
            .select("id, remaining")
            .eq("user_id", user.id)
            .gt("remaining", 0)
            .gt("expires_at", now.toISOString())
            .order("expires_at", { ascending: true });
          const rewardCredits = (rewardRows || []).reduce((s: number, r: any) => s + r.remaining, 0);

          const totalAvailable = freeRemaining + bonusCredits + rewardCredits + paidCredits;

          if (creditCost > totalAvailable) {
            return new Response(JSON.stringify({ error: "Not enough credits. Please upgrade your plan or purchase more credits." }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Build deferred deduction closure — only invoked after successful render.
          pendingDeduction = async () => {
            // Re-query reward rows at deduction time to avoid using stale balances.
            const { data: freshRewardRows } = await adminClient
              .from("credit_rewards")
              .select("id, remaining")
              .eq("user_id", user.id)
              .gt("remaining", 0)
              .gt("expires_at", new Date().toISOString())
              .order("expires_at", { ascending: true });

            // Deduction order: free monthly → bonus → reward → paid
            let remainingCost = creditCost;
            const updates: any = {};
            if (needsReset) {
              updates.generations_reset_at = now.toISOString();
              updates.bonus_earned_count = 0;
              updates.bonus_earned_reset_at = now.toISOString();
            }

            // 1. Consume free monthly credits
            const freeToUse = Math.min(remainingCost, freeRemaining);
            updates.generations_count = currentCount + freeToUse;
            remainingCost -= freeToUse;

            // 2. Consume bonus credits
            if (remainingCost > 0) {
              const bonusToUse = Math.min(remainingCost, bonusCredits);
              updates.bonus_credits = bonusCredits - bonusToUse;
              remainingCost -= bonusToUse;
            }

            // 3. Consume reward credits (soonest-expiring first)
            if (remainingCost > 0 && freshRewardRows && freshRewardRows.length > 0) {
              for (const rw of freshRewardRows) {
                if (remainingCost <= 0) break;
                const toUse = Math.min(remainingCost, rw.remaining);
                await adminClient.from("credit_rewards").update({ remaining: rw.remaining - toUse }).eq("id", rw.id);
                remainingCost -= toUse;
              }
            }

            // 4. Consume paid credits
            if (remainingCost > 0) {
              updates.paid_credits = paidCredits - remainingCost;
            }

            await adminClient.from("profiles").update(updates).eq("user_id", user.id);

            const newCount = updates.generations_count ?? currentCount;
            const newBonus = updates.bonus_credits ?? bonusCredits;
            const newPaid = updates.paid_credits ?? paidCredits;

            // Check if credits are running low (< 5 remaining) and send warning email
            const remainingCredits = Math.max(0, FREE_MONTHLY - newCount) + newBonus + newPaid;
            if (remainingCredits > 0 && remainingCredits < 5) {
              try {
                const { data: userData } = await adminClient.auth.admin.getUserById(user.id);
                const userEmail = userData?.user?.email;

                if (userEmail && profile.referral_code) {
                  console.log(`Sending low credits warning to ${userEmail}, remaining: ${remainingCredits}`);

                  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
                  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

                  fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${serviceKey}`,
                    },
                    body: JSON.stringify({
                      type: "low_credits",
                      to: userEmail,
                      data: {
                        remaining_credits: remainingCredits,
                        referral_code: profile.referral_code,
                      },
                    }),
                  }).catch(e => console.error("Low credits email failed:", e));
                }
              } catch (e) {
                console.error("Error checking for low credits email:", e);
              }
            }
          };
        }
      }

      // Determine canvas dimensions (platform-locked).
      const size = canvas_size || "1080x1080";
      const canvas = resolveCanvas(size);
      const w = canvas.w;
      const h = canvas.h;
      const sizeLabel = `${canvas.platform} ${canvas.label} (${w}x${h})`;

      // Canvas format context for upstream agents (works for any aspect ratio).
      const canvasFormatBrief = buildCanvasFormatBrief(w, h, canvas.label);
      const canvasFormatCopy = buildCanvasFormatCopy(w, h);

      // Collect inspiration examples — load from brand_inspiration table
      let inspirationUrls: string[] = brand?.inspiration_examples || [];
      if ((!inspirationUrls || inspirationUrls.length === 0) && brand?.id) {
        try {
          const { data: inspirationData } = await adminClient
            .from("brand_inspiration")
            .select("image_url")
            .eq("brand_id", brand.id)
            .limit(10);
          if (inspirationData && inspirationData.length > 0) {
            inspirationUrls = inspirationData.map((i: any) => i.image_url);
            console.log(`Loaded ${inspirationUrls.length} inspiration images from DB`);
          }
        } catch (e) {
          console.log("Failed to load inspiration images:", e);
        }
      }

      // Fetch product catalogue for contextual use
      let productImageUrls: string[] = [];
      let productImageContext = "";
      if (brand?.id) {
        try {
          const { data: productData } = await adminClient
            .from("brand_products")
            .select("image_url, label, description, product_type, price, features, duration, pricing_model, is_featured, gallery_images")
            .eq("brand_id", brand.id)
            .order("created_at", { ascending: true })
            .limit(6);
          if (productData && productData.length > 0) {
            productImageUrls = productData.flatMap((p: any) => [p.image_url, ...(p.gallery_images || [])]).filter(Boolean);
            const catalogueLines = productData
              .sort((a: any, b: any) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0))
              .map((p: any, i: number) => {
              const parts = [`${i + 1}. ${p.is_featured ? "⭐ " : ""}"${p.label || "Untitled"}"`];
              const meta = [p.product_type || "physical"];
              if (p.price) meta.push(p.price);
              if (p.product_type === "service" && p.pricing_model) meta.push(p.pricing_model);
              if (p.product_type === "service" && p.duration) meta.push(p.duration);
              parts.push(`(${meta.join(", ")})`);
              if (p.description) parts.push(`— ${p.description}`);
              if (p.features && p.features.length > 0) {
                const label = p.product_type === "service" ? "Includes" : "Features";
                parts.push(`${label}: ${p.features.join(", ")}`);
              }
              return parts.join(" ");
            }).join("\n");
            productImageContext = `\n\nPRODUCTS & SERVICES:\n${catalogueLines}\n\nPRODUCT/SERVICE IMAGE USAGE: When the design is promoting, showcasing, or related to the brand's products/services, incorporate a product image as a SUPPORTING visual element — but do NOT make it the hero of every design. Use product images when contextually relevant (e.g., product launches, promotions, offers, showcases). For services, use the image as a portfolio/cover visual. Use specific names, prices, and features in copy when relevant. The user's attached image always takes priority over product images.`;
          }
        } catch (e) {
          console.log("Product catalogue fetch failed, proceeding without:", e);
        }
      }

      const brandContext = brand
        ? `You are Brandie, a senior creative director with 20+ years of experience. You design STRICTLY within the user's brand system.

BRAND SYSTEM (YOU MUST USE THESE EXACT VALUES):
- Brand name: ${brand.name}
- Tagline: ${brand.tagline || "None"}
- Description: ${brand.description || "None"}
- Vibe: ${brand.vibe || "Modern"}
- Tone of voice: ${brand.tone_of_voice || "Professional"}
- Personality traits: ${(brand.personality_traits || []).join(", ") || "None specified"}
- Primary colours (MUST dominate the design): ${(brand.primary_colors || []).join(", ")}
- Secondary colours: ${(brand.secondary_colors || []).join(", ")}
- Accent colours: ${(brand.accent_colors || []).join(", ")}
- Primary font: ${brand.typography_primary || "Clean sans-serif"}
- Secondary font: ${brand.typography_secondary || "Serif"}
${inspirationUrls.length > 0 ? `- Brand inspiration/style references: The brand has ${inspirationUrls.length} inspiration image(s) that define the desired visual aesthetic. Match this visual style closely.` : ""}
${brand.special_instructions ? `- Special instructions: ${brand.special_instructions}` : ""}
${audienceContext}${trendContext}${productImageContext}${preferenceContext}${chatHistoryContext}

DESIGN PHILOSOPHY (ALWAYS APPLY):
1. ALWAYS use PHOTOREALISTIC imagery and real photography. Use natural textures, real environments, and lifelike visuals. NEVER use cartoons, clip art, flat illustrations, or AI-looking abstract art — UNLESS the user EXPLICITLY requests illustrations, cartoons, or abstract styles.
2. Designs MUST follow modern design principles: strong visual hierarchy, balanced composition, generous whitespace, clean typography, and overall visual appeal. Every design should look like it was crafted by a top-tier design agency.
3. The USER'S INTENT carries the HIGHEST weight. Whatever the user asks for, deliver EXACTLY that. Never override, reinterpret, or ignore the user's specific request.
4. Brand Centre data (colours, fonts, tone, personality, vibe, inspiration) carries the SECOND HIGHEST weight. Always stay on-brand.
5. ALL text/copy on the design MUST align with the brand's value proposition and speak directly to the brand's target customer. Every word must serve a purpose — no filler text, no placeholder copy, no lorem ipsum, no decorative text that doesn't belong. Only include text that a real customer would expect to see on a professional marketing graphic for this brand.
6. Do NOT add unnecessary text elements. If the design only needs a headline, do not add a subheadline or CTA just to fill space. Let the design breathe. Only include text elements that are relevant to the user's request and the brand's messaging.
7. COLOUR CONTRAST IS CRITICAL: Always ensure text is highly legible against the background. If the background is dark, use light/white text. If the background is light, use dark text. When placing text over images, ALWAYS add a semi-transparent overlay, gradient scrim, or solid colour block behind the text to guarantee readability. Never place light text on light backgrounds or dark text on dark backgrounds. Contrast and legibility are non-negotiable.

${brand.special_instructions ? `SPECIAL INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY THESE DIRECTIVES):
${brand.special_instructions}

` : ""}CRITICAL RULES:
1. The design MUST directly address the user's request. If they ask for a "happy monday flyer", the headline MUST say "Happy Monday" or similar. NEVER create generic unrelated designs.
2. Use the EXACT brand hex colours listed above as the dominant palette. Do NOT invent new colours.
3. Use the brand fonts specified above.
4. Match the brand vibe: ${brand.vibe || "Modern"}
5. Match the tone of voice: ${brand.tone_of_voice || "Professional"}
6. Reflect these personality traits in the design: ${(brand.personality_traits || []).join(", ") || "Professional"}
7. Strong visual hierarchy: headline, subheadline, optional CTA — but ONLY if they are relevant and warranted by the user's request.
8. Generous negative space, modern 2026 aesthetic
9. Include the brand name "${brand.name}" somewhere in the design
10. Canvas size: ${sizeLabel}
11. If the user attaches an image, treat it as the PRIMARY visual reference. Follow their instructions about it LITERALLY. The attached image takes priority over all other visual considerations.
12. Photorealistic by default. Clean, modern, and visually stunning. No cartoon or clip art unless user asks.
13. NEVER add random motivational quotes, taglines, or text that the user did not ask for. Every piece of text must be intentional and relevant to the specific request.
14. ALWAYS ensure sufficient colour contrast between text and its background. Use overlays, scrims, or solid blocks behind text when placed over images.`
        : "You are a helpful design assistant. Create beautiful, photorealistic social media graphics that directly match the user's request. Use real photography and modern design principles: clean layout, strong hierarchy, generous whitespace, and visual appeal.";

      // For edits, include context about the previous design
      const editContext = action === "edit" && previous_prompt
        ? `\n\nPREVIOUS DESIGN CONTEXT: The user already has a design based on this brief: "${previous_prompt}". They now want to EDIT it. Preserve the overall layout and structure but apply their requested changes. This is a refinement, not a full redesign.`
        : "";

      // Build user image context for the brief
      const userImageContext = user_image_url
        ? `\n\nCRITICAL: The user has attached a reference image. You MUST incorporate this image into the design exactly as instructed. Follow the user's instructions about this image strictly and precisely. The attached image is the PRIMARY visual element.`
        : "";

      const briefUserContent = user_image_url
        ? [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: user_image_url } },
          ]
        : userPrompt;

      // --- PARALLEL: Brief Agent + Inspiration Style Analysis ---
      // Launch inspiration analysis in parallel with brief if inspiration images exist
      let inspirationStyleTagsPromise: Promise<string[]> | null = null;
      if (inspirationUrls.length > 0) {
        inspirationStyleTagsPromise = (async () => {
          try {
            const inspContent: any[] = [
              { type: "text", text: "Analyze these brand inspiration images and extract 3-5 visual style tags that describe the aesthetic. Return ONLY a JSON array of strings, e.g. [\"luxurious\", \"minimal\", \"editorial\", \"warm tones\", \"high contrast\"]. Tags should be from this vocabulary when possible: luxurious, minimal, editorial, warm, cool, bold, playful, corporate, futuristic, organic, rebellious, calm, energetic, streetwear, retro, natural, dramatic, clean." },
            ];
            for (const url of inspirationUrls.slice(0, 2)) {
              inspContent.push({ type: "image_url", image_url: { url } });
            }
            const inspResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [{ role: "user", content: inspContent }],
              }),
            });
            if (inspResponse.ok) {
              const inspData = await inspResponse.json();
              const rawContent = inspData.choices?.[0]?.message?.content || "";
              const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const tags = JSON.parse(jsonMatch[0]);
                console.log("Inspiration style tags:", tags);
                return tags as string[];
              }
            }
          } catch (e) {
            console.log("Inspiration analysis failed, proceeding without:", e);
          }
          return [];
        })();
      }

      // --- PARALLEL: Content Category Classification ---
      // Run in parallel with inspiration analysis — zero added latency
      const contentCategoryPromise = (async (): Promise<string> => {
        const ruleResult = classifyCategoryByRules(userPrompt);
        if (ruleResult) {
          console.log(`Content category (rule-based): ${ruleResult}`);
          return ruleResult;
        }
        console.log("Content category: no rule match, falling back to LLM");
        const llmResult = await classifyCategoryWithLLM(userPrompt, LOVABLE_API_KEY);
        console.log(`Content category (LLM): ${llmResult}`);
        return llmResult;
      })();

      // --- PARALLEL: Research Enrichment (only for categories that need fresh info) ---
      // Runs in parallel once category is known. Uses Firecrawl /v2/search with time-bound `tbs`.
      // Builds a brand-aware query (name, industry, vibe, tone, post type, audience).
      // Degrades gracefully if FIRECRAWL_API_KEY is missing.
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

      // Fetch per-brand research preferences (Fast vs Accurate, recency window per category).
      // Stored in brand_trend_preferences.research_prefs as { [categoryId]: { mode, recency, enabled } }.
      const researchPrefsPromise = (async (): Promise<Record<string, { mode?: "fast" | "accurate"; recency?: "24h" | "7d" | "30d"; enabled?: boolean }>> => {
        if (!brand?.id) return {};
        try {
          const { data } = await adminClient
            .from("brand_trend_preferences")
            .select("research_prefs")
            .eq("brand_id", brand.id)
            .maybeSingle();
          const raw = (data as any)?.research_prefs;
          return raw && typeof raw === "object" ? raw : {};
        } catch (e) {
          console.log("research_prefs fetch failed:", e instanceof Error ? e.message : e);
          return {};
        }
      })();

      const researchPromise = (async () => {
        const cat = await contentCategoryPromise;
        const recipe = CATEGORY_RECIPES[cat];
        const prefs = await researchPrefsPromise;
        const override = prefs[cat] || {};
        const vibeKeywords = [
          ...(brand?.vibe ? [brand.vibe] : []),
          ...((brand?.personality_traits || []) as string[]),
        ]
          .map((v) => String(v).trim())
          .filter(Boolean);
        return await enrichWithResearch(cat, userPrompt, {
          brandName: brand?.name,
          industry: brand?.industry,
          vibeKeywords,
          toneOfVoice: brand?.tone_of_voice,
          audienceDescriptor: audienceProfile?.persona_summary,
          postType: recipe?.name || cat,
          platform: canvas.platform || "Instagram",
          override,
        }, FIRECRAWL_API_KEY, adminClient);
      })();

      // --- PARALLEL: Brief Agent + Genome Composer + Inspiration Analysis + Category ---
      // Brief Agent and Genome Composer are independent — run them in parallel for latency savings

      // Brief Agent Promise (structured tool calling) — awaits category first (fast)
      const briefPromise = (async () => {
        const contentCategory = await contentCategoryPromise;
        const categoryData = CONTENT_CATEGORIES[contentCategory];
        const categoryContext = categoryData ? `\n\nCONTENT CATEGORY: ${categoryData.name}\n${categoryData.brief_directive}` : "";
        const researchCtx = (await researchPromise).promptText;

        const briefSpanInner = tracer.startSpan("brief-agent");
        try {
          const briefSystemContent = brandContext + editContext + userImageContext + canvasFormatBrief + categoryContext + researchCtx + `\n\nYou are Brandie's Strategic Creative Director. Your job is to define the creative strategy for a design — NOT to write the image prompt. Output a structured creative direction that will guide downstream agents (copywriter, renderer).${copyPreferenceContext || ""}${editBiasContext || ""}`;
          const briefMessages = [
            { role: "system", content: briefSystemContent },
            ...compressedMessages.slice(0, -1),
            { role: "user", content: briefUserContent },
          ];
          const briefTools = [{
            type: "function",
            function: {
              name: "set_brief",
              description: "Set the strategic creative direction for this design",
              parameters: {
                type: "object",
                properties: {
                  creative_direction: { type: "string", description: "Detailed visual and conceptual direction for the design (3-4 sentences). Describe WHAT to create, the scene, the mood, the visual approach. Be extremely specific about colours (use exact hex codes from brand), fonts, and composition." },
                  composition_goal: { type: "string", description: "Layout intent: e.g. 'hero image left with text overlay right', 'centered headline over full-bleed photo', 'split layout with product left and copy right'" },
                  emotional_tone: { type: "string", description: "Single word or short phrase: e.g. 'energetic', 'luxurious', 'warm and inviting', 'bold and confident'" },
                  design_focus: { type: "string", description: "What is the hero element: e.g. 'the product image', 'the headline text', 'the brand logo', 'the lifestyle photo'" },
                  explanation: { type: "string", description: "Brief explanation of creative choices for the user (1-2 sentences, speak like a creative director)" },
                },
                required: ["creative_direction", "composition_goal", "emotional_tone", "design_focus", "explanation"],
                additionalProperties: false,
              },
            },
          }];

          const { response: briefResponse, modelUsed } = await withTimeout(
            callWithFallback(
              MODEL_CHAINS.reasoning,
              (model) => ({
                body: JSON.stringify({
                  model,
                  messages: briefMessages,
                  tools: briefTools,
                  tool_choice: { type: "function", function: { name: "set_brief" } },
                }),
              }),
              "https://ai.gateway.lovable.dev/v1/chat/completions",
              LOVABLE_API_KEY,
            ),
            TIMEOUTS.AI_CALL,
            "Brief Agent",
          );

          recordSuccess("ai-gateway");

          if (!briefResponse.ok) {
            if (briefResponse.status === 429) throw new Error("RATE_LIMIT");
            if (briefResponse.status === 402) throw new Error("CREDITS_EXHAUSTED");
            const errText = await briefResponse.text();
            console.error("Brief generation error:", briefResponse.status, errText);
            throw new Error("Failed to generate design brief");
          }

          briefSpanInner.finish({ metadata: { model: modelUsed } });

        const briefData = await briefResponse.json();
        const toolCall = briefData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          console.log("Brief Agent (structured):", JSON.stringify(parsed));
          return parsed as {
            creative_direction: string;
            composition_goal: string;
            emotional_tone: string;
            design_focus: string;
            explanation: string;
          };
        }

        // Fallback: if tool call fails, try parsing from content
        const briefContent = briefData.choices?.[0]?.message?.content || "";
        console.log("Brief Agent fallback to content parsing");
        const designPromptFallback = briefContent.includes("DESIGN BRIEF:")
          ? briefContent.split("DESIGN BRIEF:")[1].split("EXPLANATION:")[0].trim()
          : briefContent.split("\n")[0];
        const explanationFallback = briefContent.includes("EXPLANATION:")
          ? briefContent.split("EXPLANATION:")[1].trim()
          : "I've crafted this design with your brand identity in mind.";
        return {
          creative_direction: designPromptFallback,
          composition_goal: "balanced composition",
          emotional_tone: brand?.vibe || "modern",
          design_focus: "the headline",
          explanation: explanationFallback,
        };
        } catch (briefErr) {
          recordFailure("ai-gateway");
          briefSpanInner.fail(briefErr instanceof Error ? briefErr.message : String(briefErr));
          throw briefErr;
        }
      })();

      // Genome Composer Promise (deterministic — no LLM dependency, runs in parallel with brief)
      const genomePromise = (async () => {
      let genomeResult: any = null;
      try {
        // 1. Pick a base genome preset from brand vibe
        const vibePresetMap: Record<string, string> = {
          cinematic: "luxury-editorial",
          minimal: "minimalist-modern",
          bold: "bold-startup",
          playful: "streetwear-alte",
          luxury: "luxury-editorial",
          corporate: "corporate-clean",
          futuristic: "tech-futurism",
          natural: "organic-natural",
          retro: "retro-futurism",
        };
        const brandVibeLower = (brand?.vibe || "").toLowerCase();
        let basePresetId = vibePresetMap[brandVibeLower] || "bold-startup";

        // H1: Category-driven base preset override — for expressive categories,
        // force a preset that already carries the right DNA (broken grid, street typography, etc).
        // This prevents brand vibe (e.g. "luxury") from dictating a meme/entertainment post.
        const resolvedCategoryForPreset = await contentCategoryPromise;
        const CATEGORY_PRESET_OVERRIDE: Record<string, string> = {
          entertainment: "streetwear-alte",
          trending: "bold-startup",
          interactive: "bold-startup",
        };
        const categoryPresetOverride = CATEGORY_PRESET_OVERRIDE[resolvedCategoryForPreset];
        if (categoryPresetOverride && categoryPresetOverride !== basePresetId) {
          console.log(`Genome: category "${resolvedCategoryForPreset}" overrides base preset "${basePresetId}" → "${categoryPresetOverride}"`);
          basePresetId = categoryPresetOverride;
        }


        // --- INSPIRATION IMAGE INFLUENCE ON GENOME ---
        // If inspiration analysis ran, use tags to potentially override preset selection
        if (inspirationStyleTagsPromise) {
          const inspirationTags = await inspirationStyleTagsPromise;
          if (inspirationTags.length > 0) {
            // Map inspiration tags to preset candidates
            const tagPresetMap: Record<string, string> = {
              luxurious: "luxury-editorial",
              luxury: "luxury-editorial",
              editorial: "luxury-editorial",
              minimal: "minimalist-modern",
              minimalist: "minimalist-modern",
              clean: "minimalist-modern",
              bold: "bold-startup",
              energetic: "bold-startup",
              playful: "streetwear-alte",
              streetwear: "streetwear-alte",
              rebellious: "neo-brutalism",
              futuristic: "tech-futurism",
              corporate: "corporate-clean",
              organic: "organic-natural",
              natural: "organic-natural",
              calm: "organic-natural",
              retro: "retro-futurism",
              dramatic: "luxury-editorial",
              warm: "organic-natural",
            };
            // Count votes per preset from inspiration tags
            const presetVotes: Record<string, number> = {};
            for (const tag of inspirationTags) {
              const lower = tag.toLowerCase();
              const preset = tagPresetMap[lower];
              if (preset) {
                presetVotes[preset] = (presetVotes[preset] || 0) + 1;
              }
            }
            // If inspiration suggests a different preset than vibe, and it has strong signal (2+ votes), override
            const topInspirationPreset = Object.entries(presetVotes).sort((a, b) => b[1] - a[1])[0];
            if (topInspirationPreset && topInspirationPreset[1] >= 2 && topInspirationPreset[0] !== basePresetId) {
              console.log(`Inspiration override: "${basePresetId}" → "${topInspirationPreset[0]}" (${topInspirationPreset[1]} tag votes from: ${inspirationTags.join(", ")})`);
              basePresetId = topInspirationPreset[0];
            } else if (topInspirationPreset) {
              console.log(`Inspiration tags (${inspirationTags.join(", ")}) align with or insufficient to override current preset "${basePresetId}"`);
            }
          }
        }

        // Hardcoded genome presets
        const GENOME_PRESETS: Record<string, any> = {
          "minimalist-modern": {
            color: { palette_type: "monochrome", temperature: "neutral", contrast: "medium", saturation: "muted", gradient_logic: "flat" },
            typography: { font_personality: "corporate", weight_system: "light", hierarchy_logic: "text_minimal", typography_layout: "centered", text_effect: "none" },
            layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "minimal", content_ratio: "balanced" },
            composition: { visual_direction: "vertical", focal_strategy: "single_focal_point", layering_depth: "flat" },
            texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
            illustration: { style: "none", detail_level: "minimal", line_weight: "thin" },
            image_style: { lighting: "natural", color_grading: "monochrome", framing: "wide" },
            emotion: "calm",
          },
          "luxury-editorial": {
            color: { palette_type: "complementary", temperature: "warm", contrast: "high", saturation: "balanced", gradient_logic: "metallic_gradient" },
            typography: { font_personality: "editorial", weight_system: "bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "left_editorial", text_effect: "none" },
            layout: { grid_type: "modular_grid", balance: "asymmetrical", spacing_density: "balanced", content_ratio: "image_dominant" },
            composition: { visual_direction: "diagonal", focal_strategy: "dual_focal", layering_depth: "deep_layered" },
            texture: { texture_type: "paper", intensity: "subtle", distortion: "none" },
            illustration: { style: "none", detail_level: "high", line_weight: "thin" },
            image_style: { lighting: "dramatic", color_grading: "cinematic", framing: "portrait" },
            emotion: "luxurious",
          },
          "streetwear-alte": {
            color: { palette_type: "triadic", temperature: "warm", contrast: "extreme", saturation: "vibrant", gradient_logic: "flat" },
            typography: { font_personality: "street", weight_system: "ultra_bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "overlay", text_effect: "outline" },
            layout: { grid_type: "broken_grid", balance: "dynamic", spacing_density: "dense", content_ratio: "text_dominant" },
            composition: { visual_direction: "diagonal", focal_strategy: "distributed", layering_depth: "deep_layered" },
            texture: { texture_type: "grain", intensity: "heavy", distortion: "glitch" },
            illustration: { style: "abstract", detail_level: "medium", line_weight: "bold" },
            image_style: { lighting: "neon", color_grading: "vibrant", framing: "close_crop" },
            emotion: "rebellious",
          },
          "neo-brutalism": {
            color: { palette_type: "complementary", temperature: "neutral", contrast: "extreme", saturation: "vibrant", gradient_logic: "flat" },
            typography: { font_personality: "street", weight_system: "ultra_bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "left_editorial", text_effect: "drop_shadow" },
            layout: { grid_type: "broken_grid", balance: "asymmetrical", spacing_density: "dense", content_ratio: "text_dominant" },
            composition: { visual_direction: "horizontal", focal_strategy: "single_focal_point", layering_depth: "medium" },
            texture: { texture_type: "grain", intensity: "medium", distortion: "none" },
            illustration: { style: "flat", detail_level: "minimal", line_weight: "bold" },
            image_style: { lighting: "dramatic", color_grading: "vibrant", framing: "wide" },
            emotion: "rebellious",
          },
          "retro-futurism": {
            color: { palette_type: "split_complementary", temperature: "cool", contrast: "high", saturation: "neon", gradient_logic: "multi_spectrum" },
            typography: { font_personality: "futuristic", weight_system: "bold", hierarchy_logic: "balanced_hierarchy", typography_layout: "centered", text_effect: "neon" },
            layout: { grid_type: "modular_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" },
            composition: { visual_direction: "radial", focal_strategy: "single_focal_point", layering_depth: "deep_layered" },
            texture: { texture_type: "metallic", intensity: "medium", distortion: "warp" },
            illustration: { style: "3d", detail_level: "high", line_weight: "medium" },
            image_style: { lighting: "neon", color_grading: "cinematic", framing: "wide" },
            emotion: "futuristic",
          },
          "organic-natural": {
            color: { palette_type: "analogous", temperature: "warm", contrast: "low", saturation: "muted", gradient_logic: "soft_gradient" },
            typography: { font_personality: "friendly", weight_system: "light", hierarchy_logic: "balanced_hierarchy", typography_layout: "centered", text_effect: "none" },
            layout: { grid_type: "freeform", balance: "symmetrical", spacing_density: "minimal", content_ratio: "image_dominant" },
            composition: { visual_direction: "vertical", focal_strategy: "single_focal_point", layering_depth: "medium" },
            texture: { texture_type: "paper", intensity: "subtle", distortion: "none" },
            illustration: { style: "hand_drawn", detail_level: "medium", line_weight: "thin" },
            image_style: { lighting: "natural", color_grading: "vintage", framing: "wide" },
            emotion: "organic",
          },
          "tech-futurism": {
            color: { palette_type: "monochrome", temperature: "cool", contrast: "high", saturation: "balanced", gradient_logic: "soft_gradient" },
            typography: { font_personality: "futuristic", weight_system: "regular", hierarchy_logic: "text_minimal", typography_layout: "left_editorial", text_effect: "none" },
            layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" },
            composition: { visual_direction: "horizontal", focal_strategy: "distributed", layering_depth: "medium" },
            texture: { texture_type: "digital_noise", intensity: "subtle", distortion: "none" },
            illustration: { style: "3d", detail_level: "high", line_weight: "thin" },
            image_style: { lighting: "dramatic", color_grading: "cinematic", framing: "wide" },
            emotion: "futuristic",
          },
          "bold-startup": {
            color: { palette_type: "complementary", temperature: "warm", contrast: "high", saturation: "vibrant", gradient_logic: "soft_gradient" },
            typography: { font_personality: "friendly", weight_system: "bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "centered", text_effect: "none" },
            layout: { grid_type: "modular_grid", balance: "asymmetrical", spacing_density: "balanced", content_ratio: "balanced" },
            composition: { visual_direction: "diagonal", focal_strategy: "single_focal_point", layering_depth: "medium" },
            texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
            illustration: { style: "flat", detail_level: "medium", line_weight: "medium" },
            image_style: { lighting: "natural", color_grading: "vibrant", framing: "wide" },
            emotion: "energetic",
          },
          "corporate-clean": {
            color: { palette_type: "analogous", temperature: "cool", contrast: "medium", saturation: "balanced", gradient_logic: "flat" },
            typography: { font_personality: "corporate", weight_system: "regular", hierarchy_logic: "balanced_hierarchy", typography_layout: "left_editorial", text_effect: "none" },
            layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" },
            composition: { visual_direction: "horizontal", focal_strategy: "dual_focal", layering_depth: "flat" },
            texture: { texture_type: "none", intensity: "subtle", distortion: "none" },
            illustration: { style: "none", detail_level: "minimal", line_weight: "thin" },
            image_style: { lighting: "soft", color_grading: "vibrant", framing: "wide" },
            emotion: "authoritative",
          },
        };

        // 2. Trend-to-genome override mappings
        const TREND_OVERRIDES: Record<string, any> = {
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

        // 3. Deep clone the base preset
        genomeResult = JSON.parse(JSON.stringify(GENOME_PRESETS[basePresetId] || GENOME_PRESETS["bold-startup"]));
        console.log(`Genome Composer (deterministic): base preset="${basePresetId}" for vibe="${brandVibeLower}"`);

        // 4. Apply trend overrides if trend is selected — deterministic top-N blending.
        // H2: Replaces per-gene Math.random() < intensity (which produced non-reproducible genomes
        // and made the intensity slider only roughly meaningful) with a stable ranked application:
        // we apply the top N trend genes where N = round(totalTrendGenes * intensity).
        // Genes are ordered category-then-field so ordering is deterministic across runs.
        const trendLockedGenes = new Set<string>(); // "category.field" tokens for H3 conflict resolution
        if (trend && trend !== "none" && TREND_OVERRIDES[trend]) {
          const overrides = TREND_OVERRIDES[trend];
          const intensity = Math.min(1, Math.max(0, (trend_intensity ?? 40) / 100));
          // Flatten all trend gene targets into a deterministic list
          const flatGenes: Array<{ category: string; field: string | null; value: any }> = [];
          for (const [category, values] of Object.entries(overrides)) {
            if (category === "emotion") {
              flatGenes.push({ category: "emotion", field: null, value: values });
            } else if (typeof values === "object" && values !== null && genomeResult[category]) {
              for (const [field, val] of Object.entries(values as Record<string, string>)) {
                flatGenes.push({ category, field, value: val });
              }
            }
          }
          const applyCount = Math.round(flatGenes.length * intensity);
          for (let i = 0; i < applyCount; i++) {
            const gene = flatGenes[i];
            if (gene.category === "emotion") {
              genomeResult.emotion = gene.value;
              trendLockedGenes.add("emotion");
            } else if (gene.field) {
              genomeResult[gene.category][gene.field] = gene.value;
              trendLockedGenes.add(`${gene.category}.${gene.field}`);
            }
          }
          console.log(`Genome: trend "${trend}" applied ${applyCount}/${flatGenes.length} genes at intensity ${trend_intensity ?? 40}% (deterministic)`);
        }


        // --- GENOME MUTATION ENGINE (15%) ---
        const MUTATION_RATE = 0.15;
        const freeGeneOptions: Record<string, Record<string, string[]>> = {
          layout: {
            grid_type: ["strict_grid", "modular_grid", "broken_grid", "freeform"],
            balance: ["symmetrical", "asymmetrical", "dynamic"],
            spacing_density: ["minimal", "balanced", "dense"],
            content_ratio: ["image_dominant", "text_dominant", "balanced"],
          },
          composition: {
            visual_direction: ["vertical", "horizontal", "diagonal", "radial"],
            focal_strategy: ["single_focal_point", "dual_focal", "distributed"],
            layering_depth: ["flat", "medium", "deep_layered"],
          },
          texture: {
            texture_type: ["none", "grain", "paper", "digital_noise", "plastic", "metallic"],
            intensity: ["subtle", "medium", "heavy"],
            distortion: ["none", "glitch", "warp", "pixel_sort"],
          },
          illustration: {
            style: ["none", "3d", "flat", "hand_drawn", "abstract", "cartoon", "clay"],
            detail_level: ["minimal", "medium", "high"],
            line_weight: ["thin", "medium", "bold"],
          },
          image_style: {
            lighting: ["natural", "dramatic", "neon", "soft"],
            color_grading: ["cinematic", "vintage", "vibrant", "monochrome"],
            framing: ["close_crop", "wide", "portrait"],
          },
        };
        const semiFlexGeneOptions: Record<string, Record<string, string[]>> = {
          typography: {
            weight_system: ["light", "regular", "bold", "ultra_bold"],
            text_effect: ["none", "outline", "drop_shadow", "gradient", "glitch", "neon"],
            typography_layout: ["centered", "left_editorial", "split_text", "overlay"],
          },
          color: {
            temperature: ["warm", "neutral", "cool"],
            gradient_logic: ["flat", "soft_gradient", "metallic_gradient", "multi_spectrum"],
          },
        };
        const emotionOptions = ["energetic", "calm", "luxurious", "playful", "rebellious", "authoritative", "warm", "futuristic", "organic"];

        let mutationCount = 0;
        const pickMutationValue = (category: string, field: string, options: string[], current: string): string => {
          const prefKey = `_preferred_${field}`;
          const preferred = preferenceWeights[category]?.[prefKey] as unknown as string;
          if (preferred && preferred !== current && options.includes(preferred)) {
            if (Math.random() < 0.6) return preferred;
          }
          const alternatives = options.filter((o: string) => o !== current);
          return alternatives.length > 0 ? alternatives[Math.floor(Math.random() * alternatives.length)] : current;
        };

        for (const [category, fields] of Object.entries(freeGeneOptions)) {
          for (const [field, options] of Object.entries(fields)) {
            if (Math.random() < MUTATION_RATE) {
              genomeResult[category][field] = pickMutationValue(category, field, options, genomeResult[category]?.[field]);
              mutationCount++;
            }
          }
        }
        for (const [category, fields] of Object.entries(semiFlexGeneOptions)) {
          for (const [field, options] of Object.entries(fields)) {
            if (Math.random() < MUTATION_RATE / 2) {
              genomeResult[category][field] = pickMutationValue(category, field, options, genomeResult[category]?.[field]);
              mutationCount++;
            }
          }
        }
        if (Math.random() < MUTATION_RATE / 2) {
          const currentEmotion = genomeResult.emotion;
          const prefEmotion = preferenceWeights["_emotion"]?.["_preferred_value"] as unknown as string;
          if (prefEmotion && prefEmotion !== currentEmotion && emotionOptions.includes(prefEmotion) && Math.random() < 0.6) {
            genomeResult.emotion = prefEmotion;
          } else {
            const altEmotions = emotionOptions.filter((e: string) => e !== currentEmotion);
            genomeResult.emotion = altEmotions[Math.floor(Math.random() * altEmotions.length)];
          }
          mutationCount++;
        }

        if (mutationCount > 0) {
          console.log(`Genome Mutation: ${mutationCount} gene(s) mutated (preference-biased)`);
        }

        // --- BRAND LOCK ENFORCEMENT ---
        // Override locked genes with actual brand values to prevent genome contradicting brand
        if (brand) {
          let lockCount = 0;

          // Lock color genes based on brand colors
          if (brand.primary_colors && brand.primary_colors.length > 0) {
            const colorAnalysis = analyzeBrandColors(brand.primary_colors);
            if (genomeResult.color.temperature !== colorAnalysis.temperature) {
              genomeResult.color.temperature = colorAnalysis.temperature;
              lockCount++;
            }
            if (genomeResult.color.saturation !== colorAnalysis.saturation && !["neon", "muted"].includes(genomeResult.color.saturation)) {
              genomeResult.color.saturation = colorAnalysis.saturation;
              lockCount++;
            }
          }

          // Lock typography personality based on brand font
          if (brand.typography_primary) {
            const mappedPersonality = mapFontToPersonality(brand.typography_primary);
            if (mappedPersonality && genomeResult.typography.font_personality !== mappedPersonality) {
              genomeResult.typography.font_personality = mappedPersonality;
              lockCount++;
            }
          }

          if (lockCount > 0) {
            console.log(`Brand Lock: ${lockCount} gene(s) locked to brand values`);
          }
        }

        // Surface trend-locked genes for downstream conflict-resolution (H3)
        if (trendLockedGenes.size > 0) {
          genomeResult._trend_locked_genes = Array.from(trendLockedGenes);
        }
        console.log("Final genome:", JSON.stringify(genomeResult));

      } catch (e) {
        console.error("Genome Composer error, proceeding without:", e);
      }
      return genomeResult;
      })();

      // --- AWAIT BRIEF + GENOME IN PARALLEL ---
      let briefResult: { creative_direction: string; composition_goal: string; emotional_tone: string; design_focus: string; explanation: string };
      let genomeData: any = null;
      try {
        const briefSpan = tracer.startSpan("brief+genome");
        const results = await Promise.all([briefPromise, genomePromise]);
        briefResult = results[0];
        genomeData = results[1];
        briefSpan.finish();

        // Validate genome output
        if (genomeData) {
          const validation = validateGenome(genomeData);
          if (validation) {
            genomeData = validation.genome;
            if (validation.fixes.length > 0) {
              console.log(`Genome validation fixes: ${validation.fixes.join(", ")}`);
            }
          }
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        if (errMsg === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (errMsg === "CREDITS_EXHAUSTED") {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw e;
      }

      // Assemble designPrompt from structured brief (used by downstream agents)
      const designPrompt = briefResult.creative_direction;
      const explanation = briefResult.explanation;

      // genomeContext is now built per-variation inside renderVariation()

      // --- PARALLEL: COPYWRITER + CAPTION AGENTS ---
      let copyStructure: { headline: string; subheadline: string; cta: string; supporting_text: string } | null = null;
      let captionText: string | null = null;

      // Resolve content category (already completed during brief — instant)
      const resolvedCategory = await contentCategoryPromise;
      const resolvedCategoryData = CONTENT_CATEGORIES[resolvedCategory];
      const researchEnrichment = await researchPromise;
      const researchContext = researchEnrichment.promptText;

      // --- BRAND UPDATES: pull category-relevant real-world updates as factual seed ---
      let updatesUsed: any[] = [];
      let updatesContext = "";
      if (brand?.id) {
        try {
          const cats = ["social_proof", "bts", "announcement", "trending", "promotional", "informational"];
          const wantUpdates = cats.includes(resolvedCategory);
          const updates = await fetchRecentUpdates(adminClient, brand.id, {
            categoryId: resolvedCategory,
            limit: wantUpdates ? 5 : 3,
            recencyDays: wantUpdates ? 60 : 30,
          });
          if (updates.length > 0) {
            updatesUsed = updates;
            const heading = resolvedCategory === "social_proof"
              ? "BUSINESS UPDATES (real testimonials/customer stories from this brand — when a testimonial exists in this list you MUST use the verbatim quote and attribution; NEVER fabricate testimonials):"
              : resolvedCategory === "bts"
              ? "BUSINESS UPDATES (real recent activity behind the scenes — ground BTS copy in these specific events, names, and outcomes):"
              : resolvedCategory === "announcement"
              ? "BUSINESS UPDATES (real recent launches, milestones, partnerships, press — anchor the announcement in these factual items):"
              : "BUSINESS UPDATES (real recent activity from this brand — prefer these as factual seed material; do not invent events when this list is non-empty):";
            updatesContext = formatUpdatesForPrompt(updates, { heading });
          }
        } catch (e) {
          console.log("[design-studio] updates fetch failed:", e instanceof Error ? e.message : e);
        }
      }

      const copyForbiddenContext = buildCopyForbiddenContext(resolvedCategory);
      const ctaPolicyLine = (() => {
        const policy = CATEGORY_RECIPES[resolvedCategory]?.cta_policy;
        if (policy === "forbidden") return "\n\nCTA POLICY: This category does NOT use a CTA. Leave the cta field as an empty string. Do NOT include any action language ('shop', 'buy', 'learn more', 'sign up', etc.) anywhere in the copy.";
        if (policy === "required") return "\n\nCTA POLICY: A clear, specific CTA is REQUIRED for this category. Never leave the cta field empty.";
        return "";
      })();
      const copyCategoryContext = resolvedCategoryData ? `\n\nCONTENT CATEGORY: ${resolvedCategoryData.name}\n${resolvedCategoryData.copy_directive}${copyForbiddenContext}${ctaPolicyLine}${researchContext}${updatesContext}` : "";
      const captionCategoryContext = resolvedCategoryData ? `\n\nCONTENT CATEGORY: ${resolvedCategoryData.name}\n${resolvedCategoryData.caption_directive}${copyForbiddenContext}${ctaPolicyLine}${researchContext}${updatesContext}` : "";

      const trendPresetForCopy = trend && trend !== "none" ? (({
        "tactile-rebellion": "More expressive and human — use imperfect, authentic, conversational language",
        "hyper-chromatic": "High-energy promotional language — bold, punchy, exclamatory, confident",
        "technical-mono": "Shorter and sharper copy — precise, technical, no-nonsense, data-driven",
        "neo-naturalism": "Calm and soothing tone — gentle, reassuring, mindful, nurturing",
        "kinetic-typography": "Energetic and dynamic — action-oriented verbs, short punchy phrases, momentum-building",
      } as Record<string, string>)[trend] || "") : "";

      // Copywriter Agent (runs in parallel with Caption)
      const copywriterPromise = (async () => {
        try {
          const copywriterPrompt = `You are a world-class brand copywriter. Your job is to write the EXACT text that will appear on a social media graphic.

CONTEXT:
- Creative direction: ${designPrompt}
- Composition goal: ${briefResult.composition_goal}
- Design focus: ${briefResult.design_focus}
- Emotional tone: ${briefResult.emotional_tone}
- User's original request: "${userPrompt}"
- Brand name: ${brand?.name || "Unknown"}
- Brand tone of voice: ${brand?.tone_of_voice || "Professional"}
- Brand personality: ${(brand?.personality_traits || []).join(", ") || "Professional"}
- Brand vibe: ${brand?.vibe || "Modern"}
${audienceContext ? `\n${audienceContext}` : ""}
${trendPresetForCopy ? `\nCOPY TONE ADJUSTMENT: ${trendPresetForCopy}` : ""}${canvasFormatCopy}${chatHistoryContext}${copyCategoryContext}
${genomeData ? `\nVISUAL DENSITY CONTEXT: The design uses ${genomeData.layout.content_ratio.replace(/_/g, " ")} content ratio with ${genomeData.typography.hierarchy_logic.replace(/_/g, " ")}. Adjust copy length accordingly — text_minimal means fewer words, text_dominant means richer copy.` : ""}

RULES:
1. The copy MUST directly address the user's request topic: "${userPrompt}"
2. Total word count across ALL fields: 15-25 words maximum
3. Use the brand's tone of voice and personality
4. If audience intelligence is provided, leverage emotional drivers and messaging angles for persuasion
5. NEVER use generic filler like "Elevate your brand" or "Take it to the next level" unless that's what the user asked for
6. The headline is the most important element — make it punchy, specific, and on-topic
7. Leave fields empty ("") if they are not needed for this design. Not every design needs all fields.
8. The copy must sound like it was written by the brand, not by a generic AI
${brand?.special_instructions ? `\nSPECIAL BRAND INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY):\n${brand.special_instructions}` : ""}`;

          const copySpan = tracer.startSpan("copywriter");
          const copyToolsDef = [{
            type: "function",
            function: {
              name: "set_copy",
              description: "Set the exact copy text for the social media graphic",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "Main headline text (required, 3-8 words)" },
                  subheadline: { type: "string", description: "Supporting subheadline (optional, 3-10 words, empty string if not needed)" },
                  cta: { type: "string", description: "Call to action text (optional, 2-5 words, empty string if not needed)" },
                  supporting_text: { type: "string", description: "Any additional small text (optional, empty string if not needed)" },
                },
                required: ["headline", "subheadline", "cta", "supporting_text"],
                additionalProperties: false,
              },
            },
          }];

          const { response: copyResponse, modelUsed: copyModel } = await callWithFallback(
            MODEL_CHAINS.chat,
            (model) => ({
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: copywriterPrompt },
                  { role: "user", content: `Write the exact copy for this design. Return structured JSON only.` },
                ],
                tools: copyToolsDef,
                tool_choice: { type: "function", function: { name: "set_copy" } },
              }),
            }),
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            LOVABLE_API_KEY,
          );

          recordSuccess("ai-gateway");

          if (copyResponse.ok) {
            const copyData = await copyResponse.json();
            const toolCall = copyData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const rawResult = JSON.parse(toolCall.function.arguments);
              // Validate copy structure
              const validated = validateCopyStructure(rawResult);
              if (!validated) {
                console.warn("Copywriter output failed validation, using raw:", JSON.stringify(rawResult));
              }
              const result = validated || rawResult;
              console.log(`Copywriter output (model: ${copyModel}):`, JSON.stringify(result));
              copySpan.finish({ metadata: { model: copyModel } });
              return result;
            }
          } else {
            console.error("Copywriter agent failed, falling back to image model copy:", copyResponse.status);
          }
          copySpan.finish({ status: "error" });
        } catch (e) {
          recordFailure("ai-gateway");
          console.error("Copywriter agent error, falling back:", e);
        }
        return null;
      })();

      // Caption Agent — H5: now awaits copywriter so caption mirrors the actual on-image headline.
      const captionPromise = (async () => {
        try {
          // Wait for copywriter so the caption can reference the exact headline rendered on the design.
          const upstreamCopy = await copywriterPromise.catch(() => null);
          const renderedCopyBlock = upstreamCopy
            ? `\n\nFINAL COPY RENDERED ON THE DESIGN (mirror this language — do NOT contradict or restate differently):\n- Headline: "${upstreamCopy.headline}"${upstreamCopy.subheadline ? `\n- Subheadline: "${upstreamCopy.subheadline}"` : ""}${upstreamCopy.cta ? `\n- CTA: "${upstreamCopy.cta}"` : ""}`
            : "";

          const captionSystemPrompt = `You are Brandie's social media caption writer. You write scroll-stopping, brand-aligned captions for social media posts.

BRAND CONTEXT:
- Brand: ${brand?.name || "Unknown"}
- Tone: ${brand?.tone_of_voice || "Professional"}
- Personality: ${(brand?.personality_traits || []).join(", ") || "None"}
- Vibe: ${brand?.vibe || "Modern"}
${audienceContext ? `\n${audienceContext}` : ""}

RULES:
1. Write a ready-to-post caption (2-4 sentences max)
2. Match the brand's tone of voice exactly
3. Include a clear call-to-action or engagement hook
4. Generate 5-10 relevant hashtags mixing popular and niche
5. Use line breaks between caption and hashtags
6. Do NOT use generic filler — every word must serve the brand
7. If audience data is available, use emotional drivers and messaging angles
8. The caption must be semantically aligned with the on-image headline when one is provided — extend or contextualise it, never contradict.
${brand?.special_instructions ? `\nSPECIAL BRAND INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY):\n${brand.special_instructions}` : ""}${captionCategoryContext}${renderedCopyBlock}`;

          const captionUserPrompt = `Write a social media caption for this design:
Brief: ${designPrompt}
User request: "${userPrompt}"`;

          const captionSpan = tracer.startSpan("caption");
          const captionToolsDef = [{
            type: "function",
            function: {
              name: "set_caption",
              description: "Set the social media caption and hashtags for the design",
              parameters: {
                type: "object",
                properties: {
                  caption: { type: "string", description: "The main caption text (2-4 sentences, ready to post)" },
                  hashtags: {
                    type: "array",
                    items: { type: "string" },
                    description: "5-10 relevant hashtags including the # symbol",
                  },
                },
                required: ["caption", "hashtags"],
                additionalProperties: false,
              },
            },
          }];

          const { response: captionResponse, modelUsed: captionModel } = await callWithFallback(
            MODEL_CHAINS.chat,
            (model) => ({
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: captionSystemPrompt },
                  { role: "user", content: captionUserPrompt },
                ],
                tools: captionToolsDef,
                tool_choice: { type: "function", function: { name: "set_caption" } },
              }),
            }),
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            LOVABLE_API_KEY,
          );

          recordSuccess("ai-gateway");




          if (captionResponse.ok) {
            const captionData = await captionResponse.json();
            const toolCall = captionData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const parsed = JSON.parse(toolCall.function.arguments);
              const result = parsed.caption + "\n\n" + (parsed.hashtags || []).join(" ");
              console.log(`Caption Agent output (model: ${captionModel}):`, result);
              captionSpan.finish({ metadata: { model: captionModel } });
              return result;
            }
          } else {
            console.error("Caption agent failed:", captionResponse.status);
          }
          captionSpan.finish({ status: "error" });
        } catch (e) {
          recordFailure("ai-gateway");
          console.error("Caption agent error:", e);
        }
        return null;
      })();

      // Await both in parallel
      const [copyResult, captionResult] = await Promise.all([copywriterPromise, captionPromise]);
      // Enforce CTA policy on copy (strips CTA-style language for "forbidden" categories,
      // injects sensible default for "required" if missing).
      copyStructure = enforceCTAPolicy(copyResult, resolvedCategory);
      if (copyStructure && copyResult && copyStructure.cta !== copyResult.cta) {
        console.log(`[CTA enforcement] category=${resolvedCategory} policy=${CATEGORY_RECIPES[resolvedCategory]?.cta_policy} cta_before="${copyResult.cta}" cta_after="${copyStructure.cta}"`);
      }
      captionText = captionResult;

      // --- CATEGORY BIAS: nudge free/semi-flexible genes toward category preferences ---
      if (genomeData) {
        // H3: When trend intensity is at least 50%, protect trend-locked genes from being
        // overwritten by category bias (resolves the trend-vs-category collision).
        const trendIntensityPct = trend_intensity ?? 40;
        const lockedGenesArr: string[] = Array.isArray(genomeData._trend_locked_genes) ? genomeData._trend_locked_genes : [];
        const protectTrend = trendIntensityPct >= 50 && lockedGenesArr.length > 0;
        const trendLockedSet = protectTrend ? new Set(lockedGenesArr) : null;
        applyCategoryBias(genomeData, resolvedCategory, 0.7, false, trendLockedSet);
        const fitScore = computeCategoryFit(genomeData, resolvedCategory);
        genomeData._category_fit = fitScore;
        console.log(`[category-bias] category=${resolvedCategory} fit_score=${fitScore} biases_applied=${genomeData._category_bias_applied || 0} skipped_for_trend=${genomeData._category_bias_skipped_for_trend || 0}`);
      }



      // --- HELPER: Apply stability gate to a genome ---
      function applyStabilityGate(genome: any, brandData: any, trendId: string | undefined, trendInt: number | undefined, copy: any): { genome: any; scores: Record<string, number> } {
        let scores = computeGenomeScores(genome, brandData, trendId, trendInt, copy);
        genome._scores = scores;
        if (scores.overall < 55) {
          console.log(`Stability Gate triggered: overall=${scores.overall}`);
          const dimensions = ["brand_alignment", "trend_balance", "visual_clarity", "conversion", "visual_balance"];
          const weakest = dimensions.reduce((a, b) => (scores[a] < scores[b] ? a : b));
          if (weakest === "visual_clarity") {
            genome.color.contrast = "high";
            genome.typography.hierarchy_logic = "strong_headline_dominance";
            genome.layout.spacing_density = "balanced";
            genome.composition.focal_strategy = "single_focal_point";
            genome.texture.distortion = "none";
          } else if (weakest === "brand_alignment") {
            const vibeEmotions: Record<string, string> = { cinematic: "luxurious", minimal: "calm", bold: "energetic", playful: "playful", luxury: "luxurious", corporate: "authoritative" };
            genome.emotion = vibeEmotions[(brandData?.vibe || "").toLowerCase()] || genome.emotion;
            const toneFonts: Record<string, string> = { professional: "corporate", humourous: "friendly", formal: "corporate", casual: "friendly", inspirational: "editorial" };
            genome.typography.font_personality = toneFonts[(brandData?.tone_of_voice || "").toLowerCase()] || genome.typography.font_personality;
          } else if (weakest === "conversion") {
            genome.composition.focal_strategy = "single_focal_point";
            genome.typography.hierarchy_logic = "strong_headline_dominance";
            if (!["energetic", "authoritative", "rebellious"].includes(genome.emotion)) genome.emotion = "energetic";
          } else if (weakest === "visual_balance") {
            genome.layout.balance = "asymmetrical";
            genome.composition.layering_depth = "medium";
            genome.layout.spacing_density = "balanced";
          }
          genome._refined = true;
          scores = computeGenomeScores(genome, brandData, trendId, trendInt, copy);
          genome._scores = scores;
        }
        return { genome, scores };
      }

      // --- HELPER: Serialize genome into a context string for the image prompt ---
      function serializeGenomeContext(gd: any): string {
        if (!gd) return "";
        return `

VISUAL STYLE GENOME (follow these precise styling instructions):
- Color: ${gd.color.palette_type.replace(/_/g, " ")} palette, ${gd.color.temperature} temperature, ${gd.color.contrast} contrast, ${gd.color.saturation} saturation, ${gd.color.gradient_logic.replace(/_/g, " ")}
- Typography: ${gd.typography.font_personality} personality, ${gd.typography.weight_system.replace(/_/g, " ")} weight, ${gd.typography.hierarchy_logic.replace(/_/g, " ")}, ${gd.typography.typography_layout.replace(/_/g, " ")} layout${gd.typography.text_effect !== "none" ? `, ${gd.typography.text_effect.replace(/_/g, " ")} effect` : ""}
- Layout: ${gd.layout.grid_type.replace(/_/g, " ")}, ${gd.layout.balance} balance, ${gd.layout.spacing_density} density, ${gd.layout.content_ratio.replace(/_/g, " ")}
- Composition: ${gd.composition.visual_direction} direction, ${gd.composition.focal_strategy.replace(/_/g, " ")}, ${gd.composition.layering_depth.replace(/_/g, " ")} layering
- Texture: ${gd.texture.texture_type.replace(/_/g, " ")}${gd.texture.texture_type !== "none" ? `, ${gd.texture.intensity} intensity` : ""}${gd.texture.distortion !== "none" ? `, ${gd.texture.distortion} distortion` : ""}
- Image Style: ${gd.image_style.lighting} lighting, ${gd.image_style.color_grading} grading, ${gd.image_style.framing.replace(/_/g, " ")} framing
- Emotion: ${gd.emotion}`;
      }

      // (mutateGenomeCopy removed — single generation per call)

      // --- HELPER: Render a single image given genome + shared context ---
      async function renderVariation(
        varGenome: any,
        varGenomeScores: Record<string, number> | null,
        label: string,
      ): Promise<{ image_url: string; genome: any; genome_scores: Record<string, number> | null; refined: boolean }> {
        const varGenomeContext = serializeGenomeContext(varGenome);
        const varCopyInjection = copyStructure
          ? `\n\nEXACT TEXT TO RENDER ON THE DESIGN (use these EXACT words, do NOT modify, rephrase, or add ANY other text):
- Headline: "${copyStructure.headline}"${copyStructure.subheadline ? `\n- Subheadline: "${copyStructure.subheadline}"` : ""}${copyStructure.cta ? `\n- CTA: "${copyStructure.cta}"` : ""}${copyStructure.supporting_text ? `\n- Supporting text: "${copyStructure.supporting_text}"` : ""}
CRITICAL: Render ONLY the text listed above. Do NOT invent, add, or modify any text. Every word on the graphic must match exactly.`
          : "";

        const userImageInstruction = user_image_url
          ? ` CRITICAL: The user has provided a reference image (attached). Incorporate it into the design EXACTLY as the user describes. This image is the PRIMARY visual reference and must be used prominently.`
          : "";
        const dimensionEnforcement = buildDimensionEnforcement(w, h, canvas.label);

        const categoryRenderInjection = buildCategoryRenderInjection(resolvedCategory);
        const imagePromptText = `${dimensionEnforcement}\n\nCreate a PHOTOREALISTIC, clean, modern, visually stunning professional social media graphic (${sizeLabel} format, ${w}x${h} pixels). Use REAL PHOTOGRAPHY, natural textures, and lifelike imagery — NOT cartoons, clip art, or flat illustrations — unless the user specifically requests otherwise. The design must be professionally composed with balanced layout, clear visual hierarchy, generous breathing room, and a polished 2026 aesthetic. MANDATORY POLISH & FINISH: Render the entire composition with a refined, glassy, premium finish — soft specular highlights, gentle depth-of-field, subtle reflective sheen on key surfaces, crisp edges, micro-contrast, and tasteful glassmorphism on overlay panels (translucent frosted layers with delicate inner highlights and soft outer shadows). Output must look studio-grade: sharp, high-fidelity, magazine-quality. Avoid muddy gradients, blurry textures, jagged edges, low-resolution artefacts, or amateur compositing. CRITICAL TEXT CONTRAST RULE: ALL text MUST have excellent colour contrast against its background. When placing text over photographic or busy backgrounds, ALWAYS use a semi-transparent overlay, gradient scrim, or solid colour block behind the text. Light text on dark backgrounds, dark text on light backgrounds — never low-contrast combinations. Readability is non-negotiable.${varCopyInjection} ${copyStructure ? "" : `CRITICAL TEXT RULES: Only include text that directly serves the user's request and aligns with the brand's value proposition. Do NOT add filler text, random quotes, unnecessary taglines, or decorative text that wasn't asked for. Every word on the design must be intentional and relevant. If the design only needs a headline, do not add extra text elements just to fill space.`} IMPORTANT: The design must be about "${userPrompt}". Use these exact brand colours: primary ${(brand?.primary_colors || []).join(", ")}, secondary ${(brand?.secondary_colors || []).join(", ")}, accent ${(brand?.accent_colors || []).join(", ")}. Fonts: ${brand?.typography_primary || "sans-serif"} and ${brand?.typography_secondary || "serif"}. Tone: ${brand?.tone_of_voice || "Professional"}. ${brand?.logo_url ? "CRITICAL: Include the company logo (provided as attached image) prominently in the design, typically in the bottom or top corner." : ""}${userImageInstruction}${categoryRenderInjection}${varGenomeContext || (trendContext ? ` TREND STYLING OVERLAY: Apply the following trend aesthetic as a styling layer on top of the base brand design.${trendContext}` : "")} ${designPrompt}${brand?.special_instructions ? ` SPECIAL BRAND INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY): ${brand.special_instructions}` : ""} [VARIATION ${label}]`;

        // gpt-image-2 is text-only (no reference image inputs). Reference URLs
        // are described in the prompt as descriptive hints.
        const refHints: string[] = [];
        if (brand?.logo_url) refHints.push(`Brand logo image URL: ${brand.logo_url}`);
        if (user_image_url) refHints.push(`User-provided reference image URL: ${user_image_url}`);
        if (action === "edit" && previous_image_url) refHints.push(`Previous design URL (preserve overall layout): ${previous_image_url}`);
        for (const inspUrl of inspirationUrls.slice(0, 2)) refHints.push(`Inspiration reference: ${inspUrl}`);
        const productKeywords = /product|promo|promotion|offer|sale|showcase|launch|discount|deal|shop|buy|order|new arrival|collection|menu|service/i;
        const isProductRelevant = productKeywords.test(userPrompt) || productKeywords.test(designPrompt);
        if (isProductRelevant && productImageUrls.length > 0 && !user_image_url) {
          for (const prodUrl of productImageUrls.slice(0, 2)) refHints.push(`Product image reference: ${prodUrl}`);
        }
        const refHintsText = refHints.length > 0 ? `\n\nREFERENCE IMAGE HINTS (described, not attached):\n- ${refHints.join("\n- ")}` : "";
        const editHint = action === "edit" && previous_image_url ? " EDIT: Keep the overall layout similar to the previous design but apply the user's changes." : "";

        const finalPrompt = imagePromptText + editHint + refHintsText;

        // Render via gpt-image-2 (/v1/images/generations).
        const imageBase64 = await renderWithGptImage(finalPrompt, w, h);
        let binaryData = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

        // Strict platform-aspect enforcement: center-crop + resize to exact target dims.
        binaryData = await enforceCanvasDimensions(binaryData, w, h);

        const filePath = `${user.id}/${crypto.randomUUID()}.png`;
        const { error: uploadError } = await adminClient.storage.from("designs").upload(filePath, binaryData, { contentType: "image/png" });
        if (uploadError) throw new Error(`Failed to save image (variation ${label})`);
        const { data: urlData } = adminClient.storage.from("designs").getPublicUrl(filePath);

        return {
          image_url: urlData.publicUrl,
          genome: varGenome,
          genome_scores: varGenomeScores,
          refined: varGenome?._refined === true,
        };
      }

      // --- SINGLE GENERATION (all actions) ---
      let genomeScores: Record<string, number> | null = null;
      if (genomeData) {
        const stabilized = applyStabilityGate(genomeData, brand, trend, trend_intensity, copyStructure);
        genomeScores = stabilized.scores;
      }

      const singleResult = await renderVariation(genomeData, genomeScores, "A");

      // Render succeeded — now deduct credits.
      if (pendingDeduction) {
        try {
          await pendingDeduction();
        } catch (e) {
          console.error("Credit deduction failed after successful render:", e);
        }
      }

      // Log trace
      tracer.log();
      try {
        const summary = tracer.summary();
        await adminClient.from("design_traces").insert({
          run_id: tracer.runId,
          user_id: user.id,
          spans: summary.spans,
          total_latency_ms: summary.total_latency_ms,
          total_input_tokens: summary.total_input_tokens,
          total_output_tokens: summary.total_output_tokens,
          error: summary.error_count > 0 ? JSON.stringify(tracer.getSpans().filter(s => s.status === "error").map(s => s.error)) : null,
        });
      } catch (traceErr) {
        console.error("Failed to persist trace:", traceErr);
      }

      if (updatesUsed.length > 0) {
        markUpdatesUsed(adminClient, updatesUsed.map((u: any) => u.id)).catch(() => {});
      }

      return new Response(
        JSON.stringify({
          image_url: singleResult.image_url,
          explanation,
          design_prompt: designPrompt,
          free_edit: isFreeEdit,
          ...(copyStructure ? { copy_structure: copyStructure } : {}),
          ...(genomeData ? { genome: genomeData } : {}),
          ...(genomeScores ? { genome_scores: genomeScores } : {}),
          refined: singleResult.refined,
          ...(captionText ? { caption: captionText } : {}),
          run_id: tracer.runId,
          content_category: resolvedCategory,
          ...(researchEnrichment?.sources?.length ? { research_sources: researchEnrichment.sources } : {}),
          ...(updatesUsed.length ? { updates_used: summariseForClient(updatesUsed) } : {}),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === CAROUSEL ACTION ===
    if (action === "generate_carousel") {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const numSlides = Math.min(10, Math.max(2, slide_count || 5));
      // Carousel pricing: floor(slides * 1.5), quality-independent. Single still uses render_quality.
      const creditCost = Math.floor(numSlides * 1.5);

      // Pre-check credits — actual deduction happens AFTER all slides successfully render.
      let pendingCarouselDeduction: null | (() => Promise<void>) = null;
      const { data: profile } = await adminClient
        .from("profiles")
        .select("generations_count, generations_reset_at, bonus_credits, subscription_tier, paid_credits")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        const resetAt = new Date(profile.generations_reset_at);
        const now = new Date();
        const needsReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();
        const FREE_MONTHLY = 5;
        const currentCount = needsReset ? 0 : profile.generations_count;
        const freeRemaining = Math.max(0, FREE_MONTHLY - currentCount);
        const bonusCredits = profile.bonus_credits || 0;
        const paidCredits = (profile as any).paid_credits || 0;

        const { data: rewardRows } = await adminClient
          .from("credit_rewards")
          .select("id, remaining")
          .eq("user_id", user.id)
          .gt("remaining", 0)
          .gt("expires_at", now.toISOString())
          .order("expires_at", { ascending: true });
        const rewardCredits = (rewardRows || []).reduce((s: number, r: any) => s + r.remaining, 0);

        const totalAvailable = freeRemaining + bonusCredits + rewardCredits + paidCredits;

        if (creditCost > totalAvailable) {
          return new Response(JSON.stringify({ error: "Not enough credits for carousel. You need " + creditCost + " credits." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        pendingCarouselDeduction = async () => {
          const { data: freshRewardRows } = await adminClient
            .from("credit_rewards")
            .select("id, remaining")
            .eq("user_id", user.id)
            .gt("remaining", 0)
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: true });

          let remainingCost = creditCost;
          const updates: any = {};
          if (needsReset) updates.generations_reset_at = now.toISOString();

          const freeToUse = Math.min(remainingCost, freeRemaining);
          updates.generations_count = currentCount + freeToUse;
          remainingCost -= freeToUse;

          if (remainingCost > 0) {
            const bonusToUse = Math.min(remainingCost, bonusCredits);
            updates.bonus_credits = bonusCredits - bonusToUse;
            remainingCost -= bonusToUse;
          }

          if (remainingCost > 0 && freshRewardRows && freshRewardRows.length > 0) {
            for (const rw of freshRewardRows) {
              if (remainingCost <= 0) break;
              const toUse = Math.min(remainingCost, rw.remaining);
              await adminClient.from("credit_rewards").update({ remaining: rw.remaining - toUse }).eq("id", rw.id);
              remainingCost -= toUse;
            }
          }

          if (remainingCost > 0) {
            updates.paid_credits = paidCredits - remainingCost;
          }

          await adminClient.from("profiles").update(updates).eq("user_id", user.id);
        };
      }

      const carouselId = crypto.randomUUID();
      const userPrompt = messages[messages.length - 1]?.content || "";

      // Build brand context
      const brandContext = brand ? `BRAND CONTEXT:\n- Name: ${brand.name || "Unknown"}\n- Vibe: ${brand.vibe || "Modern"}\n- Tone: ${brand.tone_of_voice || "Professional"}\n- Personality: ${(brand.personality_traits || []).join(", ")}\n- Primary colours: ${(brand.primary_colors || []).join(", ")}\n- Fonts: ${brand.typography_primary || "sans-serif"}, ${brand.typography_secondary || "serif"}` : "";

      // Fetch audience
      let audienceContext = "";
      if (brand?.id) {
        try {
          const { data: audienceData } = await adminClient.from("target_audiences").select("jtbd_profile").eq("brand_id", brand.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
          if (audienceData?.jtbd_profile) {
            const p = audienceData.jtbd_profile as any;
            audienceContext = `\nAUDIENCE: ${p.persona_summary || ""}\nStruggles: ${(p.struggling_moments || []).slice(0, 2).join("; ")}\nDrivers: ${(p.emotional_outcomes || []).slice(0, 2).join("; ")}`;
          }
        } catch {}
      }

      // Step 1: Generate unified creative brief + narrative arc for all slides
      const arcPrompt = `You are a senior creative director planning an Instagram carousel with ${numSlides} slides.

${brandContext}${audienceContext}

User request: "${userPrompt}"

Create a unified creative direction and per-slide copy following this narrative arc:
- Slide 1: HOOK — attention-grabbing opening
- Slides 2-${numSlides - 1}: VALUE — key benefits, insights, or story beats
- Slide ${numSlides}: CTA — clear call to action

Return structured JSON.`;

      const arcResponse = await retryFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: arcPrompt }, { role: "user", content: "Generate the carousel plan now." }],
          tools: [{
            type: "function",
            function: {
              name: "set_carousel_plan",
              description: "Set the carousel creative plan",
              parameters: {
                type: "object",
                properties: {
                  creative_direction: { type: "string", description: "Overall visual direction for the carousel (3-4 sentences)" },
                  explanation: { type: "string", description: "Brief explanation for the user (1-2 sentences)" },
                  slides: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        slide_label: { type: "string", description: "e.g. 'Hook', 'Benefit 1', 'CTA'" },
                        headline: { type: "string", description: "Main headline (3-8 words)" },
                        subheadline: { type: "string", description: "Supporting text (0-10 words, empty if not needed)" },
                        cta: { type: "string", description: "CTA text (0-5 words, empty if not needed)" },
                        scene_description: { type: "string", description: "What this specific slide shows visually (1-2 sentences)" },
                      },
                      required: ["slide_label", "headline", "subheadline", "cta", "scene_description"],
                    },
                    description: `Exactly ${numSlides} slides`,
                  },
                },
                required: ["creative_direction", "explanation", "slides"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "set_carousel_plan" } },
        }),
      });

      if (!arcResponse.ok) {
        if (arcResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (arcResponse.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Failed to plan carousel");
      }

      const arcData = await arcResponse.json();
      const arcToolCall = arcData.choices?.[0]?.message?.tool_calls?.[0];
      let carouselPlan: { creative_direction: string; explanation: string; slides: any[] };
      if (arcToolCall?.function?.arguments) {
        carouselPlan = JSON.parse(arcToolCall.function.arguments);
      } else {
        throw new Error("Failed to parse carousel plan");
      }

      // Ensure we have the right number of slides
      while (carouselPlan.slides.length < numSlides) {
        carouselPlan.slides.push({ slide_label: `Slide ${carouselPlan.slides.length + 1}`, headline: brand?.name || "More", subheadline: "", cta: "", scene_description: "Continuation slide" });
      }
      carouselPlan.slides = carouselPlan.slides.slice(0, numSlides);

      // Step 2: Compose shared genome (reuse existing logic)
      const brandVibeLower = (brand?.vibe || "").toLowerCase();
      const vibePresetMap: Record<string, string> = { cinematic: "luxury-editorial", minimal: "minimalist-modern", bold: "bold-startup", playful: "streetwear-alte", luxury: "luxury-editorial", corporate: "corporate-clean", futuristic: "tech-futurism", natural: "organic-natural", retro: "retro-futurism" };
      const basePresetId = vibePresetMap[brandVibeLower] || "bold-startup";

      const GENOME_PRESETS: Record<string, any> = {
        "minimalist-modern": { color: { palette_type: "monochrome", temperature: "neutral", contrast: "medium", saturation: "muted", gradient_logic: "flat" }, typography: { font_personality: "corporate", weight_system: "light", hierarchy_logic: "text_minimal", typography_layout: "centered", text_effect: "none" }, layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "minimal", content_ratio: "balanced" }, composition: { visual_direction: "vertical", focal_strategy: "single_focal_point", layering_depth: "flat" }, texture: { texture_type: "none", intensity: "subtle", distortion: "none" }, illustration: { style: "none", detail_level: "minimal", line_weight: "thin" }, image_style: { lighting: "natural", color_grading: "monochrome", framing: "wide" }, emotion: "calm" },
        "luxury-editorial": { color: { palette_type: "complementary", temperature: "warm", contrast: "high", saturation: "balanced", gradient_logic: "metallic_gradient" }, typography: { font_personality: "editorial", weight_system: "bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "left_editorial", text_effect: "none" }, layout: { grid_type: "modular_grid", balance: "asymmetrical", spacing_density: "balanced", content_ratio: "image_dominant" }, composition: { visual_direction: "diagonal", focal_strategy: "dual_focal", layering_depth: "deep_layered" }, texture: { texture_type: "paper", intensity: "subtle", distortion: "none" }, illustration: { style: "none", detail_level: "high", line_weight: "thin" }, image_style: { lighting: "dramatic", color_grading: "cinematic", framing: "portrait" }, emotion: "luxurious" },
        "bold-startup": { color: { palette_type: "complementary", temperature: "warm", contrast: "high", saturation: "vibrant", gradient_logic: "soft_gradient" }, typography: { font_personality: "friendly", weight_system: "bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "centered", text_effect: "none" }, layout: { grid_type: "modular_grid", balance: "asymmetrical", spacing_density: "balanced", content_ratio: "balanced" }, composition: { visual_direction: "diagonal", focal_strategy: "single_focal_point", layering_depth: "medium" }, texture: { texture_type: "none", intensity: "subtle", distortion: "none" }, illustration: { style: "flat", detail_level: "medium", line_weight: "medium" }, image_style: { lighting: "natural", color_grading: "vibrant", framing: "wide" }, emotion: "energetic" },
        "streetwear-alte": { color: { palette_type: "triadic", temperature: "warm", contrast: "extreme", saturation: "vibrant", gradient_logic: "flat" }, typography: { font_personality: "street", weight_system: "ultra_bold", hierarchy_logic: "strong_headline_dominance", typography_layout: "overlay", text_effect: "outline" }, layout: { grid_type: "broken_grid", balance: "dynamic", spacing_density: "dense", content_ratio: "text_dominant" }, composition: { visual_direction: "diagonal", focal_strategy: "distributed", layering_depth: "deep_layered" }, texture: { texture_type: "grain", intensity: "heavy", distortion: "glitch" }, illustration: { style: "abstract", detail_level: "medium", line_weight: "bold" }, image_style: { lighting: "neon", color_grading: "vibrant", framing: "close_crop" }, emotion: "rebellious" },
        "corporate-clean": { color: { palette_type: "analogous", temperature: "cool", contrast: "medium", saturation: "balanced", gradient_logic: "soft_gradient" }, typography: { font_personality: "corporate", weight_system: "regular", hierarchy_logic: "balanced_hierarchy", typography_layout: "left_editorial", text_effect: "none" }, layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" }, composition: { visual_direction: "horizontal", focal_strategy: "single_focal_point", layering_depth: "flat" }, texture: { texture_type: "none", intensity: "subtle", distortion: "none" }, illustration: { style: "flat", detail_level: "minimal", line_weight: "thin" }, image_style: { lighting: "soft", color_grading: "cinematic", framing: "wide" }, emotion: "authoritative" },
        "tech-futurism": { color: { palette_type: "monochrome", temperature: "cool", contrast: "high", saturation: "balanced", gradient_logic: "soft_gradient" }, typography: { font_personality: "futuristic", weight_system: "regular", hierarchy_logic: "text_minimal", typography_layout: "left_editorial", text_effect: "none" }, layout: { grid_type: "strict_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" }, composition: { visual_direction: "horizontal", focal_strategy: "distributed", layering_depth: "medium" }, texture: { texture_type: "digital_noise", intensity: "subtle", distortion: "none" }, illustration: { style: "3d", detail_level: "high", line_weight: "thin" }, image_style: { lighting: "dramatic", color_grading: "cinematic", framing: "wide" }, emotion: "futuristic" },
        "organic-natural": { color: { palette_type: "analogous", temperature: "warm", contrast: "low", saturation: "muted", gradient_logic: "soft_gradient" }, typography: { font_personality: "friendly", weight_system: "light", hierarchy_logic: "balanced_hierarchy", typography_layout: "centered", text_effect: "none" }, layout: { grid_type: "freeform", balance: "symmetrical", spacing_density: "minimal", content_ratio: "image_dominant" }, composition: { visual_direction: "vertical", focal_strategy: "single_focal_point", layering_depth: "medium" }, texture: { texture_type: "paper", intensity: "subtle", distortion: "none" }, illustration: { style: "hand_drawn", detail_level: "medium", line_weight: "thin" }, image_style: { lighting: "natural", color_grading: "vintage", framing: "wide" }, emotion: "organic" },
        "retro-futurism": { color: { palette_type: "split_complementary", temperature: "cool", contrast: "high", saturation: "neon", gradient_logic: "multi_spectrum" }, typography: { font_personality: "futuristic", weight_system: "bold", hierarchy_logic: "balanced_hierarchy", typography_layout: "centered", text_effect: "neon" }, layout: { grid_type: "modular_grid", balance: "symmetrical", spacing_density: "balanced", content_ratio: "balanced" }, composition: { visual_direction: "radial", focal_strategy: "single_focal_point", layering_depth: "deep_layered" }, texture: { texture_type: "metallic", intensity: "medium", distortion: "warp" }, illustration: { style: "3d", detail_level: "high", line_weight: "medium" }, image_style: { lighting: "neon", color_grading: "cinematic", framing: "wide" }, emotion: "futuristic" },
      };

      const genomeData = JSON.parse(JSON.stringify(GENOME_PRESETS[basePresetId] || GENOME_PRESETS["bold-startup"]));

      // Step 3: Render slides in parallel batches of 2
      const size = canvas_size || "1080x1080";
      const canvas = resolveCanvas(size);
      const w = canvas.w;
      const h = canvas.h;
      const sizeLabel = `${canvas.platform} ${canvas.label} (${w}x${h})`;

      const genomeContext = `VISUAL STYLE GENOME: ${genomeData.color.palette_type} palette, ${genomeData.color.temperature} temp, ${genomeData.color.contrast} contrast, ${genomeData.typography.font_personality} typography, ${genomeData.layout.grid_type} grid, ${genomeData.emotion} emotion.`;

      const dimensionEnforcement = buildDimensionEnforcement(w, h, canvas.label);

      const slides: { image_url: string; slide_index: number; copy_structure: any; design_id: string }[] = [];

      // Render in batches of 2
      for (let batchStart = 0; batchStart < numSlides; batchStart += 2) {
        const batchEnd = Math.min(batchStart + 2, numSlides);
        const batchPromises = [];

        for (let i = batchStart; i < batchEnd; i++) {
          const slide = carouselPlan.slides[i];
          const copyInjection = `EXACT TEXT TO RENDER:\n- Headline: "${slide.headline}"${slide.subheadline ? `\n- Subheadline: "${slide.subheadline}"` : ""}${slide.cta ? `\n- CTA: "${slide.cta}"` : ""}\nRender ONLY the text listed above.`;

          const slidePrompt = `${dimensionEnforcement}\n\nCreate a PHOTOREALISTIC, clean, modern professional social media graphic (${sizeLabel}, slide ${i + 1} of ${numSlides} in a carousel). This is the "${slide.slide_label}" slide. ${carouselPlan.creative_direction}\n\nScene: ${slide.scene_description}\n\n${copyInjection}\n\n${genomeContext}\n\nMANDATORY POLISH & FINISH: Render with a refined, glassy, premium finish — soft specular highlights, gentle depth-of-field, subtle reflective sheen, crisp edges, micro-contrast, and tasteful glassmorphism on overlay panels (translucent frosted layers with delicate inner highlights and soft outer shadows). Studio-grade, sharp, magazine-quality. No muddy gradients, blur, or low-resolution artefacts.\n\nIMPORTANT: All slides in this carousel must share the same visual style, colour palette, and typography. Brand colours: ${(brand?.primary_colors || []).join(", ")}. Fonts: ${brand?.typography_primary || "sans-serif"}.${brand?.logo_url ? " Include the brand logo." : ""}${brand?.special_instructions ? ` SPECIAL INSTRUCTIONS: ${brand.special_instructions}` : ""}`;

          const slidePromptWithLogo = brand?.logo_url
            ? `${slidePrompt}\n\nBrand logo image URL (described, not attached): ${brand.logo_url}`
            : slidePrompt;

          batchPromises.push((async () => {
            const imageBase64 = await renderWithGptImage(slidePromptWithLogo, w, h);
            let binaryData = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
            // Strict platform-aspect enforcement on each slide.
            binaryData = await enforceCanvasDimensions(binaryData, w, h);
            const filePath = `${user.id}/${crypto.randomUUID()}.png`;
            const { error: uploadErr } = await adminClient.storage.from("designs").upload(filePath, binaryData, { contentType: "image/png" });
            if (uploadErr) throw new Error(`Slide ${i + 1} upload failed`);
            const { data: urlData } = adminClient.storage.from("designs").getPublicUrl(filePath);

            // Save design row
            const { data: designRow, error: saveErr } = await adminClient.from("designs").insert({
              user_id: user.id,
              brand_id: brand?.id,
              title: `${slide.slide_label} — ${slide.headline}`.slice(0, 100),
              prompt: carouselPlan.creative_direction,
              image_url: urlData.publicUrl,
              canvas_size: size,
              carousel_id: carouselId,
              slide_index: i,
              genome: genomeData,
              vote: 0,
              ...(trend && trend !== "none" && { trend_used: trend, trend_intensity }),
            } as any).select("id").single();

            return {
              image_url: urlData.publicUrl,
              slide_index: i,
              copy_structure: { headline: slide.headline, subheadline: slide.subheadline || "", cta: slide.cta || "", supporting_text: "" },
              design_id: saveErr ? "" : designRow?.id || "",
            };
          })());
        }

        const batchResults = await Promise.all(batchPromises);
        slides.push(...batchResults);

        // Small delay between batches to avoid rate limits
        if (batchEnd < numSlides) await new Promise(r => setTimeout(r, 1000));
      }

      // Generate caption for the carousel
      let captionText: string | null = null;
      try {
        const captionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: `You are a social media caption writer. Write a caption for an Instagram carousel post. Brand: ${brand?.name}. Tone: ${brand?.tone_of_voice || "Professional"}.` },
              { role: "user", content: `Write a caption for a ${numSlides}-slide carousel about: "${userPrompt}". Include 5-8 hashtags.` },
            ],
          }),
        });
        if (captionResp.ok) {
          const capData = await captionResp.json();
          captionText = capData.choices?.[0]?.message?.content || null;
        }
      } catch {}

      console.log(`Carousel generated: ${slides.length} slides, carousel_id=${carouselId}`);

      // All slides rendered successfully — deduct credits now.
      if (pendingCarouselDeduction) {
        try {
          await pendingCarouselDeduction();
        } catch (e) {
          console.error("Carousel credit deduction failed after successful render:", e);
        }
      }

      return new Response(JSON.stringify({
        carousel_id: carouselId,
        slides: slides.sort((a, b) => a.slide_index - b.slide_index),
        explanation: carouselPlan.explanation,
        caption: captionText,
        genome: genomeData,
        genome_scores: computeGenomeScores(genomeData, brand, trend, trend_intensity, null),
        design_prompt: carouselPlan.creative_direction,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("design-studio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Outer serve handler: supports two modes.
//   1. Background mode (body.job_id present): kick off the pipeline via
//      EdgeRuntime.waitUntil, write final result/error to design_jobs, and
//      return an immediate 202 ack to the caller (Inngest worker).
//   2. Sync mode (legacy): behave exactly like before.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Peek the body for a job_id without consuming the request for the inner handler.
  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch {
    bodyText = "";
  }
  let parsed: any = {};
  try { parsed = bodyText ? JSON.parse(bodyText) : {}; } catch { parsed = {}; }

  const jobId: string | undefined = parsed?.job_id;

  // Snapshot headers/url/method NOW while the request is still open. Reading
  // req.headers after the outer response is returned (background mode) throws
  // "Cannot read headers: request closed" on Supabase Edge Runtime.
  const headersSnapshot = new Headers(req.headers);
  const reqUrl = req.url;
  const reqMethod = req.method;

  // Rebuild a fresh Request the inner handler can consume (with the same body).
  const cloneReq = () => new Request(reqUrl, {
    method: reqMethod,
    headers: headersSnapshot,
    body: bodyText || undefined,
  });

  if (!jobId) {
    return runFullHandler(cloneReq());
  }

  // Background mode — run the pipeline detached and ack immediately.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const work = (async () => {
    try {
      await admin.from("design_jobs").update({
        status: "running",
        started_at: new Date().toISOString(),
        progress: 5,
        stage: "starting",
      }).eq("id", jobId);

      const res = await runFullHandler(cloneReq());
      let data: any = null;
      try { data = await res.json(); } catch { data = null; }

      // Re-check cancellation before writing result
      const { data: jobRow } = await admin
        .from("design_jobs").select("status").eq("id", jobId).maybeSingle();
      if (jobRow?.status === "cancelled") return;

      if (!res.ok || (data && data.error)) {
        await admin.from("design_jobs").update({
          status: "failed",
          error: { message: data?.error || `HTTP ${res.status}`, status: res.status },
          finished_at: new Date().toISOString(),
        }).eq("id", jobId);
      } else {
        await admin.from("design_jobs").update({
          status: "succeeded",
          result: data,
          progress: 100,
          stage: "done",
          finished_at: new Date().toISOString(),
        }).eq("id", jobId);
      }
    } catch (e) {
      try {
        await admin.from("design_jobs").update({
          status: "failed",
          error: { message: e instanceof Error ? e.message : "Unknown error" },
          finished_at: new Date().toISOString(),
        }).eq("id", jobId);
      } catch {}
    }
  })();

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(work);
  } else {
    // Fallback: at least don't block the response
    work.catch(() => {});
  }

  return new Response(JSON.stringify({ accepted: true, job_id: jobId }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
