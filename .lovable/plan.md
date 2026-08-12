# WhatsApp delivery for Autopilot

Send each finished autopilot post to the user's WhatsApp DM: the design image, the caption, and a link back into Brandie — alongside the existing email and push notifications.

## How it will work

1. You connect Twilio (a connect card will appear in chat) and pick the approved WhatsApp Business sender number.
2. In Settings, next to your existing WhatsApp number field, a new "WhatsApp delivery" toggle turns delivery on or off (default off until a number is saved and verified).
3. When Autopilot finishes rendering a post, Brandie sends a WhatsApp message with the design image attached, the caption text, and a "Open in Brandie" link to the post page.
4. Carousels send the cover slide as media plus a note ("carousel, 5 slides") and the link; the remaining slides stay in the app to avoid spamming the chat.
5. If WhatsApp sending fails (bad number, template not approved, provider error), email and push still go out and the failure is recorded so it can be reviewed.

## What you need to know about WhatsApp rules

Meta only allows business-initiated messages outside a 24-hour conversation window through an **approved template**. Since a daily "your post is ready" ping is business-initiated, you must have a template approved in Twilio (e.g. "Your {{1}} is ready. Open it here: {{2}}"). The plan wires the template variables and falls back to a plain free-form message when the user has messaged you in the last 24 hours.

## Technical scope

- **Connector**: Twilio via `standard_connectors--connect`; all calls go through the Lovable connector gateway (`/Messages.json`, form-encoded). No credentials in app code.
- **New edge function `whatsapp-send`** (`verify_jwt = false`, service-role): input `{ user_id, title, body, image_url, url, template_vars? }`. Resolves `profiles.whatsapp_number`, normalises to E.164, checks the delivery toggle, sends `To: whatsapp:+…`, `From: whatsapp:<sender>`, `Body`, `MediaUrl`. Surfaces Twilio status + body on failure (including 401/70051 permission hints).
- **Delivery hook**: call `whatsapp-send` from `autopilot-notify` (success path) next to the existing `send-email` and `push-send` calls, fire-and-forget. Failure path (no credits) also gets an optional WhatsApp notice.
- **Media URL**: use a signed URL for the design image so Twilio can fetch it (designs bucket), valid ~24h.
- **DB**: add `whatsapp_delivery_enabled boolean default false` to `profiles`; add a `whatsapp_deliveries` table (user_id, idea_id, message_sid, status, error_text) with RLS scoped to the owner plus GRANTs, used for de-duplication (unique on idea_id) and debugging.
- **Secrets**: `TWILIO_WHATSAPP_FROM` (the sender number) and optionally `TWILIO_WHATSAPP_TEMPLATE_SID` requested via the secret tool after connecting.
- **Settings UI** (`src/pages/v2/Settings.tsx`): delivery toggle plus a "Send test message" button that calls `whatsapp-send` with a sample payload and shows the provider error verbatim if it fails.
- **Security**: Twilio's SMS/WhatsApp Pumping Protection and Geo Permissions recommended after connecting; only the post owner's own saved number is ever messaged.

## Out of scope

Inbound WhatsApp replies, two-way chat with the agents, and posting to WhatsApp Status — those can come later.
