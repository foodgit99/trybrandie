import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const { brand_id, force_refresh } = await req.json();
    if (!brand_id) {
      return new Response(JSON.stringify({ error: "brand_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabase.from("brands").select("*").eq("id", brand_id).single();
    if (brandErr || !brand) {
      return new Response(JSON.stringify({ error: "Brand not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check cache — return existing if less than 7 days old (unless force_refresh)
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from("brand_trend_intel")
        .select("*")
        .eq("brand_id", brand_id)
        .maybeSingle();

      if (cached) {
        const ageMs = Date.now() - new Date(cached.generated_at).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (ageMs < sevenDays) {
          return new Response(JSON.stringify({ trends: cached.trends_data, generated_at: cached.generated_at, cached: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Gather brand context
    const [audienceRes, productsRes] = await Promise.all([
      supabase.from("target_audiences").select("label, jtbd_profile").eq("brand_id", brand_id).limit(3),
      supabase.from("brand_products").select("label, description, product_type").eq("brand_id", brand_id).limit(5),
    ]);

    const audiences = audienceRes.data || [];
    const products = productsRes.data || [];

    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();

    const brandSummary = `
Brand: ${brand.name}
Tagline: ${brand.tagline || "N/A"}
Description: ${brand.description || "N/A"}
Vibe: ${brand.vibe || "N/A"}
Products/Services: ${products.map((p: any) => `${p.label} (${p.product_type})`).join(", ") || "N/A"}
Target Audiences: ${audiences.map((a: any) => a.label).join(", ") || "N/A"}
`.trim();

    // Call AI to synthesize trends
    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a trend research analyst specializing in social media and digital marketing. Your job is to identify 5-7 current, real-world trends that are relevant to a specific brand's industry and target market.

Focus on:
- Industry-specific trends happening RIGHT NOW (${currentMonth} ${currentYear})
- Social media content trends relevant to their niche
- Consumer behavior shifts in their market
- Seasonal opportunities for the current time of year
- Emerging themes their competitors are likely capitalizing on

Be specific and actionable. Each trend should include concrete content angles the brand can use.
Do NOT make up trends — focus on real, observable patterns in digital marketing and their specific industry.`,
          },
          {
            role: "user",
            content: `Research current industry trends for this brand:\n\n${brandSummary}\n\nCurrent date: ${currentMonth} ${currentYear}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_trends",
            description: "Report researched industry trends",
            parameters: {
              type: "object",
              properties: {
                trends: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Short trend name" },
                      summary: { type: "string", description: "2-3 sentence description of the trend" },
                      relevance_to_brand: { type: "string", description: "Why this matters for this specific brand" },
                      content_angles: {
                        type: "array",
                        items: { type: "string" },
                        description: "3-4 specific content ideas leveraging this trend",
                      },
                    },
                    required: ["title", "summary", "relevance_to_brand", "content_angles"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["trends"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_trends" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Trend research failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const json = await response.json();
    let trendsData: any[] = [];

    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        trendsData = parsed.trends || [];
      } catch {
        console.error("Failed to parse trend data");
      }
    } else {
      // Fallback: try content
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          trendsData = parsed.trends || [];
        } catch { /* ignore */ }
      }
    }

    if (trendsData.length === 0) {
      return new Response(JSON.stringify({ error: "Could not generate trend insights. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upsert into cache
    const now_iso = new Date().toISOString();
    const { data: existing } = await serviceClient
      .from("brand_trend_intel")
      .select("id")
      .eq("brand_id", brand_id)
      .maybeSingle();

    if (existing) {
      await serviceClient.from("brand_trend_intel").update({
        trends_data: trendsData,
        generated_at: now_iso,
        updated_at: now_iso,
      }).eq("id", existing.id);
    } else {
      await serviceClient.from("brand_trend_intel").insert({
        brand_id,
        user_id: userId,
        trends_data: trendsData,
        generated_at: now_iso,
      });
    }

    return new Response(JSON.stringify({ trends: trendsData, generated_at: now_iso, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trend-scout error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
