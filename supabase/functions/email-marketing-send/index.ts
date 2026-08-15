// Sends an email_broadcast to its segment via Resend.
// Subscription gate: free / pay-as-you-go tiers are blocked.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEmail, rewriteLinksForTracking, type BrandTheme } from "../_shared/marketing-email-render.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TIERS = new Set(["starter", "creator", "agency", "pro", "growth", "scale"]);

function slug(n = 10) {
  return crypto.getRandomValues(new Uint8Array(n))
    .reduce((s, b) => s + (b % 36).toString(36), "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { broadcast_id, test_recipient } = await req.json();
    if (!broadcast_id) throw new Error("broadcast_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: broadcast, error } = await supabase
      .from("email_broadcasts").select("*").eq("id", broadcast_id).single();
    if (error || !broadcast) throw new Error(error?.message || "broadcast not found");

    // Subscription gate
    const { data: brand } = await supabase.from("brands")
      .select("id,user_id,name,colors,primary_font,logo_url").eq("id", broadcast.brand_id).single();
    if (!brand) throw new Error("brand not found");

    const { data: profile } = await supabase.from("profiles")
      .select("subscription_tier").eq("user_id", brand.user_id).single();
    const tier = (profile?.subscription_tier || "free").toLowerCase();
    if (!test_recipient && !ALLOWED_TIERS.has(tier)) {
      return new Response(JSON.stringify({ error: "subscription_required", tier }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase.from("autopilot_settings")
      .select("marketing_email_from_name,marketing_email_reply_to,marketing_email_physical_address")
      .eq("brand_id", broadcast.brand_id).maybeSingle();

    // Resolve approved alias for this brand
    const { data: alias } = await supabase.from("email_sender_aliases")
      .select("handle,from_name,reply_to,reply_to_verified_at,status")
      .eq("brand_id", broadcast.brand_id)
      .eq("status", "approved")
      .maybeSingle();
    const aliasReady = alias && alias.reply_to_verified_at;
    const domain = Deno.env.get("MARKETING_EMAIL_DOMAIN") || "trybrandie.com";


    // Resolve recipients
    let recipients: { id: string; email: string; name: string | null }[] = [];
    if (test_recipient) {
      recipients = [{ id: "test", email: test_recipient, name: null }];
    } else {
      const { data: contacts } = await supabase
        .from("marketing_contacts")
        .select("id,email,full_name")
        .eq("brand_id", broadcast.brand_id)
        .eq("status", "subscribed");
      // suppression check
      const { data: suppressed } = await supabase
        .from("marketing_suppression").select("email").eq("brand_id", broadcast.brand_id);
      const blocked = new Set((suppressed || []).map(s => s.email.toLowerCase()));
      recipients = (contacts || [])
        .filter(c => !blocked.has(c.email.toLowerCase()))
        .map(c => ({ id: c.id, email: c.email, name: c.full_name }));
    }

    if (recipients.length === 0) {
      await supabase.from("email_broadcasts").update({ status: "failed", metadata: { ...(broadcast.metadata || {}), reason: "no_recipients" } }).eq("id", broadcast_id);
      return new Response(JSON.stringify({ error: "no_recipients" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("email_broadcasts").update({ status: "sending", recipients_count: recipients.length }).eq("id", broadcast_id);

    // Register click-tracked links
    const projectRef = (Deno.env.get("SUPABASE_URL") || "").match(/https:\/\/([^.]+)/)?.[1] || "";
    const trackBase = `https://${projectRef}.functions.supabase.co/email-marketing-track/c`;
    const pixelBase = `https://${projectRef}.functions.supabase.co/email-marketing-track/o`;
    const unsubBase = `https://${projectRef}.functions.supabase.co/email-marketing-track/u`;

    const linkRegistry: { slug: string; url: string; label: string }[] = [];
    const trackedBody = rewriteLinksForTracking(broadcast.body_md || "", trackBase, (url, label) => {
      const s = slug(8);
      linkRegistry.push({ slug: s, url, label });
      return s;
    });
    let ctaUrl = broadcast.cta_url || "";
    let ctaSlug: string | null = null;
    if (ctaUrl) {
      ctaSlug = slug(8);
      linkRegistry.push({ slug: ctaSlug, url: ctaUrl, label: broadcast.cta_label || "CTA" });
      ctaUrl = `${trackBase}/${ctaSlug}`;
    }
    if (linkRegistry.length) {
      await supabase.from("email_links").insert(
        linkRegistry.map(l => ({ broadcast_id, slug: l.slug, url: l.url, label: l.label })),
      );
    }

    const brandTheme: BrandTheme = {
      name: fromName,
      primary: (brand.colors as any)?.primary || "#C4993B",
      background: (brand.colors as any)?.background || "#FAF8F5",
      text: (brand.colors as any)?.text || "#2B2D33",
      logo_url: brand.logo_url || undefined,
      font: brand.primary_font || undefined,
    };


    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY missing");

    const fromName = aliasReady ? alias.from_name : (settings?.marketing_email_from_name || brand.name);
    const fromEmail = aliasReady ? `${alias.handle}@${domain}` : `news@${domain}`;
    const replyTo = aliasReady ? alias.reply_to : (settings?.marketing_email_reply_to || undefined);


    let sentCount = 0;
    let failedCount = 0;

    // Sequential with small jitter to avoid provider throttling.
    for (const r of recipients) {
      const sendRow = test_recipient ? null : await supabase
        .from("email_sends")
        .insert({ broadcast_id, contact_id: r.id, brand_id: broadcast.brand_id, status: "queued" })
        .select("id").single();
      const sendId = sendRow?.data?.id || crypto.randomUUID();

      const unsubUrl = `${unsubBase}/${sendId}`;
      const pixelUrl = `${pixelBase}/${sendId}.gif`;
      const rendered = renderEmail({
        brand: brandTheme,
        subject: broadcast.subject,
        preheader: broadcast.preheader || undefined,
        body_md: trackedBody,
        cta_label: broadcast.cta_label || undefined,
        cta_url: ctaUrl || undefined,
        unsubscribe_url: unsubUrl,
        physical_address: settings?.marketing_email_physical_address || undefined,
        open_pixel_url: pixelUrl,
        template_key: broadcast.template_key || "classic",
      });

      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [r.email],
            subject: broadcast.subject,
            html: rendered.html,
            text: rendered.text,
            reply_to: replyTo,
            headers: {
              "List-Unsubscribe": `<${unsubUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.message || `resend ${resp.status}`);
        if (sendRow) await supabase.from("email_sends").update({ status: "sent", message_id: data.id }).eq("id", sendId);
        sentCount++;
      } catch (e) {
        if (sendRow) await supabase.from("email_sends").update({ status: "failed", error_message: (e as Error).message }).eq("id", sendId);
        failedCount++;
      }
      if (recipients.length > 1) await new Promise(r => setTimeout(r, 80 + Math.random() * 120));
    }

    if (!test_recipient) {
      await supabase.from("email_broadcasts").update({
        status: failedCount === recipients.length ? "failed" : "sent",
        sent_at: new Date().toISOString(),
      }).eq("id", broadcast_id);
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount, failed: failedCount, recipients: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-marketing-send", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
