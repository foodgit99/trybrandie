# Campaign Module — Brandie as its own distribution channel

A campaign is a billboard: one live at a time. A partner or admin creates it, picks which sections their landing page carries, the campaign engine writes the copy in Brandie's voice, they preview and edit it, admin approves (partner campaigns), and once activated the default landing page carries a strip that links to the campaign page at `/c/<slug>`. Creator and admin see a funnel with section-level engagement. Referral attribution survives the whole journey.

## Decisions locked in

- Homepage: default landing page stays. Active campaign adds a dismissible top strip linking to the campaign page. No takeover, no SEO risk to `/`.
- Editing: creators toggle and reorder the standard sections and edit every text field. Images stay Brandie's asset set.
- Offer: messaging and tracking only. Sponsored credits stay in the existing partner credit-grant flow.
- Analytics: views, CTA clicks, signups, conversions, plus section-level view tracking.

## Expert view: drawbacks and how the plan avoids them

1. **Public, unreviewed content on the main domain.** A partner page carries Brandie's name. Mitigation: partner campaigns are `pending_review` until an admin approves; admin can pause or kill a live campaign instantly; only one campaign can be `active` at a time, enforced in the database.
2. **The "one active campaign" rule is a hidden global lock.** Two admins activating at once, or a partner expecting theirs to be live, causes confusion. Mitigation: a unique partial index guarantees a single active row, activation atomically archives the previous one, and the UI shows what is currently live and who owns it.
3. **Attribution can silently break.** A visitor arriving on `/c/<slug>` and clicking through to signup must keep the referral. Mitigation: the campaign page reuses the existing referral capture, every CTA carries the campaign slug plus `ref`, and the referral remains the only attribution source of truth — campaign tracking is additive, never a replacement.
4. **A second rendering path for the landing page invites drift.** Mitigation: no new template. The campaign page composes the same section components as the default page, driven by data. Copy is the only thing that varies.
5. **Public write endpoint for analytics is abuse-prone.** Mitigation: events go through one edge function that only accepts a known campaign slug and a whitelisted event name, writes aggregate counters, and stores no personal data. Rows are anonymous unless a session exists.
6. **AI cost and quality on public pages.** Mitigation: generation is one call per campaign (not per section), cached in the campaign row, regeneration is explicit, and generated copy passes through the same brand-language doctrine already used by the copy agents. Nothing publishes without a human approving it.
7. **Scope creep into a page builder.** Mitigation: sections are a fixed, known list. No custom sections, no uploads, no layout editing in v1.

## What gets built

### Data

- `campaigns_public` (named separately from the existing content `campaigns` table to avoid collision):
  name, slug, goal, target audience, offer text, owner (`user_id`, optional `partner_id`), `status` (`draft`, `pending_review`, `approved`, `active`, `paused`, `archived`, `rejected`), `sections` (ordered JSON of section keys + editable copy), `review_note`, timestamps, denormalised counters.
  Unique partial index on `status = 'active'` so only one campaign can ever be live.
- `campaign_events`: campaign id, event name (`view`, `section_view`, `cta_click`, `signup`, `conversion`), section key, referral slug, optional user id, created_at.
- RLS: owners read/write their own drafts; admins full access; `anon` gets `SELECT` only on the single active/approved campaign (via a security-definer function, not a broad grant). GRANTs written in the same migration.

### Backend (edge functions)

- `campaign-engine`: `generate_copy` (one AI call producing copy for the selected sections, in Brandie's brand language), `submit_for_review`, `approve`, `reject`, `activate`, `pause`, `stats`. Ownership and admin checks server-side.
- `campaign-track`: public, unauthenticated, validated event ingest. Also the endpoint the signup flow pings to mark `signup`/`conversion`.

### Frontend

- **Campaign tab** in `/partner` and in `/admin`: list, create wizard (details → section picker → generate → preview → edit → submit/activate), status badges, stats panel.
- **`/c/:slug` public page**: renders the selected sections using the existing `src/components/landing/*` components, fed by campaign copy. SEO tags per campaign, canonical to itself, referral capture active, section-level view tracking via an intersection observer.
- **Campaign strip** on the default landing page when a campaign is active.
- **Stats view**: funnel counts, per-section view rates, per-CTA clicks, attributed signups.

### Attribution

`/c/:slug?ref=partner` keeps working exactly as today via `capturePartnerRef`. Campaign slug is stored alongside the referral and passed into signup metadata so a lead carries both its partner and the campaign that brought it.

## Build order

1. Migration: tables, single-active constraint, RLS, GRANTs.
2. `campaign-engine` + `campaign-track` functions.
3. `/c/:slug` public page reusing the landing sections.
4. Partner campaign tab (create, generate, preview, edit, submit).
5. Admin campaign tab (review, approve/reject, activate, pause) + landing strip.
6. Stats panel with section-level engagement, then verify end to end: create → approve → activate → visit → events land → signup attributed.
