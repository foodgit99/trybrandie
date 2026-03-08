

## Plan: Referral Loyalty Program (Earn 5 Credits per Signup)

### How It Works

1. Each user gets a unique referral code (stored in `profiles`)
2. Users share a referral link: `trybrandie.lovable.app/auth?ref=CODE`
3. When a new user signs up via that link, the referral code is stored on the new user's profile
4. A backend function validates the referral and awards 5 bonus credits to the referrer

### Database Changes

**Migration 1 — Add referral columns to `profiles`:**
```sql
ALTER TABLE public.profiles
  ADD COLUMN referral_code text UNIQUE DEFAULT substr(gen_random_uuid()::text, 1, 8),
  ADD COLUMN referred_by text;
```

**Migration 2 — Create `referral_rewards` tracking table:**
```sql
CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  credits_awarded integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own rewards"
  ON public.referral_rewards FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id);
```

**Migration 3 — Database function to process referral:**
A `SECURITY DEFINER` function that:
- Looks up `referred_by` on the new user's profile
- Finds the referrer by `referral_code`
- Adds 5 to referrer's `generations_count` (as negative, i.e. subtracts 5 from used credits) or adds a `bonus_credits` column
- Inserts a row into `referral_rewards`
- Called via a trigger on `profiles` insert, or invoked from the signup flow

**Better approach — add `bonus_credits` column to profiles:**
```sql
ALTER TABLE public.profiles ADD COLUMN bonus_credits integer NOT NULL DEFAULT 0;
```
This keeps earned credits separate from the generation counter. Credit check becomes: `FREE_TIER_LIMIT - generations_count + bonus_credits`.

### Frontend Changes

**1. `src/pages/Auth.tsx`** — Capture `ref` query param on signup:
- Read `?ref=CODE` from URL
- Pass it as `user_metadata.referred_by` in `signUp()` options
- The `handle_new_user` trigger stores it on the profile

**2. `src/pages/Settings.tsx`** — Add "Refer a Friend" section:
- Show the user's unique referral link with a copy button
- Show count of successful referrals and credits earned (from `referral_rewards`)

**3. `src/components/AppHeader.tsx`** & `src/pages/DesignStudio.tsx`** — Update credit calculation:
- Change credit remaining formula: `FREE_TIER_LIMIT + bonus_credits - generations_count`

**4. `supabase/functions/handle_new_user` trigger update:**
- Update `handle_new_user()` to also store `referred_by` from `raw_user_meta_data`

### Edge Function: `process-referral`
- Called after a new user completes onboarding (or on first login)
- Validates the referral code, awards 5 `bonus_credits` to referrer
- Inserts tracking row in `referral_rewards`
- Prevents double-claiming (unique constraint on `referred_user_id`)

### Summary of Changes

| File / Resource | Change |
|---|---|
| DB migration | Add `referral_code`, `referred_by`, `bonus_credits` to `profiles`; create `referral_rewards` table; update `handle_new_user` function |
| `supabase/functions/process-referral/index.ts` | New edge function to validate & award referral credits |
| `src/pages/Auth.tsx` | Capture `?ref=` param, pass in signup metadata |
| `src/pages/Settings.tsx` | Add referral link section with copy button + stats |
| `src/pages/Onboarding.tsx` | Call `process-referral` on onboarding completion |
| `src/components/AppHeader.tsx` | Update credit formula to include `bonus_credits` |
| `src/pages/DesignStudio.tsx` | Update credit formula to include `bonus_credits` |

