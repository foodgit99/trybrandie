

## Plan: Generate & Integrate a Conversion-Optimised Hero Image

### Context
The landing page hero currently uses a static `.jpg` screenshot (`landing-hero-designs.jpg`). This is the most prominent visual on the page and directly impacts conversion. We'll use AI image generation (Gemini 3.1 Flash Image — the latest fast model with pro-level quality) to create a compelling, on-brand hero image, then replace the static import.

### What the Image Should Show
A conversion-optimised hero image for an AI brand studio needs to:
- **Show the product in action** — a sleek, modern UI mockup with a chat interface on the left and beautiful social media designs on the right
- **Convey instant value** — multiple polished social graphics visible, suggesting variety and speed
- **Feel premium** — Apple-level polish, warm neutral tones matching Brandie's palette (warm beige `#FAF8F5`, dark charcoal `#2B2D33`, gold accent `#C4993B`)
- **Create aspiration** — the designs shown should look professionally crafted
- **Include social proof cues** — subtle UI elements like "Generated in 8s" or brand consistency indicators

### Steps

1. **Generate the hero image** using `google/gemini-3.1-flash-image-preview` (Nano Banana 2) via the AI gateway script with a detailed, conversion-focused prompt. The prompt will describe a premium product screenshot mockup showing Brandie's split-screen interface with chat + beautiful generated designs.

2. **QA the generated image** — convert to viewable format and inspect for quality, layout, text legibility, and brand alignment. Regenerate if needed.

3. **Replace the existing hero image** — save as `landing-hero-designs.jpg` (or `.png`) in `src/assets/` and update the import in `LandingHero.tsx` if the extension changes.

4. **Enhance the hero image presentation** — add a subtle gradient overlay or glow effect behind the image to make it pop more against the page background, improving visual hierarchy and conversion.

### Latency & Cost
- One-time generation cost (not per-user). No runtime impact.
- `google/gemini-3.1-flash-image-preview` is the latest model with fast generation and pro-level quality.

### Technical Details
- Image will be generated at high resolution for crisp display on retina screens
- Output saved to `src/assets/` to replace the current static asset
- No changes to edge functions or database — purely a frontend asset swap
- The `LandingHero.tsx` component structure stays the same; only the image source changes

