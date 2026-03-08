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

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { raw_inputs, brand } = await req.json();

    if (!raw_inputs || !brand) {
      return new Response(JSON.stringify({ error: "raw_inputs and brand are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a Jobs-to-be-Done (JTBD) audience intelligence analyst. Given raw answers from a business owner about their target customer, you must generate a comprehensive structured JTBD profile.

The business is: ${brand.name}
${brand.description ? `Description: ${brand.description}` : ""}
${brand.tagline ? `Tagline: ${brand.tagline}` : ""}

The user answered simple questions about their audience. Convert these into a professional JTBD analysis. Be specific and actionable. Use the language patterns from the raw inputs to inform your analysis.

Call the "generate_jtbd_profile" function with the structured output.`;

    const userContent = `Here are the raw answers about the target audience:

WHO ARE THEY:
- Who typically buys: ${raw_inputs.who_buys || "Not provided"}
- Life/business stage: ${raw_inputs.life_stage || "Not provided"}
- What they're improving: ${raw_inputs.improving || "Not provided"}

THEIR STRUGGLE:
- Frustrations: ${raw_inputs.frustrations || "Not provided"}
- What's not working: ${raw_inputs.not_working || "Not provided"}
- What they've tried: ${raw_inputs.tried_before || "Not provided"}

MOTIVATION:
- Success looks like: ${raw_inputs.success_looks_like || "Not provided"}
- Consequences of inaction: ${raw_inputs.consequences || "Not provided"}

BUYING CONTEXT:
- When they decide to buy: ${raw_inputs.when_buy || "Not provided"}
- What makes them hesitate: ${raw_inputs.hesitations || "Not provided"}

EMOTIONAL DRIVERS: ${(raw_inputs.emotional_drivers || []).join(", ") || "Not provided"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_jtbd_profile",
              description: "Generate a structured JTBD audience profile from raw user inputs.",
              parameters: {
                type: "object",
                properties: {
                  persona_summary: { type: "string", description: "2-3 sentence summary of the target persona" },
                  core_job_statement: { type: "string", description: "In format: When [situation], I want to [motivation], so I can [desired outcome]." },
                  struggling_moments: { type: "array", items: { type: "string" }, description: "Key moments of struggle" },
                  push_forces: { type: "array", items: { type: "string" }, description: "Forces pushing them away from current situation" },
                  pull_forces: { type: "array", items: { type: "string" }, description: "Forces pulling them toward a new solution" },
                  anxiety_forces: { type: "array", items: { type: "string" }, description: "Anxieties about switching/buying" },
                  habit_forces: { type: "array", items: { type: "string" }, description: "Habits keeping them in current situation" },
                  functional_outcomes: { type: "array", items: { type: "string" }, description: "Functional outcomes they desire" },
                  emotional_outcomes: { type: "array", items: { type: "string" }, description: "Emotional outcomes they desire" },
                  social_outcomes: { type: "array", items: { type: "string" }, description: "Social outcomes they desire" },
                  buying_triggers: { type: "array", items: { type: "string" }, description: "Events or moments that trigger purchase" },
                  hesitation_factors: { type: "array", items: { type: "string" }, description: "Factors that cause hesitation" },
                  messaging_angles: { type: "array", items: { type: "string" }, description: "Effective messaging angles to use" },
                  language_patterns: { type: "array", items: { type: "string" }, description: "Phrases and language patterns the audience uses" },
                  conversion_levers_ranked: { type: "array", items: { type: "string" }, description: "Ranked list of conversion levers from most to least effective" },
                },
                required: [
                  "persona_summary", "core_job_statement", "struggling_moments",
                  "push_forces", "pull_forces", "anxiety_forces", "habit_forces",
                  "functional_outcomes", "emotional_outcomes", "social_outcomes",
                  "buying_triggers", "hesitation_factors", "messaging_angles",
                  "language_patterns", "conversion_levers_ranked"
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_jtbd_profile" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("Failed to generate audience profile");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured profile");
    }

    const profile = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    return new Response(JSON.stringify({ profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audience-intelligence error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
