import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, brand, action, canvas_size } = await req.json();

    if (action === "generate") {
      // Check and increment generation count
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const { data: profile } = await adminClient
        .from("profiles")
        .select("generations_count, generations_reset_at")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        const resetAt = new Date(profile.generations_reset_at);
        const now = new Date();
        const needsReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear();

        if (needsReset) {
          await adminClient
            .from("profiles")
            .update({ generations_count: 1, generations_reset_at: now.toISOString() })
            .eq("user_id", user.id);
        } else {
          if (profile.generations_count >= 10) {
            return new Response(JSON.stringify({ error: "Monthly generation limit reached. Please upgrade your plan." }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          await adminClient
            .from("profiles")
            .update({ generations_count: profile.generations_count + 1 })
            .eq("user_id", user.id);
        }
      }

      // Determine canvas dimensions
      const size = canvas_size || "1080x1080";
      const [w, h] = size.split("x");
      const sizeLabel = size === "1080x1920" ? "portrait story (1080x1920)" : "square (1080x1080)";

      const brandContext = brand
        ? `You are Brandie, a senior creative director with 20+ years of experience. You design within the user's brand system.

BRAND SYSTEM:
- Brand name: ${brand.name}
- Tagline: ${brand.tagline || "None"}
- Description: ${brand.description || "None"}
- Vibe: ${brand.vibe || "Modern"}
- Primary colours: ${(brand.primary_colors || []).join(", ")}
- Secondary colours: ${(brand.secondary_colors || []).join(", ")}
- Accent colours: ${(brand.accent_colors || []).join(", ")}
- Primary typography: ${brand.typography_primary || "Clean sans-serif"}
- Secondary typography: ${brand.typography_secondary || "Serif"}

DESIGN RULES:
- Always incorporate the brand colours prominently
- Use the brand typography styles
- Match the brand vibe (${brand.vibe || "Modern"})
- Maintain strong visual hierarchy: headline, subheadline, CTA
- Use generous negative space, no clutter
- Modern 2026-level design aesthetic
- Strong focal point with balanced composition
- Include the brand name "${brand.name}" in the design when relevant
- Canvas size: ${sizeLabel}

When generating, describe EXACTLY what the image should look like in detail, including layout, colours (use exact hex values), typography style, spacing, and composition. Be specific and visual.`
        : "You are a helpful design assistant. Create beautiful social media graphics.";

      const briefResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: brandContext + "\n\nRespond with TWO parts clearly separated:\n\nPART 1 - DESIGN BRIEF: A detailed image generation prompt (2-3 sentences) describing exactly what to create. Be very specific about colours, layout, typography, and composition.\n\nPART 2 - EXPLANATION: A brief, confident explanation (1-2 sentences) of your design choices. Speak like a creative director: professional, calm, assured. Never apologise. Example: \"I've used your deep emerald as the base to maintain authority. The typography is bold and centered for impact.\"" },
            ...messages,
          ],
        }),
      });

      if (!briefResponse.ok) {
        if (briefResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (briefResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await briefResponse.text();
        console.error("Brief generation error:", briefResponse.status, errText);
        throw new Error("Failed to generate design brief");
      }

      const briefData = await briefResponse.json();
      const briefContent = briefData.choices?.[0]?.message?.content || "";

      const designPrompt = briefContent.includes("DESIGN BRIEF:")
        ? briefContent.split("DESIGN BRIEF:")[1].split("EXPLANATION:")[0].trim()
        : briefContent.split("\n")[0];

      const explanation = briefContent.includes("EXPLANATION:")
        ? briefContent.split("EXPLANATION:")[1].trim()
        : "I've crafted this design with your brand identity in mind.";

      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: `Create a professional social media graphic (${sizeLabel} format, ${w}x${h} pixels). ${designPrompt}`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!imageResponse.ok) {
        if (imageResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (imageResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await imageResponse.text();
        console.error("Image generation error:", imageResponse.status, errText);
        throw new Error("Failed to generate image");
      }

      const imageData = await imageResponse.json();
      const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!imageBase64) {
        throw new Error("No image was generated. Try a different prompt.");
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const filePath = `${user.id}/${crypto.randomUUID()}.png`;

      const { error: uploadError } = await adminClient.storage
        .from("designs")
        .upload(filePath, binaryData, { contentType: "image/png" });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Failed to save generated image");
      }

      const { data: urlData } = adminClient.storage.from("designs").getPublicUrl(filePath);

      return new Response(
        JSON.stringify({
          image_url: urlData.publicUrl,
          explanation,
          design_prompt: designPrompt,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "chat") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are Brandie, a senior creative director. You help users refine their design ideas before generating. Be confident, professional, calm. Never apologise excessively. Suggest improvements. Keep responses concise (2-3 sentences max).`,
            },
            ...messages,
          ],
        }),
      });

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
});
