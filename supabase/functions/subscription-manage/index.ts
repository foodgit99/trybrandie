// Cancel / reactivate the current user's subscription.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: userRes } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    const userId = userRes?.user?.id;
    if (!userId) return j({ error: "Unauthorized" }, 401);

    const { action } = await req.json();
    if (!["cancel", "reactivate"].includes(action)) return j({ error: "Bad action" }, 400);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub) return j({ error: "No subscription" }, 404);

    if (action === "cancel") {
      await supabase
        .from("subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("id", sub.id);
      return j({ ok: true, cancel_at_period_end: true });
    } else {
      await supabase
        .from("subscriptions")
        .update({ cancel_at_period_end: false })
        .eq("id", sub.id);
      return j({ ok: true, cancel_at_period_end: false });
    }
  } catch (err) {
    return j({ error: (err as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
