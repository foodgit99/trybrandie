

## Fix: Double Credit Deposit (80 credits instead of 40)

### Root Cause
Two separate functions both deposit credits for the same payment:
- `paystack-webhook/index.ts` (lines 155-171) — triggered by Paystack server callback
- `paystack-verify/index.ts` (lines 57-82) — triggered by frontend when user returns to /plans

Both read the current `paid_credits`, add the purchased credits, and write back. This results in exactly double the credits.

### Solution
Remove the credit deposit logic from `paystack-verify`. The webhook is the authoritative, tamper-proof source (signature-verified). The verify function should only confirm payment status and return the result to the frontend for UI feedback — it should NOT modify the database.

### Changes

**`supabase/functions/paystack-verify/index.ts`**
- Remove lines 57-82 (the entire block that reads `paid_credits` and updates the profile)
- Keep the payment confirmation email sending (move it to webhook if not already there — but it IS already handled there implicitly via the verify flow, so just remove the email block from verify too since webhook handles affiliate logic)
- Actually, the webhook does NOT send a payment confirmation email — only the verify function does. So we should move the email sending to the webhook, or keep it in verify but just remove the credit deposit.
- Simplest fix: Remove only the credit deposit block (lines 64-82). Keep the email sending in verify since it doesn't cause data issues.

### Files
- `supabase/functions/paystack-verify/index.ts` — remove credit deposit logic, keep email sending

