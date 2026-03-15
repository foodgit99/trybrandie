# Content Hub — Status Audit

## Working Perfectly

1. **Frontend UI structure** — The Content Hub page renders correctly with all sections: pillars, weekly calendar, series, campaigns. Layout, animations, and responsive design are solid.
2. **Manual CRUD for pillars and series** — Create, edit, and delete dialogs work correctly. Forms have proper validation, emoji picker, and all fields map to the database schema. RLS policies are properly configured for all four tables.
3. **Data queries** — All four `useQuery` hooks (pillars, series, campaigns, weekly ideas) are correctly structured with proper `enabled` guards and `brandId` scoping.
4. **Studio deep-link navigation** — `handleIdeaAction` correctly builds URL params with `prompt` and `content_idea_id`, and the Studio picks them up to pre-fill the input.
5. **Weekly calendar rendering** — Day-by-day layout with idea status indicators (lightbulb vs checkmark), series badges, and arrow buttons to create designs.
6. **Content idea status tracking** — After a design is created from a content idea, the Studio updates the idea's status to "created" and links the `design_id`.
7. **ChatSuggestions integration** — Content ideas are fetched in the Studio and passed to ChatSuggestions, which prioritizes them over random seasonal suggestions.

---

## Working Partially

1. **Studio auto-fill only sets input, does not auto-send** — When navigating from Content Hub with `?prompt=...`, the prompt is placed in the textarea but the user must manually press Send. The plan called for auto-send. This is a UX friction point but not broken.
2. **Campaigns section has no manual CRUD** — Pillars and series have Add/Edit/Delete, but campaigns only have AI regeneration. Users cannot manually create, edit, or delete campaigns. The section also hides entirely when empty (line 654: `campaigns && campaigns.length > 0`), so new users with no campaigns see nothing — not even an empty state with an "Add" button.

---

## Not Working At All

1. **Edge function auth is broken** — The `brand-engine` function uses `supabase.auth.getClaims(token)` (line 32), which **does not exist** in the Supabase JS client. Every other edge function in the project uses `supabase.auth.getUser()`. This means every call to the Brand Engine will fail with a runtime error, making **all AI generation non-functional**: pillars, series, campaigns, and weekly ideas.
2. **Auto-generate on first visit fails silently** — Because the edge function crashes, the `useEffect` that triggers `handleFullGenerate()` when no pillars exist (line 162-167) will fire, fail, show an error toast, and leave the user with an empty Content Hub and no clear path forward.

---

## Fixes Required

### Critical (blocks all AI generation)

- **Fix `brand-engine` edge function auth**: Replace `getClaims(token)` with `getUser()` pattern used by all other functions. Extract `userId` from the user object instead of claims.

### Important (UX gaps)

- **Add campaign manual CRUD**: Add create/edit/delete dialogs for campaigns, matching the pillar and series pattern. Show empty state with "Add" button when no campaigns exist.
  &nbsp;

### Minor

- The `decodeURIComponent` on line 342 of DesignStudio is redundant — `URLSearchParams.get()` already decodes, which could cause double-decoding issues with special characters.