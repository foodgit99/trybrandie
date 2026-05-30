// Inngest serve endpoint. Hosts the durable worker that processes
// design.requested events by invoking design-studio in background mode.
import { Inngest } from "https://esm.sh/inngest@3";
import { serve } from "https://esm.sh/inngest@3/edge";

const inngest = new Inngest({ id: "brandie-design" });

const designWorker = inngest.createFunction(
  {
    id: "design-worker",
    name: "Design pipeline worker",
    // M7: 2 retries with Inngest's default exponential backoff. Safe because the dispatch
    // step is the gateway call only; credit deduction happens INSIDE design-studio after
    // a successful render, so a retried dispatch will not double-charge a user.
    retries: 2,
    concurrency: { limit: 5 },
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
      if (!res.ok) {
        throw new Error(`design-studio dispatch failed [${res.status}]: ${text}`);
      }
      return { status: res.status, body: text };
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
