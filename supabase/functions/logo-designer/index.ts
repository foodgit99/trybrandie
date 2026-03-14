import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brand_id, style, visual_feel, notes } = await req.json();
    if (!brand_id) {
      return new Response(JSON.stringify({ error: "brand_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load brand context
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("*")
      .eq("id", brand_id)
      .maybeSingle();

    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: "Brand not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt from brand context
    const colorInfo = [
      brand.primary_colors?.length ? `Primary colors: ${brand.primary_colors.join(", ")}` : "",
      brand.secondary_colors?.length ? `Secondary colors: ${brand.secondary_colors.join(", ")}` : "",
      brand.accent_colors?.length ? `Accent colors: ${brand.accent_colors.join(", ")}` : "",
    ].filter(Boolean).join(". ");

    const typographyInfo = [
      brand.typography_primary ? `Primary font: ${brand.typography_primary}` : "",
      brand.typography_display ? `Display font: ${brand.typography_display}` : "",
    ].filter(Boolean).join(". ");

    const brandContext = [
      `Brand name: "${brand.name}"`,
      brand.tagline ? `Tagline: "${brand.tagline}"` : "",
      brand.description ? `Description: ${brand.description}` : "",
      brand.vibe ? `Brand vibe: ${brand.vibe}` : "",
      brand.tone_of_voice ? `Tone: ${brand.tone_of_voice}` : "",
      brand.personality_traits?.length ? `Personality: ${brand.personality_traits.join(", ")}` : "",
      colorInfo,
      typographyInfo,
      brand.special_instructions ? `Special instructions: ${brand.special_instructions}` : "",
    ].filter(Boolean).join("\n");

    const styleMap: Record<string, string> = {
      wordmark: "a wordmark logo (text-based, the brand name styled as the logo)",
      lettermark: "a lettermark logo (using initials or first letter of the brand name)",
      "icon-text": "a combination logo with an icon/symbol alongside the brand name text",
      abstract: "an abstract symbol/mark logo (geometric or abstract shape, no text)",
      mascot: "a mascot logo (a character or illustrated figure representing the brand)",
    };

    const prompt = `Design a professional, high-quality logo on a clean white background.

Logo type: ${styleMap[style] || styleMap.wordmark}
Visual feel: ${visual_feel || "Minimal"}
${notes ? `Additional preferences: ${notes}` : ""}

Brand context:
${brandContext}

Requirements:
- Clean, scalable vector-style design
- Professional quality suitable for business use
- The logo should feel aligned with the brand's personality and vibe
- Use brand colors if provided, otherwise choose colors that match the brand feel
- White or transparent background
- Modern and memorable design`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ image: imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("logo-designer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
