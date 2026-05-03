// Autopilot Planner — Sunday weekly job.
// For every brand on `mode = 'autonomous'` whose pending idea queue is below
// `min_queue_threshold` and that hasn't been planned this calendar week,
// drafts next week's ideas via brand-engine. Idempotent on weekly_plan_last_run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side mirror of src/lib/industryPlaybooks.ts (titles + prompts only).
const PLAYBOOK_SEEDS: Record<string, Array<{ title: string; prompt: string; category: string; idea_type?: string }>> = {
  restaurants: [
    { title: "Today's special", prompt: "A bold mouth-watering hero shot poster announcing today's special dish with price.", category: "promotion" },
    { title: "Behind the kitchen", prompt: "A cinematic behind-the-scenes shot of the chef plating, captioned to build trust.", category: "behind_the_scenes" },
    { title: "Customer love", prompt: "A clean testimonial card quoting a happy regular customer.", category: "social_proof" },
    { title: "Did you know?", prompt: "An educational micro-fact about one of our signature ingredients.", category: "education" },
    { title: "Weekend hype", prompt: "A vibrant weekend-vibes post inviting people to book a table.", category: "promotion" },
    { title: "Order online", prompt: "A clean product-style post with a clear ORDER NOW call to action.", category: "promotion" },
    { title: "Thank you", prompt: "A warm gratitude post thanking the community for the week.", category: "community" },
  ],
  beauty: [
    { title: "Transformation Tuesday", prompt: "A clean side-by-side before/after style poster of a recent client treatment.", category: "social_proof" },
    { title: "Treatment 101", prompt: "An educational explainer of one signature treatment and its benefit.", category: "education" },
    { title: "Glow inspiration", prompt: "An aspirational lifestyle post showing the after-feeling, not the service.", category: "inspiration" },
    { title: "Meet the artist", prompt: "A warm portrait-style post introducing one of the team members.", category: "behind_the_scenes" },
    { title: "Booking nudge", prompt: "A clear, gentle reminder post with a BOOK NOW call to action for the weekend.", category: "promotion" },
    { title: "Care tip", prompt: "A short take-home care tip educational post.", category: "education" },
    { title: "Client love", prompt: "A testimonial card from a recent happy client.", category: "social_proof" },
  ],
  fitness: [
    { title: "Motivation Monday", prompt: "A bold typographic motivation poster with a punchy one-liner.", category: "inspiration" },
    { title: "Class promo", prompt: "A high-energy poster promoting this week's signature class with day & time.", category: "promotion" },
    { title: "Form check", prompt: "A short educational tip post about one common training mistake.", category: "education" },
    { title: "Transformation", prompt: "A respectful before/after style post celebrating a member's progress.", category: "social_proof" },
    { title: "Weekend challenge", prompt: "A weekend mini-challenge post inviting members to participate.", category: "community" },
    { title: "Recovery tip", prompt: "A calmer post about rest, mobility, or recovery.", category: "education" },
    { title: "Member spotlight", prompt: "A warm spotlight post on one community member.", category: "community" },
  ],
  retail: [
    { title: "New in", prompt: "A clean editorial-style poster announcing a new arrival product.", category: "product_launch" },
    { title: "Style this", prompt: "A styling tip post showing 3 ways to wear / use a featured product.", category: "education", idea_type: "carousel" },
    { title: "Customer fit", prompt: "A user-generated style testimonial card.", category: "social_proof" },
    { title: "Limited offer", prompt: "A bold sale or limited-offer poster with clear deadline.", category: "promotion" },
    { title: "Lookbook", prompt: "A moody lookbook hero image showcasing the season's mood.", category: "inspiration" },
    { title: "Restock alert", prompt: "A clean alert-style post about a restocked bestseller.", category: "promotion" },
    { title: "Thank-you note", prompt: "A warm thank-you post to weekend shoppers.", category: "community" },
  ],
  services: [
    { title: "Insight of the week", prompt: "A bold typographic insight post sharing one sharp opinion in our field.", category: "thought_leadership" },
    { title: "Client win", prompt: "A clean case-study card highlighting a recent client outcome with a stat.", category: "social_proof" },
    { title: "How we work", prompt: "An educational explainer of one piece of our process.", category: "education", idea_type: "carousel" },
    { title: "Myth vs fact", prompt: "A myth-busting post for our industry.", category: "education" },
    { title: "Free consult offer", prompt: "A clean lead-gen poster offering a free consultation with a clear CTA.", category: "promotion" },
    { title: "Tool we love", prompt: "A short post recommending a tool or framework we use.", category: "thought_leadership" },
    { title: "Team note", prompt: "A warm post introducing the team or a team milestone.", category: "community" },
  ],
  general: [
    { title: "What we do", prompt: "A clean intro poster explaining what our business does in one sentence.", category: "education" },
    { title: "Featured offer", prompt: "A bold poster highlighting our flagship offer with a clear CTA.", category: "promotion" },
    { title: "Customer story", prompt: "A testimonial card from a happy customer.", category: "social_proof" },
    { title: "Tip of the week", prompt: "A short educational tip post relevant to our audience.", category: "education" },
    { title: "Behind the scenes", prompt: "A behind-the-scenes look at our work this week.", category: "behind_the_scenes" },
    { title: "Inspiration", prompt: "An aspirational lifestyle post in our brand mood.", category: "inspiration" },
    { title: "Thank you", prompt: "A warm community thank-you post.", category: "community" },
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
        const rows = seeds.map((s, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() + i);
          return {
            brand_id: brand.id,
            user_id: brand.user_id,
            title: s.title,
            prompt: s.prompt,
            content_category: s.category,
            idea_type: s.idea_type || "single",
            status: "suggested",
            scheduled_for: isoDate(d),
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
    const startOfWeek = new Date(now);
    startOfWeek.setUTCHours(0, 0, 0, 0);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay()); // Sunday 00:00

    // 1. Find all autonomous brands due for planning this week
    const { data: settings, error: settingsErr } = await supabase
      .from("autopilot_settings")
      .select("brand_id, user_id, min_queue_threshold, weekly_plan_last_run")
      .eq("mode", "autonomous");

    if (settingsErr) throw settingsErr;
    if (!settings || settings.length === 0) {
      console.log("[autopilot-planner] no autonomous brands");
      return jsonResponse({ planned: 0, skipped: 0, total: 0 });
    }

    const eligible = settings.filter((s: any) => {
      if (!s.weekly_plan_last_run) return true;
      return new Date(s.weekly_plan_last_run) < startOfWeek;
    });

    let planned = 0;
    let skipped = 0;
    const errors: { brand_id: string; error: string }[] = [];

    for (const s of eligible) {
      try {
        // Count pending (non-created) ideas
        const { count: pendingCount } = await supabase
          .from("content_ideas")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", s.brand_id)
          .neq("status", "created");

        const threshold = s.min_queue_threshold ?? 5;
        if ((pendingCount ?? 0) >= threshold) {
          console.log(`[autopilot-planner] brand ${s.brand_id} skipped — queue ${pendingCount} >= ${threshold}`);
          skipped++;
          // Still mark as planned this week so we don't re-check daily
          await supabase
            .from("autopilot_settings")
            .update({ weekly_plan_last_run: now.toISOString() })
            .eq("brand_id", s.brand_id);
          continue;
        }

        // Invoke brand-engine in service mode
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
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[autopilot-planner] brand ${s.brand_id} failed: ${res.status} ${errBody}`);
          errors.push({ brand_id: s.brand_id, error: errBody.slice(0, 200) });
          continue;
        }

        await supabase
          .from("autopilot_settings")
          .update({ weekly_plan_last_run: now.toISOString() })
          .eq("brand_id", s.brand_id);

        planned++;
        console.log(`[autopilot-planner] brand ${s.brand_id} planned successfully`);
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
