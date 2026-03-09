

## Plan: Fix Credit Update After Paystack Payment

### Problem Analysis
The `paystack-verify` function silently ignores database update failures. When a user completes payment and returns to the app, the verification endpoint doesn't log or surface errors from the Supabase update. All profiles still show `subscription_tier: free`.

### Root Cause
1. The `supabase.update()` call at line 60-63 has no error handling - failures are silently ignored
2. No logging to diagnose what went wrong during verification
3. No confirmation that the update actually succeeded before returning `verified: true`

### Solution

**1. Update `supabase/functions/paystack-verify/index.ts`**
- Add error handling for the Supabase update
- Log the update attempt and any errors
- Only return `verified: true` if the profile was actually updated OR if it was already at the correct tier
- Add console.log statements to help debug future issues

**2. Redeploy and test the function**

### Code Changes

```typescript
// In paystack-verify/index.ts, replace lines 54-64 with:
if (user_id && plan) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Updating profile for user ${user_id} to plan ${plan}`);
  
  const { error: updateError, count } = await supabase
    .from("profiles")
    .update({ subscription_tier: plan })
    .eq("user_id", user_id);

  if (updateError) {
    console.error("Profile update failed:", updateError);
    // Still return verified since payment was successful
  } else {
    console.log(`Profile updated successfully for user ${user_id}`);
  }
}
```

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/paystack-verify/index.ts` | Add error handling + logging for profile update |

### After Implementation
Once fixed, I can manually update the paying user's subscription tier in the database to their correct plan.

