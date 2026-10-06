// Private Network — trusted qualified-action / conversion ingest.
// Contract (docs/private-network-v1-implementation-report.md):
//   POST { "pn_ref": "pn…", "event_type": "qualified_action"|"conversion",
//          "external_event_id": "<your unique id>", "amount_ngn"?: number, "actor_user_id"?: uuid }
//   Auth, one of:
//     X-PN-Integration-Key: <server-to-server key issued by a PN admin>   -> trusted, earns immediately
//     Authorization: Bearer <PN operator JWT>                              -> trusted
//     Authorization: Bearer <brand owner/team JWT>                         -> recorded as pending_reconciliation;
//                                                                            earns only after finance reconciles it.
// A browser JWT therefore can never create a paid conversion amount on its own. External ids are idempotent.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pn-integration-key" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = req.headers.get("x-pn-integration-key");
  const auth = req.headers.get("Authorization");
  let callerId: string | null = null;
  let keyHash: string | null = null;
  if (key) {
    if (!/^pnk_[0-9a-f]{64}$/.test(key)) return json({ error: "Unauthorized" }, 401);
    keyHash = await sha256Hex(key);
  } else {
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    callerId = user.id;
  }

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const ref = String(b?.pn_ref ?? "");
  const type = String(b?.event_type ?? "");
  const ext = String(b?.external_event_id ?? "");
  const amount = b?.amount_ngn == null ? null : Number(b.amount_ngn);
  const actor = b?.actor_user_id ? String(b.actor_user_id) : null;
  if (!/^pn[0-9a-f]{32}$/.test(ref)) return json({ error: "pn_ref invalid" }, 400);
  if (!["qualified_action", "conversion"].includes(type)) return json({ error: "event_type invalid" }, 400);
  if (!ext || ext.length > 200) return json({ error: "external_event_id required" }, 400);
  if (amount != null && (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000)) return json({ error: "amount invalid" }, 400);
  if (actor && !/^[0-9a-f-]{36}$/i.test(actor)) return json({ error: "actor_user_id invalid" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.rpc("private_network_ingest_event", {
    _caller: callerId, _key_hash: keyHash, _token: ref, _type: type, _external_id: ext, _amount: amount, _actor: actor,
  });
  if (error) {
    const m = error.message.replace(/^.*PN:\s*/, "");
    const status = /Rate limit/.test(m) ? 429 : /cannot report|switched off/.test(m) ? 403 : 400;
    return json({ error: m }, status);
  }
  return json(data);
});
