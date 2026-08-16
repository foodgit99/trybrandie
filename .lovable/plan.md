# Show the per-recipient send log in the partner dashboard

The last campaign ("35 FREE Credits") did send: 3 leads, 3 real email addresses, 3 provider IDs, no errors. Partners just can't see any of that today — the campaign card only shows a "3 delivered" count. This adds the recipient-level view.

## What the partner will see

On each sent campaign card, a "View recipients" action opens a dialog listing every recipient of that campaign:

- Email address
- Status badge (green sent, red failed)
- Time sent
- Error reason, shown only on failed rows
- A one-line summary at the top: "3 of 3 delivered"

Failed rows sort to the top so problems are obvious. Draft and scheduled campaigns don't show the action, since there is nothing to list yet.

Wording in the dialog makes the limit of this data explicit: a "sent" row means the email provider accepted the message for delivery. It does not confirm the lead opened it or that it avoided their spam folder.

## Technical notes

- Data comes from `partner_campaign_sends`, filtered by `campaign_id`. The existing RLS policy "Partners view their own campaign sends" (`partner_id = partner_id_for_user(auth.uid())`) already scopes reads correctly, so no migration and no edge function are needed.
- New component `src/components/partner/PartnerCampaignSendsDialog.tsx` — fetches on open, orders by `status` then `sent_at desc`, renders the table with existing Dialog/Badge/Table primitives and design tokens.
- `src/components/partner/PartnerCampaignsPanel.tsx` — add the "View recipients" button on cards where `status` is `sent`, `sending`, or `failed`, plus state for the selected campaign.
- No changes to send logic, templates, or delivery behaviour.
