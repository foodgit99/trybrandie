import { supabase } from "@/integrations/supabase/client";
import type { PlanId } from "@/hooks/useSubscription";

export type ReportTier = "free" | "entrepreneur" | "creator" | "agency";

export type ReportAccess = {
  /** Effective plan for the brand (owner's active subscription, or "free"). */
  tier: ReportTier;
  /** True when the current user is not the brand owner but has active team access. */
  isTeamMember: boolean;
  /** Label used on the footer / watermark (e.g. "Prepared by teammate@x.com"). */
  preparedByEmail: string | null;
};

const KNOWN: ReportTier[] = ["free", "entrepreneur", "creator", "agency"];

function coerceTier(v: string | null | undefined): ReportTier {
  const s = (v ?? "").toLowerCase() as ReportTier;
  return KNOWN.includes(s) ? s : "free";
}

/**
 * Resolves the effective subscription tier for a brand, which governs what the
 * exported PDF may contain. Team members inherit the brand owner's plan (that
 * is how the rest of the app already treats gated features), so we always look
 * up the owner's `subscriptions` row rather than the caller's.
 */
export async function resolveReportAccess(brandId: string): Promise<ReportAccess> {
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData?.user?.id ?? null;
  const currentEmail = authData?.user?.email ?? null;

  const { data: brand } = await supabase
    .from("brands")
    .select("user_id")
    .eq("id", brandId)
    .maybeSingle();
  const ownerId = (brand as any)?.user_id ?? null;

  let tier: ReportTier = "free";
  if (ownerId) {
    const { data: sub } = await supabase
      .from("subscriptions" as any)
      .select("plan_id, status")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (sub && (sub as any).status === "active") {
      tier = coerceTier((sub as any).plan_id as PlanId);
    } else {
      const { data: prof } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("user_id", ownerId)
        .maybeSingle();
      tier = coerceTier((prof as any)?.subscription_tier);
    }
  }

  const isTeamMember = !!currentUserId && !!ownerId && currentUserId !== ownerId;
  return {
    tier,
    isTeamMember,
    preparedByEmail: isTeamMember ? currentEmail : null,
  };
}

/** What the PDF builder is allowed to include for a given plan. */
export type ReportPolicy = {
  /** Watermark strategy applied to every page. */
  watermark: "none" | "footer" | "diagonal";
  /** Text shown by the watermark (empty when watermark is "none"). */
  watermarkText: string;
  /** Include the "Why it matters" rationale column on the signals table. */
  showSignalRationale: boolean;
  /** Include the "Their public surface" snapshot excerpts section. */
  showSnapshotExcerpts: boolean;
  /** Include the "What to steal this week" ideas table. */
  showIdeas: boolean;
  /** Include full "Recommended action steps" (false = show upgrade card only). */
  showRecommendedActions: boolean;
  /** Include the full sources & citations appendix. */
  showSourcesAppendix: boolean;
  /** Cap the number of signals rendered in the detail table (null = no cap). */
  maxSignalsInTable: number | null;
  /** Cap the number of ideas rendered (null = no cap). */
  maxIdeas: number | null;
  /** Cap the number of citations in the appendix (null = no cap). */
  maxCitations: number | null;
  /** Human-readable label for the tier badge on the cover. */
  tierLabel: string;
  /** True when the report is a full, unrestricted export. */
  isFull: boolean;
};

export function policyForTier(tier: ReportTier): ReportPolicy {
  switch (tier) {
    case "agency":
      return {
        watermark: "none",
        watermarkText: "",
        showSignalRationale: true,
        showSnapshotExcerpts: true,
        showIdeas: true,
        showRecommendedActions: true,
        showSourcesAppendix: true,
        maxSignalsInTable: null,
        maxIdeas: null,
        maxCitations: null,
        tierLabel: "Agency",
        isFull: true,
      };
    case "creator":
      return {
        watermark: "footer",
        watermarkText: "Prepared with Brandie · Creator",
        showSignalRationale: true,
        showSnapshotExcerpts: true,
        showIdeas: true,
        showRecommendedActions: true,
        showSourcesAppendix: true,
        maxSignalsInTable: null,
        maxIdeas: null,
        maxCitations: null,
        tierLabel: "Creator",
        isFull: true,
      };
    case "entrepreneur":
      return {
        watermark: "footer",
        watermarkText: "Prepared with Brandie · Entrepreneur",
        showSignalRationale: true,
        showSnapshotExcerpts: false,
        showIdeas: true,
        showRecommendedActions: true,
        showSourcesAppendix: true,
        maxSignalsInTable: 20,
        maxIdeas: 10,
        maxCitations: 8,
        tierLabel: "Entrepreneur",
        isFull: false,
      };
    case "free":
    default:
      return {
        watermark: "diagonal",
        watermarkText: "SAMPLE · Brandie Free",
        showSignalRationale: false,
        showSnapshotExcerpts: false,
        showIdeas: false,
        showRecommendedActions: false,
        showSourcesAppendix: false,
        maxSignalsInTable: 5,
        maxIdeas: 0,
        maxCitations: 0,
        tierLabel: "Free preview",
        isFull: false,
      };
  }
}
