// Builds personalised copy for the Audience Intelligence prompt dialog,
// using whatever fields are available on the brand row.

type BrandLike = {
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  vibe?: string | null;
  personality_traits?: string[] | null;
} | null | undefined;

export type AudiencePromptCopy = {
  heading: string;
  subheading: string;
  bullets: { title: string; body: string }[];
};

export function buildAudienceCopy(brand: BrandLike): AudiencePromptCopy {
  const name = (brand?.name || "Your brand").trim();
  const tagline = (brand?.tagline || "").trim();
  const description = (brand?.description || "").trim();

  const contextLine = tagline
    ? `“${tagline}” is a strong promise, but a promise only lands when it's pointed at the right person.`
    : description
      ? `${name} already has a clear story. The next leap is pointing that story at a specific human.`
      : `${name} has the voice set. The next leap is knowing exactly who that voice is for.`;

  const heading = `${name}, who exactly are you talking to?`;

  const subheading = `${contextLine} Right now, every suggestion we generate goes out to "everyone", which is the fastest way to be ignored. Tell us who actually buys from ${name}, and we'll rewrite every caption, hook, and visual to speak straight to them.`;

  const bullets = [
    {
      title: "Sharper targeting",
      body: `Posts speak to the specific people most likely to buy from ${name}, not a faceless crowd.`,
    },
    {
      title: "Persuasive copy",
      body: "Captions pull from real struggles, desires, and the exact language your buyers already use.",
    },
    {
      title: "Higher conversion",
      body: "Audience-aware designs consistently outperform generic posts, often by 2–3×.",
    },
  ];

  return { heading, subheading, bullets };
}
