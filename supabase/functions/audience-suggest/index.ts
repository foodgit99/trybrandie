// Suggest audience answers for the v2 onboarding Audience step based on brand context.
// Returns 4 string fields (who, struggle, outcome, trigger) plus a per-field confidence map.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Product = { label?: string; description?: string; price?: string };

type BrandContext = {
  name?: string;
  description?: string;
  tagline?: string;
  playbook_id?: string;
  vibe?: string;
  tone_of_voice?: string;
  personality_traits?: string[];
  website_url?: string;
  products?: Product[];
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader ?? "" } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brand } = (await req.json()) as { brand: BrandContext };
    if (!brand?.name) {
      return new Response(JSON.stringify({ error: "brand.name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productsBlock = (brand.products ?? [])
      .filter((p) => p?.label?.trim())
      .slice(0, 8)
      .map((p) => `- ${p.label}${p.description ? ` — ${p.description}` : ""}${p.price ? ` (${p.price})` : ""}`)
      .join("\n");

    const systemPrompt = `You are a Nigerian-market audience strategist for small businesses. Given a brand's context, draft a realistic Jobs-to-be-Done style answer for four short questions about the brand's likely target customer.

Rules:
- Write in the language a Nigerian SME owner would actually hear from buyers. Avoid corporate jargon and avoid the word "consumers".
- Be specific. Mention age, role, city or context where credible. Reference real triggers (payday, owambe, end of term, new role, restock, Detty December, etc.) only when they fit the brand.
- If a field has weak evidence, write a short honest best-guess rather than fabricating specifics — and lower its confidence.
- Each answer: 1-2 sentences, under 220 characters.
- Never invent product names, prices, or claims not in the brand context.

Return your answer by calling the "suggest_audience" function.`;

    const userContent = `Brand: ${brand.name}
${brand.tagline ? `Tagline: ${brand.tagline}` : ""}
${brand.description ? `Description: ${brand.description}` : ""}
${brand.playbook_id ? `Industry/Playbook: ${brand.playbook_id}` : ""}
${brand.vibe ? `Vibe: ${brand.vibe}` : ""}
${brand.tone_of_voice ? `Tone: ${brand.tone_of_voice}` : ""}
${brand.personality_traits?.length ? `Personality: ${brand.personality_traits.join(", ")}` : ""}
${brand.website_url ? `Website: ${brand.website_url}` : ""}
${productsBlock ? `Products/Services:\n${productsBlock}` : "Products/Services: (none provided yet)"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: MAX_TOKENS.planner,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_audience",
              description: "Draft the four audience fields with per-field confidence (0-1).",
              parameters: {
                type: "object",
                properties: {
                  who: { type: "string", description: "Who they are. Age, role, vibe, city if known. 1-2 sentences." },
                  struggle: { type: "string", description: "The pain that makes them open their phone at midnight." },
                  outcome: { type: "string", description: "The version of life they're paying for." },
                  trigger: { type: "string", description: "The event or moment that makes them finally buy." },
                  confidence: {
                    type: "object",
                    properties: {
                      who: { type: "number" },
                      struggle: { type: "number" },
                      outcome: { type: "number" },
                      trigger: { type: "number" },
                    },
                    required: ["who", "struggle", "outcome", "trigger"],
                    additionalProperties: false,
                  },
                },
                required: ["who", "struggle", "outcome", "trigger", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_audience" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("audience-suggest gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return a suggestion");
    }
    const parsed = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    return new Response(
      JSON.stringify({
        suggestion: {
          who: String(parsed.who ?? "").trim(),
          struggle: String(parsed.struggle ?? "").trim(),
          outcome: String(parsed.outcome ?? "").trim(),
          trigger: String(parsed.trigger ?? "").trim(),
        },
        confidence: parsed.confidence ?? {},
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("audience-suggest error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
