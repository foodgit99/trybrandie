/**
 * Deterministic Next Best Action for a creator. Rules are evaluated in order;
 * the first rule whose preconditions hold wins. No rule recommends an action
 * whose dependencies are unmet.
 */
export interface NbaInput {
  creator: {
    status: string;
    contact_status?: string | null;
    licensing_interest?: string | null;
    brand_safety_status?: string | null;
  };
  validations: Array<{ validation_type: string; status: string }>;
  licences: Array<{ status: string; revoked?: boolean; licence_scope?: string }>;
  matchesCount: number;
  approvedConceptWithoutJob: boolean;
  previewReadyWithoutOutreach: boolean;
}

export interface NextBestAction {
  key: string;
  label: string;
  why: string;
}

const RIGHTS_TYPES = ["likeness_licensing", "paid_ad_permission", "organic_ad_permission"];

const passed = (v: NbaInput["validations"], type: string) =>
  v.some((x) => x.validation_type === type && x.status === "Passed");

export function nextBestAction(i: NbaInput): NextBestAction {
  const c = i.creator;
  if (c.status === "Rejected" || c.status === "Paused") {
    return { key: "none", label: "No action — creator is " + c.status.toLowerCase(), why: "Paused or rejected creators are not progressed." };
  }
  if (c.brand_safety_status === "Flagged") {
    return { key: "brand_safety", label: "Resolve brand safety review", why: "A public-content issue is flagged and needs a human decision before any outreach." };
  }
  if (!c.contact_status || c.contact_status === "Not Contacted") {
    return { key: "contact", label: "Contact creator", why: "The creator has not been contacted yet." };
  }
  if (c.licensing_interest === "Not Interested") {
    return { key: "none", label: "Close out — not interested in licensing", why: "The creator declined licensing." };
  }
  if (c.licensing_interest !== "Interested") {
    return { key: "confirm_interest", label: "Confirm licensing interest", why: "Interest in licensing is not yet confirmed by a human." };
  }
  const rightsComplete = RIGHTS_TYPES.every((t) => passed(i.validations, t));
  if (!rightsComplete) {
    return { key: "licensing_interview", label: "Complete licensing interview", why: "Interested, but likeness/ad-permission validations are incomplete." };
  }
  if (!passed(i.validations, "camera_test") || !passed(i.validations, "digital_twin_test")) {
    return { key: "camera_test", label: "Run camera / digital-twin test", why: "Rights are approved but camera or digital-twin suitability is unverified." };
  }
  const activeLicence = i.licences.some((l) => !l.revoked && (l.status === "Signed" || l.status === "Active") && (l.licence_scope ?? "Commercial") === "Commercial");
  if (!activeLicence) {
    return { key: "sign_licence", label: "Negotiate / sign licence", why: "Validation passed but no signed commercial licence exists." };
  }
  if (i.previewReadyWithoutOutreach) {
    return { key: "outreach", label: "Review outreach package", why: "A preview is ready but no outreach has been recorded." };
  }
  if (i.approvedConceptWithoutJob) {
    return { key: "production", label: "Send to production", why: "An approved concept has no production job yet." };
  }
  if (i.matchesCount === 0) {
    return { key: "find_matches", label: "Create matches", why: "Licensed creator with no brand/prospect matches yet." };
  }
  return { key: "review_matches", label: "Review strongest matches", why: "Licensed — progress the best-scoring match into an opportunity." };
}
