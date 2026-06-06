// Marketing kit content shared between the public marketing page preview
// and the dashboard "Marketing Kit" tab.

export interface SwipePost {
  id: string;
  label: string;
  channel: "twitter" | "whatsapp" | "instagram" | "email" | "general";
  body: string;
}

export const SWIPE_POSTS: SwipePost[] = [
  {
    id: "edu-1",
    label: "Educational - How I save 10hrs/week",
    channel: "twitter",
    body:
      "I used to spend hours each week designing Instagram posts.\n\nNow Brandie generates on-brand graphics for me in under a minute - colors, fonts, copy, all my brand.\n\nIf you run a small business, try it: {LINK}",
  },
  {
    id: "promo-1",
    label: "Promotional - Direct ask",
    channel: "general",
    body:
      "Brandie is the AI Brand Studio I wish I had years ago. It learns your brand and creates social graphics that actually look professional.\n\nGet started → {LINK}",
  },
  {
    id: "story-1",
    label: "Story - Before/after",
    channel: "instagram",
    body:
      "Before: 4 hours wrestling with Canva, settling for okay.\nAfter: 30 seconds with Brandie, on-brand and on-trend.\n\nGame changer for solo founders → {LINK}",
  },
  {
    id: "wa-1",
    label: "WhatsApp - Friend-to-friend",
    channel: "whatsapp",
    body:
      "Hey! Quick one - I've been using this AI tool called Brandie for my social posts. It learns your brand and just spits out clean graphics. Worth a look: {LINK}",
  },
  {
    id: "email-1",
    label: "Email - Newsletter mention",
    channel: "email",
    body:
      "One tool I've been loving: Brandie. It's basically an AI creative director that knows your brand and generates social graphics in seconds. If you're a solo operator or run an agency, this saves real time. Check it out: {LINK}",
  },
  {
    id: "testimonial-1",
    label: "Testimonial - Result-focused",
    channel: "twitter",
    body:
      "Posted 3x more this week than last month.\n\nNot because I worked harder - because Brandie removed the design bottleneck.\n\n→ {LINK}",
  },
];

export const FTC_DISCLOSURE =
  "Disclosure: I'm a Brandie affiliate. If you sign up through my link, I may earn a commission at no extra cost to you. I only share tools I actually use.";

export interface BannerAsset {
  id: string;
  label: string;
  ratio: string;            // e.g. "1:1"
  dimensions: string;       // e.g. "1080x1080"
  description: string;
}

export const BANNER_ASSETS: BannerAsset[] = [
  { id: "square", label: "Square (Feed)", ratio: "1:1", dimensions: "1080×1080", description: "Instagram / X / LinkedIn feed posts" },
  { id: "story", label: "Story", ratio: "9:16", dimensions: "1080×1920", description: "Instagram & TikTok stories, Reels covers" },
  { id: "banner", label: "Wide Banner", ratio: "16:9", dimensions: "1920×1080", description: "YouTube end cards, blog headers, X header" },
];
