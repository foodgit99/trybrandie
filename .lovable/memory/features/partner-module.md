---
name: Marketing Partner module
description: Partner tiers, attribution, CRM, and the partner email/automation pipeline (Phases 1-3)
type: feature
---

Two affiliate tiers: `friend_of_brandie` (default) and `marketing_partner` (admin promotes). Marketing Partners get `/partner`: referral link, lead CRM, campaigns, automations.

- Attribution is permanent: `partner_leads` written at signup from `partner_slug` metadata; never reassigned.
- Lead statuses are computed, never stored: new, activated, active, low_credits, exhausted, paid, inactive, churned. Single source of truth: `supabase/functions/_shared/partner-leads.ts` + `src/lib/partnerLeadStatus.ts`.
- Partner email is a **separate pipeline** from the brand Outbox: `partner_campaigns`, `partner_campaign_sends`, `partner_automations`, `partner_automation_runs`, `partner_email_suppression`.
- Sending: `partner-campaign-send` (manual/test/scheduled) and `partner-automation-tick` (hourly pg_cron at :07, also flushes due scheduled campaigns). Resend from `partners@<MARKETING_EMAIL_DOMAIN>`, reply-to the partner contact email.
- Automations are once-per-lead, enforced by UNIQUE(automation_id, lead_user_id) in `partner_automation_runs`.
- Merge tokens: first_name, full_name, email, credits, designs, plan, partner_name, referral_link, app_url.
- Privacy: partners only ever see whitelisted lead fields (name, email, plan, credits, counts, dates). Never design content, brand data, or other partners' leads.
- Unsubscribe: public `partner-unsubscribe` function writes to `partner_email_suppression`.
