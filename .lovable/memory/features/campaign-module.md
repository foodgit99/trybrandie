---
name: Campaign module (distribution billboard)
description: One-live-at-a-time campaign landing pages created by partners/admins at /c/:slug, with approval, tracking, and attribution
type: feature
---

Turns Brandie into its own distribution channel. Only ONE campaign can be live at a time (billboard rule), enforced by a unique partial index on `campaigns_public` where status='active'.

- Tables: `campaigns_public` (name, slug, goal, audience, offer_text, sections[], copy jsonb, status, starts_at/ends_at, counters), `campaign_page_events` (view, section_view, cta_click, signup, conversion).
- Statuses: draft → pending_review → approved → active → paused/archived (or rejected). Partner campaigns REQUIRE admin approval; only admins can `activate`. Activating archives the previous live campaign. `expire_campaign_pages` runs on pg_cron every 15 min.
- Backend: `campaign-engine` (auth'd CRUD + AI copy in Brandie's voice via Ogilvy doctrine), `campaign-track` (public, anonymous ingest), `campaign-scheduler`.
- Public read is via security-definer RPCs `get_campaign_page(_slug)` and `get_active_campaign_page()` — anonymous visitors never touch the table.
- Layout: exactly ONE template — Brandie's own landing page (`src/components/campaign/CampaignLanding.tsx`). Only the copy varies; sections are toggled (hero is always on).
- UI: `CampaignManager` appears in the Partner Dashboard ("Campaign pages" tab) and Admin ("Campaign Pages" tab). `CampaignBanner` strip on both landing pages points at the live campaign.
- Attribution: partner `?ref=` capture is untouched. The campaign slug is stored separately in `brandie_campaign_ref` (90 days) and sent as `campaign_slug` signup metadata, so affiliate/partner attribution always wins and is never overwritten.
