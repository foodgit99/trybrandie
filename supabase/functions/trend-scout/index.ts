import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - ((day + 6) % 7);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return jsonResp({ error: "AI service not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    const { brand_id, force_refresh, check_only } = await req.json();
    if (!brand_id) {
      return jsonResp({ error: "brand_id is required" }, 400);
    }

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabase.from("brands").select("*").eq("id", brand_id).single();
    if (brandErr || !brand) {
      return jsonResp({ error: "Brand not found" }, 404);
    }

    // --- Credit check logic ---
    const { data: profile, error: profileErr } = await serviceClient
      .from("profiles")
      .select("trend_intel_gen_count, trend_intel_gen_reset_at, bonus_credits, paid_credits, generations_count, generations_reset_at")
      .eq("user_id", userId)
      .single();

    if (profileErr || !profile) {
      return jsonResp({ error: "Profile not found" }, 404);
    }

    const now = new Date();
    const weekStart = getISOWeekStart(now);
    const resetAt = new Date(profile.trend_intel_gen_reset_at);
    let genCount = profile.trend_intel_gen_count || 0;

    // Reset counter if we're in a new week
    if (resetAt < weekStart) {
      genCount = 0;
    }

    const isFree = genCount === 0;
    const creditsRequired = isFree ? 0 : 2;

    // Query active reward credits
    const { data: rewardRows } = await serviceClient
      .from("credit_rewards")
      .select("id, remaining")
      .eq("user_id", userId)
      .gt("remaining", 0)
      .gt("expires_at", now.toISOString())
      .order("expires_at", { ascending: true });
    const rewardCredits = (rewardRows || []).reduce((s: number, r: any) => s + r.remaining, 0);

    const availableCredits = (profile.bonus_credits || 0) + rewardCredits + (profile.paid_credits || 0);

    // check_only mode — just return cost info
    if (check_only) {
      return jsonResp({ is_free: isFree, credits_required: creditsRequired, available_credits: availableCredits });
    }

    // If not free, check & deduct credits
    if (!isFree) {
      if (availableCredits < 2) {
        return jsonResp({ error: "Not enough credits. You need 2 credits for an additional trend refresh this week." }, 402);
      }

      // Deduct 2 credits: bonus → reward → paid
      let toDeduct = 2;
      let bonusDeduct = Math.min(toDeduct, profile.bonus_credits || 0);
      toDeduct -= bonusDeduct;

      // Consume reward credits
      if (toDeduct > 0 && rewardRows && rewardRows.length > 0) {
        for (const rw of rewardRows) {
          if (toDeduct <= 0) break;
          const toUse = Math.min(toDeduct, rw.remaining);
          await serviceClient.from("credit_rewards").update({ remaining: rw.remaining - toUse }).eq("id", rw.id);
          toDeduct -= toUse;
        }
      }

      let paidDeduct = toDeduct;

      await serviceClient
        .from("profiles")
        .update({
          bonus_credits: (profile.bonus_credits || 0) - bonusDeduct,
          paid_credits: (profile.paid_credits || 0) - paidDeduct,
        })
        .eq("user_id", userId);
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
          return jsonResp({ trends: cached.trends_data, generated_at: cached.generated_at, cached: true });
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
        return jsonResp({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
      }
      if (response.status === 402) {
        return jsonResp({ error: "AI service temporarily unavailable." }, 503);
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return jsonResp({ error: "Trend research failed" }, 500);
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
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          trendsData = parsed.trends || [];
        } catch { /* ignore */ }
      }
    }

    if (trendsData.length === 0) {
      return jsonResp({ error: "Could not generate trend insights. Please try again." }, 500);
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

    // Increment trend intel gen count
    await serviceClient
      .from("profiles")
      .update({
        trend_intel_gen_count: genCount + 1,
        trend_intel_gen_reset_at: now.toISOString(),
      })
      .eq("user_id", userId);

    return jsonResp({ trends: trendsData, generated_at: now_iso, cached: false });
  } catch (e) {
    console.error("trend-scout error:", e);
    return jsonResp({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
