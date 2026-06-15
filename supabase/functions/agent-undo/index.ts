// Reverse a previously-executed reversible agent action.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REVERSIBLE_TABLES = new Set(["campaigns", "content_pillars", "post_series", "content_ideas"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return j(401, { error: "Unauthorized" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
  });

  const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
  const userId = claims?.claims?.sub;
  if (!userId) return j(401, { error: "Unauthorized" });

  const { action_id } = await req.json();
  if (!action_id) return j(400, { error: "Missing action_id" });

  const { data: action, error } = await userClient
    .from("agent_actions").select("*").eq("id", action_id).eq("user_id", userId).maybeSingle();
  if (error || !action) return j(404, { error: "Action not found" });
  if (!action.is_reversible) return j(400, { error: "This action cannot be undone." });
  if (action.status === "reversed") return j(400, { error: "Already reversed." });

  const payload = action.reverse_payload as any;
  if (!payload?.table || !REVERSIBLE_TABLES.has(payload.table)) {
    return j(400, { error: "Reverse target not allowed" });
  }

  try {
    if (payload.prev) {
      // Restore prior values.
      const { error: upErr } = await userClient
        .from(payload.table).update(payload.prev).eq("id", payload.row_id);
      if (upErr) throw upErr;
    } else {
      // Delete the row we created.
      const { error: delErr } = await userClient
        .from(payload.table).delete().eq("id", payload.row_id);
      if (delErr) throw delErr;
    }
    await userClient.from("agent_actions").update({ status: "reversed" }).eq("id", action_id);
    return j(200, { ok: true });
  } catch (e: any) {
    return j(500, { error: e?.message ?? "Undo failed" });
  }
});

function j(status: number, body: any) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
