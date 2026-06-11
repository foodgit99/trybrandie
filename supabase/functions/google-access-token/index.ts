import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function requireAdmin(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 };
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return { error: "Unauthorized", status: 401 };
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: role } = await admin
    .from("user_roles").select("role")
    .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
  if (!role) return { error: "Admin only", status: 403 };
  return { admin, user: userData.user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { admin } = auth;

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    // ---- STATUS ----
    if (!action || action === "status") {
      const { data, error } = await admin
        .from("google_oauth_tokens")
        .select("google_email, scopes, expires_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ connected: !!data, token: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- REVEAL refresh_token ----
    if (action === "reveal") {
      const { data, error } = await admin
        .from("google_oauth_tokens")
        .select("google_email, refresh_token, access_token, expires_at, scopes")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Not connected" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- REFRESH access_token (and return it) ----
    if (action === "refresh") {
      const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: "Server missing oauth config" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: row, error } = await admin
        .from("google_oauth_tokens")
        .select("id, refresh_token")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!row) {
        return new Response(JSON.stringify({ error: "Not connected" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: row.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const j = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("[google-access-token] refresh failed", j);
        return new Response(JSON.stringify({ error: j?.error || "refresh_failed", details: j }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expiresAt = new Date(Date.now() + (j.expires_in - 30) * 1000).toISOString();
      await admin
        .from("google_oauth_tokens")
        .update({ access_token: j.access_token, expires_at: expiresAt })
        .eq("id", row.id);
      return new Response(JSON.stringify({
        access_token: j.access_token,
        expires_at: expiresAt,
        scope: j.scope,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- DISCONNECT (revoke + delete) ----
    if (action === "disconnect") {
      const { data: row } = await admin
        .from("google_oauth_tokens")
        .select("id, refresh_token")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row?.refresh_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).catch((e) => console.error("[google-access-token] revoke failed", e));
      }
      await admin.from("google_oauth_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[google-access-token]", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
