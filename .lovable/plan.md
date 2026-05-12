## Sprint A — The Ritual

Goal: Make Amina's week feel like a ritual she shows up to, not a tool she uses. Monday she gets briefed, she approves, and every day she just drops the post.

---

### 1. Briefing Room screen (`/briefing`)

A single dedicated screen replacing the "scattered cockpit" feel for the weekly review moment.

Layout:
```text
┌─────────────────────────────────────┐
│  This Week's Plan · Week of Nov 11  │
│  Status: Awaiting Approval          │
├─────────────────────────────────────┤
│  Mon · Teaser     [thumb] [caption] │
│  Tue · Education  [thumb] [caption] │
│  Wed · Proof      [thumb] [caption] │
│  Thu · Urgency    [thumb] [caption] │
│  Fri · Close      [thumb] [caption] │
│  Sat · Lifestyle  [thumb] [caption] │
│  Sun · Rest / CTA [thumb] [caption] │
├─────────────────────────────────────┤
│  [Swap a day] [Edit copy]           │
│  [✓ Approve All Drops]              │
└─────────────────────────────────────┘
```

- Inline "Quick Pivot": clicking a day opens a sheet to swap the angle (e.g., "replace with restock announcement") — re-runs only that idea card, not the week.
- Lock state: once approved, week is locked. Edits require explicit "Unlock week" action.

### 2. Approve All gate

- New columns on `content_ideas` (or new `weekly_blueprints` table): `approval_status` (`draft` | `approved` | `locked`), `approved_at`, `week_start_date`.
- Autopilot planner stops setting ideas straight to `scheduled` — instead drops them as `draft` tied to a blueprint row.
- Daily reminder + auto-post jobs only act on `approved` ideas. Drafts are invisible to the daily push.
- "Approve All" button: single click flips the whole week to `approved`, fires confirmation toast, and triggers the Monday Briefing email/WhatsApp confirmation.

### 3. Daily Execution Push

- New edge function `daily-execution-push` (cron at user's local 8am — store `posting_timezone` + `daily_push_hour` on profile).
- For each user with an approved drop today: send WhatsApp-style notification via:
  - **Email** (existing `send-email`) — short subject "Today's drop is ready 📲", body = hook + thumbnail + 1-tap "Open in Brandie" deep link to `/cockpit?drop=<idea_id>`.
  - **In-app**: notification bell + push (web push API, opt-in).
- Cockpit `?drop=` param auto-opens the design viewer with WhatsApp share button already focused.

### 4. Monday Briefing trigger

- New edge function `monday-briefing` (cron Monday 7am local).
- Runs autopilot-planner if no draft blueprint exists for the week, then sends:
  - Email "Your Weekly Strategy is ready" with 7-day summary + CTA "Review & Approve" → `/briefing`.
  - In-app banner on home/cockpit: "Your week is ready — 2 min to approve."

### 5. WhatsApp DM copy field

- Copywriter agent output schema gains `whatsapp_dm` (separate from `caption`/`hook`).
- Format rules: line breaks, emoji-led, single CTA, no hashtags, ≤ 350 chars.
- Brand-strategist + content-autopilot prompts updated to emit it.
- Add field to `content_ideas` table.
- Cockpit share sheet: tabs "Status / Feed Caption / DM Broadcast" — DM tab copies `whatsapp_dm` to clipboard + opens `wa.me`.

### 6. Cockpit copy refresh (light touch)

Replace creator-tool verbs with operator verbs across Cockpit + Home headers:
- "Generate" → "Review today's drop"
- "Create design" → "Open today's post"
- "Design Studio" stays (it's the creative escape hatch), but Cockpit hero now reads "Today's drop · ready to share."

---

### Technical scope

**DB migration**
- `weekly_blueprints` table (`user_id`, `week_start_date`, `status`, `approved_at`, `playbook_id` nullable for Sprint B).
- `content_ideas`: add `blueprint_id`, `approval_status`, `whatsapp_dm`, `day_of_week`, `playbook_role`.
- `profiles`: add `posting_timezone`, `daily_push_hour` (default 8), `monday_briefing_hour` (default 7).

**Edge functions**
- New: `monday-briefing`, `daily-execution-push`.
- Modify: `content-autopilot` (write to blueprint as `draft`), `brand-strategist` / copywriter prompts (emit `whatsapp_dm`), `content-daily-reminder` (filter to `approved`).
- pg_cron: hourly tick that fans out per-user based on `posting_timezone`.

**Frontend**
- New page: `src/pages/Briefing.tsx` + route in `App.tsx`.
- New components: `BriefingDayRow`, `QuickPivotSheet`, `ApproveAllBar`, `WhatsAppDMTab`.
- Cockpit: read `?drop=` param, render "Today's drop" hero, add DM tab to share sheet.
- FloatingNavBar: add "Briefing" entry (Monday-prominent or always-on, TBD).

**Email template**
- New transactional template: `monday-briefing` (7-day summary + Approve CTA).
- New transactional template: `daily-drop-ready` (today's hook + thumbnail + deep link).

---

### Out of scope (deferred to Sprint B / C)
- Playbook engine / Idea Stack angles (Sprint B).
- Signals capture + CEO Briefing (Sprint C).
- Web push notification permissions UI (email-only for v1 of the push).
- NG-specific trigger calendar seed (Sprint B).

---

### Open questions before build
1. Should "Approve All" allow per-day edits *after* approval (soft lock) or require explicit unlock (hard lock)?
2. Is the daily push **email-only** for V1, or do we also want WhatsApp Cloud API? (Cloud API needs Meta Business approval — adds weeks.)
3. Should the Monday Briefing also include a **24h pulse on last week's drops** ("3 posted, 2 skipped") or stay forward-looking only for Sprint A?
