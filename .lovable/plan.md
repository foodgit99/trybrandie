

# Plan: Smart Content Format Assignment per Content Idea

## Problem

Currently, every content idea in the calendar shows three action buttons (graphic, carousel, video) regardless of the content type. This is wrong — a social media expert knows that **educational content works best as carousels**, **promotional content works best as single graphics**, and **behind-the-scenes content works best as video**. Each idea should have one purposeful format assigned at generation time.

## Content Format Mapping (Expert Strategy)

Based on social media best practices, here is the pillar-to-format mapping:

```text
┌──────────────────────────┬────────────┬─────────────────────────────────┐
│ Content Pillar Type      │ Format     │ Why                             │
├──────────────────────────┼────────────┼─────────────────────────────────┤
│ Educational / How-to     │ carousel   │ Multi-step, swipeable learning  │
│ Tips & Tricks            │ carousel   │ Listicle format, high saves     │
│ Promotional / Sales      │ graphic    │ Single punchy visual CTA        │
│ Announcements / Launch   │ graphic    │ Bold single-frame impact        │
│ Behind the Scenes        │ video      │ Authenticity, motion, story     │
│ Testimonials / Social    │ graphic    │ Quote card, trust signal        │
│ Storytelling / Narrative │ carousel   │ Sequential story arc            │
│ Engagement / Interactive │ graphic    │ Poll prompt, question card      │
│ Inspirational / Quotes   │ graphic    │ Single striking visual          │
│ Process / Tutorial       │ video      │ Demonstration, walkthrough      │
│ Culture / Team           │ video      │ Human connection, authenticity  │
│ Case Study / Results     │ carousel   │ Before/after, data breakdown    │
│ Product Showcase         │ carousel   │ Multiple angles/features        │
│ Event / Recap            │ video      │ Dynamic highlights              │
│ UGC / Community          │ graphic    │ Reshared single-frame content   │
└──────────────────────────┴────────────┴─────────────────────────────────┘
```

## Changes Required

### 1. Database Migration
Add a `content_format` column to the `content_ideas` table:
- Type: `text`, default `'graphic'`
- Valid values: `graphic`, `carousel`, `video`

### 2. Edge Function (`brand-engine/index.ts`)
Update the `generate_weekly_ideas` action:
- Add `content_format` to the AI tool schema (enum: `graphic`, `carousel`, `video`)
- Update the system prompt to instruct the AI to assign the correct format based on the pillar type, using the mapping above as guidance
- Include the format in the insert payload

### 3. ContentHub UI (`ContentHub.tsx`)
- Remove the three separate action buttons (ArrowRight, Layers, Play) per idea
- Replace with a **single action button** that shows the correct icon based on `content_format`:
  - `graphic` → ArrowRight icon ("Create graphic")
  - `carousel` → Layers icon ("Create carousel")  
  - `video` → Play icon ("Create video")
- Show a small format badge next to the idea title (e.g., "carousel", "video", "graphic")
- The button routes to the correct studio mode automatically
- In the manual "Add Idea" dialog, add a `content_format` selector so users can override

### 4. Idea Form Update
- Add `content_format` field to the `IdeaForm` interface (default: `graphic`)
- Add a format selector (dropdown) in the create/edit idea dialog
- Pre-fill based on selected pillar when creating manually

## Technical Details

- The AI prompt will include the mapping table so the model assigns formats intelligently based on pillar context
- Fallback: if `content_format` is null/missing, default to `graphic`
- Existing ideas without the column will render with the `graphic` default

