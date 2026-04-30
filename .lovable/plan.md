
# Content Hub → Autonomous Content System

## Vision

Today the Content Hub is a **dashboard of tools** (Pillars, Campaigns, Series, Trends, Calendar, Autopilot, Coverage, Audience). The user still has to think: *"What do I do next?"*

The best version is a **conductor**: the Hub decides what the brand needs this week, executes most of it autonomously, and only surfaces the human in moments that genuinely require taste or approval. Tools become *drill-downs from a recommendation*, not the starting point.

## The 4 Optimization Pillars

### 1. A single "Brand Pulse" header (replaces scattered status)

One always-visible strip at the top showing the brand's content health at a glance:

```text
┌───────────────────────────────────────────────────────────────┐
│ Brand Pulse  ●●●●○  Healthy   ·  12 posts this week           │
│ Autopilot ON · Next delivery: Tomorrow 9:14 AM (Africa/Lagos) │
│ ⚡ 1 action needed → "Approve 3 ideas before Friday"  [Open] │
└───────────────────────────────────────────────────────────────┘
```

Composed of 4 signals already in the DB:
- **Coverage score** (from `CategoryCoveragePanel` logic) → balanced vs skewed
- **Cadence score** (ideas/week vs target from `autopilot_settings`)
- **Approval backlog** (ideas in `pending` state)
- **Failure surface** (any `autopilot_status = failed_*`)

This collapses Upcoming Events + Autopilot status + Coverage into one decision-grade summary. The four hub buttons (Pillars/Campaigns/Series/Trends) stay below as "deeper controls."

### 2. "Next Best Action" engine — the autonomy layer

A new lightweight orchestrator (extend `brand-engine` with `action: "recommend_next_action"`) that runs whenever the Hub loads and returns ONE recommendation card:

Examples it would emit:
- *"Your Education pillar hasn't posted in 14 days — generate 3 ideas?"* → 1-click
- *"Lagos Fashion Week is in 5 days and you have no related content — draft a campaign?"*
- *"4 autopilot posts failed for low credits — top up or skip?"*
- *"Your audience JTBD says they buy on Fridays — schedule 2 promo posts?"*

Inputs: pillar last-post recency, holiday calendar (`holidayCalendar.ts`), trend cache (`brand_trend_intel`), JTBD buying triggers, autopilot failure rows, coverage skew.

Output: one card with a primary CTA that triggers the right existing flow. This is what turns the Hub from passive to autonomous.

### 3. Unified Autopilot — plan + deliver + recover in one loop

Today autopilot only *delivers* what the user already created. Make it own the full loop:

- **Plan** weekly: every Sunday it auto-runs `generate_weekly_ideas` if the queue is below threshold (e.g. <5 pending). User just sees "12 new ideas drafted for next week — review."
- **Deliver** daily (existing `content-autopilot` cron — keep as-is).
- **Recover**: any `failed_*` idea is auto-rescheduled the next morning *only* if credits are available; otherwise it surfaces in Brand Pulse. (Today this is partly there but invisible.)
- **Settings**: collapse the current Autopilot card into a single "⚙️ Autopilot rules" sheet (delivery time, timezone, weekly auto-plan toggle, min-queue threshold, credit floor).

Expose three modes the user picks once during onboarding:
- **Manual** — generate on demand (today's default behavior)
- **Assisted** — autopilot delivers, user plans (current autopilot)
- **Fully Autonomous** — autopilot plans AND delivers (new)

### 4. Progressive disclosure of the 4 tool buttons

Pillars/Campaigns/Series/Trends stay as the 4-button grid (per recent UX), but each button gets:

- A **status pill** ("3 active", "Needs refresh", "Empty")
- An **inline "Auto-fill" action** in the dialog (e.g. inside the Trends dialog: "Apply top trending style to next 5 posts")
- The "i" tooltip you already added stays as the rationale layer

This removes the need to ever leave the Hub for routine work.

## Calendar improvements (small but high-impact)

- **Drag-to-reschedule** ideas across days (already shown by category color)
- **"Generate to fill"** buttons on empty days
- **Conflict warnings**: 2 promos on the same day, or category clash with a holiday

## What gets removed / merged

- **Upcoming Events** card → folded into Brand Pulse (events become triggers, not a separate widget)
- **Audience Suggestions** standalone panel → moves inside the "Next Best Action" reasoning ("because your audience…")
- **Regenerate All** button → demoted to inside the ⚙️ settings sheet (it's destructive and rarely the right move once Autopilot owns planning)
- **Category Coverage** standalone card → its score lives in Brand Pulse; full breakdown becomes a popover from the score chip

End state: ~40% less visual surface, ~10x more direction.

## Technical Plan

### Frontend (`src/pages/ContentHub.tsx`)
- New `BrandPulse` component (top of Hub) — composes existing queries, no new fetches
- New `NextBestActionCard` component — calls `brand-engine` with new action
- Refactor: collapse 3 cards (Upcoming/Coverage/Autopilot) into Pulse + a single ⚙️ sheet
- Keep the 4-button grid; add status pills derived from existing query data
- Calendar: add drag-and-drop with `@dnd-kit/core` (already a Tailwind/Radix-friendly lib); add "fill day" CTA on empty cells

### Edge function (`supabase/functions/brand-engine/index.ts`)
- New action `recommend_next_action` — reads pillars/ideas/autopilot_runs/holiday_calendar/JTBD, runs a small Gemini Flash-Lite classifier, returns `{ headline, reason, cta_action, cta_payload, severity }`
- New action `autopilot_weekly_plan` — generates the next week's ideas if queue below threshold, idempotent (skip if already run this week)

### Cron (Supabase `pg_cron`)
- Add a Sunday 00:30 UTC job that, for each brand on "Fully Autonomous" mode, invokes `autopilot_weekly_plan`
- Add a daily 06:00 UTC job that retries `failed_*` ideas where `credits_available = true`

### Database (migration)
- `autopilot_settings`: add `mode text default 'assisted'` ('manual' | 'assisted' | 'autonomous'), `min_queue_threshold int default 5`, `weekly_plan_last_run timestamptz`
- New table `brand_pulse_snapshots` (optional) to memoize daily score for trend lines

### Memory updates
- Update `mem://features/content-autopilot` to reflect the 3 modes + weekly planner
- New `mem://features/brand-pulse` describing the score composition

## Phasing (so we don't ship one giant PR)

**Phase 1 — Brand Pulse + Next Best Action card** (highest perceived intelligence per line of code)

**Phase 2 — Autonomous mode + weekly planner cron** (the "magic" tier)

**Phase 3 — Calendar drag/drop + fill-day + conflict warnings** (productivity polish)

Each phase is independently shippable and reversible.

## Why this is the "best version right now"

It uses **only systems already in the codebase** (brand-engine, content-autopilot, JTBD, trend cache, holiday calendar, category coverage) but reorganizes them around a **single decision the user actually has** each session: *"What should I focus on for my brand today?"* Instead of 8 widgets answering 8 questions, one Pulse + one Action answers the only one that matters — and Autopilot quietly handles the rest.
