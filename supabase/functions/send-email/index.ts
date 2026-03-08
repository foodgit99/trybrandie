import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API = "https://api.resend.com/emails";

function welcomeHtml(name: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">Welcome to Brandie ✨</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Hey ${name || "there"},
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Your brand studio is ready. Brandie will remember your colours, fonts, tone, and personality — so every design feels unmistakably <strong>you</strong>.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      Head to the Design Studio and create your first graphic. Just describe what you need in plain English.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="https://trybrandie.lovable.app/" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Open Brandie
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you signed up for Brandie.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function referralRewardHtml(credits: number): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">You earned credits! 🎉</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      Great news — someone joined Brandie using your referral link.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      We've added <strong>${credits} bonus credits</strong> to your account. Keep sharing to earn more!
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="https://trybrandie.lovable.app/" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Start Designing
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because someone used your Brandie referral link.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function outOfCreditsHtml(): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
    <h1 style="color:#c4a265;font-size:28px;margin:0;font-weight:700;">You've used all your credits</h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      You've reached your monthly generation limit. Your credits will reset next month, or you can upgrade for more.
    </p>
    <p style="font-size:16px;color:#1a1a2e;line-height:1.6;margin:0 0 24px;">
      In the meantime, you can still browse and download your existing designs.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="https://trybrandie.lovable.app/plans" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        View Plans
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 40px 32px;text-align:center;">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this because you reached your Brandie credit limit.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, to, data } = await req.json();

    if (!type || !to) {
      return new Response(JSON.stringify({ error: "Missing type or to" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject: string;
    let html: string;

    switch (type) {
      case "welcome":
        subject = "Welcome to Brandie — your brand studio is ready ✨";
        html = welcomeHtml(data?.name || "");
        break;
      case "referral_reward":
        subject = "You just earned bonus credits on Brandie! 🎉";
        html = referralRewardHtml(data?.credits || 5);
        break;
      case "out_of_credits":
        subject = "You've used all your Brandie credits this month";
        html = outOfCreditsHtml();
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Brandie <hello@trybrandie.com>",
        to: [to],
        subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
