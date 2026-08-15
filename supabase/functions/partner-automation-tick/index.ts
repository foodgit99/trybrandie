// Hourly background job: fires due partner automations and sends scheduled partner campaigns.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPartnerLeads, type PartnerLeadRow } from "../_shared/partner-leads.ts";
import {
  applyMergeTokens,
  renderPartnerEmail,
  sendPartnerEmail,
  unsubscribeUrl,
} from "../_shared/partner-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Trigger definitions: which leads qualify, and when the clock starts for the delay. */
export function triggerAnchor(trigger: string, lead: PartnerLeadRow): string | null {
  switch (trigger) {
    case "new_lead":
      return lead.attributed_at;
    case "activated":
      return lead.first_design_at;
    case "low_credits":
      return lead.status === "low_credits" ? lead.attributed_at : null;
    case "exhausted":
      return lead.status === "exhausted" ? lead.attributed_at : null;
    case "inactive":
      return lead.status === "inactive" ? lead.last_active || lead.attributed_at : null;
    case "paid":
      return lead.first_paid_at;
    default:
      return null;
  }
}

export function isDue(trigger: string, lead: PartnerLeadRow, delayHours: number, now = Date.now()): boolean {
  if (trigger === "activated" && !lead.first_design_at) return false;
  if (trigger === "paid" && !lead.first_paid_at) return false;
  const anchor = triggerAnchor(trigger, lead);
  if (!anchor) return false;
  return now - new Date(anchor).getTime() >= delayHours * 3600000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const summary = { automations: 0, emails: 0, campaigns: 0, errors: [] as string[] };

  try {
    // ---- 1. Due scheduled campaigns ----
    const { data: dueCampaigns } = await admin
      .from("partner_campaigns")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString());

    for (const c of dueCampaigns || []) {
      const res = await fetch(`${supabaseUrl}/functions/v1/partner-campaign-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          "x-internal-key": serviceRoleKey,
        },
        body: JSON.stringify({ campaign_id: c.id, internal: true }),
      });
      if (res.ok) summary.campaigns++;
      else summary.errors.push(`campaign ${c.id}: ${res.status}`);
    }

    // ---- 2. Active automations ----
    const { data: automations } = await admin
      .from("partner_automations")
      .select("id, partner_id, name, trigger, delay_hours, subject, body, sent_count")
      .eq("active", true);

    const byPartner = new Map<string, any[]>();
    (automations || []).forEach((a: any) => {
      byPartner.set(a.partner_id, [...(byPartner.get(a.partner_id) || []), a]);
    });

    for (const [partnerId, rules] of byPartner) {
      const { data: partner } = await admin
        .from("partner_profiles")
        .select("id, name, slug, contact_email, logo_url, status")
        .eq("id", partnerId)
        .maybeSingle();
      if (!partner || partner.status !== "active") continue;

      const leads = await buildPartnerLeads(admin, partnerId);
      const { data: suppressed } = await admin
        .from("partner_email_suppression")
        .select("email")
        .eq("partner_id", partnerId);
      const blocked = new Set((suppressed || []).map((s: any) => s.email.toLowerCase()));

      for (const rule of rules) {
        const { data: alreadyRun } = await admin
          .from("partner_automation_runs")
          .select("lead_user_id")
          .eq("automation_id", rule.id);
        const done = new Set((alreadyRun || []).map((r: any) => r.lead_user_id));

        let fired = 0;
        for (const lead of leads) {
          if (!lead.email || done.has(lead.user_id)) continue;
          if (blocked.has(lead.email.toLowerCase())) continue;
          if (!isDue(rule.trigger, lead, Number(rule.delay_hours || 0))) continue;

          const subject = applyMergeTokens(rule.subject, lead, partner);
          const html = renderPartnerEmail({
            partner,
            subject,
            preheader: null,
            body: applyMergeTokens(rule.body, lead, partner),
            unsubscribeUrl: unsubscribeUrl(partner.id, lead.email),
          });
          const res = await sendPartnerEmail({ partner, to: lead.email, subject, html });

          await admin.from("partner_automation_runs").insert({
            automation_id: rule.id,
            partner_id: partnerId,
            lead_user_id: lead.user_id,
            email: lead.email,
            status: res.ok ? "sent" : "failed",
            error: res.error || null,
          });

          if (res.ok) {
            fired++;
            summary.emails++;
          } else {
            summary.errors.push(`automation ${rule.id}: ${res.error}`);
          }
        }

        await admin
          .from("partner_automations")
          .update({ last_run_at: new Date().toISOString(), sent_count: Number(rule.sent_count || 0) + fired })
          .eq("id", rule.id);
        summary.automations++;
      }
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("partner-automation-tick error", err);
    return new Response(JSON.stringify({ error: (err as Error).message, summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
