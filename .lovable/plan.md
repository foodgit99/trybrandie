

## Autopilot: Automated Content Creation and Delivery

### What It Does
Users toggle "Autopilot" on specific content calendar days or ideas. At the scheduled time, a backend job automatically generates the design using the existing design-studio pipeline and emails the finished image to the user -- no manual intervention needed.

### Architecture

```text
User enables Autopilot on calendar idea(s)
        ↓
content_ideas row: autopilot = true
        ↓
pg_cron (daily, e.g. 6:00 AM UTC)
        ↓
Edge Function: "content-autopilot"
  1. Query content_ideas WHERE scheduled_for = today AND autopilot = true AND status IN ('suggested','scheduled')
  2. For each idea:
     a. Load brand context (colors, tone, audience, trend prefs)
     b. Call design-studio edge function internally (service role, passing the idea's prompt)
     c. Store resulting design in the designs table
     d. Send email with the design image attached via send-email
     e. Update idea status → 'completed'
        ↓
User receives email with their ready-made design
```

### Database Changes

**Add column to `content_ideas`:**
```sql
ALTER TABLE content_ideas ADD COLUMN autopilot boolean NOT NULL DEFAULT false;
```

No new tables needed. The existing `content_ideas` table already has `scheduled_for`, `prompt`, `brand_id`, `user_id`, and `status`.

### Backend: New Edge Function `content-autopilot`

Triggered daily via pg_cron (similar to `content-daily-reminder`). For each autopilot idea scheduled today:
1. Fetch the user's brand, audience profile, and trend preferences
2. Call the design-studio function internally with the idea's prompt and brand context
3. Save the generated design to the `designs` table and link it back (`content_ideas.design_id`)
4. Send the image to the user via the existing `send-email` function with a new `autopilot_design_ready` template
5. Mark the idea's status as `completed`

Credit deduction follows the same logic already in design-studio. If the user has no credits, the idea is skipped and a "no credits" notification email is sent instead.

### Frontend UI Changes

**Content Hub Calendar (`ContentHub.tsx`):**
- Add an "Autopilot" toggle (Switch component) on each calendar idea card -- a small rocket/zap icon with a switch
- When toggled on, the idea card gets a subtle accent glow/badge (e.g. "⚡ Autopilot") so users can see at a glance which days are automated
- A collapsible "Autopilot Settings" section at the top of the Content Calendar with:
  - A master toggle: "Enable Autopilot for all new ideas"
  - Preferred delivery time (morning/afternoon/evening dropdown)
  - A brief explanation: "Brandie will automatically create and email your designs on scheduled days"

**Idea Creation/Edit Dialog:**
- Add an Autopilot checkbox in the idea form dialog so users can enable it when creating or editing an idea

**Email Template (`send-email/index.ts`):**
- New `autopilot_design_ready` template: "Your design is ready! ✨" with the design image inline and a CTA to view in Design History

### Files Changed

| File | Change |
|---|---|
| `content_ideas` table | Add `autopilot` boolean column |
| `supabase/functions/content-autopilot/index.ts` | New edge function: daily autopilot runner |
| `supabase/functions/send-email/index.ts` | Add `autopilot_design_ready` email template |
| `supabase/config.toml` | Add `[functions.content-autopilot]` config |
| `src/pages/ContentHub.tsx` | Autopilot toggle on idea cards, settings section |
| pg_cron job (via insert tool) | Schedule daily invocation of `content-autopilot` |

### UX Details
- The Autopilot toggle uses a Switch with a Zap icon, colored in primary when active
- Enabled ideas show a small "⚡" badge on the calendar card
- Toast confirmation when toggling: "Autopilot enabled — Brandie will create this design automatically"
- The autopilot settings section uses a clean collapsible card at the top of the calendar, matching existing Content Hub patterns

