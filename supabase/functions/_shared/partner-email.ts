// Shared rendering + delivery for Marketing Partner emails (campaigns and automations).
// Kept independent of the brand Outbox engine on purpose.

import type { PartnerLeadRow } from "./partner-leads.ts";

const DOMAIN = Deno.env.get("MARKETING_EMAIL_DOMAIN") || "trybrandie.com";
const APP_URL = "https://trybrandie.com";

export interface PartnerLike {
  id: string;
  name: string;
  slug: string;
  contact_email?: string | null;
  logo_url?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replaces the merge tokens partners can use in subject and body. */
export function applyMergeTokens(text: string, lead: PartnerLeadRow, partner: PartnerLike): string {
  const first = (lead.full_name || "").trim().split(/\s+/)[0] || "there";
  return (text || "")
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*full_name\s*\}\}/gi, lead.full_name || first)
    .replace(/\{\{\s*email\s*\}\}/gi, lead.email || "")
    .replace(/\{\{\s*credits\s*\}\}/gi, String(lead.credits))
    .replace(/\{\{\s*designs\s*\}\}/gi, String(lead.designs))
    .replace(/\{\{\s*plan\s*\}\}/gi, lead.plan)
    .replace(/\{\{\s*partner_name\s*\}\}/gi, partner.name)
    .replace(/\{\{\s*referral_link\s*\}\}/gi, `${APP_URL}/?ref=${partner.slug}`)
    .replace(/\{\{\s*app_url\s*\}\}/gi, APP_URL);
}

export function renderPartnerEmail(args: {
  partner: PartnerLike;
  subject: string;
  preheader?: string | null;
  body: string;
  unsubscribeUrl: string;
}): string {
  const paragraphs = args.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#2B2D33">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(args.subject)}</title></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
${args.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(args.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:36px">
      <tr><td>
        ${
          args.partner.logo_url
            ? `<img src="${args.partner.logo_url}" alt="${escapeHtml(args.partner.name)}" width="120" style="max-width:120px;height:auto;margin-bottom:24px"/>`
            : `<p style="margin:0 0 24px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#C4993B">${escapeHtml(args.partner.name)}</p>`
        }
        ${paragraphs}
      </td></tr>
      <tr><td style="padding-top:24px;border-top:1px solid #EFEAE3">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#8A8781">
          Sent by ${escapeHtml(args.partner.name)}, a Brandie Marketing Partner.<br/>
          <a href="${args.unsubscribeUrl}" style="color:#8A8781">Unsubscribe from these emails</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export interface PartnerAlias {
  handle: string;
  from_name: string | null;
  reply_to: string | null;
}

/**
 * Returns the partner's approved + reply-to-verified sending alias, when they have one.
 * Falls back to null so callers keep using the generic partners@ address.
 */
export async function resolvePartnerAlias(
  admin: { from: (t: string) => any },
  partnerId: string,
): Promise<PartnerAlias | null> {
  const { data } = await admin
    .from("email_sender_aliases")
    .select("handle, from_name, reply_to, reply_to_verified_at, status")
    .eq("partner_id", partnerId)
    .eq("status", "approved")
    .maybeSingle();
  if (!data || !data.reply_to_verified_at || !data.handle) return null;
  return { handle: data.handle, from_name: data.from_name, reply_to: data.reply_to };
}

export function partnerFrom(partner: PartnerLike, alias?: PartnerAlias | null): string {
  const clean = (v: string) => v.replace(/[<>"]/g, "").trim();
  const name = clean(alias?.from_name || partner.name || "") || "Brandie Partner";
  const local = alias?.handle ? alias.handle : "partners";
  return `${name} <${local}@${DOMAIN}>`;
}

export function unsubscribeUrl(partnerId: string, email: string): string {
  const ref = (Deno.env.get("SUPABASE_URL") || "").match(/https:\/\/([^.]+)/)?.[1] || "";
  return `https://${ref}.functions.supabase.co/partner-unsubscribe?p=${partnerId}&e=${encodeURIComponent(email)}`;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendPartnerEmail(args: {
  partner: PartnerLike;
  to: string;
  subject: string;
  html: string;
  alias?: PartnerAlias | null;
}): Promise<SendResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "missing_resend_key" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: partnerFrom(args.partner, args.alias),
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...((args.alias?.reply_to || args.partner.contact_email)
          ? { reply_to: args.alias?.reply_to || args.partner.contact_email }
          : {}),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.message || `resend_${res.status}` };
    return { ok: true, id: json?.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
