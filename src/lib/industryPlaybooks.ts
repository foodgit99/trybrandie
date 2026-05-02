// Industry Playbooks — defaults the autonomous content engine runs on.
// Each playbook seeds 7 starter content ideas and provides sensible brand defaults.

export type PlaybookIdeaTemplate = {
  dayOffset: number; // 0 = today, 1 = tomorrow ...
  title: string;
  prompt: string;
  category: string; // matches contentCategories ids
  idea_type?: "single" | "carousel" | "campaign";
};

export type IndustryPlaybook = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  sample: string; // sample weekly cadence
  defaultVibe: string;
  defaultTone: string;
  defaultPersonality: string[];
  defaultPalette: { primary: string; secondary: string; accent: string };
  weeklyTemplate: PlaybookIdeaTemplate[];
};

const t = (
  dayOffset: number,
  title: string,
  prompt: string,
  category: string,
  idea_type: "single" | "carousel" | "campaign" = "single",
): PlaybookIdeaTemplate => ({ dayOffset, title, prompt, category, idea_type });

export const INDUSTRY_PLAYBOOKS: IndustryPlaybook[] = [
  {
    id: "restaurants",
    name: "Restaurants & Cafés",
    emoji: "🍽️",
    tagline: "Daily specials, weekend hype, regular-customer love.",
    sample: "Mon special · Wed behind-the-kitchen · Fri weekend hype · Sun gratitude post",
    defaultVibe: "Warm",
    defaultTone: "Warm and inviting, a little playful",
    defaultPersonality: ["Warm", "Approachable", "Playful"],
    defaultPalette: { primary: "#B8462E", secondary: "#F4E8D8", accent: "#2B2D33" },
    weeklyTemplate: [
      t(0, "Today's special", "A bold mouth-watering hero shot poster announcing today's special dish with price.", "promotion"),
      t(1, "Behind the kitchen", "A cinematic behind-the-scenes shot of the chef plating, captioned to build trust.", "behind_the_scenes"),
      t(2, "Customer love", "A clean testimonial card quoting a happy regular customer.", "social_proof"),
      t(3, "Did you know?", "An educational micro-fact about one of our signature ingredients.", "education"),
      t(4, "Weekend hype", "A vibrant weekend-vibes post inviting people to book a table.", "promotion"),
      t(5, "Order online", "A clean product-style post with a clear ORDER NOW call to action.", "promotion"),
      t(6, "Thank you", "A warm gratitude post thanking the community for the week.", "community"),
    ],
  },
  {
    id: "beauty",
    name: "Beauty & Salons",
    emoji: "💅",
    tagline: "Before/afters, booking nudges, treatment education.",
    sample: "Mon transformation · Wed treatment 101 · Fri booking nudge · Sun glow inspiration",
    defaultVibe: "Luxury",
    defaultTone: "Soft, confident, aspirational",
    defaultPersonality: ["Sophisticated", "Warm", "Inspiring"],
    defaultPalette: { primary: "#C4993B", secondary: "#FAF8F5", accent: "#2B2D33" },
    weeklyTemplate: [
      t(0, "Transformation Tuesday", "A clean side-by-side before/after style poster of a recent client treatment.", "social_proof"),
      t(1, "Treatment 101", "An educational explainer of one signature treatment and its benefit.", "education"),
      t(2, "Glow inspiration", "An aspirational lifestyle post showing the after-feeling, not the service.", "inspiration"),
      t(3, "Meet the artist", "A warm portrait-style post introducing one of the team members.", "behind_the_scenes"),
      t(4, "Booking nudge", "A clear, gentle reminder post with a BOOK NOW call to action for the weekend.", "promotion"),
      t(5, "Care tip", "A short take-home care tip educational post.", "education"),
      t(6, "Client love", "A testimonial card from a recent happy client.", "social_proof"),
    ],
  },
  {
    id: "fitness",
    name: "Fitness & Wellness",
    emoji: "💪",
    tagline: "Class promos, transformation stories, motivation Mondays.",
    sample: "Mon motivation · Wed class promo · Fri transformation · Sun recovery",
    defaultVibe: "Bold",
    defaultTone: "High-energy, encouraging, no-nonsense",
    defaultPersonality: ["Energetic", "Bold", "Inspiring"],
    defaultPalette: { primary: "#16A34A", secondary: "#0F172A", accent: "#FACC15" },
    weeklyTemplate: [
      t(0, "Motivation Monday", "A bold typographic motivation poster with a punchy one-liner.", "inspiration"),
      t(1, "Class promo", "A high-energy poster promoting this week's signature class with day & time.", "promotion"),
      t(2, "Form check", "A short educational tip post about one common training mistake.", "education"),
      t(3, "Transformation", "A respectful before/after style post celebrating a member's progress.", "social_proof"),
      t(4, "Weekend challenge", "A weekend mini-challenge post inviting members to participate.", "community"),
      t(5, "Recovery tip", "A calmer post about rest, mobility, or recovery.", "education"),
      t(6, "Member spotlight", "A warm spotlight post on one community member.", "community"),
    ],
  },
  {
    id: "retail",
    name: "Boutique Retail",
    emoji: "🛍️",
    tagline: "New arrivals, styling tips, sale countdowns.",
    sample: "Mon new in · Wed style guide · Fri offer · Sun lookbook",
    defaultVibe: "Minimal",
    defaultTone: "Crisp, stylish, confident",
    defaultPersonality: ["Sophisticated", "Bold", "Approachable"],
    defaultPalette: { primary: "#1E293B", secondary: "#FAF8F5", accent: "#C4993B" },
    weeklyTemplate: [
      t(0, "New in", "A clean editorial-style poster announcing a new arrival product.", "product_launch"),
      t(1, "Style this", "A styling tip post showing 3 ways to wear / use a featured product.", "education", "carousel"),
      t(2, "Customer fit", "A user-generated style testimonial card.", "social_proof"),
      t(3, "Limited offer", "A bold sale or limited-offer poster with clear deadline.", "promotion"),
      t(4, "Lookbook", "A moody lookbook hero image showcasing the season's mood.", "inspiration"),
      t(5, "Restock alert", "A clean alert-style post about a restocked bestseller.", "promotion"),
      t(6, "Thank-you note", "A warm thank-you post to weekend shoppers.", "community"),
    ],
  },
  {
    id: "services",
    name: "Professional Services",
    emoji: "💼",
    tagline: "Authority posts, client wins, lead-gen offers.",
    sample: "Mon insight · Wed case study · Fri offer · Sun thought-leadership",
    defaultVibe: "Corporate",
    defaultTone: "Confident, expert, plain-spoken",
    defaultPersonality: ["Authoritative", "Trustworthy", "Inspiring"],
    defaultPalette: { primary: "#1D4ED8", secondary: "#F8FAFC", accent: "#0F172A" },
    weeklyTemplate: [
      t(0, "Insight of the week", "A bold typographic insight post sharing one sharp opinion in our field.", "thought_leadership"),
      t(1, "Client win", "A clean case-study card highlighting a recent client outcome with a stat.", "social_proof"),
      t(2, "How we work", "An educational explainer of one piece of our process.", "education", "carousel"),
      t(3, "Myth vs fact", "A myth-busting post for our industry.", "education"),
      t(4, "Free consult offer", "A clean lead-gen poster offering a free consultation with a clear CTA.", "promotion"),
      t(5, "Tool we love", "A short post recommending a tool or framework we use.", "thought_leadership"),
      t(6, "Team note", "A warm post introducing the team or a team milestone.", "community"),
    ],
  },
  {
    id: "general",
    name: "Other small business",
    emoji: "✨",
    tagline: "A balanced weekly mix to keep your brand visible.",
    sample: "Mon promo · Wed education · Fri social proof · Sun community",
    defaultVibe: "Minimal",
    defaultTone: "Friendly and clear",
    defaultPersonality: ["Approachable", "Trustworthy", "Warm"],
    defaultPalette: { primary: "#2B2D33", secondary: "#FAF8F5", accent: "#C4993B" },
    weeklyTemplate: [
      t(0, "What we do", "A clean intro poster explaining what our business does in one sentence.", "education"),
      t(1, "Featured offer", "A bold poster highlighting our flagship offer with a clear CTA.", "promotion"),
      t(2, "Customer story", "A testimonial card from a happy customer.", "social_proof"),
      t(3, "Tip of the week", "A short educational tip post relevant to our audience.", "education"),
      t(4, "Behind the scenes", "A behind-the-scenes look at our work this week.", "behind_the_scenes"),
      t(5, "Inspiration", "An aspirational lifestyle post in our brand mood.", "inspiration"),
      t(6, "Thank you", "A warm community thank-you post.", "community"),
    ],
  },
];

export function getPlaybook(id: string | null | undefined): IndustryPlaybook {
  return INDUSTRY_PLAYBOOKS.find((p) => p.id === id) || INDUSTRY_PLAYBOOKS[INDUSTRY_PLAYBOOKS.length - 1];
}
