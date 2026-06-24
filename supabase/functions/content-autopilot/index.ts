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
    // Parse body — supports delivery_time sweep AND single-brand force path
    let deliveryWindow = "morning";
    let forceBrandId: string | null = null;
    let force = false;
    let reconcileOnly = false;
    try {
      const body = await req.json();
      if (body?.delivery_time) deliveryWindow = body.delivery_time;
      if (body?.brand_id) forceBrandId = String(body.brand_id);
      if (body?.force) force = !!body.force;
      if (body?.reconcile_only) reconcileOnly = !!body.reconcile_only;
    } catch { /* no body — use default */ }

    // Create durable run record up-front so reconcile + processing events share one run.
    const { data: run } = await supabase
      .from("autopilot_runs")
      .insert({ delivery_time: deliveryWindow })
      .select("id")
      .single();

    // ── Reconciliation pass ──
    // Any idea stuck in autopilot_status='processing' for >1h almost always means
    // the upstream design-studio call finished writing slides but content-autopilot
    // was interrupted before updating the idea. Recover by inspecting designs and
    // either finalising (completed) or marking failed_error so retry can pick it up.
    try {

      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: stuck } = await supabase
        .from("content_ideas")
        .select("id, brand_id, content_format")
        .eq("autopilot_status", "processing")
        .lt("created_at", cutoff);

      const stuckRows = (stuck || []) as any[];
      if (stuckRows.length > 0) console.log(`[autopilot:reconcile] inspecting ${stuckRows.length} stuck idea(s)`);
      for (const row of stuckRows) {
        const { data: linked } = await supabase
          .from("designs")
          .select("id, carousel_id, slide_index, created_at")
          .eq("content_idea_id", row.id)
          .order("slide_index", { ascending: true, nullsFirst: false });
        const designs = (linked || []) as any[];
        if (designs.length === 0) {
          await supabase
            .from("content_ideas")
            .update({ autopilot_status: "failed_error" } as any)
            .eq("id", row.id);
          await logEvent(supabase, run?.id, row.id, row.brand_id, "reconcile_failed", "no_linked_designs", {
            action: "update",
            table: "content_ideas",
            changes: { autopilot_status: "failed_error" },
          });
          continue;
        }
        const cover = designs.find((d) => d.slide_index === 0) || designs[0];
        await supabase
          .from("content_ideas")
          .update({
            design_id: cover.id,
            status: "created",
            autopilot_status: "completed",
          } as any)
          .eq("id", row.id);
        await logEvent(supabase, run?.id, row.id, row.brand_id, "reconcile_completed", undefined, {
          action: "update",
          table: "content_ideas",
          design_id: cover.id,
          linked_design_count: designs.length,
          changes: { design_id: cover.id, status: "created", autopilot_status: "completed" },
        });
      }
    } catch (e) {
      console.error("[autopilot:reconcile] failed", e);
    }


    if (reconcileOnly) {
      return jsonResponse({ reconciled: true });
    }


    if (!VALID_DELIVERY_TIMES.includes(deliveryWindow)) {
      return new Response(JSON.stringify({ error: `Invalid delivery_time. Must be one of: ${VALID_DELIVERY_TIMES.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[autopilot] Running for delivery_time=${deliveryWindow}${forceBrandId ? ` brand=${forceBrandId} force=${force}` : ""}`);

    const runId = run?.id;


    // Fetch autopilot_settings where enabled = true and delivery_time matches.
    // When forceBrandId is supplied, scope to that brand only (bypass delivery_time match).
    let settingsQuery = supabase
      .from("autopilot_settings")
      .select("brand_id, delivery_time, timezone, enabled")
      .eq("enabled", true);
    if (forceBrandId) {
      settingsQuery = settingsQuery.eq("brand_id", forceBrandId);
    } else {
      settingsQuery = settingsQuery.eq("delivery_time", deliveryWindow);
    }
    const { data: allSettings, error: settingsErr } = await settingsQuery;

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

    // Build brand settings map and check time window per brand timezone.
    // When force=true, skip the hour-window check entirely.
    const nowUtc = new Date();
    const eligibleBrandIds: string[] = [];
    const settingsMap = new Map<string, { delivery_time: string; timezone: string }>();

    const windowLocalHours: Record<string, number> = { morning: 8, afternoon: 13, evening: 18 };

    for (const s of allSettings) {
      const targetLocalHour = windowLocalHours[s.delivery_time] ?? 8;
      const tz = s.timezone || "Africa/Lagos";

      if (force) {
        eligibleBrandIds.push(s.brand_id);
        settingsMap.set(s.brand_id, { delivery_time: s.delivery_time, timezone: tz });
        continue;
      }

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

      // Ideas must originate from a Blueprint AND be approved — either the
      // whole weekly_blueprints row is approved (mode='autonomous' auto-approves;
      // user can also approve all) OR the user approved this specific idea card
      // on /v2/Blueprint (content_ideas.approval_status='approved').
      const baseFilter = (q: any) =>
        q.eq("brand_id", brandId)
          .eq("autopilot", true)
          .not("blueprint_id", "is", null)
          .in("status", ["suggested", "scheduled"])
          .or(
            `and(scheduled_for.eq.${localToday},autopilot_status.is.null),` +
            `and(scheduled_for.eq.${localToday},autopilot_status.eq.pending),` +
            `and(scheduled_for.gte.${retryFrom},scheduled_for.lte.${localToday},autopilot_status.in.(failed_no_credits,failed_error)),` +
            `and(scheduled_for.gte.${retryFrom},scheduled_for.lt.${localToday},autopilot_status.is.null),` +
            `and(scheduled_for.gte.${retryFrom},scheduled_for.lt.${localToday},autopilot_status.eq.pending)`
          );

      const [{ data: blueprintApproved, error: bErr }, { data: ideaApproved, error: iErr }] = await Promise.all([
        baseFilter(
          supabase
            .from("content_ideas")
            .select("*, weekly_blueprints!inner(id, status)")
            .eq("weekly_blueprints.status", "approved"),
        ),
        baseFilter(
          supabase
            .from("content_ideas")
            .select("*, weekly_blueprints(id, status)")
            .eq("approval_status", "approved"),
        ),
      ]);

      if (bErr || iErr) {
        console.error(`[autopilot] Failed to fetch ideas for brand ${brandId}:`, bErr || iErr);
        continue;
      }

      const merged = new Map<string, any>();
      for (const row of [...(blueprintApproved || []), ...(ideaApproved || [])]) {
        merged.set(row.id, row);
      }
      if (merged.size > 0) {
        allIdeas = allIdeas.concat(Array.from(merged.values()));
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

    const handleIdea = async (idea: any) => {
      const baseMeta = {
        scheduled_for: idea.scheduled_for,
        blueprint_week: blueprintWeekOf(idea.scheduled_for),
        blueprint_id: idea.blueprint_id ?? null,
        blueprint_status: idea.weekly_blueprints?.status ?? null,
        idea_title: idea.title,
        format: idea.content_format || "graphic",
        slide_count: idea.content_format === "carousel" ? (Number(idea.slide_count) || 5) : null,
      };

      try {
        await logEvent(supabase, runId, idea.id, idea.brand_id, "picked_up", undefined, baseMeta);

        const { data: lockResult, error: lockErr } = await supabase
          .rpc("lock_autopilot_idea", { p_idea_id: idea.id })
          .maybeSingle();

        if (lockErr || !lockResult) {
          console.log(`[autopilot] Skipping idea ${idea.id} — already processing or completed`);
          skipped++;
          await logEvent(supabase, runId, idea.id, idea.brand_id, "skipped_locked", lockErr?.message, baseMeta);
          return;
        }

        await logEvent(supabase, runId, idea.id, idea.brand_id, "lock_acquired", undefined, {
          ...baseMeta,
          action: "update",
          table: "content_ideas",
          changes: { autopilot_status: "processing" },
        });

        const result = await processIdea(supabase, idea, supabaseUrl, serviceRoleKey, runId, baseMeta);
        if (result.success) {
          processed++;
          await logEvent(supabase, runId, idea.id, idea.brand_id, "completed", undefined, {
            ...baseMeta,
            design_id: result.design_id,
            carousel_id: result.carousel_id,
          });
        } else {
          skipped++;
          await logEvent(supabase, runId, idea.id, idea.brand_id, result.status || "failed_error", result.error, baseMeta);
        }
      } catch (ideaErr) {
        console.error(`[autopilot] Error processing idea ${idea.id}:`, ideaErr);
        await supabase
          .from("content_ideas")
          .update({ autopilot_status: "failed_error" } as any)
          .eq("id", idea.id);
        errors++;
        errorDetails.push({ idea_id: idea.id, error: (ideaErr as Error).message });
        await logEvent(supabase, runId, idea.id, idea.brand_id, "failed_error", (ideaErr as Error).message, baseMeta);
      }
    };

    // Bounded concurrency so one slow idea doesn't starve the whole window.
    // design-studio takes 60-90s per idea; running 3 in parallel keeps us well
    // under the Edge Function wall-clock while clearing the queue ~3x faster.
    const CONCURRENCY = 3;
    try {
      for (let i = 0; i < allIdeas.length; i += CONCURRENCY) {
        const batch = allIdeas.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map(handleIdea));
      }
    } finally {
      await finalizeRun(supabase, runId, allIdeas.length, processed, skipped, errors, errorDetails);
    }

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

// Compute the Monday (ISO week start) of the week containing `dateStr` (YYYY-MM-DD), return YYYY-MM-DD.
function blueprintWeekOf(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
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
  runId?: string,
  baseMeta?: Record<string, any>,
): Promise<{ success: boolean; status?: string; error?: string; design_id?: string; carousel_id?: string }> {

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

  // Load audience (optional) — select id so design-studio can join the JTBD profile.
  const { data: audience } = await supabase
    .from("target_audiences")
    .select("id, jtbd_profile, label")
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

  // Canvas size: per-idea override (planner can set portrait/square per idea),
  // else portrait 1080x1350 for single graphics (best IG feed performance),
  // else 1080x1080 for carousels.
  const canvasSize: string = (typeof (idea as any).canvas_size === "string" && (idea as any).canvas_size)
    ? (idea as any).canvas_size
    : (isCarousel ? "1080x1080" : "1080x1350");

  // Build design payload
  const designPayload: Record<string, any> = {
    user_id: idea.user_id,
    action: isCarousel ? "generate_carousel" : "generate",
    canvas_size: canvasSize,
    content_idea_id: idea.id,
    // Best-of-N: render two candidates and let the critic pick the stronger one.
    // Carousels skip this (already multi-image and cost-sensitive).
    ...(isCarousel ? {} : { candidate_count: 2 }),
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

  // Pass the actual UUID so design-studio's `.eq("id", audience_id)` resolves
  // and the JTBD profile flows into the Brief Agent. Previously a label string
  // was sent here, which silently dropped the entire audience context.
  if (audience?.id) {
    designPayload.audience_id = audience.id;
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
    // Reject partial carousels: every slide must carry a non-empty design_id.
    const incomplete = sorted.find((s: any) => !s?.design_id);
    if (incomplete) {
      console.error(`[autopilot] Carousel slide ${incomplete?.slide_index} missing design_id for idea ${idea.id}`);
      await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
      return { success: false, status: "failed_error", error: "incomplete_carousel" };
    }


    await logEvent(supabase, runId, idea.id, idea.brand_id, "designs_inserted", undefined, {
      ...(baseMeta || {}),
      action: "insert",
      table: "designs",
      carousel_id: designData?.carousel_id,
      slide_count: sorted.length,
      design_ids: sorted.map((s: any) => s.design_id).filter(Boolean),
      cover_design_id: coverDesignId,
    });

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
        canvas_size: canvasSize,
        vote: 0,
        content_idea_id: idea.id,
        ...(designData.genome && { genome: designData.genome }),
        ...(designData.caption && { caption: designData.caption }),
        ...(designData.copy_structure && { copy_structure: designData.copy_structure }),
        ...(designData.quality_score && { quality_score: designData.quality_score }),
        ...(Array.isArray(designData.quality_signals) && designData.quality_signals.length > 0 && {
          quality_signals: designData.quality_signals,
        }),
        ...(trendPref?.trend_enabled && trendPref.selected_trend !== "none" && {
          trend_used: trendPref.selected_trend,
          trend_intensity: trendPref.default_trend_intensity,
        }),

      } as any)
      .select("id")
      .single();


    if (saveErr) {
      console.error(`[autopilot] Failed to save design for idea ${idea.id}:`, saveErr);
      await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
      return { success: false, status: "failed_error", error: saveErr.message };
    }

    coverImageUrl = designData.image_url;
    coverDesignId = savedDesign.id;

    await logEvent(supabase, runId, idea.id, idea.brand_id, "design_inserted", undefined, {
      ...(baseMeta || {}),
      action: "insert",
      table: "designs",
      design_id: coverDesignId,
    });
  }

  // Update content_ideas
  await supabase
    .from("content_ideas")
    .update({ design_id: coverDesignId, status: "created", autopilot_status: "completed" } as any)
    .eq("id", idea.id);

  await logEvent(supabase, runId, idea.id, idea.brand_id, "idea_finalized", undefined, {
    ...(baseMeta || {}),
    action: "update",
    table: "content_ideas",
    changes: { design_id: coverDesignId, status: "created", autopilot_status: "completed" },
  });



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

  // Send push notification (fire-and-forget)
  fetch(`${supabaseUrl}/functions/v1/push-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
    body: JSON.stringify({
      user_id: idea.user_id,
      title: "Today's post is ready",
      body: idea.title,
      url: `/post/${idea.id}`,
      tag: `idea-${idea.id}`,
      data: { idea_id: idea.id, design_id: coverDesignId },
    }),
  }).catch((e) => console.error(`[autopilot] Push failed for idea ${idea.id}:`, e));

  console.log(`[autopilot] ✅ Processed idea ${idea.id} → design ${coverDesignId}${isCarousel ? ` (carousel ${designData.carousel_id})` : ""}`);
  return { success: true, design_id: coverDesignId, carousel_id: isCarousel ? designData.carousel_id : undefined };
}
