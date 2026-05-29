// Inngest serve endpoint. Hosts the durable worker that processes
// design.requested events by invoking design-studio in background mode.
import { Inngest } from "https://esm.sh/inngest@3.40.0";
import { serve } from "https://esm.sh/inngest@3.40.0/deno";

const inngest = new Inngest({ id: "brandie-design" });

const designWorker = inngest.createFunction(
  {
    id: "design-worker",
    name: "Design pipeline worker",
    retries: 0, // Don't retry — design-studio handles credit deduction internally.
    concurrency: { limit: 12 },
  },
  { event: "app/design.requested" },
  async ({ event, step }) => {
    const { job_id, body } = event.data as { job_id: string; user_id: string; body: any };
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
        body: JSON.stringify({ ...body, job_id, user_id: event.data.user_id }),
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
