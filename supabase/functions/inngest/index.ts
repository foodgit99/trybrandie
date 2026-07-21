// Inngest serve endpoint. Hosts the durable worker that processes
// design.requested events by invoking design-studio in background mode.
import { Inngest } from "https://esm.sh/inngest@3";
import { serve } from "https://esm.sh/inngest@3/edge";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const inngest = new Inngest({ id: "brandie-design" });

const designWorker = inngest.createFunction(
  {
    id: "design-worker",
    name: "Design pipeline worker",
    // retries: 0 — heartbeat + stall-watchdog in design_jobs is now the authoritative
    // failure signal. Inngest retrying on top of that risked spawning a second isolate
    // for a job already running (double model spend, racing writers).
    retries: 0,
    // Widened from 5 → 15 so autopilot bursts (Blueprint approval fires many jobs at once)
    // don't head-of-line-block manual /post generations. Real parallelism is still capped
    // by Edge Runtime isolate quota; this just widens the Inngest gate.
    concurrency: { limit: 15 },
  },
  { event: "app/design.requested" },
  async ({ event, step }) => {
    const data = (event?.data ?? {}) as { job_id?: string; user_id?: string; body?: any };
    if (!data.job_id || !data.user_id || !data.body) {
      return { skipped: true, reason: "missing payload (likely Inngest sync/test invocation)" };
    }
    const { job_id, user_id, body } = data;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Idempotency pre-check: if the job is not 'queued' anymore, it's already been
    // dispatched (or finished). Do not fire a second isolate.
    const preCheck = await step.run("idempotency-check", async () => {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: row, error } = await admin
        .from("design_jobs")
        .select("status")
        .eq("id", job_id)
        .maybeSingle();
      if (error) throw new Error(`idempotency-check failed: ${error.message}`);
      return { status: row?.status ?? "missing" };
    });

    if (preCheck.status !== "queued") {
      return { job_id, skipped: true, reason: "already_dispatched", status: preCheck.status };
    }

    // Fire design-studio in background mode. The function ack's in <1s,
    // then writes the final result to design_jobs via EdgeRuntime.waitUntil.
    const ack = await step.run("dispatch-pipeline", async () => {
      const res = await fetch(`${supabaseUrl}/functions/v1/design-studio`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, job_id, user_id }),
      });
      const text = await res.text();
      // Treat 2xx AND 409 (idempotency reject from design-studio's compare-and-swap)
      // as terminal success — do not throw, do not retry.
      if (res.ok || res.status === 409) {
        return { status: res.status, body: text };
      }
      throw new Error(`design-studio dispatch failed [${res.status}]: ${text}`);
    });

    return { job_id, ack };
  },
);

const handler = serve({ client: inngest, functions: [designWorker] });

// Wrap to ensure CORS is permissive for Inngest sync (POST/PUT from dashboard).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      },
    });
  }
  return handler(req);
});

