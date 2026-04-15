

## Plan: Inject Content Categories into Content Hub Strategy Generation

### Problem
The Content Hub's AI prompts for pillars, series, campaigns, and weekly calendar have no awareness of the 10 content categories (Announcement, Educational, Informational, Entertainment, Promotional, Trending, Holidays, Social Proof, BTS, Interactive). This means the generated output skews toward a narrow subset of categories — typically educational and promotional — instead of giving the brand a well-rounded content mix.

### Approach
Add a shared `CONTENT_CATEGORIES` reference block and inject category-aware instructions into each of the 4 generation prompts in `supabase/functions/brand-engine/index.ts`. No new agents or edge functions needed.

### Changes — `supabase/functions/brand-engine/index.ts`

**1. Add a shared categories constant** (top of file)
A string constant listing all 10 categories with short descriptions, reusable across all prompts.

**2. `generate_pillars` prompt (line ~196)**
- Instruct the AI that pillars should collectively cover a healthy spread of the 10 content categories
- Add: "Each pillar should map to one or more content categories. Ensure the 5 pillars together cover at least 7 of the 10 categories."
- Add a `content_categories` string field to the pillar tool schema so the AI outputs which categories each pillar serves

**3. `generate_series` prompt (line ~258)**
- Instruct: "Each series should align with a specific content category. Ensure variety — avoid clustering all series under the same category."
- Add a `content_category` enum field to the series tool schema

**4. `generate_campaigns` prompt (line ~320)**
- Instruct: "Each campaign should target a specific content category. Vary categories across campaigns."
- Add a `content_category` enum field to the campaign tool schema

**5. `generate_weekly_ideas` prompt (line ~417)**
- Replace generic format guidance with category-aware instructions:
  - "Each idea MUST be assigned a `content_category` from the 10 categories."
  - "The week's ideas must represent at least 4 different content categories. Aim for maximum variety."
  - "Use the content category to determine the visual approach and copy tone in the prompt."
- Add `content_category` enum field to the weekly ideas tool schema
- Map the category into the `content_ideas` insert (the DB column may need adding)

**6. Database migration**
- Add `content_category text` column to `content_ideas`, `content_pillars`, `post_series`, and `campaigns` tables (nullable, no breaking change)

### Result
Every layer of the Content Hub — from strategic pillars down to individual daily ideas — will be aware of and distribute across all 10 content categories. This feeds directly into the design-studio's existing content categorisation layer, creating end-to-end category alignment.

### Files
- `supabase/functions/brand-engine/index.ts` — prompt + schema updates for all 4 actions
- Database migration — add `content_category` column to 4 tables

