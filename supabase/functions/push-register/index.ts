import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const fcmToken = String(body?.token || "");
    const platform = body?.platform ? String(body.platform).slice(0, 64) : null;
    const userAgent = body?.user_agent ? String(body.user_agent).slice(0, 512) : null;

    if (!fcmToken || fcmToken.length < 20) {
      return json({ error: "Invalid token" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert by token; ensures the token always belongs to the latest user that registered it.
    const { error: upsertErr } = await admin
      .from("push_subscriptions")
      .upsert(
        { user_id: userId, token: fcmToken, platform, user_agent: userAgent, last_seen_at: new Date().toISOString() },
        { onConflict: "token" },
      );

    if (upsertErr) {
      console.error("[push-register] upsert error:", upsertErr);
      return json({ error: upsertErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("[push-register] fatal:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
