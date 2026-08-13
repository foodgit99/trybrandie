# Make WhatsApp DM delivery actually work

WhatsApp delivery is already built end to end: autopilot finishes a design, calls `whatsapp-send`, which sends through the Twilio connector to the user's saved number. But the delivery log (`whatsapp_deliveries`) has **zero rows ever**, so no message has left the system. This plan diagnoses that and closes the gaps, then verifies with a real message to your phone.

## What we know

- 86 profiles, 65 have a WhatsApp number saved, only 2 have delivery switched on.
- No delivery rows at all — not even failures — meaning `whatsapp-send` is bailing out early (delivery disabled / invalid number / missing config) rather than reaching Twilio, or it is never being invoked for the enabled accounts.
- Your sender is production approved, so business-initiated messages need an approved **content template**. No template SID is configured today, which means any message sent outside a 24-hour conversation window will be rejected with error 63016.

## Steps

1. **Diagnose the live path.** Call `whatsapp-send` in test mode against your number and read the exact Twilio response, plus the recent autopilot logs, to confirm which of the early exits or provider errors is firing.
2. **Log every attempt.** Record a row for skips and early exits too (currently only real send attempts are logged), with the reason. This makes "nothing arrived" diagnosable instead of silent.
3. **Add the approved template.** Wire the approved WhatsApp template SID as a secret and use it for business-initiated sends, falling back to free-form text when a conversation window is already open. Media (the design image) attaches when allowed, otherwise the image goes out as a link.
4. **Make failures visible and retryable.** Show the last WhatsApp delivery status (sent / failed + reason) in Settings, and retry transient provider failures once with backoff.
5. **Verify.** Send a live test to your number, then trigger one real autopilot post end to end and confirm a `sent` row with a Twilio SID.

## Technical notes

- `supabase/functions/whatsapp-send/index.ts` — add skip/early-exit logging, one retry on 5xx / rate limit, template-first send with free-form fallback, and keep the trial media fallback.
- New secret `TWILIO_WHATSAPP_TEMPLATE_SID` (I will request it; you paste the approved template SID from Twilio). Template variables stay as `{{1}}` = post title, `{{2}}` = deep link.
- `whatsapp_deliveries` gains a `reason` text column for skip/failure classification; no schema change to profiles.
- `src/pages/v2/Settings.tsx` — surface last delivery status under the existing "Send posts to WhatsApp" row; no new page.
- No change to `autopilot-notify` wiring; it already fires the call fire-and-forget.
