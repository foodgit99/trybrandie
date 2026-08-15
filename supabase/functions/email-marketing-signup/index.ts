// Public endpoint for signup forms. Creates a pending contact and (optionally)
// triggers a double opt-in confirmation email + welcome journey enrollment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function token() {
  return crypto.getRandomValues(new Uint8Array(16))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { form_slug, email, full_name, confirm_token } = body || {};
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Confirmation flow (double opt-in)
    if (confirm_token) {
      const { data: c } = await supabase.from("marketing_contacts")
        .select("id,brand_id").eq("double_opt_in_token", confirm_token).maybeSingle();
      if (!c) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await supabase.from("marketing_contacts").update({
        status: "subscribed", consent_at: new Date().toISOString(), double_opt_in_token: null,
      }).eq("id", c.id);
      // Auto-enroll into signup journeys
      const { data: journeys } = await supabase.from("marketing_journeys")
        .select("id").eq("brand_id", c.brand_id).eq("is_active", true).eq("trigger_type", "signup");
      for (const j of journeys || []) {
        await supabase.from("marketing_journey_enrollments")
          .upsert({ journey_id: j.id, contact_id: c.id, brand_id: c.brand_id, next_run_at: new Date().toISOString() }, { onConflict: "journey_id,contact_id" });
      }
      return new Response(JSON.stringify({ ok: true, status: "confirmed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!form_slug || !email) throw new Error("form_slug and email required");
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error("invalid email");

    const { data: form } = await supabase.from("email_signup_forms")
      .select("*").eq("slug", form_slug).eq("is_active", true).maybeSingle();
    if (!form) throw new Error("form not found");

    // Suppression check
    const { data: sup } = await supabase.from("marketing_suppression")
      .select("id").eq("brand_id", form.brand_id).eq("email", cleanEmail).maybeSingle();
    if (sup) return new Response(JSON.stringify({ ok: true, status: "suppressed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const doubleOptIn = form.double_opt_in;
    const optInToken = doubleOptIn ? token() : null;
    const status = doubleOptIn ? "pending" : "subscribed";
    const consent_at = doubleOptIn ? null : new Date().toISOString();

    const { data: contact, error } = await supabase.from("marketing_contacts").upsert({
      brand_id: form.brand_id,
      email: cleanEmail,
      full_name: full_name || null,
      status,
      source: `form:${form.slug}`,
      tags: form.default_tags,
      double_opt_in_token: optInToken,
      consent_at,
    }, { onConflict: "brand_id,email" }).select("id").single();
    if (error) throw error;

    if (!doubleOptIn) {
      // Trigger signup journeys immediately
      const { data: journeys } = await supabase.from("marketing_journeys")
        .select("id").eq("brand_id", form.brand_id).eq("is_active", true).eq("trigger_type", "signup");
      for (const j of journeys || []) {
        await supabase.from("marketing_journey_enrollments")
          .upsert({ journey_id: j.id, contact_id: contact.id, brand_id: form.brand_id, next_run_at: new Date().toISOString() }, { onConflict: "journey_id,contact_id" });
      }
    }

    // (Optional) Send confirm email via Resend if double opt-in
    if (doubleOptIn && optInToken) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const { data: brand } = await supabase.from("brands").select("name").eq("id", form.brand_id).single();
      const { data: alias } = await supabase.from("email_sender_aliases")
        .select("handle,from_name,reply_to,reply_to_verified_at,status")
        .eq("brand_id", form.brand_id)
        .eq("status", "approved")
        .maybeSingle();
      const domain = Deno.env.get("MARKETING_EMAIL_DOMAIN") || "trybrandie.com";
      const aliasReady = alias && alias.reply_to_verified_at;
      const fromName = aliasReady ? alias.from_name : brand?.name;
      const fromEmail = aliasReady ? `${alias.handle}@${domain}` : `news@${domain}`;
      const replyTo = aliasReady ? alias.reply_to : undefined;
      const confirmUrl = `${req.headers.get("origin") || ""}/subscribe/confirm?t=${optInToken}`;
      if (resendKey && brand) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [cleanEmail],
            subject: `Confirm your subscription to ${brand.name}`,
            html: `<p>Thanks for signing up. Please confirm your subscription:</p><p><a href="${confirmUrl}">Confirm subscription</a></p>`,
            reply_to: replyTo,
          }),
        }).catch(() => {});
      }

    }

    return new Response(JSON.stringify({ ok: true, status, message: form.success_message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
