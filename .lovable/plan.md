# Brandie four-engine audit: Intelligence, Strategy, Execution, Learning

Read-only audit of the current build. No code, data or settings were changed. Sources: `src/App.tsx`, `NewFloatingNav.tsx`, `src/pages/v2/*`, `supabase/functions/*` (67 functions), the live public schema, and `docs/brandie-architecture-for-private-network.md`. If you approve this plan, the next step only saves this report as `docs/brandie-four-engine-audit.md`. Any restructuring would be a separate request.

## A. What users see today

The main menu has 3 items: Cockpit (`/cockpit`), Content (`/hub`) and Engine (`/engine`). The "More" menu has Blueprint, Brand, Report and Settings. Creator Network and Private Network are added to the menu only when their feature flags are on (both are OFF).

- **Plan and approve:** `/blueprint` (weekly arc, chat edits, Approve), `/post/:dayId` (daily post, voting), `/engine` (autopilot mode, Assisted or Autonomous), `/cockpit` (next best action and Brand Pulse).
- **Content:** `/hub` (Trends, Competitors, campaigns, ideas), `/content-hub` (V2 hub), `/content` (legacy hub, still in use), `/history` (gallery), `/legacy/library`.
- **Create:** `/studio` (a 1:1 copy of the legacy DesignStudio chat), `/agent`, `/agent/:threadId` and `/agent/settings` (expert agents and Roundtable).
- **Brand:** `/brand` (V2 Brand Centre), `/brand/editor` (legacy Brand Centre, still the real editor), `/brands` (multi-brand).
- **Results:** `/report` (counts of output and votes only).
- **Growth and money:** `/partner`, `/affiliate`, `/affiliates`, `/plans`, `/pricing`, and the public campaign pages at `/c/:slug`.
- **Modules:** `/creator-network/*` (internal team only) and `/private-network/*` (publishers).
- **Admin and setup:** `/admin` (about 3,200 lines of tabs), `/onboarding`, `/settings`, `/profile`, `/support`.
- **Legacy:** 13 `/legacy/*` routes and 8 `/v2/*` redirects are still registered.

## B. Backend and AI services

- **Shared context:** `_shared/brand-context.ts` gathers Brand Centre, audience profile (JTBD), products, brand updates and inspiration. It is the RAG core that every engine reuses.
- **Research:**
  - Trends: `trend-scout`, `trend-recommend`, `holiday-feed`, `brand_trend_intel`, `research_cache`.
  - Competitors: `competitor-discover`, `-scan`, `-orchestrator`, `-digest`, plus `competitor_snapshots` and `competitor_signals`.
  - Brand and audience setup: `brand-scraper`, `audience-intelligence`, `audience-suggest`.
- **Strategy:**
  - Planning: `autopilot-planner`, `brand-engine` (ideas, 8 content pillars, arc), `weekly_blueprints`, `content_ideas`, `content_pillars`, `post_series`.
  - Strategist chat: `brand-strategist` and `strategist-agent` (with `strategy_conversations`).
  - Campaigns: `campaigns` with `resolve-autopilot-campaign.ts`.
  - Email planning: `email-marketing-plan`.
- **Execution:**
  - Design pipeline: `design-enqueue` → `design_jobs` → `design-dispatch` → `design-studio` → `designs`.
  - Edits: `v2-edit-router`.
  - Other creation: `logo-designer`, `video-studio` and `video-render` (no screens), `email-marketing-generate` and `-send`.
  - Delivery: `whatsapp-send` (Twilio, blocked), `daily-execution-push`, `push-send`, `content-autopilot`, `autopilot-retry`.
  - Distribution: `campaign-engine` (landing pages), `partner-campaign-send`, `private-network-*`.
- **Learning:**
  - `record_preset_feedback` (DailyPost votes) writes `genome_preset_weights`. That table is read only by `design-studio`, so votes change visual style choices but never strategy.
  - `weekly-recap` and `monday-briefing` send summaries.
  - Event tables are separate and nothing reads them back for planning: `campaign_page_events`, `email_*` tracking, `private_network_events`, `product_events`, `design_traces`, `autopilot_run_events`.
- **Shared infrastructure:**
  - Reliability: `model-fallback`, `token-budget`, `tracer`, `ai-cache`, `circuit-breaker`, `validate-output`, `design-scorer`.
  - Access and accounts: auth with brand tenancy, Paystack credits and subscriptions.
  - Notifications and agent tools: notification outbox, `agent-tools`, `agent-undo`, `stage-agent`.

## C. Where each feature belongs

| Feature | Engine |
|---|---|
| Brand Centre (V2 and legacy editor), audience profile, products, brand updates, inspiration, onboarding and website scan | Intelligence (inputs) |
| Trends tab, Competitor Intelligence, holiday feed, Brand Pulse | Intelligence (market signals) |
| Visual Style Genome and Trend Lab intensity | Intelligence, used by Execution |
| Blueprint, autopilot planner, 8 pillars, campaigns (quotas, funnel stages), Assisted/Autonomous modes, weekly replanning, Trend→Campaign | Strategy |
| Strategist agent, Brand Strategist ("Plan" mode), Roundtable, expert agents | Strategy (chat front-ends for it) |
| Email-marketing plan and journeys | A second Strategy track running in parallel |
| Studio, Daily Post, carousels, logos, PDF export, Gallery/History, `v2-edit-router` | Execution (creation) |
| WhatsApp, push, email delivery, Brandie Outbox sends, campaign landing pages, Private Network | Execution (distribution) |
| DailyPost votes leading to genome weights | Learning (partial) |
| Report, weekly recap, Monday briefing | Learning (reporting only, no feedback into planning) |
| Admin traces and analytics | Infrastructure (operator view, not product learning) |
| Partner, Affiliate, referrals, campaign pages for Brandie's own growth | Adjacent (Brandie's own marketing, not the customer's) |
| Creator Network | Adjacent (internal content supply, off) |
| Video engine | Legacy/parked (no screens) |
| `/legacy/*`, `/content`, `/legacy/library`, `/brand/editor` | Legacy, but some are still load-bearing |

## D. Duplicates and fragmentation

1. **Three content hubs:** `/hub`, `/content-hub` and the legacy `/content`. They overlap on ideas, campaigns and status.
2. **Three "home" screens:** Cockpit (next best action), Engine (autopilot) and Blueprint (week). Each partly answers "what should I do now?".
3. **Two Brand Centres:** the V2 summary at `/brand` and the legacy editor at `/brand/editor`, which is where editing actually happens.
4. **Four strategy chats:** Brand Strategist, Strategist agent, Agent cockpit/Roundtable and Studio "plan mode". On top of that, Blueprint chat edits go through `v2-edit-router`.
5. **Three meanings of "campaign":**
   - content campaigns (`campaigns`)
   - landing pages for Brandie's own growth (`campaigns_public`, one live at a time)
   - Partner and Private Network campaigns

   The Unified Campaigns tab mixes the customer's email campaigns with Brandie's growth pages.
6. **Two ways to approve a Blueprint:** a client-side bulk update and the `approve-blueprint` function.
7. **Two parallel planners:** email planning (`email-marketing-plan`) runs separately from the weekly Blueprint arc. It is not part of the weekly arc.
8. **Two creation entry points:** Studio (blank-canvas chat) and Blueprint/Daily Post (the system-led path). They compete with each other.
9. **Feedback and analytics scattered across 6+ event tables,** with no single performance record per post.

## E. What is missing for a continuous loop

1. **No outcome model.** Nothing links "post X, published on channel Y, led to clicks, DMs or leads". Votes measure taste, not results. A unified `content_outcomes` record per post is missing. It would combine designs/ideas with campaign-page, email, Private Network and manual "posted/DMs" input.
2. **Learning never reaches Strategy.** `genome_preset_weights` affects visual style only. Neither `autopilot-planner` nor `brand-engine` reads results by pillar, arc slot, hook or offer.
3. **No "was it posted?" confirmation** for Daily Post, the main execution path. Execution is assumed, not recorded.
4. **No weekly learning snapshot.** No step turns last week's results into updated Intelligence for the next planner run, for example "pillars that worked" or "audience notes". The Report screen only counts output.
5. **Intelligence is never refreshed by results.** The audience profile and Brand Centre stay fixed after onboarding unless edited by hand.
6. **No single cycle object.** Week, Blueprint and campaigns are separate. Nothing records "cycle N: inputs, then plan, then executed, then results, then lessons".

## F. Smallest high-impact changes

Keep all working code. Reorganise around 4 engines and add one feedback path.

1. **Change the menu to 4 engines only. Nothing is deleted.**
   - Intelligence = Brand, Trends, Competitors.
   - Strategy = Blueprint with campaigns. Engine becomes a settings panel inside it.
   - Execution = Today/Daily Post, Studio, Gallery, Delivery.
   - Learning = Report.
   - Cockpit becomes the home page that shows where the loop stands.
2. **Merge the hubs.** Move the Trends/Competitors tabs from `/hub` into Intelligence and the ideas/campaigns into Strategy. Redirect `/content-hub` and `/content`.
3. **One strategy chat:** the Blueprint chat, which sends to `v2-edit-router`, with experts as personas behind it. Hide the separate Brand Strategist and Agent entry points from the main menu.
4. **Add a `content_outcomes` table and a "Mark as posted / log results" step on Daily Post.** Feed it from existing campaign-page, email and Private Network events.
5. **Add a weekly learning job that extends the existing `weekly-recap`.** It writes `learning_insights` per brand (pillar, hook, offer, timing, style). `brand-context.ts` then includes them, so the planner and the renderer use them automatically.
6. **Rename and separate the campaigns.** Brandie's own growth pages, Partner and Affiliate move under Admin/Growth. Customer campaigns stay in Strategy.
7. **Make email part of the Blueprint.** Email becomes a channel inside the Blueprint arc instead of a separate planner.
8. **Hide `/legacy/*` and move the legacy Brand Centre editor into `/brand`.** The routes stay registered.

## G. Features that would work against this design or confuse users

- **Studio as a top-level blank canvas.** It contradicts "cockpit, not canvas". It should be shown as "Edit / make one-off" under Execution.
- **Engine page as a separate destination.** It splits Strategy into two places.
- **Four chat agents plus Roundtable.** Users can't tell which one changes the plan.
- **The word "campaign" for both growth pages and customer content.** Partner, Affiliate and growth landing pages appear next to customer work.
- **Report showing activity counts as "performance".** It suggests learning is happening when it isn't.
- **Votes presented as the learning signal.** They only change visual style.
- **The separate email-marketing planner,** which can contradict the weekly arc.
- **Creator Network and Private Network if surfaced to ordinary users.** They are distribution or supply side-modules and must stay behind their flags, outside the core loop.
- **The video engine leftovers and the menu link to the Creator Network readiness report.**

## Technical notes
- Learning seam: `_shared/brand-context.ts` is the only edit needed so that every engine reads lessons learned.
- Outcome sources that already exist: `campaign_page_events`, `email_*` tracking, `private_network_events`, `designs.vote`.
- Menu seam: the `NewFloatingNav.tsx` item arrays and `primaryPrefixes`; use redirects in `App.tsx`, not removals.
- Unify Blueprint approval before building learning on approvals (see the rule in `AGENTS.md`).
