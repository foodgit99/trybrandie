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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Parse delivery window
    let deliveryWindow = "morning";
    try {
      const body = await req.json();
      if (body?.delivery_time) deliveryWindow = body.delivery_time;
    } catch { /* no body — use default */ }

    if (!VALID_DELIVERY_TIMES.includes(deliveryWindow)) {
      return new Response(JSON.stringify({ error: `Invalid delivery_time. Must be one of: ${VALID_DELIVERY_TIMES.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[autopilot] Running for delivery_time=${deliveryWindow}`);

    // Create durable run record
    const { data: run } = await supabase
      .from("autopilot_runs")
      .insert({ delivery_time: deliveryWindow })
      .select("id")
      .single();
    const runId = run?.id;

    // Fetch autopilot_settings where enabled = true and delivery_time matches
    const { data: allSettings, error: settingsErr } = await supabase
      .from("autopilot_settings")
      .select("brand_id, delivery_time, timezone, enabled")
      .eq("enabled", true)
      .eq("delivery_time", deliveryWindow);

    if (settingsErr) {
      console.error("[autopilot] Failed to fetch settings:", settingsErr);
      await finalizeRun(supabase, runId, 0, 0, 0, 0, [{ error: settingsErr.message }]);
      return errorResponse(500, settingsErr.message);
    }

    if (!allSettings || allSettings.length === 0) {
      console.log(`[autopilot] No enabled brands for delivery_time=${deliveryWindow}`);
      await finalizeRun(supabase, runId, 0, 0, 0, 0, []);
      return jsonResponse({ processed: 0, skipped: 0, total: 0, delivery_time: deliveryWindow });
    }

    // Build brand settings map and check time window per brand timezone
    const nowUtc = new Date();
    const eligibleBrandIds: string[] = [];
    const settingsMap = new Map<string, { delivery_time: string; timezone: string }>();

    const windowLocalHours: Record<string, number> = { morning: 8, afternoon: 13, evening: 18 };

    for (const s of allSettings) {
      const targetLocalHour = windowLocalHours[s.delivery_time] ?? 8;
      const tz = s.timezone || "Africa/Lagos";

      // Get current local hour in brand's timezone
      const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
      const localNowHour = parseInt(formatter.format(nowUtc), 10);

      const hourDiff = Math.abs(localNowHour - targetLocalHour);
      if (hourDiff <= 1) {
        eligibleBrandIds.push(s.brand_id);
        settingsMap.set(s.brand_id, { delivery_time: s.delivery_time, timezone: tz });
      }
    }

    if (eligibleBrandIds.length === 0) {
      console.log(`[autopilot] No brands within time window for ${deliveryWindow}`);
      await finalizeRun(supabase, runId, 0, 0, 0, 0, []);
      return jsonResponse({ processed: 0, skipped: 0, total: 0, delivery_time: deliveryWindow });
    }

    // For each eligible brand, compute local "today" and fetch ideas
    let allIdeas: any[] = [];
    for (const brandId of eligibleBrandIds) {
      const tz = settingsMap.get(brandId)!.timezone;
      const localToday = getLocalDate(nowUtc, tz);
      const retryFrom = getLocalDate(new Date(nowUtc.getTime() - 3 * 86400000), tz);

      const { data: ideas, error: ideasErr } = await supabase
        .from("content_ideas")
        .select("*")
        .eq("brand_id", brandId)
        .eq("autopilot", true)
        .in("status", ["suggested", "scheduled"])
        .or(
          `and(scheduled_for.eq.${localToday},autopilot_status.is.null),` +
          `and(scheduled_for.eq.${localToday},autopilot_status.eq.pending),` +
          `and(scheduled_for.gte.${retryFrom},scheduled_for.lte.${localToday},autopilot_status.in.(failed_no_credits,failed_error))`
        );

      if (ideasErr) {
        console.error(`[autopilot] Failed to fetch ideas for brand ${brandId}:`, ideasErr);
        continue;
      }
      if (ideas && ideas.length > 0) {
        allIdeas = allIdeas.concat(ideas);
      }
    }

    if (allIdeas.length === 0) {
      console.log(`[autopilot] No autopilot ideas to process.`);
      await finalizeRun(supabase, runId, 0, 0, 0, 0, []);
      return jsonResponse({ processed: 0, skipped: 0, total: 0, delivery_time: deliveryWindow });
    }

    console.log(`[autopilot] ${allIdeas.length} ideas to process`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    for (const idea of allIdeas) {
      try {
        // Duplicate-run guard: atomic lock via SQL function (bypasses PostgREST NULL filter issues)
        const { data: lockResult, error: lockErr } = await supabase
          .rpc("lock_autopilot_idea", { p_idea_id: idea.id })
          .maybeSingle();

        if (lockErr || !lockResult) {
          console.log(`[autopilot] Skipping idea ${idea.id} — already processing or completed`);
          skipped++;
          await logEvent(supabase, runId, idea.id, idea.brand_id, "skipped_locked");
          continue;
        }

        const result = await processIdea(supabase, idea, supabaseUrl, serviceRoleKey);
        const meta = { format: idea.content_format || "graphic", slide_count: idea.content_format === "carousel" ? (Number(idea.slide_count) || 5) : null };
        if (result.success) {
          processed++;
          await logEvent(supabase, runId, idea.id, idea.brand_id, "completed", undefined, meta);
        } else {
          skipped++;
          await logEvent(supabase, runId, idea.id, idea.brand_id, result.status || "failed_error", result.error, meta);
        }
      } catch (ideaErr) {
        console.error(`[autopilot] Error processing idea ${idea.id}:`, ideaErr);
        await supabase
          .from("content_ideas")
          .update({ autopilot_status: "failed_error" } as any)
          .eq("id", idea.id);
        errors++;
        errorDetails.push({ idea_id: idea.id, error: (ideaErr as Error).message });
        await logEvent(supabase, runId, idea.id, idea.brand_id, "failed_error", (ideaErr as Error).message);
      }
    }

    await finalizeRun(supabase, runId, allIdeas.length, processed, skipped, errors, errorDetails);

    console.log(`[autopilot] Done (${deliveryWindow}). Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);

    return jsonResponse({ processed, skipped, errors, total: allIdeas.length, delivery_time: deliveryWindow });
  } catch (err) {
    console.error("[autopilot] Fatal error:", err);
    return errorResponse(500, (err as Error).message);
  }
});

// ─── Helpers ──────────────────────────────────────────────

function getLocalDate(date: Date, tz: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return formatter.format(date); // returns YYYY-MM-DD
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function finalizeRun(supabase: any, runId: string | undefined, found: number, processed: number, skipped: number, errors: number, errorDetails: any[]) {
  if (!runId) return;
  await supabase
    .from("autopilot_runs")
    .update({
      ideas_found: found,
      processed,
      skipped,
      errors,
      error_details: errorDetails,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

async function logEvent(supabase: any, runId: string | undefined, ideaId: string, brandId: string, status: string, errorMessage?: string, metadata?: Record<string, any>) {
  if (!runId) return;
  await supabase
    .from("autopilot_run_events")
    .insert({ run_id: runId, idea_id: ideaId, brand_id: brandId, status, error_message: errorMessage || null, metadata: metadata || null });
}

// ─── Process a single idea ──────────────────────────────

async function processIdea(
  supabase: any,
  idea: any,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ success: boolean; status?: string; error?: string }> {
  // Load brand
  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", idea.brand_id)
    .single();

  if (!brand) {
    console.warn(`[autopilot] No brand found for idea ${idea.id}`);
    await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
    return { success: false, status: "failed_error", error: "brand_not_found" };
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
    return { success: false, status: "failed_error", error: "profile_not_found" };
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

  const isCarousel = idea.content_format === "carousel";
  const slideCount = isCarousel ? Math.min(10, Math.max(2, Number(idea.slide_count) || 5)) : 0;
  console.log(`[autopilot] idea ${idea.id} format=${isCarousel ? "carousel" : "graphic"}${isCarousel ? ` slides=${slideCount}` : ""}`);

  // Build design payload
  const designPayload: Record<string, any> = {
    user_id: idea.user_id,
    action: isCarousel ? "generate_carousel" : "generate",
    canvas_size: "1080x1080",
    ...(isCarousel && { slide_count: slideCount }),
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
      await supabase.from("content_ideas").update({ autopilot_status: "failed_no_credits" } as any).eq("id", idea.id);
      if (userEmail) {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ type: "autopilot_no_credits", to: userEmail, data: { idea_title: idea.title } }),
        }).catch(() => {});
      }
      return { success: false, status: "failed_no_credits", error: errBody };
    }

    await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
    return { success: false, status: "failed_error", error: errBody };
  }

  const designData = await designRes.json();

  let coverImageUrl: string | undefined;
  let coverDesignId: string | undefined;

  if (isCarousel) {
    const slides = Array.isArray(designData?.slides) ? designData.slides : [];
    if (slides.length === 0) {
      console.error(`[autopilot] No slides returned for carousel idea ${idea.id}`);
      await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
      return { success: false, status: "failed_error", error: "no_slides" };
    }
    const sorted = [...slides].sort((a: any, b: any) => (a.slide_index ?? 0) - (b.slide_index ?? 0));
    const cover = sorted[0];
    coverImageUrl = cover?.image_url;
    coverDesignId = cover?.design_id;

    if (!coverDesignId) {
      console.error(`[autopilot] Carousel cover missing design_id for idea ${idea.id}`);
      await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
      return { success: false, status: "failed_error", error: "no_cover_design_id" };
    }

    // Defense-in-depth: ensure caption is persisted on cover slide for the post page.
    if (designData?.caption) {
      try {
        await supabase
          .from("designs")
          .update({ caption: designData.caption })
          .eq("id", coverDesignId);
      } catch (e) {
        console.error(`[autopilot] Failed to persist caption on cover ${coverDesignId}:`, e);
      }
    }
  } else {
    if (!designData?.image_url) {
      console.error(`[autopilot] No image_url returned for idea ${idea.id}`);
      await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
      return { success: false, status: "failed_error", error: "no_image_url" };
    }

    // Save design (single graphic only — carousels are saved by design-studio per slide).
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
      return { success: false, status: "failed_error", error: saveErr.message };
    }

    coverImageUrl = designData.image_url;
    coverDesignId = savedDesign.id;
  }

  // Update content_ideas
  await supabase
    .from("content_ideas")
    .update({ design_id: coverDesignId, status: "created", autopilot_status: "completed" } as any)
    .eq("id", idea.id);

  // Send email notification
  if (userEmail && coverImageUrl) {
    const emailTitle = isCarousel ? `${idea.title} (carousel, ${slideCount} slides)` : idea.title;
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        type: "autopilot_design_ready",
        to: userEmail,
        data: { idea_title: emailTitle, image_url: coverImageUrl, design_id: coverDesignId },
      }),
    }).catch((e) => console.error(`[autopilot] Email failed for idea ${idea.id}:`, e));
  }

  console.log(`[autopilot] ✅ Processed idea ${idea.id} → design ${coverDesignId}${isCarousel ? ` (carousel ${designData.carousel_id})` : ""}`);
  return { success: true };
}
