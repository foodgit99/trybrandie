

# Plan: Make Video Pipeline Brand-Aware

## Problem
The video pipeline assembles brand context for the Strategy and Script agents, but the **scene image generation** and **Veo video rendering** stages ignore most brand data. Specifically:

- `generateSceneImage` only passes `brand.primary_colors` — no tone, personality, vibe, special instructions, typography, secondary/accent colors, or audience signals
- `video-render` sends raw `scene.description` to Veo with zero brand context — no colors, style direction, or audience psychology

This means the visual output (both storyboard frames and rendered videos) has no brand alignment.

## Changes

### 1. Enrich scene image prompts (`video-studio/index.ts`)

Update `generateSceneImage` to accept the full assembled brand context string (already built by `assembleContext`) and inject it into the image prompt. The prompt will include:
- Brand name, tone, vibe, personality traits
- Full color palette (primary, secondary, accent)
- Typography direction
- Special instructions
- Audience emotional drivers and visual psychology cues
- Trend styling if enabled

### 2. Enrich Veo render prompts (`video-render/index.ts`)

Update the render function to:
- Fetch the brand data (`brands`, `target_audiences`, `brand_trend_preferences`) using the project's `brand_id`
- Build a brand-aware prompt that wraps each scene description with brand styling directives (colors, mood, tone, visual style)
- Pass this enriched prompt to the Veo API instead of the bare `scene.description`

### 3. Add brand context to script visual descriptions

Update the Script Agent system prompt to explicitly instruct it to embed brand visual language (colors, textures, mood) into each scene's `visual_description` field. This ensures that even the raw descriptions carry brand DNA before they reach the image/video generators.

## Files Changed

1. **`supabase/functions/video-studio/index.ts`**
   - Pass full context string to `generateSceneImage`
   - Rewrite image prompt to include brand colors (all tiers), tone, personality, vibe, special instructions, audience signals, and trend styling
   - Update Script Agent system prompt to require brand-embedded visual descriptions

2. **`supabase/functions/video-render/index.ts`**
   - Add `assembleContext`-style brand data fetching (brand, audience, trends)
   - Build enriched Veo prompts: `"[Brand context + style directives]. Scene: [description]"`
   - Include brand color palette, mood, and visual style in every Veo request

