// Sends a Marketing Partner campaign to the partner's own attributed leads.
// Partner-scoped: the caller can only ever reach campaigns and leads that belong to them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPartnerLeads, type PartnerLeadRow } from "../_shared/partner-leads.ts";
import {
  applyMergeTokens,
  renderPartnerEmail,
  resolvePartnerAlias,
  sendPartnerEmail,
  unsubscribeUrl,
} from "../_shared/partner-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export function selectAudience(leads: PartnerLeadRow[], audience: any): PartnerLeadRow[] {
  const statuses: string[] = Array.isArray(audience?.statuses) ? audience.statuses : [];
  const scoped = statuses.length === 0 ? leads : leads.filter((l) => statuses.includes(l.status));
  return scoped.filter((l) => !!l.email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const campaignId = String(body?.campaign_id || "");
    const testRecipient = body?.test_recipient ? String(body.test_recipient) : null;
    const internal = body?.internal === true && req.headers.get("x-internal-key") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!campaignId) return json({ error: "campaign_id required" }, 400);

    const { data: campaign } = await admin
      .from("partner_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (!campaign) return json({ error: "not_found" }, 404);

    // Auth: either the owning partner, or an internal (cron) call
    if (!internal) {
      const token = req.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token) return json({ error: "unauthorized" }, 401);
      const { data: userData } = await admin.auth.getUser(token);
      if (!userData?.user) return json({ error: "unauthorized" }, 401);

      const { data: p } = await admin
        .from("partner_profiles")
        .select("id, status")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!p || p.status !== "active" || p.id !== campaign.partner_id) {
        return json({ error: "forbidden" }, 403);
      }
    }

    const { data: partner } = await admin
      .from("partner_profiles")
      .select("id, name, slug, contact_email, logo_url")
      .eq("id", campaign.partner_id)
      .single();

    if (!testRecipient && campaign.status === "sent") {
      return json({ error: "already_sent" }, 409);
    }

    let recipients: PartnerLeadRow[];
    if (testRecipient) {
      recipients = [
        {
          user_id: "test",
          full_name: partner.name,
          email: testRecipient,
          plan: "free",
          credits: 5,
          designs: 0,
          last_active: null,
          joined: new Date().toISOString(),
          source: "test",
          attributed_at: new Date().toISOString(),
          status: "new",
          ever_paid: false,
          first_design_at: null,
          first_paid_at: null,
        },
      ];
    } else {
      const leads = await buildPartnerLeads(admin, campaign.partner_id);
      const { data: suppressed } = await admin
        .from("partner_email_suppression")
        .select("email")
        .eq("partner_id", campaign.partner_id);
      const blocked = new Set((suppressed || []).map((s: any) => s.email.toLowerCase()));
      recipients = selectAudience(leads, campaign.audience).filter(
        (l) => !blocked.has((l.email || "").toLowerCase())
      );
    }

    if (recipients.length === 0) {
      await admin.from("partner_campaigns").update({ status: "draft" }).eq("id", campaignId);
      return json({ error: "no_recipients" }, 400);
    }

    if (!testRecipient) {
      await admin
        .from("partner_campaigns")
        .update({ status: "sending", recipients_count: recipients.length })
        .eq("id", campaignId);
    }

    const alias = await resolvePartnerAlias(admin, partner.id);

    let delivered = 0;
    for (const lead of recipients) {
      const subject = applyMergeTokens(campaign.subject, lead, partner);
      const html = renderPartnerEmail({
        partner,
        subject,
        preheader: campaign.preheader,
        body: applyMergeTokens(campaign.body, lead, partner),
        unsubscribeUrl: unsubscribeUrl(partner.id, lead.email!),
      });

      const res = await sendPartnerEmail({ partner, to: lead.email!, subject, html, alias });
      if (res.ok) delivered++;

      if (!testRecipient) {
        await admin.from("partner_campaign_sends").insert({
          campaign_id: campaignId,
          partner_id: partner.id,
          lead_user_id: lead.user_id,
          email: lead.email,
          status: res.ok ? "sent" : "failed",
          provider_id: res.id || null,
          error: res.error || null,
          sent_at: res.ok ? new Date().toISOString() : null,
        });
      }
    }

    if (!testRecipient) {
      await admin
        .from("partner_campaigns")
        .update({
          status: delivered > 0 ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          delivered_count: delivered,
        })
        .eq("id", campaignId);
    }

    return json({ ok: true, recipients: recipients.length, delivered, test: !!testRecipient });
  } catch (err) {
    console.error("partner-campaign-send error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
