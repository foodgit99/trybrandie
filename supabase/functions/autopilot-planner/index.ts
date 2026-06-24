// Autopilot Planner — Sunday weekly job.
// For every brand on `mode = 'autonomous'` whose pending idea queue is below
// `min_queue_threshold` and that hasn't been planned this calendar week,
// drafts next week's ideas via brand-engine. Idempotent on weekly_plan_last_run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAutopilotCampaign } from "../_shared/resolve-autopilot-campaign.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Seed = { title: string; prompt: string; category: string; idea_type?: string; content_format?: "graphic" | "carousel"; slide_count?: number; arc?: string };

// Strategic Arc — Hook → Proof → CTA narrative across the week.
// Each weekday gets a role; the seed at index i is annotated with WEEK_ARC[i].
// Ordering ensures a multi-day story instead of random posts (PRD §3 "Strategic Arc").
const WEEK_ARC = [
  "Hook",      // Mon — grab attention, set the theme
  "Educate",   // Tue — teach, build authority
  "Proof",     // Wed — testimonial, case, before/after
  "Offer",     // Thu — promotional, the ask
  "Urgency",   // Fri — scarcity / deadline CTA
  "Lifestyle", // Sat — entertainment, mood, BTS
  "Community", // Sun — gratitude, UGC, interactive
];

const PLAYBOOK_SEEDS: Record<string, Array<Seed>> = {
  restaurants: [
    { title: "Today's special", prompt: "A bold mouth-watering hero shot poster announcing today's special dish with price.", category: "promotional" },
    { title: "Behind the kitchen", prompt: "A 4-slide carousel walking through how our signature dish is prepared, one step per slide.", category: "bts", content_format: "carousel", slide_count: 4 },
    { title: "Customer love", prompt: "A clean testimonial card quoting a happy regular customer.", category: "social_proof" },
    { title: "Did you know?", prompt: "An educational micro-fact about one of our signature ingredients.", category: "educational" },
    { title: "Weekend hype", prompt: "A vibrant weekend-vibes post inviting people to book a table.", category: "promotional" },
    { title: "Order online", prompt: "A clean product-style post with a clear ORDER NOW call to action.", category: "promotional" },
    { title: "Thank you", prompt: "A warm gratitude post thanking the community for the week.", category: "interactive" },
  ],
  beauty: [
    { title: "Transformation Tuesday", prompt: "A clean side-by-side before/after style poster of a recent client treatment.", category: "social_proof" },
    { title: "Treatment 101", prompt: "A 4-slide carousel explaining one signature treatment: what it is, how it works, who it's for, the after-result.", category: "educational", content_format: "carousel", slide_count: 4 },
    { title: "Glow inspiration", prompt: "An aspirational lifestyle post showing the after-feeling, not the service.", category: "entertainment" },
    { title: "Meet the artist", prompt: "A warm portrait-style post introducing one of the team members.", category: "bts" },
    { title: "Booking nudge", prompt: "A clear, gentle reminder post with a BOOK NOW call to action for the weekend.", category: "promotional" },
    { title: "Care tip", prompt: "A short take-home care tip educational post.", category: "educational" },
    { title: "Client love", prompt: "A testimonial card from a recent happy client.", category: "social_proof" },
  ],
  fitness: [
    { title: "Motivation Monday", prompt: "A bold typographic motivation poster with a punchy one-liner.", category: "entertainment" },
    { title: "Class promo", prompt: "A high-energy poster promoting this week's signature class with day & time.", category: "promotional" },
    { title: "Form check", prompt: "A 5-slide carousel breaking down one common training mistake and the correct form, slide-by-slide.", category: "educational", content_format: "carousel", slide_count: 5 },
    { title: "Transformation", prompt: "A respectful before/after style post celebrating a member's progress.", category: "social_proof" },
    { title: "Weekend challenge", prompt: "A weekend mini-challenge post inviting members to participate.", category: "interactive" },
    { title: "Recovery tip", prompt: "A calmer post about rest, mobility, or recovery.", category: "educational" },
    { title: "Member spotlight", prompt: "A warm spotlight post on one community member.", category: "social_proof" },
  ],
  retail: [
    { title: "New in", prompt: "A clean editorial-style poster announcing a new arrival product.", category: "announcement" },
    { title: "Style this", prompt: "A 5-slide carousel showing 5 ways to style or use a featured product, one look per slide.", category: "educational", content_format: "carousel", slide_count: 5 },
    { title: "Customer fit", prompt: "A user-generated style testimonial card.", category: "social_proof" },
    { title: "Limited offer", prompt: "A bold sale or limited-offer poster with clear deadline.", category: "promotional" },
    { title: "Lookbook", prompt: "A moody lookbook hero image showcasing the season's mood.", category: "entertainment" },
    { title: "Restock alert", prompt: "A clean alert-style post about a restocked bestseller.", category: "promotional" },
    { title: "Thank-you note", prompt: "A warm thank-you post to weekend shoppers.", category: "interactive" },
  ],
  services: [
    { title: "Insight of the week", prompt: "A bold typographic insight post sharing one sharp opinion in our field.", category: "informational" },
    { title: "Client win", prompt: "A clean case-study card highlighting a recent client outcome with a stat.", category: "social_proof" },
    { title: "How we work", prompt: "A 5-slide carousel walking through our process step-by-step, one stage per slide.", category: "educational", content_format: "carousel", slide_count: 5 },
    { title: "Myth vs fact", prompt: "A myth-busting post for our industry.", category: "educational" },
    { title: "Free consult offer", prompt: "A clean lead-gen poster offering a free consultation with a clear CTA.", category: "promotional" },
    { title: "Tool we love", prompt: "A short post recommending a tool or framework we use.", category: "informational" },
    { title: "Team note", prompt: "A warm post introducing the team or a team milestone.", category: "bts" },
  ],
  general: [
    { title: "What we do", prompt: "A clean intro poster explaining what our business does in one sentence.", category: "informational" },
    { title: "Featured offer", prompt: "A bold poster highlighting our flagship offer with a clear CTA.", category: "promotional" },
    { title: "Customer story", prompt: "A testimonial card from a happy customer.", category: "social_proof" },
    { title: "Tip of the week", prompt: "A 4-slide carousel sharing 4 quick tips relevant to our audience, one tip per slide.", category: "educational", content_format: "carousel", slide_count: 4 },
    { title: "Behind the scenes", prompt: "A behind-the-scenes look at our work this week.", category: "bts" },
    { title: "Inspiration", prompt: "An aspirational lifestyle post in our brand mood.", category: "entertainment" },
    { title: "Thank you", prompt: "A warm community thank-you post.", category: "interactive" },
  ],
};


function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ─── SEED MODE ───────────────────────────────────────────────────────────
  // Called once at end of onboarding to populate the brand's first week with
  // playbook ideas. Idempotent: skips if the brand already has any ideas.
  if (req.method === "POST") {
    let body: any = null;
    try {
      body = await req.clone().json();
    } catch (_) {
      /* ignore */
    }
    if (body && body.seed && body.brand_id) {
      try {
        const playbookId = String(body.playbook_id || "general");
        const seeds = PLAYBOOK_SEEDS[playbookId] || PLAYBOOK_SEEDS.general;

        // Resolve user_id from brand row
        const { data: brand, error: brandErr } = await supabase
          .from("brands")
          .select("id, user_id")
          .eq("id", body.brand_id)
          .single();
        if (brandErr || !brand) throw brandErr || new Error("brand not found");

        // Skip if any ideas already exist for this brand (idempotent)
        const { count: existing } = await supabase
          .from("content_ideas")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brand.id);
        if ((existing ?? 0) > 0) {
          return jsonResponse({ seeded: 0, skipped: true, reason: "ideas_exist" });
        }

        const today = new Date();
        // Re-order seeds to fit the Hook → Proof → CTA arc by mapping each
        // weekday role to the best-matching seed category.
        const ROLE_PREF: Record<string, string[]> = {
          Hook: ["entertainment", "informational", "announcement"],
          Educate: ["educational"],
          Proof: ["social_proof"],
          Offer: ["promotional"],
          Urgency: ["promotional", "announcement"],
          Lifestyle: ["bts", "entertainment"],
          Community: ["interactive", "social_proof"],
        };
        const pool = [...seeds];
        const ordered: Seed[] = [];
        for (const role of WEEK_ARC) {
          const prefs = ROLE_PREF[role] || [];
          let pick = -1;
          for (const p of prefs) {
            pick = pool.findIndex((s) => s.category === p);
            if (pick >= 0) break;
          }
          if (pick < 0) pick = 0;
          ordered.push({ ...pool[pick], arc: role });
          pool.splice(pick, 1);
          if (!pool.length) break;
        }
        // Load any autopilot defaults the user has already configured for this brand
        const { data: apDefaults } = await supabase
          .from("autopilot_settings")
          .select("default_funnel_stage, default_campaign_id")
          .eq("brand_id", brand.id)
          .maybeSingle();
        const defaultFunnelStage = (apDefaults as any)?.default_funnel_stage || null;
        const defaultCampaignId = (apDefaults as any)?.default_campaign_id || null;

        const rows = ordered.map((s, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() + i);
          const format: "graphic" | "carousel" = s.content_format === "carousel" ? "carousel" : "graphic";
          return {
            brand_id: brand.id,
            user_id: brand.user_id,
            title: s.title,
            prompt: s.prompt,
            content_category: s.category,
            strategic_arc: s.arc ?? null,
            idea_type: s.idea_type || "single",
            content_format: format,
            slide_count: format === "carousel" ? (s.slide_count ?? 5) : null,
            status: "suggested",
            scheduled_for: isoDate(d),
            autopilot: true, // seed mode flips autopilot ON below, so auto-enrol
            funnel_stage: defaultFunnelStage,
            campaign_id: defaultCampaignId,
          };
        });
        const { error: insertErr } = await supabase.from("content_ideas").insert(rows);
        if (insertErr) throw insertErr;

        // Turn the engine ON by default so the user lands on a "Live" home.
        await supabase
          .from("autopilot_settings")
          .upsert(
            {
              brand_id: brand.id,
              user_id: brand.user_id,
              enabled: true,
              mode: "autonomous",
            },
            { onConflict: "brand_id" },
          );

        console.log(`[autopilot-planner] seeded ${rows.length} ideas + engine ON for brand ${brand.id} (${playbookId})`);
        return jsonResponse({ seeded: rows.length, engine: "live" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[autopilot-planner] seed error:", msg);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  console.log("[autopilot-planner] starting weekly plan sweep");

  try {
    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setUTCHours(0, 0, 0, 0);
    startOfThisWeek.setUTCDate(startOfThisWeek.getUTCDate() - startOfThisWeek.getUTCDay()); // Sunday 00:00

    // Compute NEXT week's Monday (UTC) — the week the planner is filling.
    const nextMonday = new Date(now);
    nextMonday.setUTCHours(0, 0, 0, 0);
    const dow = nextMonday.getUTCDay(); // 0=Sun..6=Sat
    const daysUntilMonday = ((1 - dow) + 7) % 7 || 7; // always next Monday (1..7 days ahead)
    nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
    const nextWeekStart = isoDate(nextMonday);
    const nextWeekEnd = (() => {
      const d = new Date(nextMonday);
      d.setUTCDate(d.getUTCDate() + 6);
      return isoDate(d);
    })();
    const nextWeekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(nextMonday);
      d.setUTCDate(d.getUTCDate() + i);
      nextWeekDates.push(isoDate(d));
    }

    // 1. Find all brands with autopilot enabled (assisted OR autonomous; skip manual)
    const { data: settings, error: settingsErr } = await supabase
      .from("autopilot_settings")
      .select("brand_id, user_id, min_queue_threshold, weekly_plan_last_run, mode")
      .eq("enabled", true)
      .neq("mode", "manual");

    if (settingsErr) throw settingsErr;
    if (!settings || settings.length === 0) {
      console.log("[autopilot-planner] no eligible brands");
      return jsonResponse({ planned: 0, skipped: 0, total: 0 });
    }

    const eligible = settings.filter((s: any) => {
      if (!s.weekly_plan_last_run) return true;
      return new Date(s.weekly_plan_last_run) < startOfThisWeek;
    });

    let planned = 0;
    let skipped = 0;
    const errors: { brand_id: string; error: string }[] = [];

    for (const s of eligible) {
      try {
        // Coverage check: does the queue already cover every day of NEXT week?
        const { data: nextWeekIdeas } = await supabase
          .from("content_ideas")
          .select("scheduled_for")
          .eq("brand_id", s.brand_id)
          .gte("scheduled_for", nextWeekStart)
          .lte("scheduled_for", nextWeekEnd);
        const filledDates = new Set((nextWeekIdeas || []).map((r: any) => r.scheduled_for));
        const fullyCovered = nextWeekDates.every((d) => filledDates.has(d));

        // Count pending (non-created) ideas across all upcoming work
        const { count: pendingCount } = await supabase
          .from("content_ideas")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", s.brand_id)
          .neq("status", "created");

        const threshold = s.min_queue_threshold ?? 5;
        if ((pendingCount ?? 0) >= threshold && fullyCovered) {
          console.log(`[autopilot-planner] brand ${s.brand_id} skipped — queue ${pendingCount} >= ${threshold} and next week fully covered`);
          skipped++;
          // Only stamp when next-week coverage is real, so we don't get stuck.
          await supabase
            .from("autopilot_settings")
            .update({ weekly_plan_last_run: now.toISOString() })
            .eq("brand_id", s.brand_id);
          continue;
        }

        // Ensure blueprint exists for next week (plan-of-record).
        // For mode='autonomous', auto-approve immediately so content-autopilot
        // can render without waiting on user approval. mode='assisted' stays draft.
        const autoApprove = s.mode === "autonomous";
        await supabase
          .from("weekly_blueprints")
          .upsert(
            {
              brand_id: s.brand_id,
              user_id: s.user_id,
              week_start_date: nextWeekStart,
              status: autoApprove ? "approved" : "draft",
              approved_at: autoApprove ? new Date().toISOString() : null,
              source: "autopilot",
            },
            { onConflict: "brand_id,week_start_date" },
          );


        // Invoke brand-engine in service mode, planning NEXT week.
        const res = await fetch(`${supabaseUrl}/functions/v1/brand-engine`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            action: "generate_weekly_ideas",
            brand_id: s.brand_id,
            user_id: s.user_id,
            skip_credit_check: true,
            week_offset: 1,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[autopilot-planner] brand ${s.brand_id} failed: ${res.status} ${errBody}`);
          errors.push({ brand_id: s.brand_id, error: errBody.slice(0, 200) });
          continue;
        }

        // Backfill any empty days so the Blueprint is never ragged.
        try {
          const { data: afterIdeas } = await supabase
            .from("content_ideas")
            .select("scheduled_for")
            .eq("brand_id", s.brand_id)
            .gte("scheduled_for", nextWeekStart)
            .lte("scheduled_for", nextWeekEnd);
          const have = new Set((afterIdeas || []).map((r: any) => r.scheduled_for));
          if (nextWeekDates.some((d) => !have.has(d))) {
            await fetch(`${supabaseUrl}/functions/v1/brand-engine`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                action: "fill_empty_days",
                brand_id: s.brand_id,
                user_id: s.user_id,
                skip_credit_check: true,
                week_offset: 1,
              }),
            });
          }
        } catch (fillErr) {
          console.warn(`[autopilot-planner] fill_empty_days non-fatal for ${s.brand_id}:`, fillErr);
        }

        await supabase
          .from("autopilot_settings")
          .update({ weekly_plan_last_run: now.toISOString() })
          .eq("brand_id", s.brand_id);

        planned++;
        console.log(`[autopilot-planner] brand ${s.brand_id} planned successfully (week ${nextWeekStart})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[autopilot-planner] brand ${s.brand_id} threw:`, msg);
        errors.push({ brand_id: s.brand_id, error: msg });
      }
    }

    return jsonResponse({
      total: eligible.length,
      planned,
      skipped,
      errors: errors.length,
      error_details: errors,
    });
  } catch (e) {
    console.error("[autopilot-planner] fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
