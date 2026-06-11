import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const ownerEmail = (Deno.env.get("GOOGLE_OWNER_EMAIL") || "").toLowerCase();
  const fallbackOrigin = "https://trybrandie.com";
  const errTarget = (origin: string, msg: string) =>
    `${origin}/admin/google-connect?status=error&message=${encodeURIComponent(msg)}`;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) return redirect(errTarget(fallbackOrigin, errorParam));
    if (!code || !stateRaw) return redirect(errTarget(fallbackOrigin, "missing_code_or_state"));
    if (!clientId || !clientSecret) {
      return redirect(errTarget(fallbackOrigin, "server_missing_oauth_config"));
    }

    // state = nonce.base64(origin)
    const [nonce, encodedOrigin] = stateRaw.split(".");
    let origin = fallbackOrigin;
    try { if (encodedOrigin) origin = atob(encodedOrigin); } catch { /* ignore */ }

    const admin = createClient(supabaseUrl, serviceKey);

    // Validate + consume state
    const { data: stateRow, error: stateErr } = await admin
      .from("google_oauth_states")
      .select("user_id, created_at")
      .eq("state", nonce)
      .maybeSingle();
    if (stateErr || !stateRow) return redirect(errTarget(origin, "invalid_state"));
    await admin.from("google_oauth_states").delete().eq("state", nonce);

    // Expire after 15 min
    if (Date.now() - new Date(stateRow.created_at).getTime() > 15 * 60 * 1000) {
      return redirect(errTarget(origin, "state_expired"));
    }

    // Exchange code for tokens
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("[google-oauth-callback] token exchange failed", tokenJson);
      return redirect(errTarget(origin, tokenJson?.error || "token_exchange_failed"));
    }

    const {
      access_token, refresh_token, expires_in, scope, id_token,
    } = tokenJson as {
      access_token: string; refresh_token?: string; expires_in: number;
      scope: string; id_token?: string;
    };

    if (!refresh_token) {
      // Google only returns refresh_token on first consent; if user has previously
      // granted, they must revoke and reconnect. prompt=consent should force it.
      return redirect(errTarget(origin, "no_refresh_token_returned"));
    }

    const payload = id_token ? decodeJwtPayload(id_token) : null;
    const googleEmail = String(payload?.email || "").toLowerCase();
    if (!googleEmail) return redirect(errTarget(origin, "no_email_in_id_token"));
    if (ownerEmail && googleEmail !== ownerEmail) {
      return redirect(errTarget(origin, `not_owner_account_${googleEmail}`));
    }

    const expiresAt = new Date(Date.now() + (expires_in - 30) * 1000).toISOString();
    const scopes = (scope || "").split(" ").filter(Boolean);

    const { error: upsertErr } = await admin
      .from("google_oauth_tokens")
      .upsert({
        user_id: stateRow.user_id,
        google_email: googleEmail,
        refresh_token,
        access_token,
        expires_at: expiresAt,
        scopes,
      }, { onConflict: "google_email" });

    if (upsertErr) {
      console.error("[google-oauth-callback] upsert failed", upsertErr);
      return redirect(errTarget(origin, "store_failed"));
    }

    return redirect(`${origin}/admin/google-connect?status=ok&email=${encodeURIComponent(googleEmail)}`);
  } catch (err) {
    console.error("[google-oauth-callback]", err);
    return redirect(errTarget(fallbackOrigin, "server_error"));
  }
});
