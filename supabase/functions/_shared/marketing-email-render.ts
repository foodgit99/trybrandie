// Renders a responsive HTML email from a broadcast + brand context.
// Inlined styles only. Injects unsubscribe footer, physical address,
// open pixel, and rewritten click-tracking links.

export interface BrandTheme {
  name: string;
  primary?: string;
  background?: string;
  text?: string;
  logo_url?: string;
  font?: string;
}

export interface RenderInput {
  brand: BrandTheme;
  subject: string;
  preheader?: string;
  body_md?: string;
  cta_label?: string;
  cta_url?: string;
  unsubscribe_url: string;
  physical_address?: string;
  open_pixel_url?: string;
  template_key?: string;
}

// Tiny markdown -> HTML (headings, **bold**, *italic*, links, paragraphs, lists).
function mdToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  for (let raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    if (line.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2 style="font-size:20px;margin:24px 0 8px;color:inherit">${esc(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1 style="font-size:24px;margin:24px 0 12px;color:inherit">${esc(line.slice(2))}</h1>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { out.push(`<ul style="padding-left:20px;margin:8px 0">`); inList = true; }
      out.push(`<li style="margin:4px 0">${inlineMd(esc(line.replace(/^[-*]\s+/, "")))}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p style="margin:0 0 14px;line-height:1.55">${inlineMd(esc(line))}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function inlineMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:inherit;text-decoration:underline">$1</a>');
}

export function renderEmail(input: RenderInput): { html: string; text: string } {
  const primary = input.brand.primary || "#C4993B";
  const bg = input.brand.background || "#FAF8F5";
  const text = input.brand.text || "#2B2D33";
  const font = input.brand.font || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const bodyHtml = mdToHtml(input.body_md || "");
  const logo = input.brand.logo_url
    ? `<img src="${input.brand.logo_url}" alt="${input.brand.name}" style="max-height:36px;display:block;margin:0 auto 16px" />`
    : `<div style="font-weight:700;font-size:18px;margin:0 0 16px">${input.brand.name}</div>`;
  const cta = input.cta_url && input.cta_label
    ? `<div style="text-align:center;margin:28px 0"><a href="${input.cta_url}" style="background:${primary};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${input.cta_label}</a></div>`
    : "";
  const pixel = input.open_pixel_url
    ? `<img src="${input.open_pixel_url}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`
    : "";
  const address = input.physical_address
    ? `<div style="font-size:11px;color:#888;margin-top:8px">${input.physical_address}</div>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${input.subject}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:${font};color:${text}">
<div style="display:none;max-height:0;overflow:hidden">${input.preheader || ""}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${bg};border-radius:12px;padding:32px;text-align:left">
      <tr><td style="text-align:center">${logo}</td></tr>
      <tr><td>${bodyHtml}${cta}</td></tr>
      <tr><td style="border-top:1px solid #e6e3dd;padding-top:16px;margin-top:24px;font-size:12px;color:#666;text-align:center">
        You're receiving this because you opted in at ${input.brand.name}.
        <br/><a href="${input.unsubscribe_url}" style="color:#666;text-decoration:underline">Unsubscribe</a>
        ${address}
      </td></tr>
    </table>
  </td></tr>
</table>
${pixel}
</body></html>`;

  const plain = (input.preheader ? input.preheader + "\n\n" : "") +
    (input.body_md || "").replace(/\*\*/g, "").replace(/\*/g, "") +
    (input.cta_url ? `\n\n${input.cta_label || "Open"}: ${input.cta_url}` : "") +
    `\n\n—\nUnsubscribe: ${input.unsubscribe_url}`;

  return { html, text: plain };
}

// Detect spam-ish patterns. Returns a 0-100 deliverability score.
export function scoreDeliverability(subject: string, body: string): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 100;
  const s = subject || "";
  const b = body || "";
  if (/[A-Z]{6,}/.test(s)) { score -= 15; warnings.push("Subject contains ALL CAPS run"); }
  if ((s.match(/!/g) || []).length > 1) { score -= 8; warnings.push("Multiple exclamation marks in subject"); }
  if (s.length > 70) { score -= 6; warnings.push("Subject longer than 70 chars"); }
  if (s.length < 6) { score -= 10; warnings.push("Subject very short"); }
  const spamWords = /(free|guarantee|winner|act now|limited time|click here|100% free|risk-free|cash bonus|congratulations)/i;
  if (spamWords.test(s)) { score -= 10; warnings.push("Spammy phrase in subject"); }
  if (spamWords.test(b)) { score -= 5; warnings.push("Spammy phrase in body"); }
  const emojiCount = (s.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 2) { score -= 5; warnings.push("Too many emojis in subject"); }
  if (!b || b.length < 60) { score -= 10; warnings.push("Body too short"); }
  return { score: Math.max(0, Math.min(100, score)), warnings };
}

// Rewrites markdown links to tracked /e/c/<slug> URLs.
export function rewriteLinksForTracking(
  bodyMd: string,
  trackBase: string,
  registerLink: (url: string, label: string) => string,
): string {
  return bodyMd.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    if (/^mailto:|^#/.test(url)) return `[${label}](${url})`;
    const slug = registerLink(url, label);
    return `[${label}](${trackBase}/${slug})`;
  });
}
