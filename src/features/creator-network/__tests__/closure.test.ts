import { describe, it, expect } from "vitest";
import { nextBestAction } from "../services/nextBestAction";

// Fixture mirrors the live TEST creator state written by creator_network_submit_interview()
// during the V1 closure run (interview → validations → creator state).
const afterInterview = {
  creator: { status: "Validation Passed", contact_status: "Responded", licensing_interest: "Interested", brand_safety_status: "Not Reviewed" },
  validations: [
    { validation_type: "licensing_interest", status: "Passed" },
    { validation_type: "likeness_licensing", status: "Passed" },
  ],
  licences: [],
  matchesCount: 0,
  approvedConceptWithoutJob: false,
  previewReadyWithoutOutreach: false,
};

describe("V1 closure — interview feeds Next Best Action", () => {
  it("recommends a concrete next step once the interview is submitted", () => {
    const nba = nextBestAction(afterInterview);
    expect(nba.key).not.toBe("contact");
    expect(nba.label.length).toBeGreaterThan(0);
  });
  it("never suggests progressing a flagged creator", () => {
    expect(nextBestAction({ ...afterInterview, creator: { ...afterInterview.creator, brand_safety_status: "Flagged" } }).key).toBe("brand_safety");
  });
});
