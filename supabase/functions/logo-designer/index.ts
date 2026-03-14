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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brand_id, style, visual_feel, notes, brand_context: passedContext } = await req.json();

    // --- Credit / free generation logic ---
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("logo_generations_used, bonus_credits, generations_count, generations_reset_at, subscription_tier")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFirstFree = profile.logo_generations_used === 0;

    if (!isFirstFree) {
      // Check credit availability (bonus first, then generation credits)
      const tierLimits: Record<string, number> = { free: 10, entrepreneur: 50, creator: 150, agency: 400 };
      const limit = tierLimits[profile.subscription_tier] || 10;
      const resetAt = new Date(profile.generations_reset_at);
      const now = new Date();
      let availableGen = (resetAt < new Date(now.getFullYear(), now.getMonth(), 1))
        ? limit
        : Math.max(0, limit - profile.generations_count);
      const totalAvailable = profile.bonus_credits + availableGen;

      if (totalAvailable < 1) {
        return new Response(JSON.stringify({ error: "No credits remaining. Please upgrade your plan or wait for your monthly reset.", requires_credits: true }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let brandContext = "";

    if (brand_id) {
      // Load brand context from DB
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

      const colorInfo = [
        brand.primary_colors?.length ? `Primary colors: ${brand.primary_colors.join(", ")}` : "",
        brand.secondary_colors?.length ? `Secondary colors: ${brand.secondary_colors.join(", ")}` : "",
        brand.accent_colors?.length ? `Accent colors: ${brand.accent_colors.join(", ")}` : "",
      ].filter(Boolean).join(". ");

      const typographyInfo = [
        brand.typography_primary ? `Primary font: ${brand.typography_primary}` : "",
        brand.typography_display ? `Display font: ${brand.typography_display}` : "",
      ].filter(Boolean).join(". ");

      brandContext = [
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
    } else if (passedContext) {
      // Use passed context (e.g. during onboarding before brand is saved)
      brandContext = [
        passedContext.name ? `Brand name: "${passedContext.name}"` : "",
        passedContext.tagline ? `Tagline: "${passedContext.tagline}"` : "",
        passedContext.description ? `Description: ${passedContext.description}` : "",
        passedContext.vibe ? `Brand vibe: ${passedContext.vibe}` : "",
      ].filter(Boolean).join("\n");
    } else {
      return new Response(JSON.stringify({ error: "brand_id or brand_context required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Deduct credit and increment logo_generations_used
    if (isFirstFree) {
      await adminSupabase
        .from("profiles")
        .update({ logo_generations_used: 1 })
        .eq("user_id", user.id);
    } else {
      // Deduct from bonus first, then from generation credits
      if (profile.bonus_credits > 0) {
        await adminSupabase
          .from("profiles")
          .update({ bonus_credits: profile.bonus_credits - 1, logo_generations_used: profile.logo_generations_used + 1 })
          .eq("user_id", user.id);
      } else {
        await adminSupabase
          .from("profiles")
          .update({ generations_count: profile.generations_count + 1, logo_generations_used: profile.logo_generations_used + 1 })
          .eq("user_id", user.id);
      }
    }

    return new Response(JSON.stringify({ image: imageUrl, was_free: isFirstFree }), {
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
