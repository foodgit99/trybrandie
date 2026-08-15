// Public one-click unsubscribe for Marketing Partner emails.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const page = (title: string, message: string) =>
  new Response(
    `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#FAF8F5;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="max-width:420px;background:#fff;border-radius:20px;padding:40px;text-align:center">
<h1 style="margin:0 0 12px;font-size:24px;color:#2B2D33">${title}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#6B6862">${message}</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const partnerId = url.searchParams.get("p");
  const email = url.searchParams.get("e");

  if (!partnerId || !email) return page("Link not valid", "This unsubscribe link is incomplete.");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await admin
    .from("partner_email_suppression")
    .upsert(
      { partner_id: partnerId, email: email.toLowerCase(), reason: "user_unsubscribed" },
      { onConflict: "partner_id,email" }
    );

  if (error) return page("Something went wrong", "We could not process that just now. Please try again later.");

  return page("You are unsubscribed", `${email} will no longer receive emails from this Brandie partner.`);
});
