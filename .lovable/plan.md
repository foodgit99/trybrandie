# One partner, one link: the referral link carries the campaign

A partner shares exactly one URL — their referral link. When a campaign page is live, that link lands the visitor on the campaign page, with attribution intact. The campaign page URL stops being something partners see or copy.

## Rules being locked in

- Only ONE campaign page is live across Brandie at a time (unchanged, still enforced in the database).
- A partner's referral link is their only link. `/?ref=<partner>` sends the visitor to the live campaign page when one is running, otherwise to Brandie's default landing page.
- Every call to action on the campaign page keeps `ref=<partner>` so signups stay attributed to the partner exactly as today. Affiliate/partner attribution still wins over campaign attribution.
- The `/c/<slug>` URL keeps working (admins and direct traffic), but it is no longer surfaced to partners as a link to copy or open.
- Partner email campaigns are untouched — no "one active" restriction there.

## What changes

### 1. Referral link routes to the live campaign

On the public landing route, after the existing referral capture runs, check the live campaign (via the existing `get_active_campaign_page` function, which already returns the campaign slug and the owning `partner_slug`). If a campaign is live, redirect signed-out visitors who arrived with `?ref=` to `/c/<slug>?ref=<partner>`, replacing the history entry so Back does not bounce. Signed-in users and visitors without a referral keep today's behaviour: default landing page plus the campaign strip.

### 2. Campaign page preserves and forwards the referral

The campaign page reads the stored partner referral and appends it to the signup link and every CTA, so the flow is: referral link → campaign page → `/auth` with both the partner ref and the campaign slug. Tracking events already send the ref; nothing regresses.

### 3. One link in the partner UI

In the unified Campaigns tab (partner view):

- Replace the campaign page "Copy link" and "Open" actions with the partner's referral link, labelled as the link to share, with a note that it points at the live campaign page automatically.
- Keep an internal "Preview" that opens the page in the existing in-dialog preview, so partners can still see what visitors see.
- Admins keep the direct `/c/<slug>` open/copy actions.

## Technical notes

- Files: `src/App.tsx` (or a small `CampaignRefRouter` component mounted on the landing route), `src/pages/v2/CampaignPage.tsx`, `src/components/campaign/UnifiedCampaigns.tsx`, `src/components/campaign/CampaignLanding.tsx` (CTA href threading), `src/lib/campaignTrack.ts` if a helper is needed.
- No schema change, no edge function change. The global single-active index and `activate_campaign_page` stay as they are.
- Redirect guard: never redirect when already on `/c/*`, when `preview=1`, or for authenticated users, to avoid loops and to keep the app entry path clean.

## Verification

Create/activate a campaign, open `/?ref=<partner>` in a fresh session, confirm the redirect to the campaign page, confirm the stored partner ref survives, click the CTA and confirm `/auth` carries both partner ref and campaign slug, and confirm the partner dashboard shows only the referral link.
