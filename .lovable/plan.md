

## Fix: Old Design Persists When Opening Fresh Studio

### Problem

When a user creates a design and then navigates back to `/studio` (no `?design=` param), the previous design reappears. This happens because:

1. The reset effect (line 309) calls `generation.clearResult()`, but React state updates are asynchronous
2. Before the context state updates, the sync effect (line 580) sees `generation.status === "complete"` with the old result and re-populates all the local state (image, prompt, messages, etc.)
3. The user sees their previous design instead of a blank studio

### Fix

**File: `src/pages/DesignStudio.tsx`**

Add a guard to the sync effect (line 580) so it only applies results that were initiated from the current studio session. Use a ref flag that gets set to `false` on reset and `true` when the user actually triggers a generation in the current session.

Specifically:
- Add a `generationInitiated` ref, defaulting to `false`
- Set it to `true` in `sendMessage` right before calling `generation.startGeneration()`
- Set it to `false` in the reset effect (line 309) alongside the other resets
- In the sync effect (line 580), add `if (!generationInitiated.current) return;` at the top — so stale results from a previous session are ignored
- Reset it back to `false` after the result is consumed

This is a single-file, ~10-line change.

### Files to modify

| File | Change |
|------|--------|
| `src/pages/DesignStudio.tsx` | Add `generationInitiated` ref guard to prevent stale result sync |

