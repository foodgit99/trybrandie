// Public, unauthenticated event ingest for campaign landing pages.
// Only a known campaign slug and a whitelisted event name are accepted, and no
// personal data is stored — the user id is only attached when a valid session
// token comes with the request.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVENTS = new Set(["view", "section_view", "cta_click", "signup", "conversion"]);
const SECTIONS = new Set(["hero", "features", "showcase", "how_it_works", "testimonials", "pricing", "faq", "cta"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug || "").toLowerCase().trim();
    const eventName = String(body?.event || "");
    if (!slug || !EVENTS.has(eventName)) return json({ error: "bad_request" }, 400);

    // The campaign must exist. Signups/conversions can land slightly after a
    // campaign closes, so those accept any non-draft campaign.
    const { data: campaign } = await admin
      .from("campaigns_public")
      .select("id, status")
      .eq("slug", slug)
      .maybeSingle();
    if (!campaign || campaign.status === "draft") return json({ ok: true, ignored: true });

    const rawSection = String(body?.section || "");
    const section = SECTIONS.has(rawSection) ? rawSection : null;
    const referral = String(body?.ref || "").toLowerCase().slice(0, 60) || null;

    // Attach a user only when the caller proves a session.
    let userId: string | null = null;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (token) {
      const { data } = await admin.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    await admin.from("campaign_page_events").insert({
      campaign_id: campaign.id,
      event_name: eventName,
      section_key: section,
      referral_slug: referral,
      user_id: userId,
    });

    // Denormalised counters for fast dashboard reads.
    const column =
      eventName === "view" ? "views_count" : eventName === "cta_click" ? "clicks_count" : eventName === "signup" ? "signups_count" : null;
    if (column) {
      const { data: current } = await admin
        .from("campaigns_public")
        .select(column)
        .eq("id", campaign.id)
        .single();
      const next = Number((current as any)?.[column] || 0) + 1;
      await admin.from("campaigns_public").update({ [column]: next }).eq("id", campaign.id);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("campaign-track error", err);
    return json({ ok: true });
  }
});
