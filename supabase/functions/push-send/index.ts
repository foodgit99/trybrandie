import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache the OAuth access token in-memory for cold-start reuse.
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.user_id || "");
    const title = String(body?.title || "Brandie");
    const message = String(body?.body || "");
    const url = body?.url ? String(body.url) : "/";
    const tag = body?.tag ? String(body.tag) : undefined;
    const data = body?.data && typeof body.data === "object" ? body.data : {};

    if (!userId) return json({ error: "user_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("token")
      .eq("user_id", userId);

    if (subsErr) return json({ error: subsErr.message }, 500);
    if (!subs || subs.length === 0) return json({ ok: true, sent: 0, reason: "no_subscriptions" });

    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountRaw) return json({ error: "FIREBASE_SERVICE_ACCOUNT_JSON not set" }, 500);
    const serviceAccount = JSON.parse(serviceAccountRaw);
    const projectId = serviceAccount.project_id;
    if (!projectId) return json({ error: "service account missing project_id" }, 500);

    const accessToken = await getAccessToken(serviceAccount);

    let sent = 0;
    let pruned = 0;
    const errors: string[] = [];

    for (const sub of subs) {
      const fcmRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: sub.token,
              notification: { title, body: message },
              data: {
                url,
                ...(tag ? { tag } : {}),
                ...Object.fromEntries(
                  Object.entries(data).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]),
                ),
              },
              webpush: {
                fcm_options: { link: url },
                notification: { icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", ...(tag ? { tag } : {}) },
              },
            },
          }),
        },
      );

      if (fcmRes.ok) {
        sent++;
        continue;
      }

      const errText = await fcmRes.text();
      console.warn(`[push-send] fcm ${fcmRes.status} for token=${sub.token.slice(0, 12)}…: ${errText}`);

      // Prune stale tokens.
      if (
        fcmRes.status === 404 ||
        errText.includes("UNREGISTERED") ||
        errText.includes("INVALID_ARGUMENT") ||
        fcmRes.status === 403
      ) {
        await admin.from("push_subscriptions").delete().eq("token", sub.token);
        pruned++;
      } else {
        errors.push(`${fcmRes.status}: ${errText.slice(0, 200)}`);
      }
    }

    return json({ ok: true, sent, pruned, total: subs.length, errors: errors.slice(0, 5) });
  } catch (e) {
    console.error("[push-send] fatal:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Google OAuth (service account → access token) ────────────

async function getAccessToken(sa: any): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = `${enc(header)}.${enc(claim)}`;

  const keyData = pemToArrayBuffer(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(new Uint8Array(sigBuf))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    throw new Error(`OAuth token exchange failed ${tokenRes.status}: ${t}`);
  }
  const tok = await tokenRes.json();
  cachedAccessToken = {
    token: tok.access_token as string,
    expiresAt: Date.now() + (tok.expires_in as number) * 1000,
  };
  return cachedAccessToken.token;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
