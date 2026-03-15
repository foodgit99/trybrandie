

# Brand Engine — Full Implementation Plan

## Overview
A new **Content Hub** page (`/content`) that generates structured content systems (pillars, post series, campaigns) from existing brand data, audience intelligence, past designs, and trends. Each generated idea is one tap away from becoming a design in the Studio.

## Database Schema

### New Tables

**`content_pillars`**
- `id` uuid PK
- `brand_id` uuid (FK brands)
- `user_id` uuid
- `name` text — e.g. "Skincare Education"
- `description` text — short explanation
- `icon_emoji` text — visual identifier
- `sort_order` integer
- `created_at`, `updated_at` timestamps
- RLS: user owns via brand_id

**`post_series`**
- `id` uuid PK
- `brand_id` uuid
- `user_id` uuid
- `pillar_id` uuid (FK content_pillars, nullable)
- `name` text — e.g. "Tip Tuesday"
- `description` text
- `recurrence` text — "weekly", "biweekly", "monthly"
- `preferred_day` text — "monday", "tuesday", etc. (nullable)
- `visual_style_notes` text — style consistency hints for the AI
- `created_at`, `updated_at` timestamps
- RLS: user owns

**`content_ideas`**
- `id` uuid PK
- `brand_id` uuid
- `user_id` uuid
- `pillar_id` uuid (FK, nullable)
- `series_id` uuid (FK, nullable)
- `campaign_id` uuid (FK, nullable)
- `title` text — the post idea headline
- `prompt` text — ready-to-use Studio prompt
- `idea_type` text — "single", "series_post", "campaign_post"
- `status` text — "suggested", "scheduled", "created", "skipped"
- `scheduled_for` date (nullable)
- `design_id` uuid (nullable) — links to created design
- `created_at` timestamp
- RLS: user owns

**`campaigns`**
- `id` uuid PK
- `brand_id` uuid
- `user_id` uuid
- `name` text — e.g. "7-Day Skin Reset"
- `description` text
- `post_count` integer
- `created_at` timestamp
- RLS: user owns

### Edge Function: `brand-engine`

**Actions:**
1. `generate_pillars` — Analyzes brand data + audience + past designs, generates 5 content pillars with descriptions
2. `generate_series` — Takes pillars, generates 3-4 recurring post series
3. `generate_campaigns` — Generates 2-3 campaign ideas with multi-post breakdowns
4. `generate_weekly_ideas` — Given pillars + series, generates a week's worth of post ideas with ready-to-use prompts
5. `regenerate` — Re-generate any specific pillar/series/campaign

Uses `google/gemini-3-flash-preview` with structured tool calling (same pattern as Brief Agent). Inputs: brand data, audience JTBD profile, top 10 past designs (titles + prompts + trends), trend preferences.

### Frontend: Content Hub Page (`/content`)

```text
┌─────────────────────────────────────────┐
│  AppHeader                              │
├─────────────────────────────────────────┤
│                                         │
│  Content Hub                            │
│  "Your content strategy, powered by AI" │
│                                         │
│  ┌─── Pillars ────────────────────────┐ │
│  │ 🎓 Education  │ 💡 Tips  │ ...    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─── This Week ──────────────────────┐ │
│  │ Mon: Product highlight       [→]   │ │
│  │ Tue: Tip Tuesday #4          [→]   │ │
│  │ Wed: —                             │ │
│  │ Thu: Customer story          [→]   │ │
│  │ Fri: Weekend promo           [→]   │ │
│  │ Sat: Behind the brand        [→]   │ │
│  │ Sun: Engagement post         [→]   │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─── Series ─────────────────────────┐ │
│  │ Tip Tuesday (weekly)        [→]    │ │
│  │ Customer Stories (biweekly) [→]    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─── Campaigns ──────────────────────┐ │
│  │ Holiday Glow Campaign (5 posts)    │ │
│  │ Product Launch Series (3 posts)    │ │
│  └────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**Key interactions:**
- `[→]` button on any idea navigates to `/studio?prompt=<encoded_prompt>&content_idea_id=<id>`
- Studio picks up the pre-filled prompt and auto-sends
- After design is created, the content idea's `status` updates to "created" and links the `design_id`
- "Generate This Week" button creates 5-7 post ideas for the current week
- Pillars/series/campaigns can be regenerated or manually edited
- First visit triggers full generation (pillars → series → campaigns → week's ideas)

### Integration Points

1. **Studio integration**: `DesignStudio.tsx` reads `prompt` and `content_idea_id` from URL params. If present, auto-fills the input and marks the idea as "created" after generation completes.

2. **Dashboard integration**: Add a "Content Hub" card to `Index.tsx` showing "X posts planned this week" with a CTA to `/content`.

3. **Navigation**: Add "Content" link to `AppHeader.tsx` nav items.

4. **ChatSuggestions enhancement**: When content ideas exist, pull from them instead of random seasonal suggestions.

## Implementation Phases

**Phase 1**: Database tables + edge function with `generate_pillars` and `generate_series` actions  
**Phase 2**: Content Hub page with pillars and series UI  
**Phase 3**: Campaigns + weekly ideas generation  
**Phase 4**: Calendar view + Studio integration (auto-fill prompt from URL)  
**Phase 5**: Dashboard card + ChatSuggestions integration  

## Estimated Scope
This is a multi-session build. Each phase is self-contained and shippable.

