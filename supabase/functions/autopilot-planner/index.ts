// Autopilot Planner — Sunday weekly job.
// For every brand on `mode = 'autonomous'` whose pending idea queue is below
// `min_queue_threshold` and that hasn't been planned this calendar week,
// drafts next week's ideas via brand-engine. Idempotent on weekly_plan_last_run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

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
