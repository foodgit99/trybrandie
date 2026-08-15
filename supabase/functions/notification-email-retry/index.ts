import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceKey);

  let sent = 0;
  let requeued = 0;
  let dropped = 0;

  let force = false;
  try {
    const body = await req.json();
    force = !!body?.force;
  } catch (_e) {
    // no body
  }

  try {
    let query = client
      .from("notification_email_outbox")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20);
    if (!force) query = query.lte("next_attempt_at", new Date().toISOString());
    const { data: rows, error } = await query;
    if (error) throw error;

    for (const row of rows || []) {
      const attempts = (row.attempts || 0) + 1;
      let ok = false;
      let errText = "unknown_error";
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            type: row.email_type,
            to: row.to_email,
            data: row.payload || {},
            no_queue: true,
          }),
        });
        const text = await res.text();
        ok = res.ok;
        if (!ok) errText = `${res.status}: ${text.slice(0, 400)}`;
      } catch (err) {
        errText = String(err);
      }

      if (ok) {
        await client
          .from("notification_email_outbox")
          .update({ status: "sent", attempts, sent_at: new Date().toISOString(), last_error: null })
          .eq("id", row.id);
        sent++;
      } else if (attempts >= MAX_ATTEMPTS) {
        await client
          .from("notification_email_outbox")
          .update({ status: "failed", attempts, last_error: errText })
          .eq("id", row.id);
        dropped++;
        console.error(`Giving up on ${row.email_type} -> ${row.to_email}: ${errText}`);
      } else {
        // Quota errors reset daily — back off in growing steps, capped at 2h
        const delayMin = Math.min(120, 15 * attempts);
        await client
          .from("notification_email_outbox")
          .update({
            attempts,
            last_error: errText,
            next_attempt_at: new Date(Date.now() + delayMin * 60 * 1000).toISOString(),
          })
          .eq("id", row.id);
        requeued++;
        console.log(`Requeued ${row.email_type} -> ${row.to_email} in ${delayMin}m (${errText})`);
      }
    }

    return new Response(JSON.stringify({ sent, requeued, dropped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notification-email-retry error:", String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
