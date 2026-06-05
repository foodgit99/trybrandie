// Weekly Recap — runs hourly via pg_cron.
// For each user where local time is Sunday at their preferred briefing hour (reusing
// monday_briefing_hour for a single timing source) and we haven't sent this week,
// emails a recap of the past 7 days with a CTA to /history.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function localParts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "Sun";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  return { weekday, hour };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  console.log("[weekly-recap] sweep at", now.toISOString());

  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, posting_timezone, monday_briefing_hour, last_weekly_recap_at");
    if (error) throw error;
    if (!profiles?.length) return json({ sent: 0 });

    let sent = 0;
    let skipped = 0;
    const errors: any[] = [];

    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - 7);
    const sinceISO = since.toISOString();

    for (const p of profiles) {
      try {
        const tz = p.posting_timezone || "Africa/Lagos";
        const target = (p as any).monday_briefing_hour ?? 18; // reuse hour pref
        const { weekday, hour } = localParts(now, tz);
        if (weekday !== "Sun") { skipped++; continue; }
        if (hour !== target) { skipped++; continue; }

        // Dedupe per week
        if ((p as any).last_weekly_recap_at) {
          const last = new Date((p as any).last_weekly_recap_at);
          if (now.getTime() - last.getTime() < 6 * 24 * 60 * 60 * 1000) {
            skipped++; continue;
          }
        }

        const { data: brand } = await supabase
          .from("brands")
          .select("id")
          .eq("user_id", p.user_id)
          .eq("onboarding_complete", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!brand) { skipped++; continue; }

        const { data: designs } = await supabase
          .from("designs")
          .select("image_url, created_at")
          .eq("brand_id", brand.id)
          .gte("created_at", sinceISO)
          .order("created_at", { ascending: false })
          .limit(4);

        const { count: approvedCount } = await supabase
          .from("content_ideas")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brand.id)
          .eq("approval_status", "approved")
          .gte("created_at", sinceISO);

        const designsCount = designs?.length || 0;
        if (designsCount === 0 && (approvedCount ?? 0) === 0) {
          skipped++; continue; // nothing to celebrate
        }

        const { data: authUser } = await supabase.auth.admin.getUserById(p.user_id);
        const email = authUser?.user?.email;
        if (!email) { skipped++; continue; }

        const weekLabel = `this week`;

        const r = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "weekly_recap",
            to: email,
            data: {
              name: (p.full_name || "").split(" ")[0],
              week_label: weekLabel,
              designs_count: designsCount,
              approved_count: approvedCount ?? 0,
              preview_images: (designs || []).map((d: any) => d.image_url).filter(Boolean),
            },
          }),
        });

        if (r.ok) {
          await supabase
            .from("profiles")
            .update({ last_weekly_recap_at: now.toISOString() } as any)
            .eq("user_id", p.user_id);
          sent++;
        } else {
          errors.push({ user_id: p.user_id, error: await r.text() });
        }
      } catch (e) {
        errors.push({ user_id: p.user_id, error: (e as Error).message });
      }
    }

    console.log(`[weekly-recap] sent=${sent} skipped=${skipped} errors=${errors.length}`);
    return json({ sent, skipped, errors });
  } catch (e) {
    console.error("[weekly-recap] fatal:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(d: unknown) {
  return new Response(JSON.stringify(d), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
