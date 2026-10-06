import { describe, it, expect } from "vitest";
import { nextBestAction, type NbaInput } from "../services/nextBestAction";
import { scoreMatch } from "../services/matchScoring";
import { checkClaims } from "../services/claimGating";
import { checkEligibility } from "../services/licenceEligibility";
import { ratio, formatRatio, realOnly } from "../services/metrics";
import { fromBrandProduct, fromProspectProduct } from "../services/normalizedProduct";

const base: NbaInput = {
  creator: { status: "Researched", contact_status: "Not Contacted", licensing_interest: "Unknown", brand_safety_status: "Clear" },
  validations: [],
  licences: [],
  matchesCount: 0,
  approvedConceptWithoutJob: false,
  previewReadyWithoutOutreach: false,
};
const pass = (t: string) => ({ validation_type: t, status: "Passed" });

describe("nextBestAction", () => {
  it("contact first", () => expect(nextBestAction(base).key).toBe("contact"));
  it("interested but rights incomplete → licensing interview", () =>
    expect(nextBestAction({ ...base, creator: { ...base.creator, contact_status: "Responded", licensing_interest: "Interested" } }).key).toBe("licensing_interview"));
  const rights = ["likeness_licensing", "paid_ad_permission", "organic_ad_permission"].map(pass);
  const interested = { ...base.creator, contact_status: "Responded", licensing_interest: "Interested" };
  it("rights ok, camera missing → camera test", () =>
    expect(nextBestAction({ ...base, creator: interested, validations: rights }).key).toBe("camera_test"));
  const validated = [...rights, pass("camera_test"), pass("digital_twin_test")];
  it("validated, unsigned → sign licence", () =>
    expect(nextBestAction({ ...base, creator: interested, validations: validated }).key).toBe("sign_licence"));
  const lic = [{ status: "Signed", licence_scope: "Commercial" }];
  it("licensed + matches → review matches", () =>
    expect(nextBestAction({ ...base, creator: interested, validations: validated, licences: lic, matchesCount: 2 }).key).toBe("review_matches"));
  it("approved concept → production", () =>
    expect(nextBestAction({ ...base, creator: interested, validations: validated, licences: lic, matchesCount: 1, approvedConceptWithoutJob: true }).key).toBe("production"));
  it("never recommends production before licence", () =>
    expect(nextBestAction({ ...base, creator: interested, validations: validated, approvedConceptWithoutJob: true }).key).toBe("sign_licence"));
  it("revoked licence does not count", () =>
    expect(nextBestAction({ ...base, creator: interested, validations: validated, licences: [{ status: "Signed", revoked: true }] }).key).toBe("sign_licence"));
  it("flagged brand safety blocks outreach", () =>
    expect(nextBestAction({ ...base, creator: { ...base.creator, brand_safety_status: "Flagged" } }).key).toBe("brand_safety"));
});

describe("scoreMatch", () => {
  it("returns null with no factors", () => expect(scoreMatch({}).total).toBeNull());
  it("scores 100 for all tens", () => {
    const r = scoreMatch({ likeness_suitability: 10, camera_presence: 10, category_relevance: 10, audience_overlap: 10, brand_personality_fit: 10, visual_compatibility: 10, product_demonstrability: 10, geographic_relevance: 10, price_audience_fit: 10, creator_credibility: 10, naturalness: 10, production_feasibility: 10 });
    expect(r.total).toBe(100);
    expect(r.confidence).toBe("High");
  });
  it("low coverage → low confidence", () => expect(scoreMatch({ naturalness: 8 }).confidence).toBe("Low"));
  it("clamps out-of-range values", () => expect(scoreMatch({ naturalness: 50 }).total).toBe(100));
});

describe("checkClaims", () => {
  it("blocks unverified personal experience", () =>
    expect(checkClaims([{ type: "CREATOR_PERSONAL_EXPERIENCE", text: "I use this daily" }]).ok).toBe(false));
  it("allows verified personal experience", () =>
    expect(checkClaims([{ type: "CREATOR_PERSONAL_EXPERIENCE", text: "x", verified: true }]).ok).toBe(true));
  it("allows factual claims", () => expect(checkClaims([{ type: "FACTUAL_PRODUCT_CLAIM", text: "500ml" }]).ok).toBe(true));
});

describe("checkEligibility", () => {
  const signed = { status: "Signed", licence_scope: "Commercial", likeness_permission: true, paid_advertising_permission: true, organic_social_permission: false, creator_approval_required: false, platforms: ["Instagram"], territories: ["NG"], restricted_categories: ["Alcohol"] };
  it("blocks commercial with no licence", () => expect(checkEligibility([], { mode: "Commercial", usage: "paid" }).allowed).toBe(false));
  it("allows covered paid usage", () => expect(checkEligibility([signed], { mode: "Commercial", usage: "paid", platform: "instagram", territory: "NG", category: "beauty" }).allowed).toBe(true));
  it("denies missing scope (no Commercial default)", () => expect(checkEligibility([{ ...signed, licence_scope: null }], { mode: "Commercial", usage: "paid", platform: "instagram", territory: "NG", category: "beauty" }).allowed).toBe(false));
  it("denies absent platform/territory when licence lists them", () => expect(checkEligibility([signed], { mode: "Commercial", usage: "paid", category: "beauty" }).allowed).toBe(false));
  it("denies before starts_at", () => expect(checkEligibility([{ ...signed, starts_at: "2999-01-01" }], { mode: "Commercial", usage: "paid", platform: "instagram", territory: "NG", category: "beauty" }).allowed).toBe(false));
  it("expiry lasts to end of day UTC", () => expect(checkEligibility([{ ...signed, expires_at: "2030-05-01" }], { mode: "Commercial", usage: "paid", platform: "instagram", territory: "NG", category: "beauty", today: new Date("2030-05-01T23:00:00Z") }).allowed).toBe(true));
  it("blocks organic when only paid", () => expect(checkEligibility([signed], { mode: "Commercial", usage: "organic" }).allowed).toBe(false));
  it("blocks restricted category", () => expect(checkEligibility([signed], { mode: "Commercial", usage: "paid", category: "alcohol" }).allowed).toBe(false));
  it("blocks uncovered platform", () => expect(checkEligibility([signed], { mode: "Commercial", usage: "paid", platform: "TikTok" }).allowed).toBe(false));
  it("blocks expired", () => expect(checkEligibility([{ ...signed, expires_at: "2020-01-01" }], { mode: "Commercial", usage: "paid" }).allowed).toBe(false));
  it("blocks revoked", () => expect(checkEligibility([{ ...signed, revoked: true }], { mode: "Commercial", usage: "paid" }).allowed).toBe(false));
  it("preview does not imply commercial", () => {
    const preview = { status: "Negotiating", licence_scope: "Preview", likeness_permission: true };
    expect(checkEligibility([preview], { mode: "Preview", usage: "paid" }).allowed).toBe(true);
    expect(checkEligibility([preview], { mode: "Commercial", usage: "paid" }).allowed).toBe(false);
  });
  it("requires creator approval when flagged", () =>
    expect(checkEligibility([{ ...signed, creator_approval_required: true }], { mode: "Commercial", usage: "paid" }).allowed).toBe(false));
});

describe("metrics", () => {
  it("zero denominator → No data yet", () => {
    expect(ratio(0, 0)).toBeNull();
    expect(formatRatio(ratio(3, 0))).toBe("No data yet");
  });
  it("formats ratio", () => expect(formatRatio(ratio(1, 4))).toBe("25%"));
  it("excludes test rows", () => expect(realOnly([{ is_test: true }, { is_test: false }, {}]).length).toBe(2));
});

describe("normalizedProduct", () => {
  it("normalises both sources to one shape", () => {
    const a = fromBrandProduct({ id: "1", brand_id: "b", name: "Bag", price: "5000" });
    const b = fromProspectProduct({ id: "2", prospect_id: "p", name: "Shoe", price: 3000 });
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(a.price).toBe(5000);
    expect(b.source).toBe("prospect_product");
  });
});
