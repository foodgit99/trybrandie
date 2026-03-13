

# Fix: Floating pill "generating" click opens new chat instead of returning to ongoing design

## Problem
In `FloatingDesignStatus.tsx` line 64-65, when status is `"generating"`, the click handler navigates to `/studio` with no design ID. This triggers a full state reset in the studio (fresh session). The completed state works because `result.design_id` is available.

## Fix

**1. Track `current_design_id` in the generation context**

In `src/contexts/DesignGenerationContext.tsx`:
- Add a `currentDesignId` state (`string | null`)
- Set it from `params.current_design_id` when `startGeneration` is called
- Clear it on `clearResult`
- Expose it in the context value

**2. Use it in the floating pill**

In `src/components/FloatingDesignStatus.tsx`:
- Read `currentDesignId` from the context
- Change the generating click handler from `navigate("/studio")` to `navigate("/studio?design=${currentDesignId}")` when a design ID exists, falling back to `/studio` if it's a brand-new design (no ID yet)

Two files changed, minimal edits. No other behavior affected.

