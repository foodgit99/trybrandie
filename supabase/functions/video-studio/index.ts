import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const BRAIN_MODEL = "google/gemini-3.1-pro-preview";
const IMAGE_MODEL = "google/gemini-3-pro-image-preview";
const FAST_MODEL = "google/gemini-2.5-flash-lite";

// ─── Helpers ────────────────────────────────────────────

async function callAI(
  messages: { role: string; content: string }[],
  model: string = BRAIN_MODEL,
  tools?: any[],
  toolChoice?: any
): Promise<any> {
  const body: any = { model, messages, temperature: 0.7 };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`AI call failed [${res.status}]:`, errText);
    throw new Error(`AI error ${res.status}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.message?.tool_calls?.[0]) {
    return JSON.parse(choice.message.tool_calls[0].function.arguments);
  }
  return choice?.message?.content || "";
}

function strategyTool() {
  return {
    type: "function",
    function: {
      name: "create_strategy",
      description: "Create a video content strategy.",
      parameters: {
        type: "object",
        properties: {
          hook_style: { type: "string", description: "Type of hook: question, bold_claim, relatable_pain, shocking_stat, curiosity_gap" },
          pacing: { type: "string", enum: ["slow", "medium", "fast"] },
          emotional_arc: { type: "string", description: "The emotional journey: e.g. tension→relief, curiosity→revelation" },
          structure: {
            type: "array",
            items: {
              type: "object",
              properties: {
                section: { type: "string" },
                purpose: { type: "string" },
                duration_pct: { type: "number" },
              },
              required: ["section", "purpose", "duration_pct"],
            },
          },
          key_message: { type: "string" },
          cta_text: { type: "string" },
        },
        required: ["hook_style", "pacing", "emotional_arc", "structure", "key_message", "cta_text"],
      },
    },
  };
}

function scriptTool() {
  return {
    type: "function",
    function: {
      name: "create_script",
      description: "Generate a retention-optimized video script.",
      parameters: {
        type: "object",
        properties: {
          variation_label: { type: "string" },
          hook: { type: "string", description: "First 3 seconds hook text" },
          scenes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                scene_index: { type: "integer" },
                duration_seconds: { type: "number" },
                narration: { type: "string" },
                visual_description: { type: "string" },
                text_overlay: { type: "string" },
                transition: { type: "string", enum: ["cut", "fade", "slide", "zoom", "dissolve"] },
              },
              required: ["scene_index", "duration_seconds", "narration", "visual_description"],
            },
          },
          total_duration_seconds: { type: "number" },
        },
        required: ["variation_label", "hook", "scenes", "total_duration_seconds"],
      },
    },
  };
}

function captionTool() {
  return {
    type: "function",
    function: {
      name: "create_caption",
      description: "Generate a social media caption with hashtags.",
      parameters: {
        type: "object",
        properties: {
          caption: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
        },
        required: ["caption", "hashtags"],
      },
    },
  };
}

// ─── Pipeline Stages ────────────────────────────────────

async function assembleContext(
  supabase: any,
  brandId: string,
  audienceId?: string
): Promise<string> {
  const [brandRes, audienceRes, trendRes, productsRes] = await Promise.all([
    supabase.from("brands").select("*").eq("id", brandId).single(),
    audienceId && audienceId !== "none"
      ? supabase.from("target_audiences").select("*").eq("id", audienceId).single()
      : Promise.resolve({ data: null }),
    supabase.from("brand_trend_preferences").select("*").eq("brand_id", brandId).maybeSingle(),
    supabase.from("brand_products").select("label, description, product_type, price, features, duration, pricing_model, is_featured").eq("brand_id", brandId),
  ]);

  const brand = brandRes.data;
  const audience = audienceRes.data;
  const trend = trendRes.data;
  const products = productsRes.data || [];

  let ctx = `BRAND CONTEXT:\n`;
  if (brand) {
    ctx += `Name: ${brand.name}\nTagline: ${brand.tagline || ""}\nDescription: ${brand.description || ""}\n`;
    ctx += `Tone: ${brand.tone_of_voice || ""}\nVibe: ${brand.vibe || ""}\n`;
    ctx += `Personality: ${(brand.personality_traits || []).join(", ")}\n`;
    ctx += `Colors: Primary=${(brand.primary_colors || []).join(",")}, Secondary=${(brand.secondary_colors || []).join(",")}, Accent=${(brand.accent_colors || []).join(",")}\n`;
    ctx += `Typography: ${brand.typography_primary || ""} / ${brand.typography_secondary || ""}\n`;
    if (brand.special_instructions) ctx += `Special: ${brand.special_instructions}\n`;
  }

  if (audience) {
    const jtbd = audience.jtbd_profile || {};
    ctx += `\nAUDIENCE (JTBD):\n`;
    ctx += `Persona: ${jtbd.persona_summary || audience.label}\n`;
    if (jtbd.core_job_statement) ctx += `Core Job: ${jtbd.core_job_statement}\n`;
    if (jtbd.struggling_moments?.length) ctx += `Struggles: ${jtbd.struggling_moments.join("; ")}\n`;
    if (jtbd.emotional_outcomes?.length) ctx += `Emotional Goals: ${jtbd.emotional_outcomes.join("; ")}\n`;
    if (jtbd.messaging_angles?.length) ctx += `Messaging Angles: ${jtbd.messaging_angles.join("; ")}\n`;
  }

  if (trend?.trend_enabled) {
    ctx += `\nTREND: ${trend.selected_trend} (intensity: ${trend.default_trend_intensity}%)\n`;
  }

  if (products.length > 0) {
    ctx += `\nPRODUCTS & SERVICES:\n`;
    products
      .sort((a: any, b: any) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0))
      .forEach((p: any, i: number) => {
      const isService = p.product_type === "service";
      let line = `${i + 1}. ${p.is_featured ? "⭐ " : ""}"${p.label || "Untitled"}" (${p.product_type}${p.price ? `, ${p.pricing_model ? p.pricing_model + " " : ""}${p.price}` : ""}${isService && p.duration ? `, ${p.duration}` : ""})`;
      if (p.description) line += ` — ${p.description}`;
      if (p.features?.length > 0) line += ` | ${isService ? "Includes" : "Features"}: ${p.features.join(", ")}`;
      ctx += line + "\n";
    });
  }

  return ctx;
}

async function runStrategy(context: string, intent: any): Promise<any> {
  const systemPrompt = `You are Brandie's Video Strategy Agent. You create video content strategies that are deeply brand-aligned and audience-aware.

Given the brand context, audience intelligence, and user intent, produce a strategy that defines the video's structure, emotional arc, pacing, and hook style.

Rules:
- ALWAYS align with brand tone and personality
- Hook must capture attention in first 3 seconds
- Structure must fit the target platform and length
- Consider the audience's emotional drivers and pain points`;

  const userPrompt = `${context}

USER INTENT:
- Goal: ${intent.content_goal}
- Format: ${intent.format_style}
- Platform: ${intent.platform}
- Length: ${intent.length} seconds
- Energy: ${intent.energy}
- CTA Style: ${intent.cta_style}
- Message: ${intent.script_input}

Create the video strategy.`;

  return await callAI(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    BRAIN_MODEL,
    [strategyTool()],
    { type: "function", function: { name: "create_strategy" } }
  );
}

async function runScript(
  context: string,
  strategy: any,
  intent: any,
  variationHint: string
): Promise<any> {
  const systemPrompt = `You are Brandie's Script Agent. Write retention-optimized video scripts.

Rules:
- Mobile-first: large text, concise messaging
- Hook in first 3 seconds is critical
- Match brand tone exactly
- Use audience language patterns
- Each scene's visual_description MUST embed the brand's visual identity: include brand colors (exact hex values), mood/vibe, textures, lighting style, and any special visual instructions from the brand. The visual_description is used directly for image and video generation — it must carry brand DNA so outputs look on-brand without needing separate brand lookups.
- Transitions should match the energy level
- Total duration must match target length
- ${variationHint}`;

  const userPrompt = `${context}

STRATEGY:
${JSON.stringify(strategy, null, 2)}

TARGET: ${intent.length} seconds, ${intent.energy} energy, ${intent.platform}
MESSAGE: ${intent.script_input}

Generate the script with this variation style: ${variationHint}`;

  return await callAI(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    BRAIN_MODEL,
    [scriptTool()],
    { type: "function", function: { name: "create_script" } }
  );
}

async function evaluateScript(script: any, intent: any): Promise<{ pass: boolean; feedback: string }> {
  const prompt = `Evaluate this video script for quality. Score 1-10 on:
1. Hook strength (does it grab attention in 3s?)
2. Clarity (is the message clear?)
3. Platform fit (right for ${intent.platform}?)
4. Length (close to ${intent.length}s target?)
5. Brand alignment

Script: ${JSON.stringify(script)}

Reply with ONLY a JSON object: {"pass": true/false, "score": number, "feedback": "..."}
If score >= 7, pass = true.`;

  const result = await callAI(
    [{ role: "user", content: prompt }],
    FAST_MODEL
  );

  try {
    const cleaned = result.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { pass: true, feedback: "Evaluation parse failed, proceeding." };
  }
}

async function runCaption(context: string, script: any, intent: any): Promise<any> {
  const systemPrompt = `You are Brandie's Caption Agent. Generate engaging social media captions for video content.

Rules:
- Match brand voice
- Platform-native formatting (${intent.platform})
- Include relevant hashtags (5-10)
- Add engagement hooks
- Keep under 200 characters for the main caption`;

  return await callAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Context: ${context}\n\nScript hook: ${script.hook}\nMessage: ${intent.script_input}\n\nGenerate caption and hashtags.` },
    ],
    BRAIN_MODEL,
    [captionTool()],
    { type: "function", function: { name: "create_caption" } }
  );
}

async function generateSceneImage(
  scene: any,
  brand: any,
  intent: any,
  brandContext: string
): Promise<string | null> {
  try {
    // Build rich brand-aware prompt
    const colorPalette = [
      ...(brand?.primary_colors || []).map((c: string) => `Primary: ${c}`),
      ...(brand?.secondary_colors || []).map((c: string) => `Secondary: ${c}`),
      ...(brand?.accent_colors || []).map((c: string) => `Accent: ${c}`),
    ].join(", ");

    const brandStyle = [
      brand?.vibe ? `Visual mood/vibe: ${brand.vibe}` : "",
      brand?.tone_of_voice ? `Tone: ${brand.tone_of_voice}` : "",
      brand?.personality_traits?.length ? `Personality: ${brand.personality_traits.join(", ")}` : "",
      brand?.typography_primary ? `Typography feel: ${brand.typography_primary}` : "",
      brand?.special_instructions ? `Special instructions: ${brand.special_instructions}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `Generate a high-quality social media video frame/scene image that is STRICTLY on-brand.

BRAND STYLE DIRECTIVES:
${brandStyle}
Color palette: ${colorPalette || "Not specified"}

Scene: ${scene.visual_description}
${scene.text_overlay ? `Text overlay: "${scene.text_overlay}"` : ""}
Energy: ${intent.energy}
Platform: ${intent.platform} (vertical 9:16 format)

CRITICAL: The image MUST use the brand's color palette as the dominant visual scheme. The mood, lighting, and composition must reflect the brand's vibe and personality. Do NOT use generic stock-photo aesthetics — this must feel uniquely on-brand.

Create a visually striking, photorealistic scene native to ${intent.platform}.`;

    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      console.error("Scene image API error:", res.status);
      return null;
    }

    const data = await res.json();
    let imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    // Retry once if no image
    if (!imageBase64) {
      console.log("Scene image: no image on first try, retrying...");
      await new Promise(r => setTimeout(r, 1500));
      const retry = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });
      if (retry.ok) {
        const retryData = await retry.json();
        imageBase64 = retryData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      }
    }

    if (!imageBase64) {
      console.error("Scene image: no image after retry");
      return null;
    }

    // Upload to storage
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const fileName = `video-scenes/${crypto.randomUUID()}.png`;
    const { error } = await adminClient.storage.from("designs").upload(fileName, buffer, {
      contentType: "image/png",
    });
    if (error) {
      console.error("Scene image upload failed:", error);
      return null;
    }
    const { data: urlData } = adminClient.storage.from("designs").getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch (e) {
    console.error("Scene image generation failed:", e);
    return null;
  }
}

// ─── Main Handler ────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { intent, brand_id, audience_id, content_idea_id } = body;

    if (!intent || !brand_id) {
      return new Response(JSON.stringify({ error: "Missing intent or brand_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credit check (3 credits for video)
    const VIDEO_CREDIT_COST = 3;
    const { data: profile } = await supabase
      .from("profiles")
      .select("generations_count, generations_reset_at, bonus_credits, subscription_tier")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      const tierLimits: Record<string, number> = { free: 10, entrepreneur: 50, creator: 150, agency: 400 };
      const limit = tierLimits[profile.subscription_tier] || 10;
      const resetAt = new Date(profile.generations_reset_at);
      const now = new Date();
      let count = profile.generations_count;
      if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
        count = 0;
      }
      const bonus = profile.bonus_credits || 0;
      if (count + VIDEO_CREDIT_COST > limit + bonus) {
        return new Response(JSON.stringify({ error: "Insufficient credits for video generation" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get brand data for image generation
    const { data: brandData } = await supabase.from("brands").select("*").eq("id", brand_id).single();

    // ── PIPELINE START ──

    // 1. Context Assembly
    const context = await assembleContext(supabase, brand_id, audience_id);

    // 2. Strategy Agent
    const strategy = await runStrategy(context, intent);

    // 3. Script Agent (2 variations in parallel)
    const [scriptA, scriptB] = await Promise.all([
      runScript(context, strategy, intent, "Version A: Lead with a strong, attention-grabbing hook. Bold and direct."),
      runScript(context, strategy, intent, "Version B: Lead with a storytelling angle. Emotional and relatable."),
    ]);

    // 4. Script Evaluator (parallel)
    const [evalA, evalB] = await Promise.all([
      evaluateScript(scriptA, intent),
      evaluateScript(scriptB, intent),
    ]);

    // If a script fails evaluation, try one refinement
    let finalScriptA = scriptA;
    let finalScriptB = scriptB;
    if (!evalA.pass) {
      finalScriptA = await runScript(context, strategy, intent, `Version A REFINED: Fix: ${evalA.feedback}. Bold hook style.`);
    }
    if (!evalB.pass) {
      finalScriptB = await runScript(context, strategy, intent, `Version B REFINED: Fix: ${evalB.feedback}. Storytelling style.`);
    }

    // 5. Caption Agent (parallel with scene image generation)
    const selectedScript = finalScriptA; // Default to variation A
    const captionPromise = runCaption(context, selectedScript, intent);

    // 6. Generate scene images (limit to 4 for speed)
    const scenesToRender = selectedScript.scenes?.slice(0, 6) || [];
    const imagePromises = scenesToRender.map((scene: any) =>
      generateSceneImage(scene, brandData, intent, context)
    );

    const [captionResult, ...sceneImages] = await Promise.all([
      captionPromise,
      ...imagePromises,
    ]);

    // Build scenes with images
    const scenes = scenesToRender.map((scene: any, i: number) => ({
      scene_index: scene.scene_index || i,
      description: scene.visual_description || scene.narration || "",
      image_url: sceneImages[i] || null,
      duration_ms: (scene.duration_seconds || 3) * 1000,
      text_overlay: scene.text_overlay ? { text: scene.text_overlay } : null,
      transition: scene.transition || "fade",
    }));

    // 7. Create video project
    const { data: project, error: projectError } = await supabase
      .from("video_projects")
      .insert({
        user_id: user.id,
        brand_id,
        content_idea_id: content_idea_id || null,
        intent,
        script: {
          variations: [
            { id: "a", label: "Bold Hook", ...finalScriptA },
            { id: "b", label: "Story Angle", ...finalScriptB },
          ],
          selected: "a",
        },
        storyboard: { strategy, scenes: scenesToRender },
        timeline: { scenes },
        caption: captionResult.caption || null,
        hashtags: captionResult.hashtags || [],
        status: "complete",
        credits_used: VIDEO_CREDIT_COST,
      })
      .select("id")
      .single();

    if (projectError) {
      console.error("Project save error:", projectError);
      throw new Error("Failed to save video project");
    }

    // 8. Save scenes
    if (scenes.length > 0 && project) {
      const sceneRows = scenes.map((s: any) => ({
        video_project_id: project.id,
        ...s,
      }));
      await supabase.from("video_scenes").insert(sceneRows);
    }

    // 9. Deduct credits
    await supabase
      .from("profiles")
      .update({
        generations_count: (profile?.generations_count || 0) + VIDEO_CREDIT_COST,
      })
      .eq("user_id", user.id);

    // Mark content idea if linked
    if (content_idea_id) {
      await supabase
        .from("content_ideas")
        .update({ status: "created" })
        .eq("id", content_idea_id);
    }

    return new Response(
      JSON.stringify({
        project_id: project?.id,
        scenes,
        variations: [
          { id: "a", label: "Bold Hook", hook: finalScriptA.hook, script_summary: finalScriptA.scenes?.[0]?.narration || "" },
          { id: "b", label: "Story Angle", hook: finalScriptB.hook, script_summary: finalScriptB.scenes?.[0]?.narration || "" },
        ],
        caption: captionResult.caption,
        hashtags: captionResult.hashtags,
        strategy,
        credits_used: VIDEO_CREDIT_COST,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Video studio error:", e);
    const status = e.message?.includes("429") ? 429 : e.message?.includes("402") ? 402 : 500;
    return new Response(
      JSON.stringify({ error: e.message || "Internal error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
