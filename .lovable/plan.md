# Brandie sending aliases (name@trybrandie.com)

Give each brand a sending identity on the Brandie domain — outgoing marketing email appears as `amina@trybrandie.com` — while replies go to the user's own real inbox. No mailboxes are created; nothing can receive mail at these addresses.

## How it works today

Every Outbox send goes out from a single fixed address (`news@` on the Brandie sending domain). Only the display name and reply-to are per-brand.

## What changes

1. **Alias request** — In the Outbox settings area the user picks a desired handle (`amina`), sets the display name, and gives a reply-to address. The full alias is previewed as `amina@trybrandie.com`.
2. **Admin approval** — A new Aliases section in the admin panel lists pending requests with brand, owner email, requested handle, and reply-to. Admin can approve, reject with a note, or revoke an active alias. Nothing sends from an alias until approved.
3. **Sending** — Once approved, campaign sends use the alias as the From address, the brand's display name, and the user's reply-to. Brands without an approved alias keep the current shared address, so nothing breaks.
4. **Clarity for the user** — The Outbox settings row states plainly: this is a sending identity only, replies arrive at your reply-to address, there is no inbox at this address.

## Guardrails

- Handles are lowercase letters, numbers, dots, hyphens; 3–30 chars; globally unique.
- A blocklist reserves system-ish handles (`admin`, `support`, `billing`, `noreply`, `postmaster`, `abuse`, `news`, `hello`, `security`, `info`).
- Reply-to must be a valid address; a verification email is sent to it and the alias cannot go live until that link is clicked (prevents pointing replies at someone else's inbox).
- One active alias per brand.
- Revoking an alias immediately reverts that brand to the shared sender.
- Aliases are gated to paid tiers (Creator and Agency), matching the rest of Outbox.

## Technical notes

- New table `email_sender_aliases`: `brand_id`, `user_id`, `handle`, `from_name`, `reply_to`, `reply_to_verified_at`, `status` (`pending` | `approved` | `rejected` | `revoked`), `review_note`, `reviewed_by`, `reviewed_at`, timestamps. Unique index on `lower(handle)`; unique partial index on `brand_id` for non-terminal rows. RLS: owner can read/insert their brand's rows; only `has_role(auth.uid(),'admin')` can update status; service role full access; GRANTs for `authenticated` and `service_role`.
- Handle format, length, and blocklist enforced both in a Zod schema on the client and in a `BEFORE INSERT/UPDATE` validation trigger.
- `email-marketing-send` resolves the brand's approved + reply-to-verified alias and uses `handle@MARKETING_EMAIL_DOMAIN` as the From address, falling back to the existing shared address when absent.
- Reply-to verification and approval/rejection notices are sent through the existing email pipeline.
- Admin UI added as a tab under the existing admin panel; user-facing controls added to the Outbox settings panel.

## Deliverability note

All alias mail is still signed by the Brandie domain, so one user's spam complaints affect every brand's deliverability. The admin review step plus revoke is the control for that; per-handle send volume and complaint stats can be added to the admin view later if needed.
