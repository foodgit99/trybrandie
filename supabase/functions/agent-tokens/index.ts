// Issue / list / revoke API tokens for the external strategist-agent webhook.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return j(401, { error: "Unauthorized" });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
  const userId = claims?.claims?.sub;
  if (!userId) return j(401, { error: "Unauthorized" });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "create";

  if (req.method === "POST" && action === "create") {
    const { label } = await req.json().catch(() => ({}));
    const raw = `bag_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
    const token_hash = await sha256(raw);
    const token_prefix = raw.slice(0, 12);
    const { data, error } = await sb.from("agent_api_tokens").insert({
      user_id: userId,
      label: label || "API Token",
      token_hash, token_prefix,
    }).select("id,label,token_prefix,created_at").single();
    if (error) return j(500, { error: error.message });
    return j(200, { ok: true, token: raw, record: data });
  }

  if (req.method === "POST" && action === "revoke") {
    const { token_id } = await req.json();
    if (!token_id) return j(400, { error: "Missing token_id" });
    await sb.from("agent_api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", token_id).eq("user_id", userId);
    return j(200, { ok: true });
  }

  if (req.method === "GET") {
    const { data } = await sb.from("agent_api_tokens")
      .select("id,label,token_prefix,created_at,last_used_at,revoked_at")
      .eq("user_id", userId).order("created_at", { ascending: false });
    return j(200, { tokens: data ?? [] });
  }

  return j(400, { error: "Unknown action" });
});

function j(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
