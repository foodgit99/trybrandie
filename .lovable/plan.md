## Goal

Adopt the "Ogilvy Social Media Copywriting Manual" as the guiding doctrine for every Brandie agent that writes user-facing words — headlines on designs, captions, carousel arcs, email copy, and content-plan idea prompts — without touching agents that only do classification, routing, or layout.

## Which agents get the update (and why)

Copy-producing agents — full framework applied:

1. `supabase/functions/design-studio/index.ts` — **Copywriter Agent** (line ~2561, on-image headline/body/CTA). Primary target; this is literally the "copywriter."
2. `supabase/functions/design-studio/index.ts` — **Caption Agent** (line ~2662, per-post social caption).
3. `supabase/functions/design-studio/index.ts` — **Carousel Arc planner** (line ~3459) — plans slide-by-slide copy structure; needs hooks, PAS/AIDA/BAB arcs, one-objective-per-post, and clear final CTA.
4. `supabase/functions/design-studio/index.ts` — **Carousel Caption** (line ~4049).
5. `supabase/functions/email-marketing-generate/index.ts` — **Email Copywriter** (line ~41). Subject lines, preheaders, body — Ogilvy's direct-response DNA fits perfectly.
6. `supabase/functions/brand-engine/index.ts` — the **idea/prompt generators** (lines ~865, ~1199, ~1486). These produce the `design_prompt` and titles that seed downstream copy, so the framework must shape ideation too (one objective, pillar-aware, hook-forward, no empty motivational filler).

Strategy/advisor agents — lightweight reference only:

7. `supabase/functions/strategist-agent/index.ts` and `supabase/functions/brand-strategist/index.ts` — get a short reference to the framework so their advice to users aligns, but no copywriting rules injected (they don't write posts).

Explicitly out of scope (no change):

- `design-studio` Creative Director / layout / preference-analyst / summariser prompts (not copy).
- `brand-engine` pillar/series/campaign/classifier prompts (structure, not copy).
- Autopilot planners, dispatch, recap analytics, logo designer, email delivery/tracking.

## Implementation

### 1. Shared doctrine module

Create `supabase/functions/_shared/ogilvy-copy-doctrine.ts` exporting two compact string constants distilled from the manual (kept tight to protect token budget):

- `OGILVY_COPY_DOCTRINE` — the operating rules for any agent that writes user-facing words:
  - Ten Commandments (condensed to one-liners).
  - "Every post has ONE objective" — agent must silently pick one from the objective list before writing.
  - Hook psychology menu (curiosity / contrarian / specific / story / question / fear / aspiration / surprise / pattern-interrupt).
  - Caption frameworks (PAS, AIDA, BAB, Story–Lesson–CTA, Myth–Truth–Evidence, Question–Insight–Invitation, Mistake–Solution–Example).
  - Tone Do/Don't (no jargon, no fake excitement, no empty motivational quotes, no exaggeration, no invented stats/testimonials).
  - CTA rule: weak vs strong examples, one clear next step.
  - Pre-flight checklist (objective, hook, value, clarity, credibility, emotion, readability, action).
- `OGILVY_PILLAR_GUIDE` — the 8 pillars + 35/20/15/10/10/10/… distribution ratio, for ideation agents that decide *what* to make (used only by `brand-engine` idea planners, not the caption/copywriter agents).

Both strings live in one file so we can iterate without redeploying every function.

### 2. Injection points

For each targeted agent, prepend the doctrine to the existing system prompt via string concatenation — do **not** rewrite existing brand/audience/category/genome context blocks. Order: `OGILVY_COPY_DOCTRINE` first, then the agent's current role definition and dynamic context.

Per-agent tuning on top of the shared doctrine:

- **Copywriter (on-image)**: emphasise "specifics over adjectives," "clarity beats cleverness," and 15-year-old readability. Existing length/copy_structure validation stays untouched.
- **Caption Agent**: require the agent to state (internally) the single objective + chosen framework, then output 2–4 sentence caption + hashtags. Keep the existing "must align with headline" rule.
- **Carousel Arc**: require an explicit arc mapping (e.g., slide 1 hook = curiosity/contrarian/story, mid-slides = value, final = one strong CTA). Reinforce "one objective for the whole carousel," and forbid restating the same idea across slides.
- **Carousel Caption**: same as Caption Agent + must reference the arc's through-line.
- **Email Copywriter**: add subject-line hook rules and the "attention earned in the first sentence" rule; keep existing MJML/HTML directive shape.
- **brand-engine idea planners** (weekly, empty-day filler, updates→ideas): inject `OGILVY_PILLAR_GUIDE` + a trimmed doctrine excerpt (Commandments + hook menu + "no empty motivational quotes / no company-first openings"). Prompt outputs (titles + design_prompt) must lead with the audience benefit, not "We are excited to…".

### 3. Advisor agents (light touch)

For `strategist-agent` and `brand-strategist`, append a single paragraph to their system prompt: "When advising on posts, captions, or campaigns, apply the Ogilvy Social Media Copywriting doctrine — one objective per post, hooks earn attention, specifics over adjectives, no invented proof, one clear CTA." No full doctrine dump.

### 4. Guardrails already in place — keep

- The existing copy-structure validation gates in `design-studio` (two-phase enforcement) remain the enforcement layer. The Ogilvy doctrine improves *what* the model writes; the validators keep *shape* correct.
- No new DB fields, no schema migration, no new secrets, no client changes.

### 5. Verification

- Deploy the six edited functions.
- Manually generate: one single post, one 5-slide carousel, one autopilot weekly plan, one email campaign — inspect that outputs (a) open with audience-facing hooks not "We/Our," (b) carry one clear CTA, (c) avoid buzzword filler, (d) carousel slides follow a visible arc.
- Check edge-function logs for token-budget regressions; if any prompt trips length limits, trim the doctrine string (kept in one file, so it's a one-line change).

## Technical details

Files added:

```
supabase/functions/_shared/ogilvy-copy-doctrine.ts   (new; exports 2 constants)
```

Files edited (system-prompt strings only):

```
supabase/functions/design-studio/index.ts             (copywriter, caption, carousel arc, carousel caption)
supabase/functions/email-marketing-generate/index.ts  (email copywriter)
supabase/functions/brand-engine/index.ts              (weekly ideas, empty-day filler, updates→ideas)
supabase/functions/strategist-agent/index.ts          (advisor tail paragraph)
supabase/functions/brand-strategist/index.ts          (advisor tail paragraph)
```

No frontend changes. No DB migration. No env or config changes.
