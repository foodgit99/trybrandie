import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UPDATE_TYPES = [
  "testimonial",
  "product",
  "event",
  "milestone",
  "csr",
  "press",
  "partnership",
  "customer_story",
  "other",
] as const;

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
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const update_type = String(body.update_type || "other");
    const title = String(body.title || "").slice(0, 200);
    const content = String(body.content || "").slice(0, 1000);
    const attribution = String(body.attribution || "").slice(0, 200);
    const event_date = String(body.event_date || "");

    if (!content.trim() && !title.trim()) {
      return new Response(
        JSON.stringify({ error: "Provide at least a title or content to summarise." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `You are an editorial assistant for a brand content tool. The user has logged a real-time business "update" that an AI will later use to generate social media content.

Your job:
1. Read the raw input.
2. Summarise the key facts in 1-2 sentences (max 200 chars), keeping any verbatim customer quotes intact.
3. Score how confident the AI can be using this update for content generation (0-100).
   - 90-100: clear, specific, has names/numbers/outcomes, ready to use as-is.
   - 70-89: usable but a missing detail would make it stronger.
   - 40-69: vague or generic — AI can use it but content will feel weak.
   - 0-39: too vague, contradictory, or potentially fabricated. Should not be used yet.
4. List concrete missing details that would lift confidence (e.g. "customer name", "specific outcome / number", "date", "location", "what changed").
5. Suggest a short editorial title (under 60 chars) if the existing title is missing or weak.
6. Extract attribution (person + role/company) verbatim from the content if mentioned and the attribution field is empty.
7. Surface warnings: vague quantifiers ("a lot", "many"), unverifiable claims ("#1", "best ever"), missing dates for time-sensitive types (event/product), or contradictions.

Be honest. Do not inflate confidence. Do not invent facts. If the user wrote one vague sentence, say so.

Call the "summarise_update" function with the structured output.`;

    const userContent = `UPDATE TYPE: ${update_type}
TITLE: ${title || "(empty)"}
CONTENT: ${content || "(empty)"}
ATTRIBUTION: ${attribution || "(empty)"}
EVENT DATE: ${event_date || "(empty)"}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "summarise_update",
          description: "Return a concise summary, confidence score, and editorial warnings for a brand update.",
          parameters: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "1-2 sentence summary of the key facts. Max 200 characters. Preserve verbatim quotes.",
              },
              confidence: {
                type: "integer",
                description: "Confidence 0-100 that this update is strong enough for content generation.",
                minimum: 0,
                maximum: 100,
              },
              confidence_reason: {
                type: "string",
                description: "One short sentence explaining the score.",
              },
              missing_fields: {
                type: "array",
                description: "Concrete details that would strengthen this update.",
                items: { type: "string" },
              },
              warnings: {
                type: "array",
                description: "Editorial warnings: vague claims, unverifiable boasts, contradictions, missing dates.",
                items: { type: "string" },
              },
              suggested_title: {
                type: "string",
                description: "Short editorial title (<60 chars). Empty string if existing title is fine.",
              },
              extracted_attribution: {
                type: "string",
                description: "Person + role/company extracted verbatim, or empty string.",
              },
              detected_type: {
                type: "string",
                enum: [...UPDATE_TYPES],
                description: "Best-fit update type based on the content.",
              },
            },
            required: [
              "summary",
              "confidence",
              "confidence_reason",
              "missing_fields",
              "warnings",
              "suggested_title",
              "extracted_attribution",
              "detected_type",
            ],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: MAX_TOKENS.shortJson,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "summarise_update" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service unavailable. Try again." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "AI returned no structured result." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse AI tool args:", e);
      return new Response(
        JSON.stringify({ error: "Could not parse AI response." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sanitize
    const result = {
      summary: String(parsed.summary || "").slice(0, 240),
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      confidence_reason: String(parsed.confidence_reason || "").slice(0, 200),
      missing_fields: Array.isArray(parsed.missing_fields)
        ? parsed.missing_fields.map((s: any) => String(s)).slice(0, 8)
        : [],
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.map((s: any) => String(s)).slice(0, 6)
        : [],
      suggested_title: String(parsed.suggested_title || "").slice(0, 80),
      extracted_attribution: String(parsed.extracted_attribution || "").slice(0, 200),
      detected_type: UPDATE_TYPES.includes(parsed.detected_type) ? parsed.detected_type : update_type,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("summarise-update error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
