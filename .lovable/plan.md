

# Logo Designer Agent

## Overview
Add a "Create a logo" option alongside the existing upload flow — both during onboarding (step 3) and in the Brand Centre logo section. A minimal dialog collects a few preferences, then a new edge function generates a brand-aligned logo using the image generation model, pulling live brand data from the database.

## UI Changes

### Brand Centre (`src/pages/BrandCentre.tsx`)
- In the Logo section (line 486-499), when there's no logo, show a "Create with AI" button next to the "Replace/Upload" button
- When clicked, opens a `LogoDesignerDialog` component

### Onboarding (`src/pages/Onboarding.tsx`)
- In step 3 (line 257-278), below the upload drop zone, add a divider with "or" and a "Create with AI" button
- Opens the same `LogoDesignerDialog`

### `LogoDesignerDialog` Component (new file: `src/components/LogoDesignerDialog.tsx`)
- Clean dialog with 3 simple fields:
  - **Logo style** — icon-based chips: Wordmark, Lettermark, Icon + Text, Abstract Symbol, Mascot
  - **Visual feel** — reuse existing vibes (Minimal, Bold, Luxury, Playful, Corporate, Cinematic)
  - **Additional notes** — optional short text input for specific requests
- "Generate Logo" button → shows loading state with a generating message
- Result displayed in the dialog with "Use this logo" and "Try again" buttons
- "Use this logo" uploads to `brand-logos` bucket, updates the brand record, and closes

## New Edge Function: `supabase/functions/logo-designer/index.ts`

- Accepts: `{ brand_id, style, visual_feel, notes }` + auth token
- Loads full brand context from DB: name, tagline, description, vibe, colors, typography, personality, tone, special_instructions
- Builds a detailed prompt combining brand context + user preferences
- Calls Lovable AI with `google/gemini-3-pro-image-preview` (best image quality) with `modalities: ["image", "text"]`
- Returns the base64 image data
- Handles 429/402 errors properly

## Config Update
- Add `[functions.logo-designer]` with `verify_jwt = false` to `supabase/config.toml` — but since config.toml is auto-managed, we handle auth validation in code

## Data Flow
```text
User clicks "Create with AI"
  → Dialog opens (style, feel, notes)
  → POST to logo-designer edge function
  → Edge function loads brand from DB using brand_id
  → Builds prompt with full brand context
  → Calls Lovable AI image generation
  → Returns base64 image
  → Frontend uploads to brand-logos bucket
  → Updates brands.logo_url
  → Closes dialog, refreshes brand
```

## Files Changed/Created
1. **Create** `src/components/LogoDesignerDialog.tsx` — dialog component
2. **Create** `supabase/functions/logo-designer/index.ts` — edge function
3. **Edit** `src/pages/BrandCentre.tsx` — add "Create with AI" button in logo section
4. **Edit** `src/pages/Onboarding.tsx` — add "Create with AI" option in step 3

## Key Design Decisions
- The edge function pulls brand data server-side (not passed from frontend) to ensure it always has the latest Brand Centre data
- Using `google/gemini-3-pro-image-preview` for highest quality logo output
- The dialog is intentionally minimal — 2 chip selections + 1 optional text field
- Logo is generated as a single image; user can retry or upload manually instead

