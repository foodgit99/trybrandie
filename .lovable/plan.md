# Why the user got the error

The DB error `new row for relation "brands" violates check constraint "brands_vibe_check"` is caused by a Postgres CHECK constraint on `public.brands.vibe`:

```
CHECK (vibe = ANY (ARRAY['Minimal','Bold','Luxury','Playful','Corporate','Cinematic']))
```

When I recently expanded the industry playbooks in `src/lib/industryPlaybooks.ts`, several new playbooks set `defaultVibe` to values **outside** this allowed list:

- Warm, Modern, Friendly, Calm

The Education & Coaching playbook the user picked sets `defaultVibe` to one of these (likely "Friendly"), so when onboarding ran `insert into brands { vibe: 'Friendly', ... }`, Postgres rejected it.

This also violates our own internal rule: "Use validation triggers instead of CHECK constraints" — but more importantly the constraint is now stale relative to the playbook list.

# Fix

Two coordinated changes:

### 1. Database migration
Drop the `brands_vibe_check` CHECK constraint entirely. Vibe is a free-form descriptor used as a styling hint by the AI agents — it doesn't need a hard enum lock at the DB level. Existing rows are unaffected (drop is non-destructive).

If we want any safety, we'd add a lightweight validation trigger that only checks for non-empty/length, but that's optional. Recommendation: just drop it — the playbook list is the source of truth and is curated in code.

### 2. No code changes required
Once the constraint is gone, all current `defaultVibe` values (Warm, Modern, Friendly, Calm, plus the originals) will insert cleanly. The Brand Centre vibe input is already free-text in the rest of the app.

# Recovery for the affected user

After the migration, the user can simply retry onboarding (or resume from where they were). No data was written for them since the insert failed atomically.
