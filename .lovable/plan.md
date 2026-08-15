# Brandie sending identities + inbox

Each brand gets an address on the Brandie domain (`amina@trybrandie.com`) that it can **send from** and **receive replies at**, with a real inbox inside Brandie — thread list, message view, and reply — instead of forwarding replies to an outside mailbox.

## How it works today

Every Outbox send goes out from a single fixed address (`news@` on the Brandie sending domain). Only display name and reply-to are per-brand, and nothing inbound exists — replies to Brandie addresses go nowhere.

## Part 1 — Sending identity

1. **Alias request** — In Outbox settings the user picks a handle (`amina`), a display name, and requests it. The full address is previewed.
2. **Admin approval** — A new Aliases section in the admin panel lists pending requests with brand, owner email, and requested handle. Admin approves, rejects with a note, or revokes. Nothing sends from an alias until approved.
3. **Sending** — Approved aliases become the From address on campaign sends; reply-to points back at the same alias so answers land in the Brandie inbox. Brands without an alias keep the current shared sender.

Guardrails:
- Handles: lowercase letters, numbers, dots, hyphens, 3–30 chars, globally unique.
- Reserved handles blocked (`admin`, `support`, `billing`, `noreply`, `postmaster`, `abuse`, `news`, `hello`, `security`, `info`).
- One active alias per brand; revoke reverts that brand to the shared sender.
- Aliases and inbox gated to paid tiers (Creator, Agency).

## Part 2 — Inbox

Receiving mail needs a mail provider that accepts messages for the Brandie domain and forwards them to Brandie as a webhook. That part is DNS + provider setup outside the app; everything after it is built here.

1. **Inbound route** — Mail for the alias domain is accepted by the inbound provider and POSTed to a new Brandie endpoint. Requests are authenticated by signature so nobody can inject fake mail.
2. **Delivery + storage** — The endpoint resolves the recipient handle to a brand, stores the message (from, subject, plain text, sanitised HTML, headers, attachments in storage), and attaches it to a thread. Unknown handles are dropped and logged.
3. **Threading** — Messages group by `In-Reply-To`/`References`, falling back to normalised subject plus counterparty address, so a back-and-forth reads as one conversation and links back to the campaign that started it.
4. **Inbox UI** — A new Inbox tab in the Hub: thread list with sender, snippet, unread badge and time; thread view with the full exchange; a reply composer that sends from the brand's alias and keeps the thread's headers so replies stay threaded in the recipient's client. Mark read/unread, archive, delete.
5. **Notifications** — New inbound mail can raise the existing daily/notification path (email or WhatsApp) with an unread count; a bell/unread badge shows on the Inbox tab.
6. **Safety** — Rendered HTML is sanitised, remote images are blocked until the user opts in per thread, and attachments are stored privately with signed download links. Spam/complaint headers from the provider mark a thread as spam rather than deleting it.

## Setup you'll need to complete

- Choose the inbound provider and add its MX records for the alias domain. Because Brandie's sending subdomain is already delegated, inbound uses either the root domain or a dedicated subdomain (for example `mail.trybrandie.com`, making addresses `amina@mail.trybrandie.com`) — you pick which, and the choice only changes the visible address.
- Provide the inbound provider's signing key so the webhook can verify requests. I'll request it as a secret when we build.
- Cloudflare Email Routing (free, catch-all to a webhook) and Mailgun inbound routes both work; I'll wire whichever you choose.

## Technical notes

- **Tables** — `email_sender_aliases` (brand_id, user_id, handle, from_name, status, review_note, reviewed_by/at, unique lower(handle), one active per brand); `inbox_threads` (brand_id, alias_id, counterparty_email/name, subject, last_message_at, unread_count, status: open/archived/spam, optional broadcast_id); `inbox_messages` (thread_id, brand_id, direction in/out, message_id, in_reply_to, references, from/to, subject, text_body, html_body sanitised, headers jsonb, attachments jsonb, provider_raw_ref, created_at). RLS scoped through `has_brand_access`; admin-only updates on alias status via `has_role`; GRANTs for `authenticated` and `service_role` in the same migration.
- **Functions** — `inbox-receive` (public, signature-verified, `verify_jwt = false`, idempotent on provider message id), `inbox-reply` (auth'd, sends via the existing Resend path with `Message-ID`/`In-Reply-To`/`References` and records the outbound row), alias resolution added to `email-marketing-send`.
- **Storage** — private `inbox-attachments` bucket, signed URLs on demand.
- **Frontend** — `InboxTab.tsx` in the Hub with thread list/detail split, realtime subscription on `inbox_messages` for live arrival, plus alias controls in the Outbox settings panel and an Aliases tab in the admin panel.

## Deliverability note

All alias mail is signed by the Brandie domain, so one brand's complaints affect everyone's deliverability. Admin approval plus revoke is the control; per-handle volume and complaint stats can be surfaced in the admin view later.
