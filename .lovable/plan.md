# Partner-sponsored signup credits

Let Marketing Partners request that everyone who signs up through their referral link receives free Brandie credits. Admin approves or rejects; once approved, the credits are granted automatically at signup until the budget runs out or the campaign expires.

## How it works

1. **Partner requests** (new "Credits" tab on `/partner`): credits per signup, total credit budget, and an end date, plus an optional note explaining why.
2. **Admin reviews** in the Partner details dialog (Admin > Partners) — same pattern as the Affiliate requests and Identity tabs, with an explanation line, an optional note, and Approve / Reject. Admin can edit the credits-per-signup, budget, and end date before approving, and can pause or stop an active campaign.
3. **On approval** the campaign goes live. Every new user who signs up through that partner's link gets the credits immediately, visible in their balance like any other reward credit, expiring 30 days after signup.
4. **Automatic stop** when the total budget is used up or the end date passes. Existing leads are not back-filled.
5. **Emails**: partner is notified on approval (with the live terms) and on rejection (with the admin's note). New leads see the bonus in their balance; no extra email.

## Visibility

- Partner's Credits tab shows: status, credits per signup, budget used vs. remaining, end date, number of leads credited, and the request history.
- Admin sees the same numbers per partner, plus who approved and when.

## Technical notes

**New table `public.partner_credit_grants`** (one row per request):
`partner_id`, `requested_by`, `credits_per_signup`, `total_budget_credits`, `credits_granted` (running total), `leads_credited` (running count), `starts_at`, `ends_at`, `status` (`pending` | `approved` | `rejected` | `paused` | `exhausted` | `expired`), `request_note`, `review_note`, `reviewed_by`, `reviewed_at`, timestamps + `updated_at` trigger. Partial unique index so a partner can only have one `pending` and one `approved` row at a time. GRANTs: `select, insert` to `authenticated` (partners see and create only their own via `partner_id_for_user(auth.uid())`), `all` to `service_role`; approval/edit paths are admin-only through the edge function.

**Signup wiring**: extend `public.handle_new_user()` — right after the existing `partner_leads` insert, look up the partner's live grant (`status='approved'`, within `starts_at`/`ends_at`, `credits_granted + credits_per_signup <= total_budget_credits`), insert a `credit_rewards` row (`amount`/`remaining` = credits per signup, `reason` = `partner_grant:<partner slug>`, `granted_by` = the partner's `user_id`, `expires_at` = `now() + 30 days`), then increment `credits_granted` / `leads_credited` and flip status to `exhausted` when the budget is spent. Row-locked so concurrent signups cannot overspend the budget. Wrapped so a grant failure never blocks account creation.

**Edge function `admin-action`**: new operations `partner_credit_grant_list` and `partner_credit_grant_decision` (approve with possibly edited terms, reject, pause, resume, stop), mirroring the existing `alias_decision` shape and returning the same `notified` / `notify_queued` / `notify_error` result.

**Edge function `partner-portal`**: new `credit_grants` action (read, service role, same pattern as the `alias` action) and `credit_grant_request` action to submit a request with validation (1-50 credits per signup, budget >= credits per signup, end date in the future).

**Emails** in `send-email`: `partner_credit_grant_approved` and `partner_credit_grant_rejected` templates, queued through the existing `notification_email_outbox` when the provider rate-limits.

**Frontend**: `src/components/partner/PartnerCreditsPanel.tsx` + a Credits tab in `src/pages/PartnerDashboard.tsx`; a Credits tab in `src/components/admin/PartnerDetailDialog.tsx` with a pending-count badge.

## Out of scope

- Charging the partner for the credits they hand out (grants are Brandie-funded and admin-capped).
- Back-filling existing leads.
