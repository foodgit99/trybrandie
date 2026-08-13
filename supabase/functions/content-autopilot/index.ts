import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pauseDormantBrands } from "../_shared/pause-dormant.ts";

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
        // Skip ideas whose render is still in flight — the design_jobs worker
        // (design-dispatch → design-studio → autopilot-notify) owns them.
        const { data: liveJob } = await supabase
          .from("design_jobs")
          .select("id")
          .in("status", ["queued", "running"])
          .contains("input", { content_idea_id: row.id })
          .limit(1)
          .maybeSingle();
        if (liveJob?.id) continue;

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

    // ── Backlog hygiene ──
    // The retry window is 3 days; anything older can never be delivered on time
    // and only clogs every subsequent tick. Park it as 'expired' so the queue
    // reflects deliverable work only.
    try {
      const expiryCutoff = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);
      const { data: expired } = await supabase
        .from("content_ideas")
        .update({ autopilot_status: "expired" } as any)
        .eq("autopilot", true)
        .in("status", ["suggested", "scheduled"])
        .lt("scheduled_for", expiryCutoff)
        .or("autopilot_status.is.null,autopilot_status.in.(pending,failed_error,failed_no_credits)")
        .select("id");
      if ((expired || []).length > 0) {
        console.log(`[autopilot:expire] parked ${expired!.length} undeliverable idea(s) older than ${expiryCutoff}`);
      }
    } catch (e) {
      console.error("[autopilot:expire] failed", e);
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

    // Dormancy guard: pause autopilot for brands whose owner hasn't signed in for 15+ days,
    // and email each owner so the pause is never silent.
    await pauseDormantBrands(supabase, supabaseUrl, serviceRoleKey, "[autopilot]");

    const runId = run?.id;


    // Fetch autopilot_settings where enabled = true and delivery_time matches.
    // When forceBrandId is supplied, scope to that brand only (bypass delivery_time match).
    let settingsQuery = supabase
      .from("autopilot_settings")
      .select("brand_id, delivery_time, timezone, enabled, mode")
      .eq("enabled", true)
      .neq("mode", "manual");
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
        merged.set(row.id, { ...row, __local_today: localToday });
      }
      if (merged.size > 0) {
        allIdeas = allIdeas.concat(Array.from(merged.values()));
      }


    }

    // ── Respect deactivated campaigns ──
    // Ideas routed to a paused campaign must not be generated or delivered.
    if (allIdeas.length > 0) {
      try {
        const { data: pausedCampaigns } = await supabase
          .from("campaigns")
          .select("id")
          .in("brand_id", eligibleBrandIds)
          .eq("is_active", false);
        const pausedIds = new Set(((pausedCampaigns || []) as any[]).map((c) => c.id));
        if (pausedIds.size > 0) {
          const before = allIdeas.length;
          allIdeas = allIdeas.filter((i) => !(i.campaign_id && pausedIds.has(i.campaign_id)));
          if (before !== allIdeas.length) {
            console.log(`[autopilot] skipped ${before - allIdeas.length} idea(s) in deactivated campaigns`);
          }
        }
      } catch (e) {
        console.error("[autopilot] paused-campaign filter failed", e);
      }
    }


    if (allIdeas.length === 0) {
      console.log(`[autopilot] No autopilot ideas to process.`);
      await finalizeRun(supabase, runId, 0, 0, 0, 0, []);
      return jsonResponse({ processed: 0, skipped: 0, total: 0, delivery_time: deliveryWindow });
    }

    allIdeas.sort((a, b) => {
      const aToday = a.scheduled_for === a.__local_today ? 0 : 1;
      const bToday = b.scheduled_for === b.__local_today ? 0 : 1;
      if (aToday !== bToday) return aToday - bToday;
      const byDate = String(a.scheduled_for || "").localeCompare(String(b.scheduled_for || ""));
      if (byDate !== 0) return byDate;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });

    console.log(`[autopilot] ${allIdeas.length} ideas to process`);
    await updateRunProgress(supabase, runId, { ideas_found: allIdeas.length });

    // ── Fair per-brand round-robin ──
    // Previously we took a flat slice of the globally sorted list, so one brand
    // with a large backlog starved every other brand for days. Now we interleave
    // brands: pass 1 takes each brand's most urgent idea, pass 2 the next, etc.
    const byBrand = new Map<string, any[]>();
    for (const idea of allIdeas) {
      const list = byBrand.get(idea.brand_id) || [];
      list.push(idea);
      byBrand.set(idea.brand_id, list);
    }
    const interleaved: any[] = [];
    const maxDepth = Math.max(...Array.from(byBrand.values(), (l) => l.length));
    for (let depth = 0; depth < maxDepth; depth++) {
      for (const list of byBrand.values()) {
        if (list[depth]) interleaved.push(list[depth]);
      }
    }

    // Enqueueing is cheap (a DB insert per idea), so the per-tick ceiling is now
    // about queue hygiene rather than wall-clock survival.
    const MAX_IDEAS_PER_TICK = 60;
    const totalFound = interleaved.length;
    const remaining = interleaved.slice(MAX_IDEAS_PER_TICK);
    const thisTick = interleaved.slice(0, MAX_IDEAS_PER_TICK);

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

        const result = await enqueueIdea(supabase, idea, runId, baseMeta);
        if (result.success) {
          processed++;
          await updateRunProgress(supabase, runId, { processed, skipped, errors });
          await logEvent(supabase, runId, idea.id, idea.brand_id, "queued", undefined, {
            ...baseMeta,
            action: "insert",
            table: "design_jobs",
            job_id: result.job_id,
          });
        } else {
          skipped++;
          await updateRunProgress(supabase, runId, { processed, skipped, errors });
          await logEvent(supabase, runId, idea.id, idea.brand_id, result.status || "failed_error", result.error, baseMeta);
        }
      } catch (ideaErr) {
        console.error(`[autopilot] Error queueing idea ${idea.id}:`, ideaErr);
        // Leave as 'pending' so a subsequent tick / retry sweep can pick it up
        // instead of parking it in failed_error until tomorrow.
        await supabase
          .from("content_ideas")
          .update({ autopilot_status: "pending" } as any)
          .eq("id", idea.id);
        errors++;
        errorDetails.push({ idea_id: idea.id, error: (ideaErr as Error).message });
        await updateRunProgress(supabase, runId, { processed, skipped, errors, error_details: errorDetails });
        await logEvent(supabase, runId, idea.id, idea.brand_id, "pending_after_throw", (ideaErr as Error).message, baseMeta);
      }
    };

    // Enqueue in small parallel batches — no rendering happens here, so there is
    // no gateway rate-limit exposure and the whole tick finishes in seconds.
    const CONCURRENCY = 5;
    try {
      for (let i = 0; i < thisTick.length; i += CONCURRENCY) {
        const batch = thisTick.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map(handleIdea));
      }
    } finally {
      await finalizeRun(supabase, runId, totalFound, processed, skipped, errors, errorDetails);
    }

    if (remaining.length > 0) {
      console.log(`[autopilot] ${remaining.length} leftover ideas — next tick will queue them`);
    }

    console.log(`[autopilot] Done (${deliveryWindow}). Queued: ${processed}, Skipped: ${skipped}, Errors: ${errors}, Leftover: ${remaining.length}`);

    return jsonResponse({ processed, skipped, errors, total: totalFound, leftover: remaining.length, delivery_time: deliveryWindow });



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

async function updateRunProgress(supabase: any, runId: string | undefined, patch: Record<string, any>) {
  if (!runId) return;
  await supabase
    .from("autopilot_runs")
    .update(patch)
    .eq("id", runId);
}

async function logEvent(supabase: any, runId: string | undefined, ideaId: string, brandId: string, status: string, errorMessage?: string, metadata?: Record<string, any>) {
  if (!runId) return;
  await supabase
    .from("autopilot_run_events")
    .insert({ run_id: runId, idea_id: ideaId, brand_id: brandId, status, error_message: errorMessage || null, metadata: metadata || null });
}

// ─── Enqueue a single idea as a design job ───────────────
//
// content-autopilot no longer renders inline (that made each tick a 60-90s per
// idea marathon that the edge isolate could not survive, so queues drained over
// days). It now builds the design payload, inserts a design_jobs row and
// returns. design-dispatch (sweeping every 10s, concurrency-capped) runs the
// render, and autopilot-notify finalises the idea + sends the email/push.

async function enqueueIdea(
  supabase: any,
  idea: any,
  runId?: string,
  _baseMeta?: Record<string, any>,
): Promise<{ success: boolean; status?: string; error?: string; job_id?: string }> {
  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", idea.brand_id)
    .single();

  if (!brand) {
    await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
    return { success: false, status: "failed_error", error: "brand_not_found" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", idea.user_id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("content_ideas").update({ autopilot_status: "failed_error" } as any).eq("id", idea.id);
    return { success: false, status: "failed_error", error: "profile_not_found" };
  }

  const { data: audience } = await supabase
    .from("target_audiences")
    .select("id")
    .eq("brand_id", idea.brand_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: trendPref } = await supabase
    .from("brand_trend_preferences")
    .select("selected_trend, default_trend_intensity, trend_enabled")
    .eq("brand_id", idea.brand_id)
    .maybeSingle();

  const isCarousel = idea.content_format === "carousel";
  const slideCount = isCarousel ? Math.min(10, Math.max(2, Number(idea.slide_count) || 5)) : 0;
  const canvasSize: string = (typeof idea.canvas_size === "string" && idea.canvas_size)
    ? idea.canvas_size
    : (isCarousel ? "1080x1080" : "1080x1350");

  const designPayload: Record<string, any> = {
    user_id: idea.user_id,
    action: isCarousel ? "generate_carousel" : "generate",
    canvas_size: canvasSize,
    content_idea_id: idea.id,
    autopilot_notify_idea_id: idea.id,
    // Campaign layer → renderer: lets the design adapt to the campaign it belongs to.
    ...(idea.campaign_id ? { campaign_id: idea.campaign_id } : {}),
    ...(idea.funnel_stage ? { funnel_stage: idea.funnel_stage } : {}),
    ...(idea.campaign_rationale ? { campaign_rationale: idea.campaign_rationale } : {}),
    ...(idea.funnel_rationale ? { funnel_rationale: idea.funnel_rationale } : {}),
    ...(idea.strategic_arc ? { strategic_arc: idea.strategic_arc } : {}),

    ...(isCarousel ? { slide_count: slideCount } : { candidate_count: 2 }),
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

  if (audience?.id) designPayload.audience_id = audience.id;

  if (trendPref?.trend_enabled && trendPref.selected_trend && trendPref.selected_trend !== "none") {
    designPayload.trend = trendPref.selected_trend;
    designPayload.trend_intensity = trendPref.default_trend_intensity || 40;
  }

  // Idempotency: never stack a second job for an idea that already has one in flight.
  const { data: inFlight } = await supabase
    .from("design_jobs")
    .select("id")
    .in("status", ["queued", "running"])
    .eq("brand_id", idea.brand_id)
    .contains("input", { content_idea_id: idea.id })
    .limit(1)
    .maybeSingle();

  if (inFlight?.id) {
    console.log(`[autopilot] idea ${idea.id} already has job ${inFlight.id} in flight`);
    return { success: true, job_id: inFlight.id };
  }

  const { data: job, error: jobErr } = await supabase
    .from("design_jobs")
    .insert({
      user_id: idea.user_id,
      brand_id: idea.brand_id,
      kind: isCarousel ? "carousel" : "single",
      status: "queued",
      priority: idea.scheduled_for === idea.__local_today ? 10 : 5,
      input: designPayload,
    } as any)
    .select("id")
    .single();

  if (jobErr || !job) {
    await supabase.from("content_ideas").update({ autopilot_status: "pending" } as any).eq("id", idea.id);
    return { success: false, status: "failed_error", error: jobErr?.message || "job_insert_failed" };
  }

  console.log(`[autopilot] queued idea ${idea.id} → job ${job.id} (${isCarousel ? `carousel x${slideCount}` : "single"})`);
  return { success: true, job_id: job.id };
}
