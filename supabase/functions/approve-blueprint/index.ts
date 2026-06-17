// Approve Blueprint — flips a weekly_blueprints row to status='approved'.
// Called from the Monday Briefing email CTA (and eventually the /blueprint UI).
// Idempotent: re-approving an already-approved blueprint is a no-op.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let blueprintId: string | null = null;
  try {
    const body = await req.json();
    blueprintId = typeof body?.blueprint_id === "string" ? body.blueprint_id : null;
  } catch (_) {
    return json({ error: "invalid_body" }, 400);
  }
  if (!blueprintId) return json({ error: "blueprint_id_required" }, 400);

  // Resolve caller from JWT (so we can scope ownership without trusting the body).
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResp } = await userClient.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return json({ error: "unauthorized" }, 401);

  const service = createClient(supabaseUrl, serviceKey);

  // Verify the caller owns (or is a team member of) the blueprint's brand.
  const { data: bp } = await service
    .from("weekly_blueprints")
    .select("id, brand_id, status")
    .eq("id", blueprintId)
    .maybeSingle();
  if (!bp) return json({ error: "not_found" }, 404);

  const { data: brand } = await service
    .from("brands")
    .select("user_id")
    .eq("id", bp.brand_id)
    .maybeSingle();
  let allowed = brand?.user_id === userId;
  if (!allowed) {
    const { data: member } = await service
      .from("brand_team_members")
      .select("id")
      .eq("brand_id", bp.brand_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    allowed = !!member;
  }
  if (!allowed) return json({ error: "forbidden" }, 403);

  if (bp.status === "approved") {
    return json({ ok: true, blueprint_id: bp.id, status: "approved", already: true });
  }

  const { error: updErr } = await service
    .from("weekly_blueprints")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", blueprintId);
  if (updErr) return json({ error: updErr.message }, 500);

  return json({ ok: true, blueprint_id: blueprintId, status: "approved" });
});

function json(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
