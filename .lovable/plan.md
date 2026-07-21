
# Competitor Intelligence

An autonomous module that watches a brand's real market rivals every week, benchmarks their positioning against the user's brand, tracks their SEO wins, and drops the best signals straight into Blueprint as content ideas. It lands as a new tab in `/hub` and a card in the Monday Briefing.

## The user experience

**Sunday night, before the Monday Briefing runs:**
1. If the brand has no competitors yet, Brandie discovers 3–5 rivals autonomously using industry + audience + Semrush `competitive_analysis` on the brand's domain.
2. For each tracked competitor, Brandie runs a weekly scan: Firecrawl the site + Instagram handle for new posts/offers/hero copy, Semrush `domain_analysis` + `top_pages` for SEO movement, brand extraction (colors, fonts, tone).
3. Gemini 3.1 Pro reads the raw scan and produces a **Competitor Digest**: what they launched, what's working for them, positioning shifts, and 2–3 actionable "steal-the-angle" content ideas.
4. Actionable ideas flow into `content_ideas` as `source='competitor_intel'`, tagged with the competitor and rationale, ready for the next Blueprint.

**Inside the app:**
- **New `/hub` tab: "Competitors"** — grid of tracked competitor cards. Each shows logo, last-scan date, "What changed" bullets, brand-vs-them side-by-side (colors, fonts, hero copy, price points), SEO delta (traffic ▲/▼, new top pages), and a "Turn into a post" button on each surfaced idea.
- **Cockpit weekly card** — "3 moves your rivals made this week" under the hero briefing.
- **Add / remove competitor** — manual override is available, but the empty state is auto-populated so users never see a blank canvas.

## Tier caps

| Tier    | Tracked competitors |
| ------- | ------------------- |
| Free    | 1                   |
| Creator | 3                   |
| Agency  | Unlimited           |

Enforced via a trigger on `brand_competitors` INSERT, mirroring `enforce_brand_limit()`.

## Data model

```text
brand_competitors                competitor_snapshots               competitor_signals
─────────────────                ─────────────────────              ───────────────────
id                               id                                 id
brand_id (FK brands)             competitor_id (FK)                 competitor_id (FK)
name                             scanned_at                         brand_id (FK)
domain                           source (site|instagram|semrush)    signal_type (launch|
instagram_handle                 raw (jsonb — scrape body)            offer|angle|seo_win|
logo_url                         extracted (jsonb — brand tokens,     positioning_shift)
discovery_source                    top pages, posts, prices)       summary
  (auto|user)                    tokens_used                        rationale
discovery_rationale              cost_credits                       content_idea_id (nullable)
is_active                                                           week_start_date
last_scanned_at                                                     acted_on (bool)
created_at
```

All three tables: RLS scoped to `has_brand_access(brand_id, auth.uid())`, GRANT to authenticated + service_role, no anon.

## Edge functions

- **`competitor-discover`** — one-shot. Given `brand_id`, calls Semrush `competitive_analysis`, Firecrawl-scrapes the top 3–5 rivals to enrich (name, logo, IG handle inferred from footer), inserts them into `brand_competitors` respecting the tier cap. Idempotent.
- **`competitor-scan`** — per-competitor scan. Firecrawl the domain (branding + summary formats) + IG handle (if set), Semrush `domain_analysis` + `top_pages`, write to `competitor_snapshots`. Uses `heartbeat_at` + chunking pattern already in `content-autopilot`.
- **`competitor-digest`** — per-brand weekly synthesis. Reads latest snapshots, prompts Gemini 3.1 Pro to produce signals + steal-the-angle ideas, writes `competitor_signals`, and inserts approved ideas into `content_ideas` with `source='competitor_intel'`.

Failures leave rows in `pending` so the sweep retries — matches the reliability pattern from the autopilot audit.

## Scheduling

One new `pg_cron` job — **`competitor-weekly-scan`, Sundays 22:00 UTC** — POSTs to a lightweight orchestrator that fans out `competitor-scan` per active competitor (concurrency 3, respecting Firecrawl + Semrush rate limits), then triggers `competitor-digest` per brand. Runs before the Monday 06:00 briefing so results are ready when the user opens the app.

An empty-state trigger also fires `competitor-discover` on brand creation once the brand has an industry set, so nothing is blank on day one.

## Feeding the Brandie engine

When `competitor-digest` produces a "steal-the-angle" idea:
- It's inserted into `content_ideas` as `autopilot=true, approval_status='pending'` (Assisted) or `'approved'` (Autonomous), unscheduled.
- The next `autopilot-planner` daily top-up (already scheduled at 00:15 UTC) picks it up and slots it into an empty day, respecting funnel + campaign quota rules already in `resolve-autopilot-campaign.ts`.
- The idea carries `content_category`, a `competitor_rationale` field, and links back to the competitor card via `competitor_signals.content_idea_id` so users see *why* it was suggested.

## Frontend

- `src/components/v2/hub/CompetitorsTab.tsx` — grid, add/remove, discovery empty state, "Refresh now" button (respects tier).
- `src/components/v2/CompetitorCard.tsx` — logo, last-scan pill, "What changed" bullets, mini brand-benchmark strip, SEO delta chip, ideas list.
- `src/components/v2/CompetitorDigestCard.tsx` — Cockpit hero placement, "3 moves this week" summary.
- Wired into `Hub.tsx` alongside existing Outbox/Trends/Funnels/Campaigns tabs.
- Tier upgrade prompt on hitting the cap, using the existing `SubscriptionPanel` pattern.

## Technical details

- **AI model**: `google/gemini-3.1-pro-preview` for the digest (reasoning-heavy); `google/gemini-3.1-flash-lite` for lightweight brand extraction if Firecrawl `branding` format is unavailable.
- **Firecrawl**: uses the existing gateway-backed connection. Formats requested per scan: `branding`, `summary`, `links`. IG scraping via the same connector with the profile URL.
- **Semrush**: uses the existing connector. Auto-fallback to `us` database, with the brand's country database when set on `brands`.
- **Credit accounting**: each scan writes `cost_credits` to the snapshot for admin visibility; no user-facing credit charge — this is a subscription-included feature.
- **Idempotency**: `competitor_snapshots` unique on `(competitor_id, week_start_date, source)` so a re-run replaces the row rather than duplicating.

## Out of scope for V1

- Paid-ads spend tracking (Meta ad library integration) — flagged as V2.
- Real-time push alerts when a competitor launches — weekly cadence only.
- Manual competitor discovery UI ships, but auto-discovery is the default path per the user's decision.

Ready to build once you approve.
