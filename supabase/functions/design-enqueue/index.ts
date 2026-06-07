// Enqueues a design generation job. Returns immediately with a job_id.
// The actual work runs via Inngest -> design-studio (background mode).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INNGEST_GATEWAY = "https://connector-gateway.lovable.dev/inngest";

async function sendInngestEvent(name: string, data: Record<string, unknown>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const INNGEST_API_KEY = Deno.env.get("INNGEST_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!INNGEST_API_KEY) throw new Error("INNGEST_API_KEY is not configured");

  const res = await fetch(`${INNGEST_GATEWAY}/e/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": INNGEST_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, data }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Inngest event failed [${res.status}]: ${txt}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body?.action;
    if (!action || !["generate", "edit", "generate_carousel", "chat"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid or missing action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chat is fast — call design-studio synchronously and proxy the response.
    if (action === "chat") {
      const upstream = await fetch(`${supabaseUrl}/functions/v1/design-studio`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const kind = action === "generate_carousel" ? "carousel" : "single";

    // Priority rendering: Agency tier (and any plan with priority_render_until in future)
    // gets elevated job priority. Higher number = higher priority.
    let priority = 0;
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("priority_render_until")
        .eq("user_id", user.id)
        .maybeSingle();
      const until = (prof as any)?.priority_render_until;
      if (until && new Date(until).getTime() > Date.now()) {
        priority = 10;
      }
    } catch {
      // best-effort — default to 0
    }

    const { data: job, error: insertErr } = await admin
      .from("design_jobs")
      .insert({
        user_id: user.id,
        brand_id: body?.brand?.id || null,
        kind,
        status: "queued",
        progress: 0,
        stage: "queued",
        priority,
        input: body,
      })
      .select("id")
      .single();

    if (insertErr || !job) {
      return new Response(JSON.stringify({ error: insertErr?.message || "Failed to create job" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send Inngest event — worker will invoke design-studio with job_id.
    try {
      await sendInngestEvent("app/design.requested", {
        job_id: job.id,
        user_id: user.id,
        priority,
        body,
      });
    } catch (e) {
      // Mark job failed so the client doesn't spin forever.
      await admin.from("design_jobs").update({
        status: "failed",
        error: { message: e instanceof Error ? e.message : "Failed to enqueue" },
        finished_at: new Date().toISOString(),
      }).eq("id", job.id);
      return new Response(JSON.stringify({ error: "Failed to enqueue job" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ job_id: job.id, status: "queued" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("design-enqueue error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
