import type { ClaimType } from "../types";

export interface Claim {
  type: ClaimType;
  text: string;
  /** Set only when a human verified the creator actually had this experience. */
  verified?: boolean;
}

export interface ClaimCheck {
  ok: boolean;
  blocked: Claim[];
  reason?: string;
}

/** CREATOR_PERSONAL_EXPERIENCE is locked unless human-verified. No fake testimonials. */
export function checkClaims(claims: Claim[] | null | undefined): ClaimCheck {
  const blocked = (claims ?? []).filter((c) => c.type === "CREATOR_PERSONAL_EXPERIENCE" && !c.verified);
  return blocked.length
    ? { ok: false, blocked, reason: `${blocked.length} personal-experience claim(s) are not human-verified.` }
    : { ok: true, blocked: [] };
}
