# Plan: Onboarding for an Autonomous Content System

## The shift in user psychology

Today's onboarding asks the user to **build a brand profile** (10 steps of inputs) before anything happens. That's a workbench experience. For an Autonomous Content System, the user should feel like they're **flipping the ignition on an engine** — not configuring a tool.

The new mental model:

```text
OLD:  Sign up → Fill 10 forms → Eventually generate something
NEW:  Sign up → Pick playbook → Engine starts → Brand fills in behind the scenes
```

The very first thing the user sees after signup is **not a form**. It's a single screen that says: *"Pick the playbook your business runs on. Brandie takes it from here."*

---

## The very first action: "Choose Your Industry Playbook"

A single full-screen step — no progress bar, no 10/10 — with a grid of ~9 industry playbooks. Each card shows: icon, name, one-line promise, and a sample of the kind of weekly content the engine will run for them.

Examples:
- Restaurants & Cafés — *"Daily specials, weekend hype, regular-customer love."*
- Beauty & Salons — *"Before/afters, booking nudges, treatment education."*
- Fitness & Wellness — *"Class promos, transformation stories, motivation Mondays."*
- Boutique Retail — *"New arrivals, styling tips, sale countdowns."*
- Professional Services — *"Authority posts, client wins, lead-gen offers."*
- Real Estate — *"New listings, market updates, neighbourhood spotlights."*
- Coaches & Creators — *"Insight posts, testimonial reels, offer launches."*
- Events & Hospitality — *"Countdown, behind-the-scenes, recap."*
- Other — fallback to a general SMB playbook.

Bottom of the screen: a single primary button — **"Start my engine"** — not "Continue" or "Next".

## What happens after they click

The screen transitions to a live "engine starting" sequence (3–5s, feels like a system booting, not a loading spinner):

```text
✓ Loading [Industry] playbook
✓ Setting up your weekly cadence
✓ Generating your first 7 posts
→ Add your brand details to personalise
```

Then it routes to a **shortened brand setup** — only the bare essentials needed to render the first post:
1. Website URL (auto-scrape — already exists) **or** brand name + one-sentence description
2. Logo (upload / design / skip)
3. One brand colour (or accept the playbook's default palette)

That's it. 3 inputs instead of 10. Everything else (tone, vibe, personality, audience JTBD, fonts) gets **inferred from the playbook + scrape** and shown as editable later in Brand Centre.

## What the user sees on first login to the home screen

Not "What will you design today?" — that's still a workbench question. Instead:

```text
Your engine is running.
This week: 7 posts queued · 2 published · next post Tuesday 9am

[ Review this week's plan ]   [ Pause engine ]
```

The hero becomes a **status panel for the autonomous system**, not a creative prompt. The "create new design" affordance still exists but moves from hero to a secondary action — the user is no longer expected to drive the daily output.

---

## Technical scope

**Files to modify:**
- `src/pages/Onboarding.tsx` — replace step `-1` (website prompt) with a new `IndustryPlaybookStep`. Collapse the existing 10 steps into 3 essential steps that follow.
- `src/lib/industryPlaybooks.ts` (new) — define the 9 playbooks with: id, name, icon, tagline, default tone, default vibe, default palette hint, suggested cadence, and a starter set of `content_ideas` templates (category + prompt skeleton per day-of-week).
- `src/pages/Index.tsx` — replace the "What will you design today?" hero with an `EngineStatusHero` component that shows: posts queued this week, next scheduled post, autopilot on/off toggle, and a "Review this week" CTA into Content Hub.
- `src/components/onboarding/EngineStartingSequence.tsx` (new) — the 3–5s "booting" animation that runs after playbook selection while the planner seeds ideas.
- `supabase/functions/autopilot-planner/index.ts` — accept a `playbook_id` argument; when a brand is brand-new and has no `content_ideas`, seed 7 ideas from the playbook's template set on first run.
- `brands` table — add a `playbook_id text` column (migration).
- `mem://features/onboarding-flow` — update the memory to reflect the new flow.

**What we're explicitly NOT doing in this round:**
- Full audience JTBD wizard during onboarding (move to optional "tune your engine" later).
- Trend Lab selection at signup (the playbook implies sensible defaults).
- Logo designer as a forced step (keep as optional skip).

## Open question to confirm before building

The 9 playbooks above are my best guess at SMB coverage. Want to:
1. Ship with these 9 as-is, **or**
2. Start with 4–5 tighter playbooks (Restaurants, Beauty, Fitness, Retail, Services) and expand once we see which industries actually convert?

I'd recommend option 2 — fewer, sharper choices feel more like a curated system and less like a directory. Tell me which you prefer and I'll build accordingly.