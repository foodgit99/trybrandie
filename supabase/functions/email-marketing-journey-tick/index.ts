// Runs every few minutes. Advances active journey enrollments whose
// next_run_at is due: renders the current step into a one-off broadcast
// and dispatches via email-marketing-send.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: due } = await supabase
      .from("marketing_journey_enrollments")
      .select("id,journey_id,contact_id,brand_id,current_step")
      .eq("status", "active")
      .lte("next_run_at", new Date().toISOString())
      .limit(50);

    const processed: any[] = [];
    for (const e of due || []) {
      const { data: step } = await supabase.from("marketing_journey_steps")
        .select("*").eq("journey_id", e.journey_id).eq("step_order", e.current_step).maybeSingle();
      if (!step) {
        await supabase.from("marketing_journey_enrollments").update({ status: "completed" }).eq("id", e.id);
        continue;
      }

      const { data: contact } = await supabase.from("marketing_contacts")
        .select("email,status").eq("id", e.contact_id).single();
      if (!contact || contact.status !== "subscribed") {
        await supabase.from("marketing_journey_enrollments").update({ status: "cancelled" }).eq("id", e.id);
        continue;
      }

      // Create a single-recipient broadcast
      const { data: broadcast } = await supabase.from("email_broadcasts").insert({
        brand_id: e.brand_id,
        subject: step.subject,
        preheader: step.preheader,
        body_md: step.body_md,
        cta_label: step.cta_label,
        cta_url: step.cta_url,
        status: "approved",
        metadata: { journey_id: e.journey_id, enrollment_id: e.id, step_order: e.current_step },
      }).select("id").single();

      if (broadcast) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/email-marketing-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ broadcast_id: broadcast.id, test_recipient: contact.email }),
        }).catch(() => {});
      }

      // Advance
      const { data: next } = await supabase.from("marketing_journey_steps")
        .select("wait_minutes").eq("journey_id", e.journey_id).eq("step_order", e.current_step + 1).maybeSingle();
      if (next) {
        const wait = next.wait_minutes || 0;
        await supabase.from("marketing_journey_enrollments").update({
          current_step: e.current_step + 1,
          next_run_at: new Date(Date.now() + wait * 60000).toISOString(),
        }).eq("id", e.id);
      } else {
        await supabase.from("marketing_journey_enrollments").update({ status: "completed" }).eq("id", e.id);
      }
      processed.push(e.id);
    }

    return new Response(JSON.stringify({ ok: true, processed: processed.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("journey-tick", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
