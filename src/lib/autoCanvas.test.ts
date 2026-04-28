import { describe, it, expect } from "vitest";
import { resolveAutoCanvas } from "./autoCanvas";

const cases: Array<{ prompt: string; value: string; note?: string }> = [
  // Instagram
  { prompt: "Create an Instagram feed post about our new launch", value: "1080x1350", note: "IG feed → portrait" },
  { prompt: "instagram square promo for coffee", value: "1080x1080" },
  { prompt: "make an IG story for our sale", value: "1080x1920" },
  { prompt: "Reel cover for our new product", value: "1080x1920", note: "reel beats cover" },
  { prompt: "instagram portrait post", value: "1080x1350" },

  // Facebook
  { prompt: "Facebook feed ad for Black Friday", value: "1200x630" },
  { prompt: "fb story ad for the weekend", value: "fb-1080x1920" },
  { prompt: "Facebook cover photo for our page", value: "1640x924" },

  // TikTok
  { prompt: "tiktok vertical promo", value: "tt-1080x1920" },
  { prompt: "tik tok story for new drop", value: "tt-1080x1920" },

  // LinkedIn
  { prompt: "LinkedIn post announcing a hire", value: "1200x627" },
  { prompt: "LinkedIn cover banner for my profile", value: "1584x396" },

  // YouTube
  { prompt: "YouTube thumbnail for episode 3", value: "1920x1080" },
  { prompt: "youtube shorts intro", value: "1080x1920" },

  // Twitter / X
  { prompt: "twitter post graphic about our launch", value: "1600x900" },
  { prompt: "tweet image for announcement", value: "1600x900" },

  // Pinterest
  { prompt: "Pinterest pin for our recipe", value: "1000x1500" },

  // Generic intents (no platform)
  { prompt: "make a tall portrait graphic", value: "1080x1350" },
  { prompt: "wide landscape banner image", value: "1640x924", note: "cover wins over landscape" },
  { prompt: "horizontal 16:9 hero image", value: "1640x924", note: "hero=cover" },
  { prompt: "square graphic for general use", value: "1080x1080" },

  // Synonym spot checks
  { prompt: "story ad on instagram", value: "1080x1920" },
  { prompt: "cover photo for facebook", value: "1640x924" },
  { prompt: "in-feed post for instagram", value: "1080x1350" },
  { prompt: "carousel for instagram", value: "1080x1350" },

  // Edge cases — should NOT trip on substrings
  { prompt: "history of our brand poster", value: "1080x1080", note: "'history' must not match 'story'" },
  { prompt: "pinwheel illustration", value: "1080x1080", note: "'pinwheel' must not match 'pin'" },
  { prompt: "", value: "1080x1080", note: "empty fallback" },
  { prompt: "   ", value: "1080x1080", note: "whitespace fallback" },
];

describe("resolveAutoCanvas", () => {
  for (const { prompt, value, note } of cases) {
    it(`"${prompt || "<empty>"}" → ${value}${note ? ` (${note})` : ""}`, () => {
      const result = resolveAutoCanvas(prompt);
      expect(result.value).toBe(value);
    });
  }

  it("returns a real preset object with a label and aspect", () => {
    const r = resolveAutoCanvas("instagram story");
    expect(r).toHaveProperty("label");
    expect(r).toHaveProperty("aspect");
    expect(r.platform).toBe("Instagram");
  });
});
