// Handles email alias verification.
// POST /email-alias-verify { action: "request", brand_id, alias_id, handle, reply_to, from_name }
// POST /email-alias-verify { action: "verify", token }
// Both endpoints are public because the first is invoked by a logged-in user and the second is hit from a verification link.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slug(n = 32) {
  return crypto.getRandomValues(new Uint8Array(n))
    .reduce((s, b) => s + (b % 36).toString(36), "");
}

const APP_URL = Deno.env.get("APP_URL") || "https://trybrandie.com";
const domain = Deno.env.get("MARKETING_EMAIL_DOMAIN") || "trybrandie.com";
const resendKey = Deno.env.get("RESEND_API_KEY") || "";


function verifyEmailHtml(brandName: string, handle: string, verifyUrl: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:24px;margin:0;font-weight:700;">Confirm your reply-to address</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">Hi there,</p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      <strong>${brandName}</strong> wants to use <code>${handle}</code> as a sending address on Brandie, and replies are set to come to this email address.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">Click the button below to confirm you own this address and can receive replies there.</p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${verifyUrl}" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">Confirm reply-to address</a>
    </td></tr></table>
    <p style="font-size:13px;color:#6b7280;margin:24px 0 0 0;">If you did not request this, you can ignore this email.</p>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">Brandie — sending identities for your brand.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

    const domain = Deno.env.get("MARKETING_EMAIL_DOMAIN") || "trybrandie.com";
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "request") {
      const authHeader = req.headers.get("Authorization");
      const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!accessToken) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: userData, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !userData?.user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const requestingUserId = userData.user.id;
      const { alias_id, handle, reply_to, from_name } = body;
      if (!alias_id || !handle || !reply_to) {
        return new Response(JSON.stringify({ error: "alias_id, handle, and reply_to are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply_to)) {
        return new Response(JSON.stringify({ error: "invalid_reply_to" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure the user owns the alias row before sending verification
      const { data: aliasRow } = await supabase.from("email_sender_aliases")
        .select("user_id, brand_id")
        .eq("id", alias_id)
        .single();
      if (!aliasRow || aliasRow.user_id !== requestingUserId) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = slug(32);
      await supabase.from("email_sender_aliases")
        .update({ reply_to_token: token, reply_to_verified_at: null, updated_at: new Date().toISOString() })
        .eq("id", alias_id);

      const verifyUrl = `${APP_URL}/verify-alias?token=${token}`;
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `Brandie <noreply@${domain}>`,
          to: [reply_to],
          subject: "Confirm your Brandie reply-to address",
          html: verifyEmailHtml(from_name || "Your brand", `${handle}@${domain}`, verifyUrl),
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return new Response(JSON.stringify({ error: "failed_to_send_verification", details: err }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "verify") {
      const { token } = body;
      if (!token) {
        return new Response(JSON.stringify({ error: "token required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase.from("email_sender_aliases")
        .select("id,reply_to,status")
        .eq("reply_to_token", token)
        .maybeSingle();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "invalid_token" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("email_sender_aliases")
        .update({ reply_to_verified_at: new Date().toISOString(), reply_to_token: null, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      return new Response(JSON.stringify({ ok: true, status: data.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-alias-verify", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
