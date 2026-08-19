# Unify "Campaigns" and "Campaign pages" into one tab

Today the Partner Dashboard (and Admin) carries two separate tabs that both say "campaign" but are different objects:

- **Campaigns** — email campaigns sent to the partner's leads (`partner_campaigns`): name, subject, body, audience filter, send + delivery counts.
- **Campaign pages** — public landing pages at `/c/<slug>` (`campaigns_public`): copy, sections, approval, one-live-at-a-time, page analytics.

They are related in the real world (a campaign is an offer that has both an email push and a landing page) but nothing connects them in the product. This plan merges them into a single **Campaigns** tab where each campaign is one row that can carry an email blast, a landing page, or both.

## What the unified tab looks like

One tab, `Campaigns`, with a single list. Each row is a campaign showing:

```text
Payday Restock                          [Page: LIVE]  [Email: sent 214]
offer: 20% off till Friday
[ Edit email ]  [ Edit page ]  [ Stats ]  [ Send ]  [ ... ]
```

- Two channel chips per row: **Email** (draft / scheduled / sent + delivered count) and **Page** (none / draft / pending review / live / paused).
- A filter row at the top: All · Email · Landing pages, so nothing that exists today gets harder to find.
- Rows that exist only as an email campaign show **Add landing page** — this creates the page draft, prefills name/goal/offer from the email campaign, and drops the user straight into the existing page editor with AI copy generation.
- Rows that exist only as a landing page show **Add email** — opens the existing email composer prefilled from the page copy.
- Page-side actions (submit for review, approve, activate, pause, reject, delete) and email-side actions (edit, send, recipients log) keep working exactly as they do now, just from the one list.
- Activation still respects the billboard rule: activating a page archives whichever page is currently live, and partner-created pages still need admin approval first.

The **Campaign pages** tab is removed from both the Partner Dashboard and Admin; the Admin campaign view gets the same unified list so admins can review and activate from there.

## Technical notes

- Link the two records with one nullable column: `campaigns_public.partner_campaign_id uuid references public.partner_campaigns(id) on delete set null`, plus a matching index. Nothing else in the schema changes, so existing rows on both sides keep working untouched (unlinked rows simply render with one chip).
- New component `src/components/campaign/UnifiedCampaigns.tsx` that fetches both sources (`campaign-engine` `list` for pages, `partner_campaigns` select for emails), joins them in memory by `partner_campaign_id`, and renders the merged list.
- Reuse, do not rewrite: the existing dialogs from `CampaignManager.tsx` (create, edit + generate copy, stats) and `PartnerCampaignsPanel.tsx` (email composer, inbox-placement hints, `PartnerCampaignSendsDialog`) are extracted as-is and mounted by the new component. All edge-function actions and payload shapes stay identical.
- `campaign-engine` `create` accepts an optional `partner_campaign_id` so "Add landing page" writes the link; "Add email" writes the link back onto the page row after the email campaign is inserted.
- Admins with no partner profile see the page side only, as today.

## Build order

1. Migration: add `partner_campaign_id` + index to `campaigns_public`.
2. Extract the email dialogs and page dialogs into reusable pieces (no behaviour change).
3. Build `UnifiedCampaigns` with the merged list, chips, filters, and cross-channel "Add" actions.
4. Swap it into `PartnerDashboard.tsx` (single `Campaigns` tab) and `Admin.tsx`; remove the old duplicate tab.
5. Verify: existing email campaign still sends, existing live page still resolves at `/c/<slug>`, add-page-from-email creates a linked draft, admin approve + activate still archives the previous live page.
