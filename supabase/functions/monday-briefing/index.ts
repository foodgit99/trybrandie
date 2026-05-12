// Monday Briefing — runs hourly via pg_cron.
// For every user where local time matches their preferred briefing hour AND
// it's Monday locally AND they haven't received a briefing for this week,
// ensure a draft weekly_blueprint exists (calling autopilot-planner if needed)
// then send the "Your weekly strategy is ready" email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARC_TAGS = ["Teaser", "Educate", "Hard Sell", "Urgency", "Closing", "Story", "Recap"];

function localParts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  return { weekday, hour };
}

function localISODate(date: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  console.log("[monday-briefing] sweep at", now.toISOString());

  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, posting_timezone, monday_briefing_hour, last_monday_briefing_at");

    if (error) throw error;
    if (!profiles?.length) return json({ checked: 0, sent: 0 });

    let sent = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const p of profiles) {
      try {
        const tz = p.posting_timezone || "Africa/Lagos";
        const target = p.monday_briefing_hour ?? 7;
        const { weekday, hour } = localParts(now, tz);

        if (weekday !== "Mon") {
          skipped++;
          continue;
        }
        if (hour !== target) {
          skipped++;
          continue;
        }

        // Compute this week's Monday in user's local timezone
        const weekStart = localISODate(now, tz); // Mon today

        // Skip if we've already sent this week
        if (p.last_monday_briefing_at) {
          const last = new Date(p.last_monday_briefing_at);
          const lastWeekStart = localISODate(last, tz);
          if (lastWeekStart === weekStart) {
            skipped++;
            continue;
          }
        }

        // Fetch user's primary brand
        const { data: brand } = await supabase
          .from("brands")
          .select("id, name")
          .eq("user_id", p.user_id)
          .eq("onboarding_complete", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!brand) {
          skipped++;
          continue;
        }

        // Ensure blueprint row exists for this week
        const { data: existingBp } = await supabase
          .from("weekly_blueprints")
          .select("id, status")
          .eq("brand_id", brand.id)
          .eq("week_start_date", weekStart)
          .maybeSingle();

        let blueprintId = existingBp?.id;
        if (!blueprintId) {
          const { data: newBp } = await supabase
            .from("weekly_blueprints")
            .insert({
              user_id: p.user_id,
              brand_id: brand.id,
              week_start_date: weekStart,
              status: "draft",
              source: "autopilot",
            })
            .select("id")
            .single();
          blueprintId = newBp?.id;
        }

        // Fetch ideas scheduled this week (Mon..Sun)
        const sundayDate = new Date(weekStart + "T00:00:00Z");
        sundayDate.setUTCDate(sundayDate.getUTCDate() + 6);
        const sundayISO = sundayDate.toISOString().split("T")[0];

        const { data: ideas } = await supabase
          .from("content_ideas")
          .select("title, scheduled_for, playbook_role, day_of_week")
          .eq("brand_id", brand.id)
          .gte("scheduled_for", weekStart)
          .lte("scheduled_for", sundayISO)
          .order("scheduled_for", { ascending: true });

        const ideaSummaries = (ideas || []).slice(0, 7).map((i: any) => {
          const d = new Date(i.scheduled_for + "T00:00:00Z");
          const dayLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
          const dow = i.day_of_week ?? (d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1);
          return {
            day: dayLabel,
            title: i.title,
            role: i.playbook_role || ARC_TAGS[dow] || "",
          };
        });

        // Resolve email
        const { data: authUser } = await supabase.auth.admin.getUserById(p.user_id);
        const email = authUser?.user?.email;
        if (!email) {
          skipped++;
          continue;
        }

        const weekDate = new Date(weekStart);
        const weekLabel = weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        const r = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "monday_briefing",
            to: email,
            data: {
              name: (p.full_name || "").split(" ")[0],
              week_label: `Week of ${weekLabel}`,
              ideas: ideaSummaries,
              blueprint_id: blueprintId,
            },
          }),
        });

        if (r.ok) {
          await supabase
            .from("profiles")
            .update({ last_monday_briefing_at: now.toISOString() })
            .eq("user_id", p.user_id);
          sent++;
        } else {
          errors.push({ user_id: p.user_id, error: await r.text() });
        }
      } catch (e) {
        errors.push({ user_id: p.user_id, error: (e as Error).message });
      }
    }

    console.log(`[monday-briefing] sent=${sent} skipped=${skipped} errors=${errors.length}`);
    return json({ sent, skipped, errors });
  } catch (e) {
    console.error("[monday-briefing] fatal:", e);
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
