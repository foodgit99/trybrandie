# Support Module Plan

A native-feeling support flow with a user-facing form, admin triage tab, and email notifications to both the requester and the support team.

## 1. Entry points

- **Hamburger menu** (`NewAppHeader.tsx`) — new "Support" item with `LifeBuoy` icon, placed above Settings.
- **Dedicated route** `/support` — full page using `NewAppHeader` + warm neutral design language (Beige/Charcoal/Gold).

## 2. `/support` page UX

Two-column on desktop, stacked on mobile:

**Left — "Get help" form card**
- Category select: Bug, Billing, Feature request, Account, Other
- Subject (max 120 chars)
- Message (textarea, 20–2000 chars)
- Submit button with loading state, success toast + inline confirmation panel ("We've received your request — ticket #ABC123. Check your inbox.")
- Auto-attached (hidden, sent server-side): user_id, email, brand_id, current plan, app version, user-agent

**Right — "Before you write" helper**
- 4–6 quick FAQ accordions (account, credits, autopilot, billing, design quality)
- "Email us directly" fallback line
- Response time expectation ("Usually within 24h")

Uses zod validation client + server. Sanitises message via `_shared/sanitise.ts`.

## 3. Database

New migration:

```text
support_tickets
  id uuid pk
  ticket_number text unique  (e.g. BRD-7F3A2)
  user_id uuid (nullable for safety)
  email text
  category text
  subject text
  message text
  status text default 'open'  -- open | in_progress | resolved | closed
  priority text default 'normal'
  context jsonb               -- brand_id, plan, user_agent, route
  admin_notes text
  created_at, updated_at timestamptz

support_ticket_replies   (for future two-way; out of scope UI now but table created)
  id, ticket_id, author_role, body, created_at
```

RLS:
- authenticated INSERT own ticket; SELECT own tickets
- admin SELECT/UPDATE all (via `has_role`)
- GRANTs for authenticated + service_role

## 4. Edge function `support-submit`

- Validates payload (zod)
- Inserts ticket, generates ticket_number
- Invokes `send-transactional-email` twice:
  - **User confirmation** → `support-confirmation` template (we received your request)
  - **Admin notification** → `support-new-ticket` template to admin recipient
- Idempotency key: `support-${ticket.id}`

## 5. Email templates (React Email, in `_shared/transactional-email-templates/`)

- `support-confirmation.tsx` — warm neutral, gold CTA, ticket number, message echo
- `support-new-ticket.tsx` — admin view: requester email, category, full message, context block, link to admin tab

Registered in `registry.ts`. Sends through existing Lovable Emails infra.

**Admin recipient**: stored as Supabase secret `SUPPORT_ADMIN_EMAIL` (asked for during build).

## 6. Admin panel

New tab in `/admin` — "Support":
- Table of tickets (newest first): #, requester, category, subject preview, status badge, created_at
- Filters: status, category, search
- Row click → drawer with full message, context JSON, status dropdown (open/in_progress/resolved/closed), admin notes textarea, "Reply via email" mailto link prefilled
- Status updates write to `support_tickets`

## 7. Files touched

**New**
- `src/pages/v2/Support.tsx`
- `src/components/admin/SupportTab.tsx`
- `supabase/functions/support-submit/index.ts`
- `supabase/functions/_shared/transactional-email-templates/support-confirmation.tsx`
- `supabase/functions/_shared/transactional-email-templates/support-new-ticket.tsx`
- DB migration for `support_tickets` + `support_ticket_replies`

**Edited**
- `src/components/v2/NewAppHeader.tsx` — add Support menu item
- `src/App.tsx` — register `/support` route
- `src/pages/Admin.tsx` — register Support tab
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register 2 templates

## Open question

What email should receive admin notifications? I'll store it as `SUPPORT_ADMIN_EMAIL`. If you don't specify, I'll default to `support@trybrandie.com` and you can update the secret later.
