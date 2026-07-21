// design-dispatch — Supabase-native replacement for Inngest.
// Two entrypoints:
//   1. Webhook mode: called by the AFTER INSERT trigger on design_jobs with { job_id }.
//   2. Sweep mode: called by pg_cron every ~5s with { mode: "sweep" } to pick up
//      any queued rows the webhook missed.
// Both paths converge on dispatch(): a fire-and-forget POST to design-studio.
// design-studio's own compare-and-swap prevents double-dispatch (returns 409).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONCURRENCY_CAP = 15;
const SWEEP_BATCH = 20;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(supabaseUrl, serviceRoleKey);
}

async function runningCount(): Promise<number> {
  const { count } = await admin()
    .from("design_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "running");
  return count ?? 0;
}

// Fire-and-forget POST to design-studio. design-studio's own CAS makes this
// idempotent — duplicate dispatches return 409 without spawning a second pipeline.
function dispatchJob(job: { id: string; user_id: string; input: any }) {
  const url = `${supabaseUrl}/functions/v1/design-studio`;
  const body = JSON.stringify({ ...(job.input || {}), job_id: job.id, user_id: job.user_id });
  // Do NOT await — design-studio ack's fast and runs the pipeline via
  // EdgeRuntime.waitUntil. We just need the request to leave.
  fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body,
  }).catch((e) => {
    console.error(`[design-dispatch] fetch failed for job=${job.id}:`, e?.message || e);
  });
}

async function fetchJob(jobId: string) {
  const { data, error } = await admin()
    .from("design_jobs")
    .select("id, user_id, status, input")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function sweep(): Promise<{ dispatched: number; skipped_cap: boolean }> {
  const running = await runningCount();
  if (running >= CONCURRENCY_CAP) {
    return { dispatched: 0, skipped_cap: true };
  }
  const slots = Math.min(SWEEP_BATCH, CONCURRENCY_CAP - running);

  const { data: rows, error } = await admin()
    .from("design_jobs")
    .select("id, user_id, input")
    .eq("status", "queued")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(slots);

  if (error) {
    console.error("[design-dispatch] sweep select error:", error.message);
    return { dispatched: 0, skipped_cap: false };
  }
  if (!rows || rows.length === 0) return { dispatched: 0, skipped_cap: false };

  for (const row of rows) {
    dispatchJob(row as any);
  }
  return { dispatched: rows.length, skipped_cap: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));

    // Sweep mode (pg_cron)
    if (body?.mode === "sweep") {
      const result = await sweep();
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Webhook mode — accept either { job_id } (from trigger) or { record } (from
    // Supabase DB webhook payload shape).
    const jobId: string | undefined = body?.job_id || body?.record?.id;
    if (!jobId) {
      return new Response(JSON.stringify({ error: "missing job_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const job = await fetchJob(jobId);
    if (!job) {
      return new Response(JSON.stringify({ ok: true, skipped: "not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (job.status !== "queued") {
      return new Response(JSON.stringify({ ok: true, skipped: job.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Respect the concurrency cap; if full, leave it queued for the next sweep.
    const running = await runningCount();
    if (running >= CONCURRENCY_CAP) {
      return new Response(JSON.stringify({ ok: true, deferred: "concurrency_cap" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    dispatchJob(job as any);
    return new Response(JSON.stringify({ ok: true, dispatched: jobId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[design-dispatch] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
