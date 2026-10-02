// Private Network — public attributable redirect.
// GET ?t=<opaque token>. Destination always comes from the stored, allow-listed
// campaign landing URL — never from the request — so it cannot be an open redirect.
// Clicks are deduplicated per placement+hashed IP per 24h and rate limited. Clicks never earn.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const unavailable = (reason: string) =>
  new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Link unavailable</title></head>` +
      `<body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem;text-align:center"><h1 style="font-size:1.25rem">This link is no longer available</h1>` +
      `<p style="color:#555">The campaign may have ended or been paused.</p><!-- ${reason} --></body></html>`,
    { status: 410, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
  );

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^pn[0-9a-f]{32}$/.test(token)) return unavailable("invalid");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const salt = new Date().toISOString().slice(0, 10); // daily-rotating salt: no raw IP stored
  const ipHash = await sha(`${salt}:${ip}`);
  const uaHash = await sha(req.headers.get("user-agent") ?? "");
  const { data, error } = await admin.rpc("private_network_resolve_redirect", { _token: token, _ip_hash: ipHash, _ua_hash: uaHash });
  if (error || !data?.ok || typeof data.url !== "string" || !data.url.startsWith("https://")) return unavailable(data?.reason ?? "error");
  return new Response(null, { status: 302, headers: { Location: data.url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
});
