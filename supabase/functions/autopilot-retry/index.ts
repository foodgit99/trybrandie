// Autopilot Retry — daily job.
// Re-queues all `failed_error` ideas back to `pending` so the next autopilot
// delivery cycle picks them up. Skips `failed_no_credits` (those need a top-up).
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

  console.log("[autopilot-retry] starting daily retry sweep");

  try {
    const { data: failed, error } = await supabase
      .from("content_ideas")
      .select("id, brand_id")
      .eq("autopilot_status", "failed_error");

    if (error) throw error;
    if (!failed || failed.length === 0) {
      return jsonResponse({ requeued: 0 });
    }

    const ids = failed.map((f: any) => f.id);
    const { error: updateErr } = await supabase
      .from("content_ideas")
      .update({ autopilot_status: "pending" } as any)
      .in("id", ids);

    if (updateErr) throw updateErr;

    console.log(`[autopilot-retry] requeued ${ids.length} idea(s)`);
    return jsonResponse({ requeued: ids.length });
  } catch (e) {
    console.error("[autopilot-retry] fatal:", e);
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
