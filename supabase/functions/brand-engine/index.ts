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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error in brand-engine:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const { action, brand_id, pillar_ids, series_ids } = await req.json();

    if (!brand_id) {
      return new Response(JSON.stringify({ error: "brand_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabase.from("brands").select("*").eq("id", brand_id).single();
    if (brandErr || !brand) {
      return new Response(JSON.stringify({ error: "Brand not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Gather context
    const [audienceRes, designsRes, trendRes] = await Promise.all([
      supabase.from("target_audiences").select("jtbd_profile, label").eq("brand_id", brand_id).limit(3),
      supabase.from("designs").select("title, prompt, trend_used").eq("brand_id", brand_id).order("created_at", { ascending: false }).limit(10),
      supabase.from("brand_trend_preferences").select("*").eq("brand_id", brand_id).maybeSingle(),
    ]);

    const audiences = audienceRes.data || [];
    const pastDesigns = designsRes.data || [];
    const trendPrefs = trendRes.data;

    const brandContext = `
Brand: ${brand.name}
Tagline: ${brand.tagline || "N/A"}
Description: ${brand.description || "N/A"}
Tone: ${brand.tone_of_voice || "N/A"}
Personality: ${(brand.personality_traits || []).join(", ") || "N/A"}
Vibe: ${brand.vibe || "N/A"}
Special Instructions: ${brand.special_instructions || "N/A"}
`.trim();

    const audienceContext = audiences.length > 0
      ? audiences.map((a: any) => `Audience "${a.label}": ${JSON.stringify(a.jtbd_profile)}`).join("\n")
      : "No audience data available.";

    const pastDesignContext = pastDesigns.length > 0
      ? pastDesigns.map((d: any) => `- ${d.title || d.prompt}${d.trend_used ? ` (trend: ${d.trend_used})` : ""}`).join("\n")
      : "No past designs yet.";

    const trendContext = trendPrefs?.trend_enabled
      ? `Active trend: ${trendPrefs.selected_trend}, Preferred: ${(trendPrefs.preferred_trends || []).join(", ")}`
      : "No trend preferences set.";

    const fullContext = `${brandContext}\n\nAUDIENCE INTELLIGENCE:\n${audienceContext}\n\nPAST DESIGNS:\n${pastDesignContext}\n\nTREND PREFERENCES:\n${trendContext}`;

    // --- ACTION HANDLERS ---

    if (action === "generate_pillars") {
      const result = await callAI(lovableKey, {
        system: `You are a brand content strategist. Given a brand's identity, audience, and past content, generate exactly 5 content pillars — recurring content themes that will build the brand's presence on social media. Each pillar should have a name, description, and emoji icon. Be specific to this brand, not generic.`,
        user: `Generate 5 content pillars for this brand:\n\n${fullContext}`,
        tool: {
          name: "create_pillars",
          description: "Create 5 content pillars for the brand",
          parameters: {
            type: "object",
            properties: {
              pillars: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    icon_emoji: { type: "string" },
                  },
                  required: ["name", "description", "icon_emoji"],
                  additionalProperties: false,
                },
              },
            },
            required: ["pillars"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      // Delete existing pillars for this brand, then insert new
      await serviceClient.from("content_pillars").delete().eq("brand_id", brand_id).eq("user_id", userId);
      const pillarsToInsert = result.data.pillars.map((p: any, i: number) => ({
        brand_id,
        user_id: userId,
        name: p.name,
        description: p.description,
        icon_emoji: p.icon_emoji,
        sort_order: i,
      }));
      const { data: inserted, error: insertErr } = await serviceClient.from("content_pillars").insert(pillarsToInsert).select();
      if (insertErr) throw new Error(`Insert pillars failed: ${insertErr.message}`);

      return jsonResponse({ pillars: inserted });
    }

    if (action === "generate_series") {
      // Fetch pillars
      const { data: pillars } = await supabase.from("content_pillars").select("*").eq("brand_id", brand_id).order("sort_order");
      const pillarContext = (pillars || []).map((p: any) => `${p.icon_emoji} ${p.name}: ${p.description}`).join("\n");

      const result = await callAI(lovableKey, {
        system: `You are a social media content strategist. Given a brand and its content pillars, generate 3-4 recurring post series. Each series is a repeating content format (e.g. "Tip Tuesday", "Customer Spotlight Sunday"). Assign each to a day of the week and a pillar. Be creative and specific to this brand.`,
        user: `Generate recurring post series for this brand:\n\n${fullContext}\n\nCONTENT PILLARS:\n${pillarContext}`,
        tool: {
          name: "create_series",
          description: "Create recurring post series",
          parameters: {
            type: "object",
            properties: {
              series: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    recurrence: { type: "string", enum: ["weekly", "biweekly", "monthly"] },
                    preferred_day: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
                    pillar_name: { type: "string" },
                    visual_style_notes: { type: "string" },
                  },
                  required: ["name", "description", "recurrence", "preferred_day", "pillar_name", "visual_style_notes"],
                  additionalProperties: false,
                },
              },
            },
            required: ["series"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      await serviceClient.from("post_series").delete().eq("brand_id", brand_id).eq("user_id", userId);
      const pillarMap = new Map((pillars || []).map((p: any) => [p.name.toLowerCase(), p.id]));
      const seriesToInsert = result.data.series.map((s: any) => ({
        brand_id,
        user_id: userId,
        pillar_id: pillarMap.get(s.pillar_name.toLowerCase()) || null,
        name: s.name,
        description: s.description,
        recurrence: s.recurrence,
        preferred_day: s.preferred_day,
        visual_style_notes: s.visual_style_notes,
      }));
      const { data: inserted, error: insertErr } = await serviceClient.from("post_series").insert(seriesToInsert).select();
      if (insertErr) throw new Error(`Insert series failed: ${insertErr.message}`);

      return jsonResponse({ series: inserted });
    }

    if (action === "generate_campaigns") {
      const result = await callAI(lovableKey, {
        system: `You are a brand campaign strategist. Generate 2-3 campaign ideas for this brand. Each campaign should have a catchy name, description, and a post count (3-7 posts per campaign). Be specific and seasonal/topical.`,
        user: `Generate campaign ideas:\n\n${fullContext}`,
        tool: {
          name: "create_campaigns",
          description: "Create campaign ideas",
          parameters: {
            type: "object",
            properties: {
              campaigns: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    post_count: { type: "number" },
                  },
                  required: ["name", "description", "post_count"],
                  additionalProperties: false,
                },
              },
            },
            required: ["campaigns"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      await serviceClient.from("campaigns").delete().eq("brand_id", brand_id).eq("user_id", userId);
      const campaignsToInsert = result.data.campaigns.map((c: any) => ({
        brand_id,
        user_id: userId,
        name: c.name,
        description: c.description,
        post_count: c.post_count,
      }));
      const { data: inserted, error: insertErr } = await serviceClient.from("campaigns").insert(campaignsToInsert).select();
      if (insertErr) throw new Error(`Insert campaigns failed: ${insertErr.message}`);

      return jsonResponse({ campaigns: inserted });
    }

    if (action === "generate_weekly_ideas") {
      const [pillarsRes, seriesRes, campaignsRes] = await Promise.all([
        supabase.from("content_pillars").select("*").eq("brand_id", brand_id).order("sort_order"),
        supabase.from("post_series").select("*").eq("brand_id", brand_id),
        supabase.from("campaigns").select("*").eq("brand_id", brand_id),
      ]);

      const pillars = pillarsRes.data || [];
      const series = seriesRes.data || [];
      const campaigns = campaignsRes.data || [];

      const pillarContext = pillars.map((p: any) => `${p.icon_emoji} ${p.name}: ${p.description}`).join("\n");
      const seriesContext = series.map((s: any) => `${s.name} (${s.recurrence}, ${s.preferred_day}): ${s.description}`).join("\n");
      const campaignContext = campaigns.map((c: any) => `${c.name}: ${c.description} (${c.post_count} posts)`).join("\n");

      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sun
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
      const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const weekDates = days.map((d, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return { day: d, date: date.toISOString().split("T")[0] };
      });

      const result = await callAI(lovableKey, {
        system: `You are a social media content planner. Generate 5-7 post ideas for this week. Each idea should have a title, a ready-to-use design prompt (that can be sent directly to an AI design studio), and be assigned to a specific day. Use the brand's content pillars, series, and campaigns to inform the ideas. The prompts should be specific, mentioning the brand name and what the graphic should show.`,
        user: `Generate this week's content ideas:\n\n${fullContext}\n\nPILLARS:\n${pillarContext}\n\nSERIES:\n${seriesContext}\n\nCAMPAIGNS:\n${campaignContext}\n\nWEEK DATES: ${weekDates.map(d => `${d.day}: ${d.date}`).join(", ")}`,
        tool: {
          name: "create_weekly_ideas",
          description: "Create post ideas for the week",
          parameters: {
            type: "object",
            properties: {
              ideas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    prompt: { type: "string" },
                    day: { type: "string", enum: days },
                    pillar_name: { type: "string" },
                    series_name: { type: "string" },
                    idea_type: { type: "string", enum: ["single", "series_post", "campaign_post"] },
                  },
                  required: ["title", "prompt", "day", "pillar_name", "idea_type"],
                  additionalProperties: false,
                },
              },
            },
            required: ["ideas"],
            additionalProperties: false,
          },
        },
      });

      if (result.error) return errorResponse(result);

      // Delete existing suggested ideas for this week
      const weekStart = weekDates[0].date;
      const weekEnd = weekDates[6].date;
      await serviceClient.from("content_ideas").delete()
        .eq("brand_id", brand_id)
        .eq("user_id", userId)
        .eq("status", "suggested")
        .gte("scheduled_for", weekStart)
        .lte("scheduled_for", weekEnd);

      const pillarMap = new Map(pillars.map((p: any) => [p.name.toLowerCase(), p.id]));
      const seriesMap = new Map(series.map((s: any) => [s.name.toLowerCase(), s.id]));
      const dateMap = new Map(weekDates.map((d) => [d.day, d.date]));

      const ideasToInsert = result.data.ideas.map((idea: any) => ({
        brand_id,
        user_id: userId,
        pillar_id: pillarMap.get((idea.pillar_name || "").toLowerCase()) || null,
        series_id: idea.series_name ? seriesMap.get(idea.series_name.toLowerCase()) || null : null,
        campaign_id: null,
        title: idea.title,
        prompt: idea.prompt,
        idea_type: idea.idea_type,
        status: "suggested",
        scheduled_for: dateMap.get(idea.day) || null,
      }));

      const { data: inserted, error: insertErr } = await serviceClient.from("content_ideas").insert(ideasToInsert).select();
      if (insertErr) throw new Error(`Insert ideas failed: ${insertErr.message}`);

      return jsonResponse({ ideas: inserted });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("brand-engine error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- HELPERS ---

async function callAI(apiKey: string, opts: { system: string; user: string; tool: any }): Promise<{ data?: any; error?: string; status?: number }> {
  const response = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      tools: [{ type: "function", function: opts.tool }],
      tool_choice: { type: "function", function: { name: opts.tool.name } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) return { error: "Rate limit exceeded. Please try again in a moment.", status: 429 };
    if (response.status === 402) return { error: "AI credits exhausted. Please top up.", status: 402 };
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    return { error: "AI generation failed", status: 500 };
  }

  const json = await response.json();
  const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    // Fallback: try to parse content as JSON
    const content = json.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return { data: parsed };
      } catch {
        return { error: "AI did not return structured output" };
      }
    }
    return { error: "AI did not return structured output" };
  }

  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    return { data: parsed };
  } catch {
    return { error: "Failed to parse AI output" };
  }
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(result: { error?: string; status?: number }) {
  return new Response(JSON.stringify({ error: result.error }), {
    status: result.status || 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
