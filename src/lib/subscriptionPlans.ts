export interface SubscriptionPlan {
  id: "entrepreneur" | "creator" | "agency";
  name: string;
  priceNaira: number;
  monthlyCredits: number;
  brandLimit: number | null; // null = unlimited
  tagline: string;
  highlight?: boolean;
  features: {
    label: string;
    included: boolean;
  }[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "entrepreneur",
    name: "Entrepreneur",
    priceNaira: 18500,
    monthlyCredits: 100,
    brandLimit: 1,
    tagline: "Run one brand on autopilot.",
    features: [
      { label: "100 credits / month", included: true },
      { label: "1 brand", included: true },
      { label: "Content Hub", included: true },
      { label: "Brand Centre", included: true },
      { label: "AI Content Strategy", included: true },
      { label: "Referral program", included: true },
      { label: "Download designs", included: true },
      { label: "Team access", included: false },
      { label: "Client folders", included: false },
      { label: "White-label exports", included: false },
      { label: "Priority rendering", included: false },
    ],
  },
  {
    id: "creator",
    name: "Creator",
    priceNaira: 37000,
    monthlyCredits: 200,
    brandLimit: null,
    tagline: "For creators juggling multiple brands.",
    highlight: true,
    features: [
      { label: "200 credits / month", included: true },
      { label: "Multiple brands", included: true },
      { label: "Content Hub", included: true },
      { label: "Brand Centre", included: true },
      { label: "AI Content Strategy", included: true },
      { label: "Team access", included: true },
      { label: "Referral program", included: true },
      { label: "Download designs", included: true },
      { label: "Client folders", included: false },
      { label: "White-label exports", included: false },
      { label: "Priority rendering", included: false },
    ],
  },
  {
    id: "agency",
    name: "Agency",
    priceNaira: 92500,
    monthlyCredits: 500,
    brandLimit: null,
    tagline: "Built for studios with clients.",
    features: [
      { label: "500 credits / month", included: true },
      { label: "Multiple brands", included: true },
      { label: "Team access", included: true },
      { label: "Client folders", included: true },
      { label: "White-label exports", included: true },
      { label: "Priority rendering", included: true },
      { label: "Content Hub", included: true },
      { label: "Brand Centre", included: true },
      { label: "AI Content Strategy", included: true },
      { label: "Referral program", included: true },
      { label: "Download designs", included: true },
    ],
  },
];

export const formatNaira = (amount: number) => `₦${amount.toLocaleString()}`;
