

# Website Brand Scraper — Auto-populate Brand Centre

## Overview
Add a "Have a website?" shortcut that scrapes a user's website using Firecrawl's `branding` format, then uses an AI agent to map the extracted data into Brandie's brand schema. Available in two places: during onboarding (as a frictionless shortcut before Step 1) and in the Brand Centre (as an import action).

## Architecture

```text
User enters URL
    ↓
Frontend calls edge function: brand-scraper
    ↓
Edge function:
  1. Firecrawl scrape(url, formats: ['branding', 'markdown'])
  2. AI agent (gemini-3.1-pro-preview) analyzes branding + page content
  3. Returns structured brand data matching Brandie schema
    ↓
Frontend populates form fields (onboarding) or updates brand (Brand Centre)
```

## Prerequisites
- **Firecrawl connector** must be connected (provides `FIRECRAWL_API_KEY` to edge functions)

## Plan

### 1. Connect Firecrawl connector
Prompt the user to connect Firecrawl so the API key is available in edge functions.

### 2. Create `brand-scraper` edge function
A single edge function that:
- Accepts `{ url }` in the request body (authenticated)
- Calls Firecrawl `/v1/scrape` with `formats: ['branding', 'markdown']` to extract logo, colors, fonts, and page content
- Sends the Firecrawl output to `google/gemini-3.1-pro-preview` via tool calling with a structured schema that maps to Brandie's brand fields:
  - `name`, `tagline`, `description`
  - `logo_url` (from Firecrawl branding images)
  - `primary_colors`, `secondary_colors`, `accent_colors` (from extracted color scheme)
  - `typography_primary`, `typography_secondary` (mapped to closest available Google Font)
  - `vibe` (mapped to one of: Minimal, Bold, Luxury, Playful, Corporate, Cinematic)
  - `tone_of_voice`, `personality_traits`
  - `audience_raw_inputs` (inferred audience JTBD inputs from website content)
- Returns the structured brand data to the frontend

### 3. Add website import to Onboarding flow
Insert a new **Step 0** (before the current "What's your brand called?" step) that asks:

> "Got a website? Drop your URL and we'll set everything up for you."

- Simple URL input with a "Scan my website" button
- "Skip — I'll set up manually" link below
- On scan: show a loading state with rotating messages (similar to logo designer UX)
- On success: pre-fill all `BrandData` fields and jump to Step 1 (brand name) so the user can review/edit each field as they go through the normal flow
- The total steps remain 10 visible steps; this is a pre-step shortcut
- No friction: if the user skips, the normal flow continues unchanged

### 4. Add website import to Brand Centre
Add a "Import from website" button in the Brand Centre header area:
- Opens a small dialog/inline form for URL input
- On scan: updates all brand fields in the database directly
- Shows a confirmation with what was detected before saving
- Existing fields can be overwritten or merged (user confirms)

### 5. Add `website_url` column to brands table
Migration to add `website_url text` column to the `brands` table so the scraped URL is stored for reference.

## Files Changed
- **New**: `supabase/functions/brand-scraper/index.ts` — edge function
- **Modified**: `src/pages/Onboarding.tsx` — add website import pre-step
- **Modified**: `src/pages/BrandCentre.tsx` — add import from website button/dialog
- **Migration**: Add `website_url` column to `brands` table

## UX Details
- The onboarding pre-step uses the same visual language (serif headings, minimal layout, animated transitions)
- Loading state shows: "Scanning your website...", "Extracting brand colours...", "Analyzing your tone...", "Almost there..."
- If Firecrawl connector isn't connected, the feature is hidden (no broken states)
- The scan is free (does not cost a Brandie credit)

