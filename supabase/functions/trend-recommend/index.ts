import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TREND_IDS = [
  "tactile-rebellion",
  "hyper-chromatic",
  "technical-mono",
  "neo-naturalism",
  "kinetic-typography",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { brand, audience_summary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a design trend recommendation engine for a brand studio called Brandie.

Given a brand profile and optional audience summary, recommend the SINGLE most appropriate design trend from these options:

1. tactile-rebellion — Paper textures, hand-drawn marks, grain overlays, scrapbook feel. Best for: lifestyle, artisan, handmade, creative, storytelling brands.
2. hyper-chromatic — Vibrant colours, neon accents, bold gradients, energetic layouts. Best for: entertainment, events, nightlife, bold consumer brands, launches.
3. technical-mono — Monospaced typography, clean grids, industrial aesthetic. Best for: tech, SaaS, fintech, data, developer-focused brands.
4. neo-naturalism — Calm palettes, organic textures, nature imagery, breathable spacing. Best for: wellness, health, sustainability, meditation, organic brands.
5. kinetic-typography — Motion-oriented layouts, elastic type, strong hierarchy. Best for: sports, fitness, music, high-energy, youth-oriented brands.

You MUST respond with ONLY a valid JSON object with these fields:
- trend_id: one of the 5 IDs above
- reason: a short 1-sentence explanation (max 20 words)
- confidence: a number 0-100

No extra text, no markdown. Just the JSON object.`;

    const userPrompt = `Brand: ${JSON.stringify(brand || {})}
${audience_summary ? `Audience: ${audience_summary}` : "No audience profile available."}

Recommend the best trend.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Parse JSON from possibly markdown-wrapped response
    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    let parsed: { trend_id: string; reason: string; confidence: number };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", raw);
      // Fallback: default recommendation
      parsed = {
        trend_id: "tactile-rebellion",
        reason: "Default recommendation — could not parse AI response.",
        confidence: 30,
      };
    }

    // Validate trend_id
    if (!TREND_IDS.includes(parsed.trend_id as any)) {
      parsed.trend_id = "tactile-rebellion";
      parsed.reason = "Fallback — AI returned unknown trend ID.";
      parsed.confidence = 30;
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trend-recommend error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
