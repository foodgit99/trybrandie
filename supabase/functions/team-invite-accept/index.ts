import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const inviteToken = String(body?.token || "").trim();
    if (!inviteToken) return json({ error: "missing_token" }, 400);

    const { data: invite, error: invErr } = await admin
      .from("brand_team_members")
      .select("id, brand_id, email, role, status, invite_token")
      .eq("invite_token", inviteToken)
      .maybeSingle();

    if (invErr) return json({ error: "lookup_failed", detail: invErr.message }, 500);
    if (!invite) return json({ error: "not_found" }, 404);
    if (invite.status === "revoked") return json({ error: "revoked" }, 410);

    const inviteEmail = String(invite.email || "").toLowerCase().trim();
    const userEmail = String(user.email || "").toLowerCase().trim();
    if (inviteEmail && userEmail && inviteEmail !== userEmail) {
      return json(
        { error: "email_mismatch", invited_email: inviteEmail, signed_in_email: userEmail },
        409
      );
    }

    const { data: brand } = await admin
      .from("brands")
      .select("id, name")
      .eq("id", invite.brand_id)
      .maybeSingle();

    const { error: upErr } = await admin
      .from("brand_team_members")
      .update({
        user_id: user.id,
        status: "active",
        accepted_at: new Date().toISOString(),
        invite_token: null,
      })
      .eq("id", invite.id);

    if (upErr) return json({ error: "accept_failed", detail: upErr.message }, 500);

    return json({
      success: true,
      brand_id: invite.brand_id,
      brand_name: brand?.name || "Brand",
      role: invite.role,
    });
  } catch (err) {
    console.error("team-invite-accept error:", err);
    return json({ error: "server_error", detail: String((err as Error)?.message || err) }, 500);
  }
});
