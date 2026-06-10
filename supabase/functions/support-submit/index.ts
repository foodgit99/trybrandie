import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  category: z.enum(["bug", "billing", "feature_request", "account", "other"]),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(20).max(2000),
  context: z.object({
    route: z.string().max(200).optional(),
    brand_id: z.string().uuid().optional().nullable(),
    brand_name: z.string().max(120).optional().nullable(),
    plan: z.string().max(60).optional().nullable(),
    user_agent: z.string().max(500).optional(),
    viewport: z.string().max(40).optional(),
  }).partial().optional(),
});

function genTicketNumber(): string {
  // BRD-XXXXX (5 base36 chars)
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BRD-${rand}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  billing: "Billing",
  feature_request: "Feature request",
  account: "Account",
  other: "Other",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { category, subject, message, context } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    // Get display name from profile
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const fullName = (profile as { full_name?: string } | null)?.full_name || "";

    // Insert ticket (retry on rare ticket_number collision)
    let ticketNumber = genTicketNumber();
    let inserted: { id: string; ticket_number: string } | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await admin
        .from("support_tickets")
        .insert({
          ticket_number: ticketNumber,
          user_id: user.id,
          email: user.email,
          category,
          subject,
          message,
          context: context || {},
        })
        .select("id, ticket_number")
        .single();
      if (!error && data) { inserted = data as { id: string; ticket_number: string }; break; }
      lastError = error;
      if (String(error?.code) === "23505") { ticketNumber = genTicketNumber(); continue; }
      break;
    }
    if (!inserted) {
      console.error("[support-submit] insert failed", lastError);
      return new Response(JSON.stringify({ error: "Could not save ticket" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoryLabel = CATEGORY_LABELS[category] || category;

    // Fire-and-forget both emails
    const sendEmail = (body: unknown) =>
      fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify(body),
      }).catch((e) => console.error("[support-submit] email failed", e));

    await Promise.all([
      sendEmail({
        type: "support_confirmation",
        to: user.email,
        data: {
          ticket_number: inserted.ticket_number,
          subject, message, category: categoryLabel,
          name: fullName.split(" ")[0] || "",
        },
      }),
      sendEmail({
        type: "support_new_ticket",
        to: "__admins__",
        data: {
          ticket_number: inserted.ticket_number,
          subject, message, category: categoryLabel,
          email: user.email, name: fullName,
          context: context || {},
        },
      }),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: inserted.id,
        ticket_number: inserted.ticket_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[support-submit] error", err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
