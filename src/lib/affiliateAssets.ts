// Marketing kit content shared between the public marketing page preview
// and the dashboard "Marketing Kit" tab.

import founder1x1 from "@/assets/affiliate-banners/founder-1x1.jpg.asset.json";
import founder9x16 from "@/assets/affiliate-banners/founder-9x16.jpg.asset.json";
import founder16x9 from "@/assets/affiliate-banners/founder-16x9.jpg.asset.json";
import product1x1 from "@/assets/affiliate-banners/product-1x1.jpg.asset.json";
import product9x16 from "@/assets/affiliate-banners/product-9x16.jpg.asset.json";
import product16x9 from "@/assets/affiliate-banners/product-16x9.jpg.asset.json";

export interface SwipePost {
  id: string;
  label: string;
  channel: "twitter" | "whatsapp" | "instagram" | "email" | "general";
  body: string;
}

export const SWIPE_POSTS: SwipePost[] = [
  {
    id: "edu-1",
    label: "Educational, How I save 10hrs/week",
    channel: "twitter",
    body:
      "I used to spend hours each week designing Instagram posts.\n\nNow Brandie generates on-brand graphics for me in under a minute, colors, fonts, copy, all my brand.\n\nIf you run a small business, try it: {LINK}",
  },
  {
    id: "promo-1",
    label: "Promotional, Direct ask",
    channel: "general",
    body:
      "Brandie is the Content Engine I wish I had years ago. It learns your brand and creates social graphics that actually look professional.\n\nGet started → {LINK}",
  },
  {
    id: "story-1",
    label: "Story, Before/after",
    channel: "instagram",
    body:
      "Before: 4 hours wrestling with Canva, settling for okay.\nAfter: 30 seconds with Brandie, on-brand and on-trend.\n\nGame changer for solo founders → {LINK}",
  },
  {
    id: "wa-1",
    label: "WhatsApp, Friend-to-friend",
    channel: "whatsapp",
    body:
      "Hey! Quick one, I've been using this AI tool called Brandie for my social posts. It learns your brand and just spits out clean graphics. Worth a look: {LINK}",
  },
  {
    id: "email-1",
    label: "Email, Newsletter mention",
    channel: "email",
    body:
      "One tool I've been loving: Brandie. It's basically an AI creative director that knows your brand and generates social graphics in seconds. If you're a solo operator or run an agency, this saves real time. Check it out: {LINK}",
  },
  {
    id: "testimonial-1",
    label: "Testimonial, Result-focused",
    channel: "twitter",
    body:
      "Posted 3x more this week than last month.\n\nNot because I worked harder, because Brandie removed the design bottleneck.\n\n→ {LINK}",
  },
];

export const FTC_DISCLOSURE =
  "Disclosure: I'm a Brandie affiliate. If you sign up through my link, I may earn a commission at no extra cost to you. I only share tools I actually use.";

export type BannerStyle = "founder" | "product";

export interface BannerAsset {
  id: string;
  style: BannerStyle;
  label: string;
  ratio: "1:1" | "9:16" | "16:9";
  dimensions: string;
  description: string;
  imageUrl: string;
  fileName: string;
}

export const BANNER_STYLES: { id: BannerStyle; label: string; description: string }[] = [
  {
    id: "founder",
    label: "Founder-led",
    description: "Warm editorial portrait, ideal for personal brand posts.",
  },
  {
    id: "product",
    label: "Product-led",
    description: "Bold product mockup, ideal for newsletters and launch posts.",
  },
];

export const BANNER_ASSETS: BannerAsset[] = [
  // Founder style
  {
    id: "founder-square",
    style: "founder",
    label: "Square (Feed)",
    ratio: "1:1",
    dimensions: "1024×1024",
    description: "Instagram / X / LinkedIn feed posts",
    imageUrl: founder1x1.url,
    fileName: "brandie-affiliate-founder-square.jpg",
  },
  {
    id: "founder-story",
    style: "founder",
    label: "Story",
    ratio: "9:16",
    dimensions: "1088×1920",
    description: "Instagram & TikTok stories, Reels covers",
    imageUrl: founder9x16.url,
    fileName: "brandie-affiliate-founder-story.jpg",
  },
  {
    id: "founder-banner",
    style: "founder",
    label: "Wide Banner",
    ratio: "16:9",
    dimensions: "1920×1088",
    description: "YouTube end cards, blog headers, X header",
    imageUrl: founder16x9.url,
    fileName: "brandie-affiliate-founder-wide.jpg",
  },
  // Product style
  {
    id: "product-square",
    style: "product",
    label: "Square (Feed)",
    ratio: "1:1",
    dimensions: "1024×1024",
    description: "Instagram / X / LinkedIn feed posts",
    imageUrl: product1x1.url,
    fileName: "brandie-affiliate-product-square.jpg",
  },
  {
    id: "product-story",
    style: "product",
    label: "Story",
    ratio: "9:16",
    dimensions: "1088×1920",
    description: "Instagram & TikTok stories, Reels covers",
    imageUrl: product9x16.url,
    fileName: "brandie-affiliate-product-story.jpg",
  },
  {
    id: "product-banner",
    style: "product",
    label: "Wide Banner",
    ratio: "16:9",
    dimensions: "1920×1088",
    description: "YouTube end cards, blog headers, X header",
    imageUrl: product16x9.url,
    fileName: "brandie-affiliate-product-wide.jpg",
  },
];
