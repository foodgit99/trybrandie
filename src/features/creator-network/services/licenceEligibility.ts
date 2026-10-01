export interface LicenceLike {
  status: string;
  licence_scope?: string | null;
  revoked?: boolean | null;
  expires_at?: string | null;
  likeness_permission?: boolean | null;
  voice_permission?: boolean | null;
  organic_social_permission?: boolean | null;
  paid_advertising_permission?: boolean | null;
  creator_posted_permission?: boolean | null;
  digital_twin_permission?: boolean | null;
  platforms?: string[] | null;
  territories?: string[] | null;
  restricted_categories?: string[] | null;
  restricted_brands?: string[] | null;
  creator_approval_required?: boolean | null;
}

export interface UsageRequest {
  mode: "Preview" | "Commercial";
  usage: "paid" | "organic" | "creator_posted";
  platform?: string;
  territory?: string;
  category?: string;
  brandName?: string;
  needsVoice?: boolean;
  needsDigitalTwin?: boolean;
  creatorApproved?: boolean;
  today?: Date;
}

export interface Eligibility {
  allowed: boolean;
  reasons: string[];
}

const inList = (list: string[] | null | undefined, v?: string) =>
  !!v && (list ?? []).some((x) => x.toLowerCase() === v.toLowerCase());

/**
 * Preview rights and commercial rights are evaluated separately.
 * Preview: needs likeness consent recorded (any non-revoked licence, any scope).
 * Commercial: needs a Signed/Active commercial licence covering the specific usage.
 */
export function checkEligibility(licences: LicenceLike[], req: UsageRequest): Eligibility {
  const today = req.today ?? new Date();
  const live = licences.filter(
    (l) => !l.revoked && (!l.expires_at || new Date(l.expires_at) >= new Date(today.toDateString())),
  );

  if (req.mode === "Preview") {
    const ok = live.some((l) => l.likeness_permission && ["Signed", "Active", "Negotiating"].includes(l.status));
    return ok ? { allowed: true, reasons: [] } : { allowed: false, reasons: ["No likeness permission recorded for private previews."] };
  }

  const candidates = live.filter((l) => (l.licence_scope ?? "Commercial") === "Commercial" && ["Signed", "Active"].includes(l.status));
  if (!candidates.length) return { allowed: false, reasons: ["No signed, active commercial licence."] };

  let best: string[] | null = null;
  for (const l of candidates) {
    const r: string[] = [];
    if (!l.likeness_permission) r.push("Likeness permission missing.");
    if (req.usage === "paid" && !l.paid_advertising_permission) r.push("Paid advertising not permitted.");
    if (req.usage === "organic" && !l.organic_social_permission) r.push("Organic social not permitted.");
    if (req.usage === "creator_posted" && !l.creator_posted_permission) r.push("Creator-posted usage not permitted.");
    if (req.needsVoice && !l.voice_permission) r.push("Voice permission missing.");
    if (req.needsDigitalTwin && !l.digital_twin_permission) r.push("Digital-twin permission missing.");
    if (req.platform && (l.platforms ?? []).length && !inList(l.platforms, req.platform)) r.push(`Platform ${req.platform} not covered.`);
    if (req.territory && (l.territories ?? []).length && !inList(l.territories, req.territory)) r.push(`Territory ${req.territory} not covered.`);
    if (inList(l.restricted_categories, req.category)) r.push(`Category ${req.category} is restricted.`);
    if (inList(l.restricted_brands, req.brandName)) r.push(`Brand ${req.brandName} is restricted.`);
    if (l.creator_approval_required && !req.creatorApproved) r.push("Creator approval required and not recorded.");
    if (!r.length) return { allowed: true, reasons: [] };
    if (!best || r.length < best.length) best = r;
  }
  return { allowed: false, reasons: best ?? [] };
}
