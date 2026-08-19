import { supabase } from "@/integrations/supabase/client";
import { getPartnerRef } from "@/lib/partnerRef";

const KEY = "brandie_campaign_ref";
const TTL_DAYS = 90;

/** Remember which campaign brought the visitor, so signups can be attributed. */
export function captureCampaignRef(slug: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ slug, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function getCampaignRef(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { slug?: string; at?: number };
    if (!parsed?.slug || !parsed?.at) return null;
    if (Date.now() - parsed.at > TTL_DAYS * 86400000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.slug;
  } catch {
    return null;
  }
}

type CampaignEvent = "view" | "section_view" | "cta_click" | "signup" | "conversion";

/** Fire-and-forget campaign analytics. Never throws, never blocks the UI. */
export function trackCampaignEvent(event: CampaignEvent, slug: string | null, section?: string) {
  if (!slug) return;
  try {
    supabase.functions
      .invoke("campaign-track", {
        body: { slug, event, section: section ?? null, ref: getPartnerRef() },
      })
      .catch(() => {});
  } catch {
    /* analytics must never throw */
  }
}

/** Records the signup against the campaign that brought the visitor, if any. */
export function trackCampaignSignup() {
  const slug = getCampaignRef();
  if (slug) trackCampaignEvent("signup", slug);
}
