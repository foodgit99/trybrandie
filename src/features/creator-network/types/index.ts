export const CN_ROLES = ["admin", "research", "partnerships", "production", "sales"] as const;
export type CnRole = (typeof CN_ROLES)[number];

export const CREATOR_STATUSES = [
  "Researched", "Qualified", "Contact Pending", "Contacted", "Interested", "Needs Human",
  "Validation Pending", "Validation Passed", "Ready for Licence", "Licensed", "Paused", "Rejected",
] as const;

export const OPPORTUNITY_STAGES = [
  "Identified", "Validated", "Creative Strategy", "Ready for Production", "Producing", "QA",
  "Ready for Outreach", "Outreach Sent", "Engaged", "Checkout", "Won", "Lost", "Fulfilled",
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const CONCEPT_STATUSES = ["Draft", "Selected", "Approved", "Rejected", "Needs Revision"] as const;
export const CREATOR_ROLES = ["Spokesperson", "Demonstrator", "Customer Proxy", "Host", "Lifestyle Model", "Narrator"] as const;
export const CLAIM_TYPES = ["FACTUAL_PRODUCT_CLAIM", "BRAND_PROVIDED_CLAIM", "CREATOR_PERSONAL_EXPERIENCE", "CREATIVE_OPINION"] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const PRODUCTION_STAGES = [
  "Brief", "Script", "Storyboard", "Asset Prep", "Scene Generation", "Assembly", "AI QA", "Human QA", "Watermark", "Ready",
] as const;
export const REVIEW_DECISIONS = ["Approve", "Edit", "Reject", "Regenerate"] as const;

export const TASK_STATUSES = [
  "Backlog", "Ready", "In Progress", "Waiting on AI", "Waiting on Human", "Waiting on Creator",
  "Waiting on Business", "Blocked", "Review", "Done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const AI_RUN_STATUSES = ["Queued", "Running", "Completed", "Failed", "Needs Review"] as const;

export const EVIDENCE_CLASSES = ["Verified", "Estimated", "Inferred", "Self-reported", "Human-confirmed", "Unknown"] as const;
export const CONFIDENCE = ["High", "Medium", "Low", "Unknown"] as const;

export const SALE_STATUSES = ["Draft", "Sent", "Responded", "Negotiating", "Won", "Lost"] as const;
export const RESPONSE_CLASSES = [
  "Interested", "Not Interested", "Needs More Information", "Price Objection", "Timing Objection",
  "Creator Concern", "No Response", "Wrong Contact", "Negotiating", "Won", "Lost",
] as const;

export const VALIDATION_TYPES = [
  "licensing_interest", "likeness_licensing", "voice_licensing", "paid_ad_permission", "organic_ad_permission",
  "creator_posted_permission", "approval_requirements", "restricted_industries", "restricted_brands",
  "geographic_usage_rights", "licence_duration", "compensation_expectations", "rates", "recent_video_samples",
  "audience_insights", "identity_verification", "camera_test", "digital_twin_test", "voice_reproduction_test",
  "motion_reproduction_test",
] as const;
export type ValidationType = (typeof VALIDATION_TYPES)[number];

export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Loose row type — Creator Network tables share id/is_test/record_source. */
export type Row = { id: string; [key: string]: any };
