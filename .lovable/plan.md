# Brandie Outbox — Autonomous Email Marketing Engine

A new pillar that sits alongside the social Content Engine. Same philosophy: the user does not write emails, they approve a weekly email plan that ships itself. It reuses the Brand Centre, JTBD audience profile, Trend Lab, Funnels, Campaigns, Blueprint, and the multi-agent stack we already have.

---

## 1. Scope (V1)

Included:

- Subscriber list management (import, tags, segments, suppression)
- Double opt-in signup forms + hosted landing page
- Autonomous weekly **Email Blueprint** (broadcasts + automated journeys)
- AI-generated subject lines, preheaders, body, CTAs, and on-brand HTML
- Sending via existing Lovable Emails infra (pgmq + process-email-queue), with a dedicated `marketing_emails` queue
- Per-recipient unsubscribe, CAN-SPAM/GDPR footer, suppression honoring
- Open/click tracking, bounce + complaint handling
- "CEO Briefing" extension: email performance feeds back into genome + planner

Out of scope (V2+): SMS/WhatsApp broadcasts, A/B/n statistical testing UI, full drag-and-drop editor, deliverability warm-up automation.

---

## 2. How it fits existing Brandie


| Existing system              | How Outbox uses it                                                     |
| ---------------------------- | ---------------------------------------------------------------------- |
| Brand Centre / VSGS          | Colors, fonts, logo, tone → email HTML theme + voice                   |
| Audience Intelligence (JTBD) | Segment defaults, subject line angles, emotional drivers               |
| Funnels & Campaigns          | Each email is tagged to a funnel stage + campaign; quota-aware planner |
| Content Ideas / Blueprint    | Repurpose post ideas into email arcs; share weekly approval ritual     |
| Trend Lab                    | Seasonal/holiday hooks for broadcasts                                  |
| Autopilot cron               | Same scheduler triggers email generation + sends                       |
| Lovable Emails infra         | Reuse pgmq, suppression, unsubscribe tokens, domain                    |
| Reporting                    | CEO Briefing adds email KPIs; feeds preference weights                 |


No new email provider needed — we extend the existing Lovable Emails pipeline with a separate `marketing_emails` queue, marketing-specific footer, and explicit consent gating (transactional infra never sends to unconsented addresses).

---

## 3. User experience (the "ritual")

1. **Setup once** (in `/hub` → new "Outbox" tab):
  - Connect/confirm sender domain (already done for app emails)
  - Import contacts (CSV) or enable signup form
  - Pick send cadence (e.g. 1 broadcast/week + journeys on)
  - Confirm physical address + brand footer
2. **Monday Briefing** extended:
  - Blueprint now shows two tracks: Social posts + Email sends
  - Each email card: subject, preheader, audience segment, funnel stage, campaign, scheduled time
3. **Approve System** — one tap covers both tracks
4. **Daily**: emails generate, render, and send automatically at the configured time
5. **Friday CEO Briefing**: opens, clicks, replies, unsubs, revenue-attributed (if Paystack linked) per campaign

Conversational edits work the same as posts: "Make Wednesday's email shorter" → routes through edit decision tree.

---

## 4. Multi-agent pipeline (new)

Mirrors the design pipeline:

```text
Planner (weekly) ──► Segment Resolver ──► Copywriter Agent ──►
  Subject/Preheader Optimizer ──► Email Art Director ──►
  HTML Renderer (MJML→HTML) ──► QA Gate ──► Queue ──► Send ──► Tracker
```

- **Planner**: funnel + campaign quota aware, same logic as Blueprint planner, extended with email-specific arcs (welcome, nurture, re-engage, promo, win-back, post-purchase)
- **Segment Resolver**: maps idea → audience segment (tag rules + JTBD persona)
- **Copywriter Agent** (Gemini Pro): 60–150 word body, single CTA, plain-text alt
- **Subject Optimizer** (Flash-Lite): generates 3 candidates, scores for clarity/curiosity/spam-words, picks one (logs others for future A/B)
- **Art Director**: chooses one of N MJML templates themed by VSGS
- **Renderer**: MJML → responsive HTML inline-styled; injects unsubscribe + address
- **QA Gate**: validates required tokens, link safety, image alts, no broken merge tags, suppression preview

---

## 5. Data model

New tables (all RLS-scoped to brand, GRANTs to authenticated + service_role):

- `marketing_contacts` — email, name, tags[], status (subscribed/unsubscribed/bounced), source, consent_at, brand_id
- `marketing_segments` — name, rules (jsonb: tag/JTBD filters), brand_id
- `marketing_lists` — optional named lists, m2m via `marketing_list_members`
- `marketing_journeys` — id, name, trigger (signup, tag_added, purchase, inactivity), steps (jsonb), status
- `marketing_journey_steps` — ordered, wait_duration, email_template_ref, conditions
- `email_broadcasts` — brand_id, subject, preheader, body_md, html, segment_id, funnel_stage_id, campaign_id, scheduled_for, status, idea_ref
- `email_sends` — broadcast_id (or journey_step_id), contact_id, message_id, status, opened_at, clicked_at, bounced_at, complained_at, unsubscribed_at, revenue_cents
- `email_links` — broadcast_id, url, slug (for click tracking redirect)
- `email_signup_forms` — brand_id, slug, fields, redirect_url, double_opt_in
- `marketing_suppression` — brand_id, email, reason (extends existing global suppression with brand-scope)
- `email_preferences` — contact_id, category toggles (promotions, product_updates, newsletter)

Reuses: `funnel_stages`, `campaigns`, `content_ideas`, `brand_products`, `target_audiences`.

---

## 6. Sending infrastructure

- New pgmq queue: `marketing_emails` (separate from `auth_emails`, `transactional_emails`) so rate limiting and DLQ are independent
- Extend `process-email-queue` to drain this queue with marketing-specific throttle (configurable per brand, default 60/min) and pre-send checks: subscribed? not suppressed? consent valid? quiet hours?
- New edge functions:
  - `email-marketing-plan` — weekly planner (cron)
  - `email-marketing-generate` — generates a single broadcast from an idea
  - `email-marketing-send` — enqueues a broadcast (fan-out to per-recipient queue rows)
  - `email-marketing-track` — open pixel + click redirect handler
  - `email-marketing-webhook` — bounce/complaint ingest (extend existing handler)
  - `email-marketing-signup` — public signup form submit + double opt-in confirm
- Reuse existing unsubscribe handler with a marketing-aware branch (per-category vs global)

---

## 7. Best-practice guardrails baked in

- Double opt-in by default; single opt-in opt-in only with explicit toggle
- Required physical address + brand name in footer (CAN-SPAM)
- Per-category preferences + one-click unsubscribe (RFC 8058 `List-Unsubscribe-Post`)
- Quiet hours per contact timezone (no sends 9pm–7am local)
- Frequency cap (default max 3 marketing emails/contact/week)
- Spam-word + ALL CAPS + excessive emoji checks in QA gate
- Plain-text alt auto-generated
- Pre-send "deliverability score" shown on the broadcast card
- Warm-up mode: first 14 days, cap volume + ramp
- Bounce/complaint auto-suppression at brand + global levels
- GDPR: export + delete contact endpoints; consent log immutable

---

## 8. UI surfaces

- **/hub → Outbox tab** with sub-tabs: Contacts, Segments, Forms, Journeys, Broadcasts, Performance
- **/blueprint**: new "Email" lane next to "Social"
- **/post/:dayId**: when item is email, show subject/preheader/body/segment + Send/Regenerate
- **Settings → Email Marketing**: sender name, reply-to, physical address, frequency cap, quiet hours, autopilot on/off
- **CEO Briefing**: new "Email" section with opens, clicks, top broadcasts, segment growth, suppression deltas

---

## 9. Rollout phases

1. **Phase 1 (foundations)**: tables, contacts import, signup form, manual broadcast (no planner), tracking, suppression — proves deliverability end-to-end
2. **Phase 2 (autopilot)**: weekly Email Blueprint, copywriter + subject agents, planner integration with funnels/campaigns
3. **Phase 3 (journeys)**: welcome, abandoned-interest, win-back automations triggered by events
4. **Phase 4 (intelligence)**: A/B subject tests, send-time optimization per contact, revenue attribution via Paystack webhook join

---

## 10. Technical notes (engineering detail)

- Templates as MJML in `supabase/functions/_shared/marketing-email-templates/` with a registry like the transactional one; brand theming injected at render time from VSGS tokens
- Click tracking via `/e/c/:slug` redirect on the published domain; open tracking via 1x1 pixel at `/e/o/:send_id.gif`
- Idempotency: `email_sends` unique on `(broadcast_id, contact_id)`; planner uses `(brand_id, week_start, idea_id)` to avoid duplicate broadcasts
- Reuse `resolve-autopilot-campaign` for routing; add `resolve-marketing-segment` mirror
- Consent gate: `send-transactional-email` refuses any address in `marketing_suppression` for that brand; marketing function refuses any address without `consent_at`
- Rate limit + retry pattern reused from `content-autopilot` (jitter, 429 backoff, leave-as-pending)
- New cron jobs (pg_cron + pg_net, 60s timeout): `marketing-plan-weekly` (Sun 18:00 brand-local), `marketing-send-tick` (every 1 min), `marketing-journey-tick` (every 5 min)

---

## Open questions before build

1. Do you want V1 to ship **all four phases** or start at Phase 1–2 (broadcasts + autopilot) and add journeys later? Yes, V1 to ship **all four phases.**
2. Should marketing emails be **included in the existing subscription tiers** (with a monthly contact cap), or a **paid add-on**? emails be **included in the existing subscription tiers** (with a monthly contact cap). Not available for free and pay-as-you-go customers, only subscription customers
3. Default sender: reuse the project's existing notification subdomain (e.g. `notify.brand.com`) or provision a separate marketing subdomain (`news.brand.com`) for deliverability isolation? (Recommended: separate.)
4. Should the **Blueprint approval** cover social + email together (single approval), or keep email approval as a distinct ritual? Email approval should be separate