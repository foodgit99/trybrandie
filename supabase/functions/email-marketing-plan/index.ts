// Weekly autonomous planner. For each brand with marketing_email_enabled,
// drafts 1-3 broadcasts for the upcoming week from existing content ideas
// or fresh AI ideation, tagged to funnel stage + campaign + segment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TIERS = new Set(["starter", "creator", "agency", "pro", "growth", "scale"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const targetBrandId: string | null = body?.brand_id || null;

    let q = supabase.from("autopilot_settings").select("brand_id,marketing_email_enabled").eq("marketing_email_enabled", true);
    if (targetBrandId) q = q.eq("brand_id", targetBrandId);
    const { data: settingsList } = await q;

    const results: any[] = [];
    for (const s of settingsList || []) {
      const { data: brand } = await supabase.from("brands").select("id,user_id,name").eq("id", s.brand_id).single();
      if (!brand) continue;
      const { data: profile } = await supabase.from("profiles").select("subscription_tier").eq("user_id", brand.user_id).single();
      if (!ALLOWED_TIERS.has((profile?.subscription_tier || "free").toLowerCase())) {
        results.push({ brand_id: brand.id, skipped: "subscription_required" });
        continue;
      }

      // Pull funnel stages + active campaigns to pick anchors
      const { data: stages } = await supabase.from("content_pillars").select("id,name").eq("brand_id", brand.id).limit(5);
      const { data: campaigns } = await supabase.from("campaigns").select("id,name").eq("brand_id", brand.id).limit(5);

      const weekStart = new Date();
      const dayOffsets = [1, 3, 5]; // Tue, Thu, Sat from now
      let created = 0;
      for (let i = 0; i < dayOffsets.length; i++) {
        const stage = stages?.[i % (stages?.length || 1)];
        const campaign = campaigns?.[i % (campaigns?.length || 1)];
        const scheduled = new Date(weekStart);
        scheduled.setDate(scheduled.getDate() + dayOffsets[i]);
        scheduled.setHours(10, 0, 0, 0);

        const { data: existing } = await supabase.from("email_broadcasts")
          .select("id").eq("brand_id", brand.id)
          .gte("scheduled_for", new Date(scheduled.getTime() - 12 * 3600_000).toISOString())
          .lte("scheduled_for", new Date(scheduled.getTime() + 12 * 3600_000).toISOString())
          .maybeSingle();
        if (existing) continue;

        const { data: broadcast } = await supabase.from("email_broadcasts").insert({
          brand_id: brand.id,
          user_id: brand.user_id,
          funnel_stage_id: stage?.id || null,
          campaign_id: campaign?.id || null,
          status: "draft",
          scheduled_for: scheduled.toISOString(),
          subject: `${brand.name} — ${stage?.name || "Update"}`,
        }).select("id").single();

        if (broadcast) {
          // Fire-and-forget generation
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/email-marketing-generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ broadcast_id: broadcast.id }),
          }).catch(() => {});
          created++;
        }
      }
      results.push({ brand_id: brand.id, planned: created });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-marketing-plan", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
