
## Analysis

The `send-email` edge function exists and has templates, but **it's not deployed** — the `supabase/config.toml` doesn't include it, which is why no logs appear and emails never send.

Additionally, I need to:
1. Add the function to `config.toml`
2. Add a **payment confirmation** email template (missing)
3. Add a **low credits warning** email template (different from "out of credits" — triggered at <5 credits)
4. Send confirmation email after payment (in `paystack-verify` or `paystack-webhook`)
5. Send low credits warning in `design-studio` when credits drop below 5
6. Update all templates to use clickable links with proper anchor tags

## Plan

### 1. Update `supabase/config.toml`
Add the `send-email` function configuration.

### 2. Enhance `send-email/index.ts`
Add two new email templates:

**Payment Confirmation** (`payment_confirmation`)
- Confirms successful subscription upgrade
- Shows plan name and amount
- Links to Design Studio

**Low Credits Warning** (`low_credits`)
- Triggers when remaining credits < 5
- Encourages upgrading or sharing referral link
- Links to Plans page

Both templates will:
- Use Brandie's brand colors (#1a1a2e header, #c4a265 gold accents)
- Include the Brandie logo
- Have clickable buttons using proper `<a href>` tags

### 3. Update `paystack-verify/index.ts`
After successful payment verification, fetch user email and send `payment_confirmation` email.

### 4. Update `supabase/functions/design-studio/index.ts`
After incrementing generation count, check if remaining credits < 5 and send `low_credits` warning (once per session/day to avoid spam).

### 5. Deploy `send-email` function

## Files Changed

| File | Change |
|---|---|
| `supabase/config.toml` | Add `[functions.send-email]` config |
| `supabase/functions/send-email/index.ts` | Add `payment_confirmation` and `low_credits` templates with branded design |
| `supabase/functions/paystack-verify/index.ts` | Send confirmation email after successful payment |
| `supabase/functions/design-studio/index.ts` | Send low credits warning when < 5 credits remain |
