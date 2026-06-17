// Daily Execution Push — runs hourly via pg_cron.
// For each user where local time matches their preferred push hour AND there's
// an approved drop scheduled for today AND we haven't sent today's push,
// emails them "Today's drop is ready" with a deep link to /cockpit?drop=<id>.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function localHour(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
  return parseInt(fmt.format(date), 10);
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
  console.log("[daily-push] sweep at", now.toISOString());

  // Optional: targeted test send from Settings "Send test" button
  let testUserId: string | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.test_user_id === "string") testUserId = body.test_user_id;
    }
  } catch (_) {}

  try {
    let query = supabase
      .from("profiles")
      .select("user_id, full_name, posting_timezone, daily_push_hour, last_daily_push_at");
    if (testUserId) query = query.eq("user_id", testUserId);
    const { data: profiles } = await query;

    if (!profiles?.length) return json({ sent: 0 });

    let sent = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const p of profiles) {
      try {
        // Find primary brand first so we can prefer its autopilot timing config.
        const { data: brand } = await supabase
          .from("brands")
          .select("id")
          .eq("user_id", p.user_id)
          .eq("onboarding_complete", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!brand) {
          skipped++;
          continue;
        }

        // Prefer autopilot_settings (timezone + delivery_time) when present;
        // fall back to profiles for legacy/manual users.
        const { data: apSettings } = await supabase
          .from("autopilot_settings")
          .select("timezone, delivery_time, enabled")
          .eq("brand_id", brand.id)
          .maybeSingle();

        const DELIVERY_HOUR: Record<string, number> = { morning: 8, afternoon: 13, evening: 18 };
        const useAutopilotTiming = !!(apSettings && apSettings.enabled);
        const tz = (useAutopilotTiming && apSettings?.timezone) || p.posting_timezone || "Africa/Lagos";
        const target = useAutopilotTiming
          ? (DELIVERY_HOUR[apSettings?.delivery_time || "morning"] ?? 8)
          : (p.daily_push_hour ?? 8);

        if (!testUserId && localHour(now, tz) !== target) {
          skipped++;
          continue;
        }
        const todayISO = localISODate(now, tz);

        // Skip if already pushed today (bypass for explicit test sends)
        if (!testUserId && p.last_daily_push_at) {
          const lastISO = localISODate(new Date(p.last_daily_push_at), tz);
          if (lastISO === todayISO) {
            skipped++;
            continue;
          }
        }

        // Find today's approved idea with a design + image ready
        const { data: idea } = await supabase
          .from("content_ideas")
          .select("id, title, design_id, autopilot, autopilot_status, blueprint_id, designs:design_id(image_url, caption)")
          .eq("brand_id", brand.id)
          .eq("scheduled_for", todayISO)
          .eq("approval_status", "approved")
          .not("design_id", "is", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!idea) {
          skipped++;
          continue;
        }

        // Hard guard: design must have a usable image. Otherwise the email is empty.
        const designImage = (idea as any).designs?.image_url;
        if (!designImage) {
          // If autopilot is still working, do NOT advance last_daily_push_at — let the next sweep retry.
          const apStatus = (idea as any).autopilot_status;
          const stillWorking =
            (idea as any).autopilot === true &&
            (apStatus === null ||
              apStatus === "pending" ||
              apStatus === "processing" ||
              (typeof apStatus === "string" && apStatus.startsWith("failed_")));
          if (stillWorking) {
            console.log(`[daily-push] skip ${p.user_id}/${idea.id}: design not ready (status=${apStatus}) — will retry`);
            skipped++;
            continue;
          }
          skipped++;
          continue;
        }

        // Fetch blueprint status for the email payload
        let blueprintStatus: string | null = null;
        if ((idea as any).blueprint_id) {
          const { data: bp } = await supabase
            .from("weekly_blueprints")
            .select("status")
            .eq("id", (idea as any).blueprint_id)
            .maybeSingle();
          blueprintStatus = bp?.status ?? null;
        }

        const { data: authUser } = await supabase.auth.admin.getUserById(p.user_id);
        const email = authUser?.user?.email;
        if (!email) {
          skipped++;
          continue;
        }

        const dayLabel = new Date(todayISO).toLocaleDateString("en-US", { weekday: "long" });

        const r = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "daily_drop_ready",
            to: email,
            data: {
              idea_title: idea.title,
              hook: (idea as any).designs?.caption,
              image_url: designImage,
              idea_id: idea.id,
              design_id: idea.id, // back-compat
              day_label: dayLabel,
              blueprint_status: blueprintStatus,
            },
          }),
        });

        if (r.ok) {
          await supabase
            .from("profiles")
            .update({ last_daily_push_at: now.toISOString() })
            .eq("user_id", p.user_id);
          sent++;
        } else {
          errors.push({ user_id: p.user_id, error: await r.text() });
        }
      } catch (e) {
        errors.push({ user_id: p.user_id, error: (e as Error).message });
      }
    }

    console.log(`[daily-push] sent=${sent} skipped=${skipped} errors=${errors.length}`);
    return json({ sent, skipped, errors });
  } catch (e) {
    console.error("[daily-push] fatal:", e);
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
