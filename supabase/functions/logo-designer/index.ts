import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FidelityReport {
  sketch_fidelity: number;
  colour_fidelity: number;
  overall: number;
  deviations: string[];
  verdict: "pass" | "warn" | "fail";
}

/**
 * Multimodal critic: compares the rendered logo against the user's sketch and
 * the brand palette, returning concrete deviations to correct.
 */
async function verifySketchFidelity(
  apiKey: string,
  sketchDataUrl: string,
  resultDataUrl: string,
  colours: string[],
): Promise<FidelityReport | null> {
  const tool = {
    type: "function",
    function: {
      name: "report_fidelity",
      description: "Score how faithfully the rendered logo matches the sketch and brand palette.",
      parameters: {
        type: "object",
        properties: {
          sketch_fidelity: { type: "integer", minimum: 0, maximum: 100 },
          colour_fidelity: { type: "integer", minimum: 0, maximum: 100 },
          overall: { type: "integer", minimum: 0, maximum: 100 },
          deviations: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 5 },
          verdict: { type: "string", enum: ["pass", "warn", "fail"] },
        },
        required: ["sketch_fidelity", "colour_fidelity", "overall", "deviations", "verdict"],
        additionalProperties: false,
      },
    },
  };

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a logo fidelity auditor. IMAGE 1 is the user's hand sketch (the concept truth). " +
              "IMAGE 2 is the AI-rendered logo. Judge strictly whether image 2 keeps image 1's composition, " +
              "shapes, proportions, icon idea and layout, and whether it uses the given brand hex colours. " +
              "Pencil/ink colour in the sketch is irrelevant. Output ONLY the tool call.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Brand colours that MUST dominate: ${colours.length ? colours.join(", ") : "(none supplied)"}\n` +
                  "List 0-5 short imperative corrections, e.g. \"restore the leaf notch on the right stroke\", " +
                  "\"recolour the mark to #C4993B instead of blue\". Skip vague feedback.",
              },
              { type: "image_url", image_url: { url: sketchDataUrl } },
              { type: "image_url", image_url: { url: resultDataUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "report_fidelity" } },
      }),
    });
    if (!resp.ok) {
      console.error("[logo-fidelity] http", resp.status, (await resp.text()).slice(0, 200));
      return null;
    }
    const data = await resp.json();
    const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) return null;
    const p = JSON.parse(argsStr);
    const clamp = (n: any) => Math.max(0, Math.min(100, Math.round(Number(n)) || 0));
    return {
      sketch_fidelity: clamp(p.sketch_fidelity),
      colour_fidelity: clamp(p.colour_fidelity),
      overall: clamp(p.overall),
      deviations: Array.isArray(p.deviations)
        ? p.deviations.map((s: any) => String(s)).filter(Boolean).slice(0, 5)
        : [],
      verdict: p.verdict === "pass" || p.verdict === "fail" ? p.verdict : "warn",
    };
  } catch (e) {
    console.error("[logo-fidelity] failed", e instanceof Error ? e.message : e);
    return null;
  }
}


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

    const { brand_id, style, visual_feel, notes, brand_context: passedContext, sketch_image } = await req.json();

    // --- Credit / free generation logic ---
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("logo_generations_used, bonus_credits, generations_count, generations_reset_at, subscription_tier, paid_credits")
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
      // Check credit availability with new model
      const FREE_MONTHLY = 5;
      const resetAt = new Date(profile.generations_reset_at);
      const now = new Date();
      const monthReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();
      const currentCount = monthReset ? 0 : profile.generations_count;
      const freeRemaining = Math.max(0, FREE_MONTHLY - currentCount);

      // Query active reward credits
      const { data: rewardRows } = await adminSupabase
        .from("credit_rewards")
        .select("id, remaining")
        .eq("user_id", user.id)
        .gt("remaining", 0)
        .gt("expires_at", now.toISOString())
        .order("expires_at", { ascending: true });
      const rewardCredits = (rewardRows || []).reduce((s: number, r: any) => s + r.remaining, 0);

      const totalAvailable = freeRemaining + profile.bonus_credits + rewardCredits + ((profile as any).paid_credits || 0);

      if (totalAvailable < 1) {
        return new Response(JSON.stringify({ error: "No credits remaining. Please upgrade your plan or purchase more credits.", requires_credits: true }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let brandContext = "";
    const paletteHexes: string[] = [];


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
      const ctxColors = [
        passedContext.primary_colors?.length ? `Primary colors: ${passedContext.primary_colors.join(", ")}` : "",
        passedContext.secondary_colors?.length ? `Secondary/surface colors: ${passedContext.secondary_colors.join(", ")}` : "",
        passedContext.accent_colors?.length ? `Accent colors: ${passedContext.accent_colors.join(", ")}` : "",
      ].filter(Boolean).join(". ");

      brandContext = [
        passedContext.name ? `Brand name: "${passedContext.name}"` : "",
        passedContext.tagline ? `Tagline: "${passedContext.tagline}"` : "",
        passedContext.description ? `Description: ${passedContext.description}` : "",
        passedContext.vibe ? `Brand vibe: ${passedContext.vibe}` : "",
        ctxColors,
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

    // Parse an optional sketch (data URL or raw base64) supplied by the user.
    let sketchBlob: Blob | null = null;
    if (typeof sketch_image === "string" && sketch_image.length > 100) {
      try {
        const m = sketch_image.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
        const mime = m ? m[1] : "image/png";
        const b64 = m ? m[2] : sketch_image;
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        if (bin.byteLength > 0 && bin.byteLength < 8 * 1024 * 1024) {
          sketchBlob = new Blob([bin], { type: mime });
        }
      } catch (err) {
        console.log("logo-designer: invalid sketch payload", err instanceof Error ? err.message : err);
      }
    }

    const sketchDirective = sketchBlob
      ? `
SKETCH REFERENCE (HIGHEST PRIORITY):
The attached image is the user's own sketch of the logo they want. It is the single source of truth for the concept.
- Reproduce the sketch's exact composition, shapes, proportions, icon idea and layout. Do NOT invent a different concept.
- Clean it up into a crisp, professional, production-ready vector-style logo: straighten lines, balance curves, refine spacing and typography.
- Keep every distinctive element the user drew. Do not add or remove elements.
- Recolour it using the brand colours listed below (the sketch's own pencil/ink colours are irrelevant).
- If the sketch contains handwritten brand text, set it in a typeface that matches the sketch's letterforms and the brand vibe.
`
      : "";

    const prompt = `Design a professional, high-quality logo on a clean white background.

Logo type: ${styleMap[style] || styleMap.wordmark}
Visual feel: ${visual_feel || "Minimal"}
${notes ? `Additional preferences: ${notes}` : ""}
${sketchDirective}
Brand context:
${brandContext}

Requirements:
- Clean, scalable vector-style design
- Professional quality suitable for business use
- The logo should feel aligned with the brand's personality and vibe
- Use the brand colours listed above as the logo's palette; only introduce neutrals (black, white, grey) as support
- White or transparent background
- Modern and memorable design${sketchBlob ? "\n- Fidelity to the user's sketch outranks every other stylistic preference" : ""}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let aiResponse: Response;
    if (sketchBlob) {
      const form = new FormData();
      form.append("model", "openai/gpt-image-2");
      form.append("prompt", prompt);
      form.append("image", sketchBlob, "sketch.png");
      form.append("size", "1024x1024");
      form.append("quality", "low");
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: form,
      });
    } else {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-image-2",
          prompt,
          size: "1024x1024",
          quality: "low",
          n: 1,
        }),
      });
    }


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
    const b64 = aiData?.data?.[0]?.b64_json;
    const imageUrl = b64 ? `data:image/png;base64,${b64}` : aiData?.data?.[0]?.url;

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
      // Deduction order: free monthly → bonus → reward → paid
      const FREE_MONTHLY = 5;
      const resetAt = new Date(profile.generations_reset_at);
      const now = new Date();
      const monthReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();
      const currentCount = monthReset ? 0 : profile.generations_count;
      const freeRemaining = Math.max(0, FREE_MONTHLY - currentCount);
      const bonusCredits = profile.bonus_credits;
      const paidCredits = (profile as any).paid_credits || 0;

      let remainingCost = 1;
      const updates: any = { logo_generations_used: profile.logo_generations_used + 1 };
      if (monthReset) updates.generations_reset_at = now.toISOString();

      const freeToUse = Math.min(remainingCost, freeRemaining);
      updates.generations_count = currentCount + freeToUse;
      remainingCost -= freeToUse;

      if (remainingCost > 0 && bonusCredits > 0) {
        updates.bonus_credits = bonusCredits - 1;
        remainingCost = 0;
      }

      // Consume reward credits
      if (remainingCost > 0) {
        const { data: rewardRows } = await adminSupabase
          .from("credit_rewards")
          .select("id, remaining")
          .eq("user_id", user.id)
          .gt("remaining", 0)
          .gt("expires_at", now.toISOString())
          .order("expires_at", { ascending: true });
        if (rewardRows && rewardRows.length > 0) {
          const toUse = Math.min(remainingCost, rewardRows[0].remaining);
          await adminSupabase.from("credit_rewards").update({ remaining: rewardRows[0].remaining - toUse }).eq("id", rewardRows[0].id);
          remainingCost -= toUse;
        }
      }

      if (remainingCost > 0) {
        updates.paid_credits = paidCredits - 1;
      }

      await adminSupabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);
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
