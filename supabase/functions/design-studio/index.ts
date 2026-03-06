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

    const { messages, brand, action, canvas_size, previous_prompt, previous_image_url, user_image_url, audience_id, trend, trend_intensity, render_quality } = await req.json();

    if (action === "generate" || action === "edit") {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // Fetch audience intelligence for the brand
      let audienceContext = "";
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
        // Use a fast LLM call to classify intent
        const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You are an intent classifier for a design tool. Classify the user's edit request as either MINOR or MAJOR.

MINOR edits (free, no credit cost):
- Changing headline text, CTA text, or subheadline text
- Fixing a typo
- Changing the wording of existing text
- Making text shorter or longer
- Changing tone of existing copy (e.g. "make it more casual")

MAJOR edits (costs 1 credit):
- Changing the layout or composition
- Changing colours or colour scheme
- Changing the background image or visual style
- Adding or removing visual elements
- Changing the overall design direction
- Requesting a completely different design
- Adding images or changing imagery
- Changing font/typography style
- Resizing or repositioning elements

Respond with ONLY the word "MINOR" or "MAJOR". Nothing else.`,
              },
              { role: "user", content: `Previous design brief: "${previous_prompt}"\n\nUser's edit request: "${userPrompt}"` },
            ],
          }),
        });

        if (classifyResponse.ok) {
          const classifyData = await classifyResponse.json();
          const classification = (classifyData.choices?.[0]?.message?.content || "").trim().toUpperCase();
          isFreeEdit = classification === "MINOR";
          console.log(`Intent classification: ${classification} (isFreeEdit: ${isFreeEdit})`);
        }
      }

      // Check and increment generation count — skip for free edits
      if (!isFreeEdit) {
        const creditCost = render_quality === "hd" ? 2 : 1;
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
              .update({ generations_count: creditCost, generations_reset_at: now.toISOString() })
              .eq("user_id", user.id);
          } else {
            if (profile.generations_count + creditCost > 10) {
              return new Response(JSON.stringify({ error: "Monthly generation limit reached. Please upgrade your plan." }), {
                status: 429,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            await adminClient
              .from("profiles")
              .update({ generations_count: profile.generations_count + creditCost })
              .eq("user_id", user.id);
          }
        }
      }

      // Determine canvas dimensions
      const size = canvas_size || "1080x1080";
      const [w, h] = size.split("x");
      const sizeLabels: Record<string, string> = {
        "1080x1080": "square (1080x1080, aspect ratio 1:1)",
        "1920x1080": "landscape rectangle (1920x1080, aspect ratio 16:9)",
        "1080x1920": "portrait story (1080x1920, aspect ratio 9:16)",
      };
      const sizeLabel = sizeLabels[size] || `${w}x${h}`;

      // Canvas format context for upstream agents
      const canvasFormatBrief = size === "1080x1080"
        ? "\n\nCANVAS FORMAT: SQUARE (1:1). Design for a PERFECTLY SQUARE canvas. Plan a centered, compact, symmetrical composition. All elements should be balanced around the center. Avoid wide horizontal layouts — keep content compact and vertically centered."
        : size === "1080x1920"
        ? "\n\nCANVAS FORMAT: TALL PORTRAIT (9:16). Design for a TALL, NARROW canvas. Plan a vertically stacked composition with elements flowing top-to-bottom. Use strong vertical hierarchy. Avoid wide horizontal spreads — stack elements vertically."
        : "\n\nCANVAS FORMAT: WIDE LANDSCAPE (16:9). Design for a WIDE, HORIZONTAL canvas. Plan a horizontally spread composition. Content can span the full width. Use horizontal balance and side-by-side element placement.";

      const canvasFormatCopy = size === "1080x1080"
        ? "\n\nCANVAS FORMAT: SQUARE (1:1). Keep copy SHORT and COMPACT — fewer text elements, tight word count. A square canvas has limited space. Prefer a strong headline with minimal supporting text."
        : size === "1080x1920"
        ? "\n\nCANVAS FORMAT: TALL PORTRAIT (9:16). Copy should follow a VERTICAL HIERARCHY — headline at top, supporting text in middle, CTA at bottom. You have vertical space so stacked text blocks work well, but keep each block concise."
        : "\n\nCANVAS FORMAT: WIDE LANDSCAPE (16:9). You have more HORIZONTAL space. Copy can be slightly more expansive. Side-by-side text elements work well. Keep good horizontal balance.";

      // Collect inspiration examples for context
      const inspirationUrls: string[] = brand?.inspiration_examples || [];

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
${brand.image_style_preferences?.length ? `- Image style preferences: ${brand.image_style_preferences.join(", ")}` : ""}
${audienceContext}${trendContext}

DESIGN PHILOSOPHY (ALWAYS APPLY):
1. ALWAYS use PHOTOREALISTIC imagery and real photography. Use natural textures, real environments, and lifelike visuals. NEVER use cartoons, clip art, flat illustrations, or AI-looking abstract art — UNLESS the user EXPLICITLY requests illustrations, cartoons, or abstract styles.
2. Designs MUST follow modern design principles: strong visual hierarchy, balanced composition, generous whitespace, clean typography, and overall visual appeal. Every design should look like it was crafted by a top-tier design agency.
3. The USER'S INTENT carries the HIGHEST weight. Whatever the user asks for, deliver EXACTLY that. Never override, reinterpret, or ignore the user's specific request.
4. Brand Centre data (colours, fonts, tone, personality, vibe, inspiration) carries the SECOND HIGHEST weight. Always stay on-brand.
5. ALL text/copy on the design MUST align with the brand's value proposition and speak directly to the brand's target customer. Every word must serve a purpose — no filler text, no placeholder copy, no lorem ipsum, no decorative text that doesn't belong. Only include text that a real customer would expect to see on a professional marketing graphic for this brand.
6. Do NOT add unnecessary text elements. If the design only needs a headline, do not add a subheadline or CTA just to fill space. Let the design breathe. Only include text elements that are relevant to the user's request and the brand's messaging.
7. COLOUR CONTRAST IS CRITICAL: Always ensure text is highly legible against the background. If the background is dark, use light/white text. If the background is light, use dark text. When placing text over images, ALWAYS add a semi-transparent overlay, gradient scrim, or solid colour block behind the text to guarantee readability. Never place light text on light backgrounds or dark text on dark backgrounds. Contrast and legibility are non-negotiable.

CRITICAL RULES:
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

      const briefResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: brandContext + editContext + userImageContext + canvasFormatBrief + `\n\nThe user's request is below.\n\nRespond with TWO parts clearly separated:\n\nPART 1 - DESIGN BRIEF: A detailed image generation prompt (3-4 sentences) describing EXACTLY what to create. The design MUST match the user's request topic. Specify the exact hex colour codes from the brand system, the font names, layout details, and composition. Be extremely specific. IMPORTANT: Your layout and composition directions MUST be optimised for the canvas format specified above.${user_image_url ? " CRITICAL: The user provided a reference image — describe how to incorporate it prominently into the design as the user instructs." : ""}\n\nPART 2 - EXPLANATION: A brief, confident explanation (1-2 sentences) of your design choices referencing the brand colours and fonts by name. Speak like a creative director.` },
            ...messages.slice(0, -1),
            { role: "user", content: briefUserContent },
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

      // --- GENOME COMPOSER AGENT ---
      // Produces a structured Visual Style Genome JSON for precise design control
      let genomeData: any = null;
      try {
        const genomeComposerPrompt = `You are a Visual Style Genome Composer for a brand design system. Your job is to produce a structured Visual Style Genome — the design DNA — that will guide image generation.

CONTEXT:
- Design brief: ${designPrompt}
- User's request: "${userPrompt}"
- Brand name: ${brand?.name || "Unknown"}
- Brand vibe: ${brand?.vibe || "Modern"}
- Brand tone: ${brand?.tone_of_voice || "Professional"}
- Brand personality: ${(brand?.personality_traits || []).join(", ") || "Professional"}
- Primary colours: ${(brand?.primary_colors || []).join(", ")}
- Primary font: ${brand?.typography_primary || "Clean sans-serif"}
${trend && trend !== "none" ? `- Active trend: ${trend} (intensity: ${trend_intensity ?? 40}/100)` : "- No trend active"}
${audienceContext ? audienceContext : ""}

GENE LOCKING RULES:
- LOCKED (never override): Brand primary colours must inform the palette. Brand fonts must inform font personality.
- SEMI-FLEXIBLE: Typography weight, text effects, emotion — can shift within brand-compatible range.
- FREE: Layout, composition, texture, illustration, image style — fully controlled by prompt/trend/context.

${trend && trend !== "none" ? `TREND BLENDING: At intensity ${trend_intensity ?? 40}/100, blend the "${trend}" trend aesthetic into free genes. Higher intensity = more trend influence on free genes.` : ""}

Output a complete genome that precisely captures the visual strategy for this specific design.`;

        const genomeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: genomeComposerPrompt },
              { role: "user", content: "Generate the Visual Style Genome for this design." },
            ],
            tools: [{
              type: "function",
              function: {
                name: "set_genome",
                description: "Set the Visual Style Genome for the design",
                parameters: {
                  type: "object",
                  properties: {
                    color: {
                      type: "object",
                      properties: {
                        palette_type: { type: "string", enum: ["monochrome", "complementary", "analogous", "split_complementary", "triadic"] },
                        temperature: { type: "string", enum: ["warm", "neutral", "cool"] },
                        contrast: { type: "string", enum: ["low", "medium", "high", "extreme"] },
                        saturation: { type: "string", enum: ["muted", "balanced", "vibrant", "neon"] },
                        gradient_logic: { type: "string", enum: ["flat", "soft_gradient", "metallic_gradient", "multi_spectrum"] },
                      },
                      required: ["palette_type", "temperature", "contrast", "saturation", "gradient_logic"],
                      additionalProperties: false,
                    },
                    typography: {
                      type: "object",
                      properties: {
                        font_personality: { type: "string", enum: ["corporate", "friendly", "futuristic", "street", "editorial"] },
                        weight_system: { type: "string", enum: ["light", "regular", "bold", "ultra_bold"] },
                        hierarchy_logic: { type: "string", enum: ["strong_headline_dominance", "balanced_hierarchy", "text_minimal"] },
                        typography_layout: { type: "string", enum: ["centered", "left_editorial", "split_text", "overlay"] },
                        text_effect: { type: "string", enum: ["none", "outline", "drop_shadow", "gradient", "glitch", "neon"] },
                      },
                      required: ["font_personality", "weight_system", "hierarchy_logic", "typography_layout", "text_effect"],
                      additionalProperties: false,
                    },
                    layout: {
                      type: "object",
                      properties: {
                        grid_type: { type: "string", enum: ["strict_grid", "modular_grid", "broken_grid", "freeform"] },
                        balance: { type: "string", enum: ["symmetrical", "asymmetrical", "dynamic"] },
                        spacing_density: { type: "string", enum: ["minimal", "balanced", "dense"] },
                        content_ratio: { type: "string", enum: ["image_dominant", "text_dominant", "balanced"] },
                      },
                      required: ["grid_type", "balance", "spacing_density", "content_ratio"],
                      additionalProperties: false,
                    },
                    composition: {
                      type: "object",
                      properties: {
                        visual_direction: { type: "string", enum: ["vertical", "horizontal", "diagonal", "radial"] },
                        focal_strategy: { type: "string", enum: ["single_focal_point", "dual_focal", "distributed"] },
                        layering_depth: { type: "string", enum: ["flat", "medium", "deep_layered"] },
                      },
                      required: ["visual_direction", "focal_strategy", "layering_depth"],
                      additionalProperties: false,
                    },
                    texture: {
                      type: "object",
                      properties: {
                        texture_type: { type: "string", enum: ["none", "grain", "paper", "digital_noise", "plastic", "metallic"] },
                        intensity: { type: "string", enum: ["subtle", "medium", "heavy"] },
                        distortion: { type: "string", enum: ["none", "glitch", "warp", "pixel_sort"] },
                      },
                      required: ["texture_type", "intensity", "distortion"],
                      additionalProperties: false,
                    },
                    illustration: {
                      type: "object",
                      properties: {
                        style: { type: "string", enum: ["none", "3d", "flat", "hand_drawn", "abstract", "cartoon", "clay"] },
                        detail_level: { type: "string", enum: ["minimal", "medium", "high"] },
                        line_weight: { type: "string", enum: ["thin", "medium", "bold"] },
                      },
                      required: ["style", "detail_level", "line_weight"],
                      additionalProperties: false,
                    },
                    image_style: {
                      type: "object",
                      properties: {
                        lighting: { type: "string", enum: ["natural", "dramatic", "neon", "soft"] },
                        color_grading: { type: "string", enum: ["cinematic", "vintage", "vibrant", "monochrome"] },
                        framing: { type: "string", enum: ["close_crop", "wide", "portrait"] },
                      },
                      required: ["lighting", "color_grading", "framing"],
                      additionalProperties: false,
                    },
                    emotion: { type: "string", enum: ["energetic", "calm", "luxurious", "playful", "rebellious", "authoritative", "warm", "futuristic", "organic"] },
                  },
                  required: ["color", "typography", "layout", "composition", "texture", "illustration", "image_style", "emotion"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "set_genome" } },
          }),
        });

        if (genomeResponse.ok) {
          const gData = await genomeResponse.json();
          const toolCall = gData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            genomeData = JSON.parse(toolCall.function.arguments);
            console.log("Genome Composer output:", JSON.stringify(genomeData));

            // --- GENOME MUTATION ENGINE (15%) ---
            // Randomly mutate FREE genes to keep outputs fresh across consecutive generations
            // Locked genes (color primary, font personality) are never mutated
            // Semi-flexible genes (weight, emotion) have reduced mutation chance
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
            // Semi-flexible genes mutate at half rate
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
            // Mutate free genes
            for (const [category, fields] of Object.entries(freeGeneOptions)) {
              for (const [field, options] of Object.entries(fields)) {
                if (Math.random() < MUTATION_RATE) {
                  const current = genomeData[category]?.[field];
                  const alternatives = options.filter((o: string) => o !== current);
                  if (alternatives.length > 0) {
                    genomeData[category][field] = alternatives[Math.floor(Math.random() * alternatives.length)];
                    mutationCount++;
                  }
                }
              }
            }
            // Mutate semi-flexible genes at half rate
            for (const [category, fields] of Object.entries(semiFlexGeneOptions)) {
              for (const [field, options] of Object.entries(fields)) {
                if (Math.random() < MUTATION_RATE / 2) {
                  const current = genomeData[category]?.[field];
                  const alternatives = options.filter((o: string) => o !== current);
                  if (alternatives.length > 0) {
                    genomeData[category][field] = alternatives[Math.floor(Math.random() * alternatives.length)];
                    mutationCount++;
                  }
                }
              }
            }
            // Mutate emotion at half rate (semi-flexible)
            if (Math.random() < MUTATION_RATE / 2) {
              const currentEmotion = genomeData.emotion;
              const altEmotions = emotionOptions.filter((e: string) => e !== currentEmotion);
              genomeData.emotion = altEmotions[Math.floor(Math.random() * altEmotions.length)];
              mutationCount++;
            }

            if (mutationCount > 0) {
              console.log(`Genome Mutation: ${mutationCount} gene(s) mutated`);
              console.log("Post-mutation genome:", JSON.stringify(genomeData));
            }
          }
        } else {
          console.error("Genome Composer failed, proceeding without genome:", genomeResponse.status);
        }
      } catch (e) {
        console.error("Genome Composer error, proceeding without:", e);
      }

      // Serialize genome into a human-readable styling block for the image prompt
      const genomeContext = genomeData ? `

VISUAL STYLE GENOME (follow these precise styling instructions):
- Color: ${genomeData.color.palette_type.replace(/_/g, " ")} palette, ${genomeData.color.temperature} temperature, ${genomeData.color.contrast} contrast, ${genomeData.color.saturation} saturation, ${genomeData.color.gradient_logic.replace(/_/g, " ")}
- Typography: ${genomeData.typography.font_personality} personality, ${genomeData.typography.weight_system.replace(/_/g, " ")} weight, ${genomeData.typography.hierarchy_logic.replace(/_/g, " ")}, ${genomeData.typography.typography_layout.replace(/_/g, " ")} layout${genomeData.typography.text_effect !== "none" ? `, ${genomeData.typography.text_effect.replace(/_/g, " ")} effect` : ""}
- Layout: ${genomeData.layout.grid_type.replace(/_/g, " ")}, ${genomeData.layout.balance} balance, ${genomeData.layout.spacing_density} density, ${genomeData.layout.content_ratio.replace(/_/g, " ")}
- Composition: ${genomeData.composition.visual_direction} direction, ${genomeData.composition.focal_strategy.replace(/_/g, " ")}, ${genomeData.composition.layering_depth.replace(/_/g, " ")} layering
- Texture: ${genomeData.texture.texture_type.replace(/_/g, " ")}${genomeData.texture.texture_type !== "none" ? `, ${genomeData.texture.intensity} intensity` : ""}${genomeData.texture.distortion !== "none" ? `, ${genomeData.texture.distortion} distortion` : ""}
- Image Style: ${genomeData.image_style.lighting} lighting, ${genomeData.image_style.color_grading} grading, ${genomeData.image_style.framing.replace(/_/g, " ")} framing
- Emotion: ${genomeData.emotion}` : "";

      // --- COPYWRITER AGENT ---
      // Produces exact, structured copy that the image renderer must use verbatim
      let copyStructure: { headline: string; subheadline: string; cta: string; supporting_text: string } | null = null;
      try {
        const trendPresetForCopy = trend && trend !== "none" ? (({
          "tactile-rebellion": "More expressive and human — use imperfect, authentic, conversational language",
          "hyper-chromatic": "High-energy promotional language — bold, punchy, exclamatory, confident",
          "technical-mono": "Shorter and sharper copy — precise, technical, no-nonsense, data-driven",
          "neo-naturalism": "Calm and soothing tone — gentle, reassuring, mindful, nurturing",
          "kinetic-typography": "Energetic and dynamic — action-oriented verbs, short punchy phrases, momentum-building",
        } as Record<string, string>)[trend] || "") : "";

        const copywriterPrompt = `You are a world-class brand copywriter. Your job is to write the EXACT text that will appear on a social media graphic.

CONTEXT:
- Design brief: ${designPrompt}
- User's original request: "${userPrompt}"
- Brand name: ${brand?.name || "Unknown"}
- Brand tone of voice: ${brand?.tone_of_voice || "Professional"}
- Brand personality: ${(brand?.personality_traits || []).join(", ") || "Professional"}
- Brand vibe: ${brand?.vibe || "Modern"}
${audienceContext ? `\n${audienceContext}` : ""}
${trendPresetForCopy ? `\nCOPY TONE ADJUSTMENT: ${trendPresetForCopy}` : ""}${canvasFormatCopy}
${genomeData ? `\nVISUAL DENSITY CONTEXT: The design uses ${genomeData.layout.content_ratio.replace(/_/g, " ")} content ratio with ${genomeData.typography.hierarchy_logic.replace(/_/g, " ")}. Adjust copy length accordingly — text_minimal means fewer words, text_dominant means richer copy.` : ""}

RULES:
1. The copy MUST directly address the user's request topic: "${userPrompt}"
2. Total word count across ALL fields: 15-25 words maximum
3. Use the brand's tone of voice and personality
4. If audience intelligence is provided, leverage emotional drivers and messaging angles for persuasion
5. NEVER use generic filler like "Elevate your brand" or "Take it to the next level" unless that's what the user asked for
6. The headline is the most important element — make it punchy, specific, and on-topic
7. Leave fields empty ("") if they are not needed for this design. Not every design needs all fields.
8. The copy must sound like it was written by the brand, not by a generic AI`;

        const copyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: copywriterPrompt },
              { role: "user", content: `Write the exact copy for this design. Return structured JSON only.` },
            ],
            tools: [{
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
            }],
            tool_choice: { type: "function", function: { name: "set_copy" } },
          }),
        });

        if (copyResponse.ok) {
          const copyData = await copyResponse.json();
          const toolCall = copyData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            copyStructure = JSON.parse(toolCall.function.arguments);
            console.log("Copywriter output:", JSON.stringify(copyStructure));
          }
        } else {
          console.error("Copywriter agent failed, falling back to image model copy:", copyResponse.status);
        }
      } catch (e) {
        console.error("Copywriter agent error, falling back:", e);
      }

      // --- GENOME SCORING ENGINE ---
      // Deterministic scores based on genome alignment with brand, trend, and design principles
      let genomeScores: Record<string, number> | null = null;
      if (genomeData) {
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

        genomeScores = scores;
        console.log("Genome Scores:", JSON.stringify(genomeScores));
        genomeData._scores = genomeScores;
      }

      // Build the exact copy injection for the image prompt
      const copyInjection = copyStructure
        ? `\n\nEXACT TEXT TO RENDER ON THE DESIGN (use these EXACT words, do NOT modify, rephrase, or add ANY other text):
- Headline: "${copyStructure.headline}"${copyStructure.subheadline ? `\n- Subheadline: "${copyStructure.subheadline}"` : ""}${copyStructure.cta ? `\n- CTA: "${copyStructure.cta}"` : ""}${copyStructure.supporting_text ? `\n- Supporting text: "${copyStructure.supporting_text}"` : ""}
CRITICAL: Render ONLY the text listed above. Do NOT invent, add, or modify any text. Every word on the graphic must match exactly.`
        : "";

      // Build image generation content
      const userImageInstruction = user_image_url
        ? ` CRITICAL: The user has provided a reference image (attached). Incorporate it into the design EXACTLY as the user describes. This image is the PRIMARY visual reference and must be used prominently.`
        : "";
      const dimensionEnforcement = size === "1080x1080"
        ? "CRITICAL DIMENSION REQUIREMENT: This image MUST be PERFECTLY SQUARE — equal width and height (1:1 aspect ratio). The canvas is 1080x1080 pixels. Do NOT create a landscape or portrait image. It MUST be a SQUARE."
        : size === "1080x1920"
        ? "CRITICAL DIMENSION REQUIREMENT: This image MUST be TALL PORTRAIT format — 9:16 aspect ratio (1080x1920 pixels). It must be significantly taller than it is wide. Do NOT create a landscape or square image."
        : "CRITICAL DIMENSION REQUIREMENT: This image MUST be WIDE LANDSCAPE format — 16:9 aspect ratio (1920x1080 pixels). It must be significantly wider than it is tall. Do NOT create a square or portrait image.";

      const imagePromptText = `${dimensionEnforcement}\n\nCreate a PHOTOREALISTIC, clean, modern, visually stunning professional social media graphic (${sizeLabel} format, ${w}x${h} pixels). Use REAL PHOTOGRAPHY, natural textures, and lifelike imagery — NOT cartoons, clip art, or flat illustrations — unless the user specifically requests otherwise. The design must be professionally composed with balanced layout, clear visual hierarchy, generous breathing room, and a polished 2026 aesthetic. CRITICAL TEXT CONTRAST RULE: ALL text MUST have excellent colour contrast against its background. When placing text over photographic or busy backgrounds, ALWAYS use a semi-transparent overlay, gradient scrim, or solid colour block behind the text. Light text on dark backgrounds, dark text on light backgrounds — never low-contrast combinations. Readability is non-negotiable.${copyInjection} ${copyStructure ? "" : `CRITICAL TEXT RULES: Only include text that directly serves the user's request and aligns with the brand's value proposition. Do NOT add filler text, random quotes, unnecessary taglines, or decorative text that wasn't asked for. Every word on the design must be intentional and relevant. If the design only needs a headline, do not add extra text elements just to fill space.`} IMPORTANT: The design must be about "${userPrompt}". Use these exact brand colours: primary ${(brand?.primary_colors || []).join(", ")}, secondary ${(brand?.secondary_colors || []).join(", ")}, accent ${(brand?.accent_colors || []).join(", ")}. Fonts: ${brand?.typography_primary || "sans-serif"} and ${brand?.typography_secondary || "serif"}. Tone: ${brand?.tone_of_voice || "Professional"}. ${brand?.logo_url ? "CRITICAL: Include the company logo (provided as attached image) prominently in the design, typically in the bottom or top corner." : ""}${userImageInstruction}${genomeContext || (trendContext ? ` TREND STYLING OVERLAY: Apply the following trend aesthetic as a styling layer on top of the base brand design.${trendContext}` : "")} ${designPrompt}`;

      // Collect all image references
      const imageRefs: { type: string; image_url: { url: string } }[] = [];
      if (brand?.logo_url) imageRefs.push({ type: "image_url", image_url: { url: brand.logo_url } });
      if (user_image_url) imageRefs.push({ type: "image_url", image_url: { url: user_image_url } });
      if (action === "edit" && previous_image_url) imageRefs.push({ type: "image_url", image_url: { url: previous_image_url } });
      // Pass brand inspiration images as visual references (up to 2)
      for (const inspUrl of inspirationUrls.slice(0, 2)) {
        imageRefs.push({ type: "image_url", image_url: { url: inspUrl } });
      }

      const imageContent = imageRefs.length > 0
        ? [
            { type: "text", text: imagePromptText + (action === "edit" && previous_image_url ? " EDIT: Keep the overall layout similar to the previous design but apply the user's changes." : "") },
            ...imageRefs,
          ]
        : imagePromptText;

      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: render_quality === "hd" ? "google/gemini-3-pro-image-preview" : "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: imageContent,
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

      let base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      let binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      // --- POST-PROCESS: Log actual dimensions from PNG header ---
      const targetW = parseInt(w);
      const targetH = parseInt(h);
      try {
        // Read PNG IHDR chunk: width at bytes 16-19, height at bytes 20-23 (big-endian)
        if (binaryData.length > 24 && binaryData[1] === 0x50 && binaryData[2] === 0x4E && binaryData[3] === 0x47) {
          const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
          const actualW = view.getUint32(16, false);
          const actualH = view.getUint32(20, false);
          console.log(`Generated image dimensions: ${actualW}x${actualH}, target: ${targetW}x${targetH}`);
        }
      } catch (dimErr) {
        console.error("Dimension check failed:", dimErr);
      }

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
          free_edit: isFreeEdit,
          ...(copyStructure ? { copy_structure: copyStructure } : {}),
          ...(genomeData ? { genome: genomeData } : {}),
          ...(genomeScores ? { genome_scores: genomeScores } : {}),
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
              content: `You are Brandie, a senior creative director. You help users refine their design ideas before generating. Be confident, professional, calm. Never apologise excessively. Suggest improvements. Keep responses concise (2-3 sentences max). When advising on designs, always recommend photorealistic imagery and clean, modern aesthetics unless the user explicitly wants something different. Prioritise the user's intent and their Brand Centre settings (colours, fonts, tone, personality, inspiration) above all else.`,
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
