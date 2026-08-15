import { supabase } from "@/integrations/supabase/client";

const KEY = "brandie_partner_ref";
const TTL_DAYS = 90;

interface StoredRef {
  slug: string;
  at: number;
}

/** Capture a ?ref= / ?partner= slug from the current URL and remember it for 90 days. */
export function capturePartnerRef(search: string) {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get("partner") || params.get("ref");
    if (!raw) return;
    const slug = raw.toLowerCase().trim();
    if (!slug) return;

    const existing = getPartnerRef();
    localStorage.setItem(KEY, JSON.stringify({ slug, at: Date.now() } satisfies StoredRef));

    // Count the click once per stored referral window
    if (existing !== slug) {
      supabase.functions
        .invoke("partner-portal", { body: { action: "track_click", code: slug } })
        .catch(() => {});
    }
  } catch {
    // storage unavailable, ignore
  }
}

/** Read the remembered partner slug, or null when absent/expired. */
export function getPartnerRef(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    if (!parsed?.slug) return null;
    if (Date.now() - parsed.at > TTL_DAYS * 86400000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.slug;
  } catch {
    return null;
  }
}

export function clearPartnerRef() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function partnerReferralUrl(slug: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://trybrandie.com";
  return `${origin}/?ref=${slug}`;
}
