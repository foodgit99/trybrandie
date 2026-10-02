// Private Network — short-lived signed media URLs for feed/share.
// Publishers only receive URLs for approved, currently-eligible creatives.
// Brand owners/operators can preview their own creatives. Never exposes proofs or biodata.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f-]{36}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const ids: string[] = Array.isArray(body?.creative_ids) ? body.creative_ids.slice(0, 50) : [];
  const proofPlacement: string | undefined = body?.proof_placement_id;
  if (!ids.every((i) => typeof i === "string" && UUID.test(i))) return json({ error: "Bad ids" }, 400);

  const admin = createClient(url, service);
  const { data: enabled } = await admin.rpc("private_network_enabled");
  if (!enabled) return json({ error: "Private Network is switched off." }, 403);
  const { data: isOp } = await admin.rpc("private_network_has_role", { _uid: user.id, _role: null });

  // Operator proof viewing (moderation)
  if (proofPlacement) {
    if (!isOp || !UUID.test(proofPlacement)) return json({ error: "Forbidden" }, 403);
    const { data: pl } = await admin.from("private_network_placements").select("proof_path").eq("id", proofPlacement).maybeSingle();
    if (!pl?.proof_path) return json({ url: null });
    const { data: s } = await admin.storage.from("private-network-proofs").createSignedUrl(pl.proof_path, 300);
    return json({ url: s?.signedUrl ?? null });
  }

  const { data: pub } = await admin.from("private_network_publishers").select("id,status,is_test").eq("user_id", user.id).maybeSingle();
  const { data: creatives } = await admin
    .from("private_network_creatives")
    .select("id,status,media_type,media_source,storage_bucket,storage_path,public_media_url,campaign_id,private_network_campaigns(brand_id,status,is_test)")
    .in("id", ids);

  const out: Record<string, { url: string | null; media_type: string }> = {};
  for (const c of creatives ?? []) {
    const camp: any = (c as any).private_network_campaigns;
    let allowed = !!isOp;
    if (!allowed) {
      const { data: owner } = await admin.rpc("has_brand_access", { _brand_id: camp.brand_id, _user_id: user.id });
      allowed = !!owner;
    }
    if (!allowed && pub?.status === "approved" && c.status === "approved" && camp.status === "active" && camp.is_test === pub.is_test) {
      const { data: reasons } = await admin.rpc("private_network_creative_eligibility", { _creative: c.id, _platform: null });
      allowed = Array.isArray(reasons) && reasons.length === 0;
    }
    if (!allowed) continue;
    let signed: string | null = c.public_media_url;
    if (c.storage_bucket && c.storage_path) {
      const { data: s } = await admin.storage.from(c.storage_bucket).createSignedUrl(c.storage_path, 900);
      signed = s?.signedUrl ?? null;
    }
    out[c.id] = { url: signed, media_type: c.media_type };
  }
  return json({ media: out });
});
