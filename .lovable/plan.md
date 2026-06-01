# Finalizing the v2 Flow — Remaining Work

Phases A–E shipped the new surfaces (Landing, Onboarding, Cockpit, Blueprint, DailyPost, BrandCentre, Settings, Report) behind `/v2/*` while leaving legacy intact. To call v2 done against the PRD, the following gaps remain.

## Phase F — Orchestrator wiring (backend truth)

1. **Strategic Arc planner**
  - Today `autopilot-planner` seeds ideas but doesn't guarantee a 5–7 day narrative across the 8 pillars (Announcement, Educational, Informational, Entertainment, Promotional, Trending, Holiday, UGC).
  - Add an "arc mode" branch that, on Monday seeding, enforces pillar diversity + a Hook → Proof → CTA sequence and writes a `strategic_arc` label per idea.
2. **Conversational edit router**
  - Blueprint's edit bar currently rewrites title/prompt only. PRD requires the Edit Decision Tree: text → Copywriter, color/layout → Creative Director (regen one VSGS gene), strategy → full cascade.
  - New edge function `v2-edit-router` that classifies the instruction (Flash-Lite) and dispatches to the right agent without full regen.
3. **Daily push channel parity**
  - `daily-execution-push` emails only. PRD calls for WhatsApp + email at the user's scheduled hour. Add WhatsApp send (uses existing `whatsapp_number`) and respect the Morning/Afternoon/Evening window from `autopilot_settings`.

## Phase G — Feedback loop closing

1. Wire DailyPost up/down votes into `genome_preset_weights` mutation visible on next Monday's seed (planner should read weights and bias preset selection).
2. Surface a "Why this design?" tooltip on DailyPost reading from `designs.genome` so users see the loop is learning.
3. Report page: add a "Genome drift" mini-chart (top 3 presets gaining/losing weight this week).

## Phase H — Onboarding completeness

The v2 Onboarding currently captures the essentials but skips:

- JTBD deep questions (struggle, desired outcome, emotional driver, buying trigger) — needed for Copywriter prompts.
- Products/services upload (DailyPost renders use these refs).
- Logo + inspiration upload to `brand-logos` / `brand-inspiration` buckets.
Add these as steps 6–9 (kept under the 5-minute target via the website scan shortcut already in place).

## Phase I — Notifications & ritual

1. `monday-briefing` edge function should also send the "Your Weekly Strategy is ready" push on Monday 07:00 local with deep link to `/v2/cockpit`.
2. Add in-app toast/banner on Cockpit when a fresh week is unseeded.
3. Email + WhatsApp templates for: weekly_strategy_ready, daily_drop_ready, weekly_report_ready.

## Phase J — Promotion of v2 to default

1. Feature flag `v2_enabled` on profiles (default false now).
2. Add a "Try the new Brandie" switch in legacy Settings; flipping it routes `/dashboard` → `/v2/cockpit`.
3. After internal QA, flip default to true and mark legacy routes `/legacy/*`.
4. Update `LandingNav` and auth redirect to `/v2/cockpit` for flagged users.

## Phase K — QA & polish

- Empty states on Cockpit/Blueprint/Report when no brand or no ideas.
- Mobile pass at 375px on all v2 pages (current viewport is 900 — Blueprint timeline and Report grid need check).
- Loading skeletons (currently spinners only).
- SEO: titles, descriptions, canonical for `/v2/*` public pages (Landing only — others should be `noindex`).
- Accessibility: focus traps in conversational edit bar, aria-labels on vote buttons, color contrast on category badges.

## Technical notes

- No schema migrations required for F1, F2, G1–G3, I — all reuse existing tables (`content_ideas.strategic_arc` is the one new column, nullable text).
- New edge functions: `v2-edit-router`, extension to `daily-execution-push` for WhatsApp via existing provider (confirm which — currently email-only via Resend; WhatsApp channel needs the provider decision before I build it).
- Feature flag: one boolean column on `profiles` + RLS unchanged.

## Open question before I build

WhatsApp delivery in Phase F3 / Phase I needs a provider. Options:

- Twilio WhatsApp Business API (needs secret + sender)
- Meta Cloud API (needs token + phone number id)
- Stick with `wa.me` click-to-send only (no true push, but zero infra)

Tell me which and I'll roll Phase F next.

Use Twilio WhatsApp Business API