

## Plan: Transactional Email Notifications via Resend

### Overview

Create an edge function `send-email` that uses Resend to send transactional emails at three key events:
1. **Welcome email** -- after onboarding completes
2. **Referral reward** -- when a user earns bonus credits
3. **Out of credits** -- when a generation attempt hits the credit limit

### Step 1: Store Resend API Key

Use the `add_secret` tool to securely store `RESEND_API_KEY` as a backend secret.

### Step 2: Edge Function -- `supabase/functions/send-email/index.ts`

A single edge function that accepts a JSON body:
```json
{ "type": "welcome" | "referral_reward" | "out_of_credits", "to": "user@email.com", "data": { ... } }
```

- Uses Resend's REST API (`https://api.resend.com/emails`) with the stored API key
- Contains HTML templates for each email type inline
- Sender: `Brandie <hello@trybrandie.com>` (or whatever domain you have verified in Resend)
- CORS headers included, `verify_jwt = false` with auth validation in code

### Step 3: Trigger Points (Frontend)

| Event | Location | Trigger |
|---|---|---|
| Welcome | `src/pages/Onboarding.tsx` | After brand creation completes, call `send-email` with user's email |
| Referral reward | `src/pages/Onboarding.tsx` | After `process_referral` RPC succeeds, call `send-email` to notify referrer |
| Out of credits | `src/pages/DesignStudio.tsx` | When credit check fails (user hits limit), call `send-email` |

For referral rewards, we need the referrer's email. The `process_referral` function will be updated to return the referrer's email in its response.

### Step 4: Database Change

Update `process_referral` function to also return the referrer's email so the frontend can trigger the notification email.

### Step 5: Config

Add to `supabase/config.toml`:
```toml
[functions.send-email]
verify_jwt = false
```

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/send-email/index.ts` | New edge function with 3 email templates |
| `supabase/config.toml` | Add send-email function config |
| `src/pages/Onboarding.tsx` | Call send-email for welcome + referral reward |
| `src/pages/DesignStudio.tsx` | Call send-email when out of credits |
| DB migration | Update `process_referral` to return referrer email |

