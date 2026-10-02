export const PLATFORMS = [
  { value: "whatsapp_status", label: "WhatsApp Status" },
  { value: "whatsapp_chat", label: "WhatsApp chats/groups" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X" },
  { value: "other", label: "Other" },
] as const;
export type Platform = (typeof PLATFORMS)[number]["value"];
export const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label ?? p;

export const AGE_BRACKETS = ["18-24", "25-34", "35-44", "45-54", "55+"] as const;
export const AUDIENCE_AGE_BRACKETS = ["13-17", ...AGE_BRACKETS] as const;

export type PnRole = "admin" | "moderator" | "finance";

export interface Publisher {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "suspended" | "rejected" | "deleted";
  status_reason: string | null;
  display_name: string | null;
  occupation: string | null;
  location_country: string | null;
  location_state: string | null;
  location_city: string | null;
  age_bracket: string | null;
  languages: string[];
  interests: string[];
  communities: string[];
  industries: string[];
  school: string | null;
  workplace: string | null;
  affiliations: string[];
  platforms: string[];
  audience_size_estimate: number | null;
  audience_views_estimate: number | null;
  audience_geographies: string[];
  audience_age_brackets: string[];
  creator_link_status: "none" | "pending" | "verified" | "rejected";
  creator_link_code: string | null;
  payout_details: { bank_name?: string; account_number?: string; account_name?: string };
  is_test: boolean;
}

export interface FeedItem {
  creative_id: string;
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  description: string | null;
  brand_name: string;
  brand_logo: string | null;
  media_type: "image" | "video";
  media_source: string;
  public_media_url: string | null;
  caption: string | null;
  base_fee_ngn: number;
  action_bonus_ngn: number;
  commission_pct: number;
  ends_at: string | null;
  platforms: string[];
  score: number;
  score_version: string;
  reasons: string[];
  liked: boolean;
  saved: boolean;
  my_placement_status: string | null;
}

export interface MyPlacement {
  id: string;
  token: string;
  status: PlacementStatus;
  platform: string;
  campaign_name: string;
  campaign_code: string;
  brand_name: string;
  creative_id: string;
  media_type: "image" | "video";
  caption: string | null;
  base_fee: number;
  action_bonus: number;
  commission_pct: number;
  share_method: string | null;
  share_initiated_at: string | null;
  proof_submitted_at: string | null;
  proof_url: string | null;
  reject_reason: string | null;
  resubmission_count: number;
  verified_at: string | null;
  clicks: number;
  leads: number;
  conversions: number;
  earned: number;
  created_at: string;
  campaign_status: string;
}

export type PlacementStatus = "reserved" | "share_initiated" | "proof_submitted" | "verified" | "rejected" | "cancelled";

export const PLACEMENT_STATUS_LABEL: Record<PlacementStatus, string> = {
  reserved: "Draft — not shared yet",
  share_initiated: "Shared? Add proof",
  proof_submitted: "Proof in review",
  verified: "Verified",
  rejected: "Proof rejected",
  cancelled: "Cancelled",
};

export interface Balance { pending: number; available: number; paid: number; reversed: number; requested: number }
