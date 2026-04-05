import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSeasonalContextString } from "../_shared/holiday-calendar.ts";
import { sanitise } from "../_shared/sanitise.ts";

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const { messages, brand_id } = await req.json();
    if (!messages || !brand_id) {
      return new Response(JSON.stringify({ error: "Missing messages or brand_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch brand context in parallel
    const [brandRes, audienceRes, pillarsRes, seriesRes, campaignsRes, inspirationCountRes, productsCountRes, recentDesignsRes, trendIntelRes] = await Promise.all([
      supabase.from("brands").select("*").eq("id", brand_id).eq("user_id", userId).single(),
      supabase.from("target_audiences").select("label, jtbd_profile").eq("brand_id", brand_id),
      supabase.from("content_pillars").select("name, description").eq("brand_id", brand_id).order("sort_order"),
      supabase.from("post_series").select("name, description, recurrence, preferred_day").eq("brand_id", brand_id),
      supabase.from("campaigns").select("name, description, post_count").eq("brand_id", brand_id),
      supabase.from("brand_inspiration").select("id", { count: "exact", head: true }).eq("brand_id", brand_id),
      supabase.from("brand_products").select("label, description, product_type, price, features, duration, pricing_model, image_url, is_featured").eq("brand_id", brand_id),
      supabase.from("designs").select("title, prompt, trend_used, vote").eq("brand_id", brand_id).order("created_at", { ascending: false }).limit(10),
      supabase.from("brand_trend_intel").select("trends_data, generated_at").eq("brand_id", brand_id).maybeSingle(),
    ]);

    const brand = brandRes.data;
    if (!brand) {
      return new Response(JSON.stringify({ error: "Brand not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build brand context string
    const audiences = audienceRes.data || [];
    const pillars = pillarsRes.data || [];
    const series = seriesRes.data || [];
    const campaigns = campaignsRes.data || [];
    const inspirationCount = inspirationCountRes.count || 0;
    const products = productsCountRes.data || [];
    const recentDesigns = recentDesignsRes.data || [];

    const brandContext = `
## Brand Profile
- **Name**: ${brand.name}
- **Tagline**: ${brand.tagline || "Not set"}
- **Description**: ${brand.description || "Not set"}
- **Vibe**: ${brand.vibe || "Not set"}
- **Tone of Voice**: ${brand.tone_of_voice || "Not set"}
- **Personality Traits**: ${(brand.personality_traits || []).join(", ") || "Not set"}
- **Primary Colors**: ${(brand.primary_colors || []).join(", ") || "Not set"}
- **Secondary Colors**: ${(brand.secondary_colors || []).join(", ") || "Not set"}
- **Accent Colors**: ${(brand.accent_colors || []).join(", ") || "Not set"}
- **Typography (Primary)**: ${brand.typography_primary || "Not set"}
- **Typography (Secondary)**: ${brand.typography_secondary || "Not set"}
- **Typography (Display)**: ${brand.typography_display || "Not set"}
- **Logo**: ${brand.logo_url ? "Uploaded" : "Not uploaded"}
- **Special Instructions**: ${brand.special_instructions || "None"}
- **Inspiration Images**: ${inspirationCount} uploaded

## Products & Services
${products.length > 0 ? products
  .sort((a: any, b: any) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0))
  .map((p: any, i: number) => {
  const isService = p.product_type === "service";
  let line = `${i + 1}. ${p.is_featured ? "⭐ " : ""}**${p.label || "Untitled"}** (${p.product_type}${p.price ? `, ${p.pricing_model ? p.pricing_model + " " : ""}${p.price}` : ""}${isService && p.duration ? `, ${p.duration}` : ""})`;
  if (p.description) line += ` — ${p.description}`;
  if (p.features?.length > 0) line += `\n   ${isService ? "Includes" : "Features"}: ${p.features.join(", ")}`;
  return line;
}).join("\n") : "No products or services added yet."}

## Target Audiences
${audiences.length > 0 ? audiences.map((a: any) => {
  const p = a.jtbd_profile || {};
  return `### ${a.label}
- **Persona**: ${p.persona_summary || "N/A"}
- **Core Job**: ${p.core_job_statement || "N/A"}
- **Struggling Moments**: ${(p.struggling_moments || []).join("; ") || "N/A"}
- **Emotional Outcomes**: ${(p.emotional_outcomes || []).join("; ") || "N/A"}
- **Messaging Angles**: ${(p.messaging_angles || []).join("; ") || "N/A"}`;
}).join("\n") : "No target audiences defined yet."}

## Content Strategy
### Content Pillars
${pillars.length > 0 ? pillars.map((p: any) => `- **${p.name}**: ${p.description}`).join("\n") : "No content pillars defined yet."}

### Recurring Series
${series.length > 0 ? series.map((s: any) => `- **${s.name}** (${s.recurrence}${s.preferred_day ? `, ${s.preferred_day}` : ""}): ${s.description}`).join("\n") : "No recurring series defined yet."}

### Campaigns
${campaigns.length > 0 ? campaigns.map((c: any) => `- **${c.name}** (${c.post_count} posts): ${c.description}`).join("\n") : "No campaigns defined yet."}

## Recent Designs
${recentDesigns.length > 0 ? recentDesigns.map((d: any) => `- "${d.title || d.prompt?.slice(0, 60)}"${d.trend_used ? ` (trend: ${d.trend_used})` : ""}${d.vote === 1 ? " ⬆️" : d.vote === -1 ? " ⬇️" : ""}`).join("\n") : "No designs created yet."}

## Industry Trend Intelligence
${(() => {
  const trendIntel = trendIntelRes.data;
  if (!trendIntel?.trends_data || !Array.isArray(trendIntel.trends_data) || trendIntel.trends_data.length === 0) {
    return "No trend intelligence available yet. Suggest the user refresh their Trend Intel from the Content Hub.";
  }
  const age = Date.now() - new Date(trendIntel.generated_at).getTime();
  const daysAgo = Math.floor(age / (1000 * 60 * 60 * 24));
  return `*Last updated: ${daysAgo === 0 ? "today" : `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`}*\n` +
    (trendIntel.trends_data as any[]).map((t: any) => `### ${t.title}\n${t.summary}\n**Brand relevance**: ${t.relevance_to_brand}\n**Content angles**: ${(t.content_angles || []).join("; ")}`).join("\n\n");
})()}
`.trim();

    const systemPrompt = `You are Brandie's Brand Strategist — a seasoned branding expert who has studied and applied the frameworks used by the world's most successful brands.

Your knowledge spans: Brand Archetypes, StoryBrand (Donald Miller), Jobs-to-be-Done (Clayton Christensen), Blue Ocean Strategy, Brand Pyramid, Brand Key Model, Kapferer's Brand Identity Prism, Keller's Brand Equity Model, positioning frameworks (Ries & Trout), emotional branding (Marc Gobé), narrative branding, category design, and modern digital brand building.

You have full context of the user's brand below. Reference their specific brand data naturally in your responses — their colors, tone, audience, content pillars, strategy, and history. Make the user feel like you truly know their brand.

---
${brandContext}

${getSeasonalContextString(14)}
---

## Your Personality & Tone
- You are friendly, warm, and supportive — like a trusted team member who also happens to be a world-class branding consultant.
- You are encouraging but honest. If something needs improvement, you say so with tact and a constructive alternative.
- You use conversational language, not academic jargon. When you reference frameworks, you explain them simply.
- You celebrate the user's brand wins and strengths before diving into areas for growth.
- Keep responses focused and actionable. Avoid long walls of text unless the user asks for deep analysis.

## CRITICAL BOUNDARY
You must ONLY discuss topics related to branding as it pertains to the user's brand. This includes:
- Brand strategy, positioning, messaging, differentiation
- Visual identity guidance (colors, typography, logo usage)
- Audience understanding and targeting
- Content strategy and planning
- Competitive positioning (discussing competitors is fine if it's in the context of the user's brand strategy)
- Brand storytelling, voice, and tone
- Campaign ideas and marketing angles — especially seasonal and holiday-themed campaigns
- Brand health, consistency, and growth
- Timely, seasonal content planning (reference upcoming holidays and events when relevant to the brand)

You must REFUSE to discuss:
- Anything unrelated to branding (coding, recipes, general knowledge, math, etc.)
- Other brands in isolation (not in competitive context)
- Personal advice unrelated to branding

If asked about anything outside branding as it relates to the user's brand, politely decline and redirect: "I'm your brand strategist — I'm here to help with everything related to your brand! Let's focus on that. Is there anything about [brand name]'s strategy, messaging, or positioning I can help with?"

## Response Format
- Use markdown formatting for structure when helpful (headers, bullet points, bold).
- Keep responses concise unless the user asks for deep dives.
- When giving recommendations, be specific to the user's brand — don't give generic advice.
- If the user's brand data is incomplete (e.g., no audience defined), gently suggest they set it up and explain why it matters.

## Contextual Actions (IMPORTANT)
Sometimes your advice naturally leads to a concrete next step — like creating a design or generating content ideas. When — and ONLY when — your response concludes with a specific, actionable recommendation that the user could immediately execute, append a hidden JSON block at the very end of your response in this exact format:

<!-- ACTIONS
[{"label":"Short button label","action":"design","prompt":"A specific design prompt based on your recommendation"},{"label":"Short button label","action":"ideas","prompt":"A specific content idea prompt"}]
ACTIONS -->

Rules for actions:
- Do NOT include actions in every response. Most responses should NOT have actions.
- Only include actions when your advice naturally concludes with something the user can immediately create or generate.
- Maximum 2 actions per response.
- The "action" field must be either "design" (to create a visual in the design studio) or "ideas" (to generate content ideas).
- The "prompt" field should be a specific, ready-to-use prompt that captures your strategic recommendation.
- The "label" should be short (2-4 words) and action-oriented, e.g. "Design this post", "Generate ideas".
- Examples of when to include actions: after recommending a specific post concept, after suggesting a campaign angle, after identifying a content gap.
- Examples of when NOT to include actions: when answering general strategy questions, when analyzing brand health, when explaining frameworks, during back-and-forth clarification.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("brand-strategist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
