// Derives verifiable source citations for a competitor signal.
// Prefers metadata.source_urls persisted by the digest, then falls back
// to the competitor's known public surfaces (domain / IG handle).

export type SourceCitation = {
  url: string;
  label: string; // short host-based label, e.g. "instagram.com" or "acme.co"
  channel: "site" | "instagram" | "other";
};

type CompetitorLike = {
  domain: string | null;
  instagram_handle: string | null;
};

type SignalLike = {
  metadata?: any;
};

function normalizeUrl(raw: string): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(t)) return `https://${t}`;
  return null;
}

function labelFor(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 32);
  }
}

function channelFor(url: string): SourceCitation["channel"] {
  const host = labelFor(url).toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.length > 0) return "site";
  return "other";
}

export function citationsForSignal(
  signal: SignalLike,
  competitor: CompetitorLike,
): SourceCitation[] {
  const out = new Map<string, SourceCitation>();
  const meta = signal.metadata ?? {};
  const urls: string[] = Array.isArray(meta.source_urls) ? meta.source_urls : [];
  const channels: string[] = Array.isArray(meta.sources) ? meta.sources : [];

  for (const u of urls) {
    const n = normalizeUrl(String(u));
    if (!n) continue;
    out.set(n, { url: n, label: labelFor(n), channel: channelFor(n) });
  }

  // Channel-based fallbacks so legacy signals still cite something verifiable.
  const wantSite = channels.includes("site") || out.size === 0;
  const wantIg = channels.includes("instagram") || out.size === 0;

  if (wantSite && competitor.domain) {
    const n = normalizeUrl(competitor.domain);
    if (n && !out.has(n)) out.set(n, { url: n, label: labelFor(n), channel: "site" });
  }
  if (wantIg && competitor.instagram_handle) {
    const handle = competitor.instagram_handle.replace(/^@/, "");
    const n = `https://instagram.com/${handle}`;
    if (!out.has(n)) out.set(n, { url: n, label: `instagram.com/@${handle}`, channel: "instagram" });
  }

  return [...out.values()].slice(0, 4);
}
