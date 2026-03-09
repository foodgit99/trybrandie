

## Fix: Update send-email APP_URL to trybrandie.com

### Current State
- 4 out of 5 files already use `trybrandie.com` ✅
- `supabase/functions/send-email/index.ts` line 10 uses `https://trybrandie.lovable.app` for `APP_URL` — this is the only mismatch

### Change
**File: `supabase/functions/send-email/index.ts`** (line 10)
- Change `const APP_URL = "https://trybrandie.lovable.app"` → `const APP_URL = "https://trybrandie.com"`

That's the only change needed. All other references already point to `trybrandie.com`.

