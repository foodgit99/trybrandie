import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function alertHtml(errorRate: string, p95Latency: number, totalTraces: number, errorCount: number): string {
  const alerts: string[] = [];
  if (parseFloat(errorRate) > 5) {
    alerts.push(`<tr><td style="padding:12px 20px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;margin-bottom:8px;">
      <strong style="color:#dc2626;">🔴 High Error Rate: ${errorRate}%</strong>
      <p style="margin:4px 0 0;color:#7f1d1d;font-size:14px;">${errorCount} of ${totalTraces} traces failed in the last 24 hours.</p>
    </td></tr>`);
  }
  if (p95Latency > 60000) {
    alerts.push(`<tr><td style="padding:12px 20px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;margin-bottom:8px;">
      <strong style="color:#d97706;">🟡 High P95 Latency: ${(p95Latency / 1000).toFixed(1)}s</strong>
      <p style="margin:4px 0 0;color:#78350f;font-size:14px;">P95 latency exceeds the 60s threshold.</p>
    </td></tr>`);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:40px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1a1a2e;padding:24px 40px;text-align:center;">
    <h1 style="color:#ef4444;font-size:22px;margin:0;font-weight:700;">⚠️ Brandie AI Pipeline Alert</h1>
  </td></tr>
  <tr><td style="padding:24px 40px;">
    <p style="font-size:15px;color:#1a1a2e;line-height:1.6;margin:0 0 16px;">
      The following thresholds were breached in the last 24 hours:
    </p>
    <table width="100%" cellpadding="0" cellspacing="8">
      ${alerts.join("")}
    </table>
    <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:16px 0 0;">
      <strong>Summary:</strong> ${totalTraces} total traces &middot; ${errorCount} errors &middot; ${errorRate}% error rate &middot; P95 latency ${(p95Latency / 1000).toFixed(1)}s
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;"><tr><td align="center">
      <a href="https://trybrandie.com/admin" style="display:inline-block;background:#c4a265;color:#1a1a2e;font-weight:600;font-size:15px;padding:12px 28px;border-radius:12px;text-decoration:none;">
        View Admin Dashboard
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:12px 40px 24px;text-align:center;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">Automated daily alert from Brandie AI Pipeline Monitor.</p>
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get traces from last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: traces, error: tracesError } = await supabase
      .from("design_traces")
      .select("total_latency_ms, error")
      .gte("created_at", since);

    if (tracesError) throw tracesError;

    const total = traces?.length || 0;
    if (total === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_traces" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errorCount = traces!.filter((t) => t.error !== null).length;
    const errorRate = ((errorCount / total) * 100).toFixed(1);

    // Calculate P95 latency
    const latencies = traces!
      .map((t) => t.total_latency_ms)
      .filter((l): l is number => l !== null)
      .sort((a, b) => a - b);
    const p95Index = Math.ceil(latencies.length * 0.95) - 1;
    const p95Latency = latencies.length > 0 ? latencies[Math.max(0, p95Index)] : 0;

    const highErrorRate = parseFloat(errorRate) > 5;
    const highLatency = p95Latency > 60000;

    if (!highErrorRate && !highLatency) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "within_thresholds", errorRate, p95Latency }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin user emails
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) throw rolesError;

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_admins" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch admin emails from auth.users via admin API
    const adminEmails: string[] = [];
    for (const role of adminRoles) {
      const { data: userData } = await supabase.auth.admin.getUserById(role.user_id);
      if (userData?.user?.email) {
        adminEmails.push(userData.user.email);
      }
    }

    if (adminEmails.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_admin_emails" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send alert email to each admin
    const html = alertHtml(errorRate, p95Latency, total, errorCount);
    const subject = `⚠️ Brandie AI Alert: ${highErrorRate ? `Error rate ${errorRate}%` : ""}${highErrorRate && highLatency ? " + " : ""}${highLatency ? `P95 latency ${(p95Latency / 1000).toFixed(1)}s` : ""}`;

    const results = [];
    for (const email of adminEmails) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Brandie <hello@trybrandie.com>",
          to: [email],
          subject,
          html,
        }),
      });
      const result = await res.json();
      results.push({ email, ok: res.ok, id: result.id || null });
    }

    return new Response(
      JSON.stringify({ success: true, errorRate, p95Latency, adminsNotified: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("trace-alert error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
