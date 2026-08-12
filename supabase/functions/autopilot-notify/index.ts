// autopilot-notify — completion hook for autopilot design jobs.
//
// content-autopilot is now a pure enqueuer: it locks an idea and inserts a
// design_jobs row. design-studio renders it in the background and calls this
// function when the job settles. Here we finalise content_ideas and send the
// "your post is ready" email + push, so delivery no longer depends on the
// autopilot edge isolate staying alive for 60-90s per idea.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const ideaId: string | undefined = body?.idea_id;
    const outcome: string = body?.outcome === "failed" ? "failed" : "succeeded";
    const errorText: string = String(body?.error || "");

    if (!ideaId) return json({ error: "missing idea_id" }, 400);

    const { data: idea } = await supabase
      .from("content_ideas")
      .select("id, user_id, brand_id, title, content_format, slide_count, autopilot_status")
      .eq("id", ideaId)
      .maybeSingle();

    if (!idea) return json({ ok: true, skipped: "idea_not_found" });

    // ── Failure path ───────────────────────────────────────
    if (outcome === "failed") {
      const noCredits = /402|credit|insufficient/i.test(errorText);
      await supabase
        .from("content_ideas")
        .update({ autopilot_status: noCredits ? "failed_no_credits" : "failed_error" } as any)
        .eq("id", ideaId);

      if (noCredits) {
        const { data: authUser } = await supabase.auth.admin.getUserById(idea.user_id);
        const email = authUser?.user?.email;
        if (email) {
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({ type: "autopilot_no_credits", to: email, data: { idea_title: idea.title } }),
          }).catch(() => {});
        }
      }
      return json({ ok: true, outcome: "failed", no_credits: noCredits });
    }

    // ── Success path ───────────────────────────────────────
    const { data: linked } = await supabase
      .from("designs")
      .select("id, image_url, slide_index, carousel_id, caption")
      .eq("content_idea_id", ideaId)
      .order("slide_index", { ascending: true, nullsFirst: false });


    const designs = (linked || []) as any[];
    if (designs.length === 0) {
      await supabase
        .from("content_ideas")
        .update({ autopilot_status: "failed_error" } as any)
        .eq("id", ideaId);
      return json({ ok: true, skipped: "no_designs" });
    }

    const cover = designs.find((d) => d.slide_index === 0) || designs[0];

    await supabase
      .from("content_ideas")
      .update({ design_id: cover.id, status: "created", autopilot_status: "completed" } as any)
      .eq("id", ideaId);

    const { data: profile } = await supabase
      .from("profiles")
      .select("email_reminders_enabled")
      .eq("user_id", idea.user_id)
      .maybeSingle();

    const { data: authUser } = await supabase.auth.admin.getUserById(idea.user_id);
    const email = authUser?.user?.email;
    const remindersOn = (profile as any)?.email_reminders_enabled !== false;
    const isCarousel = idea.content_format === "carousel";
    const emailTitle = isCarousel
      ? `${idea.title} (carousel, ${designs.length} slides)`
      : idea.title;

    if (email && remindersOn && cover.image_url) {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          type: "autopilot_design_ready",
          to: email,
          data: { idea_title: emailTitle, image_url: cover.image_url, design_id: cover.id },
        }),
      }).catch((e) => console.error("[autopilot-notify] email failed:", e));
    }

    fetch(`${supabaseUrl}/functions/v1/push-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        user_id: idea.user_id,
        title: "Today's post is ready",
        body: idea.title,
        url: `/post/${idea.id}`,
        tag: `idea-${idea.id}`,
        data: { idea_id: idea.id, design_id: cover.id },
      }),
    }).catch(() => {});

    // WhatsApp DM: cover image + caption + deep link (no-ops if disabled).
    const captionText = String((cover as any)?.caption || "").trim();
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        user_id: idea.user_id,
        idea_id: idea.id,
        title: isCarousel
          ? `Today's post is ready — ${idea.title} (carousel, ${designs.length} slides)`
          : `Today's post is ready — ${idea.title}`,
        body: captionText,
        image_url: cover.image_url,
        url: `/post/${idea.id}`,
      }),
    }).catch((e) => console.error("[autopilot-notify] whatsapp failed:", e));


    console.log(`[autopilot-notify] idea ${ideaId} delivered → design ${cover.id}`);
    return json({ ok: true, design_id: cover.id, slides: designs.length });
  } catch (e) {
    console.error("[autopilot-notify] error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
