

# Brandie MVP — Remaining Phases

## Phase 6: Export System Enhancement

### 6.1 Canvas Size Selection
- Add a size selector in the Design Studio toolbar (Square 1080x1080, Story 1080x1920)
- Pass the selected size to the edge function so generated images match the chosen dimensions
- Update the preview canvas aspect ratio dynamically

### 6.2 Download Options
- Add a download dropdown with PNG and JPG format options
- Use canvas/blob conversion for JPG export from the image URL

---

## Phase 7: Subscription UI and Feature Gating

### 7.1 Database Changes
- Add a `generations_count` and `generations_reset_at` columns to the `profiles` table to track monthly usage
- Increment the count each time a design is generated in the edge function

### 7.2 Plans Page
- Create `/plans` route with a new `src/pages/Plans.tsx`
- Display four tiers in a clean comparison grid:
  - **Free** ($0) — 10 generations/month, 1 brand, watermark, 1080x1080 only
  - **Creator** ($16/mo) — 50 credits, 1 brand, no watermark, PNG + JPG
  - **Business** ($29/mo) — 150 credits, multiple brands, team access, all formats
  - **Agency** ($75/mo) — 400 credits, unlimited brands, white-label, priority queue
- "Upgrade" buttons show a toast: "Payments coming soon"
- Add a link to the Plans page from the home dashboard header

### 7.3 Generation Gating
- Before generating a design, check `generations_count` against the free tier limit (10)
- If limit reached, show a modal prompting upgrade
- Increment count on successful generation

### 7.4 Watermark Badge (Free Tier)
- Overlay a small "Made with Brandie" badge on exported images for free-tier users
- Paid tiers skip the watermark

---

## Technical Details

**Files to create:**
- `src/pages/Plans.tsx` — pricing comparison page

**Files to modify:**
- `src/pages/DesignStudio.tsx` — canvas size selector, download format dropdown, generation limit check
- `src/pages/Index.tsx` — add Plans link in header
- `src/App.tsx` — add `/plans` route
- `supabase/functions/design-studio/index.ts` — accept canvas size param, increment generation count

**Database migration:**
- Add `generations_count` (integer, default 0) and `generations_reset_at` (timestamptz, default now()) to `profiles` table

