import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Deterministic vibe → trend mapping (no AI call needed)
const VIBE_TREND_MAP: Record<string, { trend_id: string; reason: string; confidence: number }> = {
  bold: { trend_id: "hyper-chromatic", reason: "Bold brands pair naturally with vibrant, high-energy visuals.", confidence: 80 },
  energetic: { trend_id: "kinetic-typography", reason: "Energetic brands benefit from motion-inspired, dynamic layouts.", confidence: 80 },
  playful: { trend_id: "hyper-chromatic", reason: "Playful brands shine with vibrant colours and bold contrasts.", confidence: 75 },
  minimal: { trend_id: "technical-mono", reason: "Minimal brands align with clean grids and monospaced aesthetics.", confidence: 85 },
  clean: { trend_id: "technical-mono", reason: "Clean brands suit industrial, grid-based layouts.", confidence: 80 },
  modern: { trend_id: "technical-mono", reason: "Modern brands work well with structured, technical design systems.", confidence: 70 },
  professional: { trend_id: "technical-mono", reason: "Professional brands benefit from structured, grid-based layouts.", confidence: 75 },
  corporate: { trend_id: "technical-mono", reason: "Corporate brands suit clean, industrial aesthetics.", confidence: 80 },
  natural: { trend_id: "neo-naturalism", reason: "Nature-oriented brands thrive with organic textures and calm palettes.", confidence: 85 },
  organic: { trend_id: "neo-naturalism", reason: "Organic brands align perfectly with natural, breathable design.", confidence: 85 },
  calm: { trend_id: "neo-naturalism", reason: "Calm brands suit nature-inspired compositions.", confidence: 80 },
  wellness: { trend_id: "neo-naturalism", reason: "Wellness brands pair naturally with organic, soothing visuals.", confidence: 85 },
  artisan: { trend_id: "tactile-rebellion", reason: "Artisan brands suit hand-crafted, textured aesthetics.", confidence: 85 },
  handmade: { trend_id: "tactile-rebellion", reason: "Handmade brands thrive with paper textures and scrapbook feel.", confidence: 85 },
  creative: { trend_id: "tactile-rebellion", reason: "Creative brands benefit from tactile, experimental visuals.", confidence: 75 },
  vintage: { trend_id: "tactile-rebellion", reason: "Vintage brands align with hand-drawn, grain-overlay aesthetics.", confidence: 80 },
  retro: { trend_id: "tactile-rebellion", reason: "Retro brands pair with nostalgic, textured design styles.", confidence: 80 },
  luxury: { trend_id: "technical-mono", reason: "Luxury brands suit refined, minimal layouts with precise typography.", confidence: 70 },
  edgy: { trend_id: "kinetic-typography", reason: "Edgy brands benefit from motion-inspired, high-contrast layouts.", confidence: 80 },
  sporty: { trend_id: "kinetic-typography", reason: "Sporty brands thrive with dynamic, movement-driven design.", confidence: 85 },
  fun: { trend_id: "hyper-chromatic", reason: "Fun brands pop with vibrant gradients and bold colour.", confidence: 80 },
  warm: { trend_id: "neo-naturalism", reason: "Warm brands pair naturally with organic, earthy aesthetics.", confidence: 75 },
  elegant: { trend_id: "neo-naturalism", reason: "Elegant brands suit calm, breathable compositions.", confidence: 70 },
  tech: { trend_id: "technical-mono", reason: "Tech brands align with monospaced, grid-based design systems.", confidence: 85 },
};

const DEFAULT_RECOMMENDATION = {
  trend_id: "tactile-rebellion",
  reason: "A versatile default that adds warmth and character to any brand.",
  confidence: 40,
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { brand } = await req.json();
    const vibe = (brand?.vibe || "").toLowerCase().trim();

    // Try exact match first
    let result = VIBE_TREND_MAP[vibe];

    // Try partial match if no exact match
    if (!result && vibe) {
      for (const [key, value] of Object.entries(VIBE_TREND_MAP)) {
        if (vibe.includes(key) || key.includes(vibe)) {
          result = value;
          break;
        }
      }
    }

    return new Response(JSON.stringify(result || DEFAULT_RECOMMENDATION), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trend-recommend error:", e);
    return new Response(
      JSON.stringify(DEFAULT_RECOMMENDATION),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
