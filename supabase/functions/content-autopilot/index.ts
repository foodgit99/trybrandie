import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_DELIVERY_TIMES = ["morning", "afternoon", "evening"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse and validate delivery window
    let deliveryWindow = "morning";
    try {
      const body = await req.json();
      if (body?.delivery_time) deliveryWindow = body.delivery_time;
    } catch { /* no body or invalid JSON — use default */ }

    if (!VALID_DELIVERY_TIMES.includes(deliveryWindow)) {
      console.error(`[autopilot] Invalid delivery_time: ${deliveryWindow}`);
      return new Response(JSON.stringify({ error: `Invalid delivery_time. Must be one of: ${VALID_DELIVERY_TIMES.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[autopilot] Running for delivery_time=${deliveryWindow}`);

    const today = new Date().toISOString().split("T")[0];
    // Retry window: also pick up failed ideas from the last 3 days
    const retryDate = new Date();
    retryDate.setDate(retryDate.getDate() - 3);
    const retryFrom = retryDate.toISOString().split("T")[0];

    console.log(`[autopilot] Date: ${today}, retry window from: ${retryFrom}`);

    // Fetch today's autopilot ideas + failed ideas within retry window
    // Exclude ideas already processing or completed
    const { data: ideas, error: ideasErr } = await supabase
      .from("content_ideas")
      .select("*")
      .eq("autopilot", true)
      .in("status", ["suggested", "scheduled"])
      .or(
        `and(scheduled_for.eq.${today},autopilot_status.is.null),` +
        `and(scheduled_for.eq.${today},autopilot_status.eq.pending),` +
        `and(scheduled_for.gte.${retryFrom},scheduled_for.lte.${today},autopilot_status.in.(failed_no_credits,failed_error))`
      );

    if (ideasErr) {
      console.error("[autopilot] Failed to fetch ideas:", ideasErr);
      return new Response(JSON.stringify({ error: ideasErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ideas || ideas.length === 0) {
      console.log("[autopilot] No autopilot ideas to process.");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch autopilot_settings for delivery_time filtering
    const brandIds = [...new Set(ideas.map((i: any) => i.brand_id))];
    const { data: allSettings } = await supabase
      .from("autopilot_settings")
      .select("brand_id, delivery_time, timezone")
      .in("brand_id", brandIds);

    const windowUtcHours: Record<string, number> = { morning: 6, afternoon: 12, evening: 18 };

    const settingsMap = new Map<string, { delivery_time: string; timezone: string }>();
    for (const s of allSettings || []) {
      settingsMap.set(s.brand_id, {
        delivery_time: s.delivery_time || "morning",
        timezone: s.timezone || "Africa/Lagos",
      });
    }

    const nowUtc = new Date();
    const currentUtcHour = nowUtc.getUTCHours();

    const filteredIdeas = ideas.filter((idea: any) => {
      const settings = settingsMap.get(idea.brand_id) || { delivery_time: "morning", timezone: "Africa/Lagos" };
      if (settings.delivery_time !== deliveryWindow) return false;

      const localHour = windowUtcHours[settings.delivery_time] ?? 6;
      const formatter = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, hour: "numeric", hour12: false });
      const localNowHour = parseInt(formatter.format(nowUtc), 10);
      const offsetHours = localNowHour - currentUtcHour;
      const targetUtcHour = ((localHour - offsetHours) % 24 + 24) % 24;

      const diff = Math.abs(currentUtcHour - targetUtcHour);
      const hourDiff = Math.min(diff, 24 - diff);
      return hourDiff <= 1;
    });

    if (filteredIdeas.length === 0) {
      console.log(`[autopilot] No ideas for delivery_time=${deliveryWindow}`);
      return new Response(JSON.stringify({ processed: 0, delivery_time: deliveryWindow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[autopilot] ${filteredIdeas.length} ideas to process`);

    let processed = 0;
    let skipped = 0;

    for (const idea of filteredIdeas) {
      try {
        // Duplicate-run guard: mark as processing atomically
        const { data: lockResult, error: lockErr } = await supabase
          .from("content_ideas")
          .update({ autopilot_status: "processing" } as any)
          .eq("id", idea.id)
          .or("autopilot_status.is.null,and(autopilot_status.neq.processing,autopilot_status.neq.completed)")
          .select("id")
          .maybeSingle();

        if (lockErr || !lockResult) {
          console.log(`[autopilot] Skipping idea ${idea.id} — already processing or completed`);
          skipped++;
          continue;
        }

        const result = await processIdea(supabase, idea, supabaseUrl, serviceRoleKey, settingsMap);
        if (result.success) {
          processed++;
        } else {
          skipped++;
        }
      } catch (ideaErr) {
        console.error(`[autopilot] Error processing idea ${idea.id}:`, ideaErr);
        await supabase
          .from("content_ideas")
          .update({ autopilot_status: "failed_error" } as any)
          .eq("id", idea.id);
        skipped++;
      }
    }

    console.log(`[autopilot] Done (${deliveryWindow}). Processed: ${processed}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({ processed, skipped, total: filteredIdeas.length, delivery_time: deliveryWindow }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[autopilot] Fatal error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processIdea(
  supabase: any,
  idea: any,
  supabaseUrl: string,
  serviceRoleKey: string,
  settingsMap: Map<string, any>,
): Promise<{ success: boolean }> {
  // Load brand
  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", idea.brand_id)
    .single();

  if (!brand) {
    console.warn(`[autopilot] No brand found for idea ${idea.id}`);
    await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
    return { success: false };
  }

  // Load user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", idea.user_id)
    .single();

  if (!profile) {
    console.warn(`[autopilot] No profile for user ${idea.user_id}`);
    await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
    return { success: false };
  }

  // Get user email
  const { data: authUser } = await supabase.auth.admin.getUserById(idea.user_id);
  const userEmail = authUser?.user?.email;

  // Load audience (optional)
  const { data: audience } = await supabase
    .from("target_audiences")
    .select("jtbd_profile, label")
    .eq("brand_id", idea.brand_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Load trend preferences (optional)
  const { data: trendPref } = await supabase
    .from("brand_trend_preferences")
    .select("selected_trend, default_trend_intensity, trend_enabled")
    .eq("brand_id", idea.brand_id)
    .maybeSingle();

  // Build design payload
  const designPayload: Record<string, any> = {
    user_id: idea.user_id,
    action: "generate",
    canvas_size: "1080x1080",
    render_quality: "fast",
    messages: [{ role: "user", content: idea.prompt }],
    brand: {
      id: brand.id,
      name: brand.name,
      tagline: brand.tagline,
      description: brand.description,
      vibe: brand.vibe,
      tone_of_voice: brand.tone_of_voice,
      personality_traits: brand.personality_traits,
      primary_colors: brand.primary_colors,
      secondary_colors: brand.secondary_colors,
      accent_colors: brand.accent_colors,
      typography_primary: brand.typography_primary,
      typography_secondary: brand.typography_secondary,
      typography_display: brand.typography_display,
      logo_url: brand.logo_url,
      special_instructions: brand.special_instructions,
    },
  };

  if (audience?.jtbd_profile) {
    designPayload.audience_id = audience.label || "primary";
  }

  if (trendPref?.trend_enabled && trendPref.selected_trend && trendPref.selected_trend !== "none") {
    designPayload.trend = trendPref.selected_trend;
    designPayload.trend_intensity = trendPref.default_trend_intensity || 40;
  }

  // Call design-studio
  const designRes = await fetch(`${supabaseUrl}/functions/v1/design-studio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(designPayload),
  });

  if (!designRes.ok) {
    const errBody = await designRes.text();
    console.error(`[autopilot] design-studio failed for idea ${idea.id}: ${designRes.status} ${errBody}`);

    if (designRes.status === 402) {
      // No credits — mark appropriately
      await supabase.from("content_ideas").update({ autopilot_status: "failed_no_credits" } as any).eq("id", idea.id);

      if (userEmail) {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "autopilot_no_credits",
            to: userEmail,
            data: { idea_title: idea.title },
          }),
        }).catch(() => {});
      }
    } else {
      await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
    }
    return { success: false };
  }

  const designData = await designRes.json();

  if (!designData?.image_url) {
    console.error(`[autopilot] No image_url returned for idea ${idea.id}`);
    await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
    return { success: false };
  }

  // Save design
  const { data: savedDesign, error: saveErr } = await supabase
    .from("designs")
    .insert({
      user_id: idea.user_id,
      brand_id: idea.brand_id,
      title: idea.title.slice(0, 100),
      prompt: designData.design_prompt || idea.prompt,
      image_url: designData.image_url,
      canvas_size: "1080x1080",
      vote: 0,
      ...(designData.genome && { genome: designData.genome }),
      ...(designData.caption && { caption: designData.caption }),
      ...(designData.copy_structure && { copy_structure: designData.copy_structure }),
      ...(trendPref?.trend_enabled && trendPref.selected_trend !== "none" && {
        trend_used: trendPref.selected_trend,
        trend_intensity: trendPref.default_trend_intensity,
      }),
    })
    .select("id")
    .single();

  if (saveErr) {
    console.error(`[autopilot] Failed to save design for idea ${idea.id}:`, saveErr);
    await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
    return { success: false };
  }

  // Update content_ideas with design_id, status, and autopilot_status
  await supabase
    .from("content_ideas")
    .update({
      design_id: savedDesign.id,
      status: "created",
      autopilot_status: "completed",
    } as any)
    .eq("id", idea.id);

  // Send email notification
  if (userEmail) {
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        type: "autopilot_design_ready",
        to: userEmail,
        data: {
          idea_title: idea.title,
          image_url: designData.image_url,
          design_id: savedDesign.id,
        },
      }),
    }).catch((e) => console.error(`[autopilot] Email failed for idea ${idea.id}:`, e));
  }

  console.log(`[autopilot] ✅ Processed idea ${idea.id} → design ${savedDesign.id}`);
  return { success: true };
}
