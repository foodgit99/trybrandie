# Brandie V1.0 — Complete UX Overhaul

A clean-sheet rebuild of the user experience around the PRD's "10-Minute Marketing Week" ritual. Nothing on the current app is deleted — every existing page is moved behind `/legacy/*` and remains fully functional. The new experience lives at the root routes.

## Guiding principles

- **Cockpit, not canvas.** Every screen answers one question and offers one primary action.
- **The Ritual is the product.** Monday = Approve. Tue–Sat = Post. Sunday = Reflect. The UI literally reflects this rhythm.
- **Defer to action.** No empty states without a CTA. No decisions without a default. No prompt without a pre-fill.
- **Editorial minimalism.** Warm-neutral palette (Beige `#FAF8F5`, Charcoal `#2B2D33`, Gold `#C4993B`) already in memory. Serif display + clean sans body. Generous whitespace. High-contrast cards. No gradients-for-the-sake-of-it.

---

## 1. Retire current UX as Legacy (zero deletion)

Move every existing top-level route under `/legacy/*`. The pages, components, hooks, contexts, and edge functions are untouched — only the route paths change.

```text
/                    → NEW Landing (Amina-focused)
/auth                → NEW auth (kept visually fresh, same backend)
/onboarding          → NEW 4-step onboarding
/cockpit             → NEW Monday Briefing / home
/blueprint           → NEW Weekly Blueprint
/post/:dayId         → NEW Daily Execution screen
/report              → NEW CEO Briefing
/brand               → NEW Brand Centre (read-mostly)
/legacy/*            → All previous pages (Index, ContentHub, DesignStudio,
                       BrandCentre, Cockpit, DesignHistory, Plans, Settings,
                       Admin, Affiliate*, AudiencePromptManager, etc.)
```

A small "Open Legacy App" link sits in the new Settings page for power users and admins. No legacy code is removed; routes are simply re-mounted.

## 2. Landing page (new)

Single goal: convert Amina in under 30 seconds.

Sections, in order:

1. **Hero** — Serif headline: *"Your marketing department, on autopilot."* Sub: *"Brandie writes, designs, and schedules a full week of on-brand content every Monday. You approve in 10 minutes."* Primary CTA: *Start my engine — free*. Visual: a stylised "Monday Briefing" card mock (not a screenshot — a designed artifact).
2. **The Ritual** — three big numbered cards: Monday Approve → Daily Post → Sunday Reflect.
3. **What you stop doing** — split list: *No more blank canvas. No more freelancer chasing. No more silent status days.*
4. **The 8 Pillars** — quiet grid of the content pillars with one-line definitions.
5. **Proof / Sample Week** — a horizontally scrolling 5-day blueprint preview (real layout, fake brand).
6. **Pricing** — single card: **18,500 NGN/month**, framed as *"600 NGN/day — cheaper than a plate of rice."* Bullet inclusions per PRD.
7. **FAQ** — 5 questions: how autonomous is it, can I edit, what about my brand, WhatsApp posting, cancel anytime.
8. **Final CTA** — *Switch on your engine*.

Sticky top nav: Logo · Ritual · Pricing · FAQ · Sign in · Start free.

## 3. Onboarding (new — under 5 minutes)

A guided 4-step flow with a persistent left rail showing progress. Each step has a "Skip — Brandie will guess" option so Amina never gets stuck.

1. **Brand basics** — business name, one-line description, website URL (optional, triggers existing `brand-scraper`), logo upload (optional — falls back to existing `logo-designer`).
2. **Look & feel** — pick 1 of 6 curated palettes + 1 of 4 type pairings + tone-of-voice slider (Street-smart ↔ Polished). Live preview card updates in real time.
3. **Audience (JTBD)** — 3 questions only (not the legacy 5-section form): *Who buys from you? What problem are they escaping? What outcome do they brag about?* Each with example chips.
4. **Products & promise** — add up to 3 hero products/services + one signature offer/CTA + WhatsApp number for posting handoff.

Finish screen: *"Building your first Weekly Blueprint…"* animated. Behind the scenes calls existing `autopilot-planner` + `brand-engine`. Lands on Cockpit when ready.

## 4. Cockpit (new home — Monday Briefing)

The single most important screen. Replaces current `Index` + `ContentHub` + old `Cockpit`.

Layout (desktop: centred 960px column; mobile: full-width):

- **Header strip** — "Good morning, Amina. It's Monday." + week range. Right-aligned: streak, credits.
- **Brand Pulse pill** — reuses logic from `BrandPulse` component (composite health score) but redesigned as a single horizontal bar with one sentence: *"Your engine is humming."* / *"Engine needs attention."*
- **The Weekly Blueprint card** (hero) — visual preview of the 5-day Strategic Arc. Each day is a row: Day · Pillar badge · Caption preview · Thumbnail. Status: *Awaiting approval* / *Approved* / *Live*. Primary button: **Approve the week** (one tap). Secondary: **Open Blueprint** (full editor).
- **Next Best Action card** — reuses `NextBestActionCard` logic, restyled to match.
- **Daily Execution strip** — a horizontal 7-day rail. Today's card is enlarged with **Post now** CTA.
- **This week's brief** — collapsible: trends pulled, holiday hooks, audience focus. Editorial typography.

No tabs. No sidebar. One column, one scroll, one ritual.

## 5. Weekly Blueprint (`/blueprint`)

Full-screen review and edit surface.

- Vertical timeline, Mon→Fri (Sat/Sun optional toggle).
- Each day card: large pillar badge, day name, generated caption, design thumbnail, schedule time. Inline actions: *Regenerate*, *Edit caption*, *Swap pillar*, *Remove*.
- **Conversational edit bar** pinned to the bottom: *"Swap Thursday's post for a restock announcement…"*. Routes through the Edit Decision Tree (text → copywriter, visual → creative director, structural → full cascade). Reuses `design-studio` and `brand-strategist` edge functions.
- Top-right: **Approve the week** button (sticky). On approve: confirmation sheet shows posting schedule + WhatsApp/email handoff opt-in. Writes to existing autopilot tables; triggers `campaign-scheduler`.

## 6. Daily Execution (`/post/:dayId`)

The screen Amina opens from her daily push notification.

- Big 1080×1080 design preview, swipeable for carousels.
- Caption block with copy button, edit button, regenerate button.
- **Post to WhatsApp** primary CTA (deeplink with pre-filled caption + image).
- Secondary: Download image, Mark as posted, Snooze 1 hour.
- Below the fold: *Why this post?* — a 2-sentence rationale (pillar, audience trigger, trend reference) generated at blueprint time and stored.
- Vote thumbs (existing `record_preset_feedback` RPC) — explicit "Train Brandie" framing.

## 7. CEO Briefing (`/report`)

Weekly reflective surface — opens Sunday.

- Headline number: conversion-weighted score (link clicks + DMs initiated). No vanity metrics on top.
- Per-day grid showing post + outcome.
- "What Brandie learned this week" — 3 bullets sourced from preset feedback + engagement.
- CTA: **Lock next week** (triggers next blueprint generation early) or **Adjust the system** (opens a guided refinement modal — tone, posting times, pillar mix).

## 8. Brand Centre (`/brand`, slim)

Read-mostly. Three tabs only: **Identity** (logo, colours, type, tone), **Audience** (JTBD card), **Catalogue** (products/services). Each tab has one *Edit* button that opens a focused sheet — never an inline form sea. Genome and trend internals are hidden from Amina (still available in `/legacy/brand`).

## 9. Settings (`/settings`, slim)

Account · Billing (Paystack) · Notifications (WhatsApp + email times) · Posting handoff · **Open Legacy App** · Sign out.

## 10. Navigation

A new floating bottom bar (mobile) / left rail (desktop) with 4 items only: **Cockpit · Blueprint · Brand · Report**. The old `FloatingNavBar` stays mounted only on `/legacy/*` routes.

---

## Technical details

### Routing

- `src/App.tsx`: add new routes at root, wrap existing routes with `/legacy` prefix. Replace `LandingOrDashboard` → new `Cockpit`. New `ProtectedRoute` reused unchanged.
- New `NewFloatingNav.tsx`; gate old `FloatingNavBar` to `/legacy/*` via a path check.

### New files (high-level)

```text
src/pages/v2/Landing.tsx
src/pages/v2/Onboarding.tsx                 (4-step wizard)
src/pages/v2/Cockpit.tsx                    (Monday Briefing home)
src/pages/v2/Blueprint.tsx
src/pages/v2/DailyPost.tsx                  (route /post/:dayId)
src/pages/v2/Report.tsx
src/pages/v2/BrandCentre.tsx
src/pages/v2/Settings.tsx
src/components/v2/NewFloatingNav.tsx
src/components/v2/cockpit/BlueprintHeroCard.tsx
src/components/v2/cockpit/BrandPulseBar.tsx
src/components/v2/cockpit/DayRail.tsx
src/components/v2/blueprint/DayRow.tsx
src/components/v2/blueprint/ConversationalEditBar.tsx
src/components/v2/daily/PostPreview.tsx
src/components/v2/onboarding/* (Step1..Step4 + ProgressRail)
src/components/v2/landing/* (Hero, Ritual, Pillars, SampleWeek, Pricing, FAQ, CTA)
```

### Backend reuse (no schema changes in this phase)

- Onboarding scrape → existing `brand-scraper`.
- Logo fallback → existing `logo-designer`.
- Blueprint generation → existing `autopilot-planner` + `brand-engine`.
- Conversational edits → `brand-strategist` (text), `design-studio` (visual).
- Scheduling → `campaign-scheduler` + existing pg_cron jobs.
- Daily reminder → existing `content-daily-reminder` and `daily-execution-push`.
- Feedback votes → existing `record_preset_feedback` RPC (Phase 6 from prior plan).
- Health/NBA → existing `BrandPulse` and `NextBestActionCard` logic, restyled.

### Design tokens

- Keep current HSL tokens in `index.css`. Add a small `v2-` namespace where needed (only for new components that need tighter editorial typography scale and a serif display rhythm). No global token rewrites.

### What stays in legacy (untouched)

Every page currently under `src/pages/*` and every component currently used only by them. They continue to render exactly as today under `/legacy/*`. Edge functions, migrations, types, and contexts are not modified.

---

## Build order (proposed phases — each shippable on its own)

1. **Phase A — Legacy preservation + scaffolding.** Re-mount old routes under `/legacy`, add new empty v2 routes + nav, no behaviour change for existing users yet (root still serves legacy until Phase B flips).
2. **Phase B — Landing + Onboarding.** New marketing landing + 4-step onboarding wired to existing backends.
3. **Phase C — Cockpit + Blueprint.** Monday Briefing home and full Blueprint review/edit with conversational bar.
4. **Phase D — Daily Execution + Brand Centre + Settings.** WhatsApp handoff, vote-to-train, slim brand centre.
5. **Phase E — CEO Briefing + polish.** Sunday report, refinement modal, motion pass, accessibility audit.

Each phase ends with a working surface the user can click through end-to-end.

---

## Open questions before I start building

1. **Default landing for existing logged-in users on Phase B launch** — should they land on the new Cockpit immediately, or see a one-time "Try the new Brandie" banner with a toggle back to legacy for a week? They should see a one-time "Try the new Brandie" banner with a toggle back to legacy for a week
2. **WhatsApp posting handoff** — confirm we should use a `wa.me` deeplink with pre-filled caption + image (Amina downloads and attaches), versus integrating WhatsApp Business API later. We are integrating WhatsApp Business API later 
3. **Sat/Sun posts** — default OFF (5-day Strategic Arc per PRD) with opt-in, or default ON? default ON.
4. **Brand Pulse copy tone** — keep existing composite score, or simplify to a 3-state pill (Humming / Steady / Needs attention)? simplify to a 3-state pill

Once you answer these (or say "you pick"), I'll switch to build mode and start with Phase A.