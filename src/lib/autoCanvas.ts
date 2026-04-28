/**
 * Auto Canvas Resolver
 * --------------------
 * Picks the best canvas preset for a given user prompt by detecting
 * platform mentions (Instagram, Facebook, TikTok, LinkedIn, YouTube,
 * Twitter/X, Pinterest) and intent keywords (story, reel, feed, post,
 * cover, banner, portrait, landscape, square, pin, etc.).
 *
 * Kept in its own module so it can be unit-tested in isolation.
 */

export type CanvasPreset = {
  label: string;
  value: string;
  aspect: string;
  platform: string;
};

export const CANVAS_PRESETS: CanvasPreset[] = [
  // Instagram
  { platform: "Instagram", label: "Instagram Post · Square (1080×1080)", value: "1080x1080", aspect: "1 / 1" },
  { platform: "Instagram", label: "Instagram Post · Portrait (1080×1350)", value: "1080x1350", aspect: "4 / 5" },
  { platform: "Instagram", label: "Instagram Story / Reel (1080×1920)", value: "1080x1920", aspect: "9 / 16" },
  // Facebook
  { platform: "Facebook", label: "Facebook Feed (1200×630)", value: "1200x630", aspect: "1200 / 630" },
  { platform: "Facebook", label: "Facebook Story (1080×1920)", value: "fb-1080x1920", aspect: "9 / 16" },
  { platform: "Facebook", label: "Facebook Cover (1640×924)", value: "1640x924", aspect: "1640 / 924" },
  // TikTok
  { platform: "TikTok", label: "TikTok Vertical (1080×1920)", value: "tt-1080x1920", aspect: "9 / 16" },
  // LinkedIn
  { platform: "LinkedIn", label: "LinkedIn Post (1200×627)", value: "1200x627", aspect: "1200 / 627" },
  { platform: "LinkedIn", label: "LinkedIn Cover (1584×396)", value: "1584x396", aspect: "1584 / 396" },
  // YouTube / Twitter
  { platform: "YouTube", label: "YouTube / Landscape (1920×1080)", value: "1920x1080", aspect: "16 / 9" },
  { platform: "Twitter / X", label: "Twitter / X Post (1600×900)", value: "1600x900", aspect: "16 / 9" },
  // Pinterest
  { platform: "Pinterest", label: "Pinterest Pin (1000×1500)", value: "1000x1500", aspect: "2 / 3" },
];

export const AUTO_CANVAS_VALUE = "auto";
export const AUTO_PREVIEW_ASPECT = "1 / 1";

/**
 * Normalize the prompt for matching:
 *  - lowercase
 *  - collapse punctuation to spaces (so " ig," -> " ig ")
 *  - pad with spaces so word-boundary checks like " ig " always work
 */
const normalize = (input: string): string => {
  const lowered = (input || "").toLowerCase();
  // Replace anything that is not a letter/number/colon/x with a space.
  // Keep ":" and "x" so "9:16" / "4x5" survive.
  const cleaned = lowered.replace(/[^a-z0-9:×x]/g, " ").replace(/\s+/g, " ").trim();
  return ` ${cleaned} `;
};

/**
 * Whole-word matcher. Each needle is matched against the padded text using
 * word boundaries — prevents false positives like "story" matching "history".
 * Multi-word needles (with spaces) are matched as substrings of the padded text.
 */
const makeMatcher = (text: string) => (...needles: string[]): boolean =>
  needles.some((needle) => {
    const n = needle.toLowerCase().trim();
    if (!n) return false;
    if (n.includes(" ")) return text.includes(` ${n} `);
    return text.includes(` ${n} `);
  });

const find = (value: string): CanvasPreset =>
  CANVAS_PRESETS.find((p) => p.value === value)!;

/**
 * Pick the best CANVAS_PRESETS entry for a given user prompt.
 */
export const resolveAutoCanvas = (prompt: string): CanvasPreset => {
  const text = normalize(prompt);
  const has = makeMatcher(text);

  // ---- Platform mentions ---------------------------------------------------
  const mentionsInstagram = has(
    "instagram", "insta", "ig", "igtv", "gram"
  );
  const mentionsFacebook = has(
    "facebook", "fb", "meta"
  );
  const mentionsTikTok = has(
    "tiktok", "tik tok", "tt"
  );
  const mentionsLinkedIn = has(
    "linkedin", "linked in", "li"
  );
  const mentionsTwitter = has(
    "twitter", "tweet", "tweets", "x post", "x/twitter", "xtwitter"
  );
  const mentionsYouTube = has(
    "youtube", "yt", "youtu be", "shorts"
  );
  const mentionsPinterest = has(
    "pinterest", "pin"
  );

  // ---- Intent keywords -----------------------------------------------------
  // Vertical / story / reel
  const wantsStory = has(
    "story", "stories", "story ad", "reel", "reels",
    "vertical", "9:16", "fullscreen", "full screen",
    "shorts", "short", "snap", "snapchat", "status"
  );
  // Cover / banner / header
  const wantsCover = has(
    "cover", "cover photo", "cover image",
    "banner", "header", "hero", "masthead", "channel art"
  );
  // Landscape / wide
  const wantsLandscape = has(
    "landscape", "horizontal", "wide", "widescreen",
    "thumbnail", "thumb", "16:9", "youtube thumbnail"
  );
  // Pinterest pin / tall
  const wantsPin = has("pin", "tall", "2:3");
  // Portrait
  const wantsPortrait = has(
    "portrait", "4:5", "4x5", "tall post"
  );
  // Square
  const wantsSquare = has("square", "1:1", "1x1");
  // Generic "feed/post" keywords (used as a tiebreaker for platform feeds)
  const wantsFeed = has(
    "feed", "post", "in feed", "in-feed", "timeline", "grid", "carousel"
  );

  // ---- Resolution priority -------------------------------------------------
  // 1) Vertical (story/reel/shorts) — platform-specific
  if (wantsStory) {
    if (mentionsFacebook) return find("fb-1080x1920");
    if (mentionsTikTok) return find("tt-1080x1920");
    if (mentionsYouTube) return find("1080x1920"); // YT Shorts → 9:16
    return find("1080x1920"); // IG story/reel default
  }

  // 2) Cover / banner / header
  if (wantsCover) {
    if (mentionsLinkedIn) return find("1584x396");
    if (mentionsYouTube) return find("1920x1080"); // YT channel art-ish → 16:9
    return find("1640x924"); // Facebook cover default
  }

  // 3) Pinterest pin
  if (wantsPin && (mentionsPinterest || !wantsFeed)) {
    if (mentionsPinterest || has("tall", "2:3")) return find("1000x1500");
  }
  if (mentionsPinterest) return find("1000x1500");

  // 4) Landscape / thumbnail
  if (wantsLandscape) {
    if (mentionsTwitter) return find("1600x900");
    if (mentionsFacebook) return find("1200x630");
    if (mentionsLinkedIn) return find("1200x627");
    return find("1920x1080"); // YouTube default
  }

  // 5) Platform-specific feed defaults
  if (mentionsLinkedIn) return find("1200x627");
  if (mentionsTwitter) return find("1600x900");
  if (mentionsYouTube) return find("1920x1080");
  if (mentionsFacebook) return find("1200x630");
  if (mentionsTikTok) return find("tt-1080x1920");

  // 6) Instagram defaults
  if (mentionsInstagram) {
    if (wantsPortrait) return find("1080x1350");
    if (wantsSquare) return find("1080x1080");
    if (wantsFeed) return find("1080x1350"); // portrait beats square for feed engagement
    return find("1080x1080");
  }

  // 7) Generic intent without platform
  if (wantsPortrait) return find("1080x1350");
  if (wantsLandscape) return find("1920x1080");
  if (wantsSquare) return find("1080x1080");

  // Final fallback — most universally usable
  return find("1080x1080");
};
