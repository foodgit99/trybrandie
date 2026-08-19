# Fix admin campaign page preview

## Why you see "This campaign has ended."

The Preview button in the admin Partner requests tab opens `/c/<slug>?preview=1`. That public page loads campaign data through the `get_campaign_page` database function, which is deliberately restricted to campaigns that are `active` and inside their date window. A page awaiting review is `pending_review`, so nothing comes back and the page falls through to the "campaign has ended" state.

In short: the preview link uses the visitor-only data path, which by design cannot see unapproved pages.

## Fix

Make the admin preview use the same in-dialog preview the campaign manager already has, instead of the public URL:

- In the admin Partner requests tab, change Preview from a link to a button that opens a preview dialog rendering `CampaignLanding` with the campaign's own `copy`/`sections` and `preview` mode on (identical to the existing preview in the unified Campaigns view).
- Keep tracking and navigation disabled in that preview so views/clicks are not counted.

## Technical notes

- `src/components/admin/PartnerDetailDialog.tsx` (~line 736): replace the `<a href={`/c/${slug}?preview=1`}>` with local `previewing` state plus a `Dialog` (`max-h-[85vh] overflow-y-auto`) containing `CampaignLanding copy={...} sections={normaliseSections(...)} preview signupHref="#"`.
- The partner campaign rows fetched for this tab must include `copy` and `sections`; if the current fetch omits them, widen the select.
- No database or edge-function changes; `get_campaign_page` stays locked to live campaigns.
