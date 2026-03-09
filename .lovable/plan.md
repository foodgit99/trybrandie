
## Plan: Refined Floating Design Status Behavior

### Current Issue
The `FloatingDesignStatus` component currently shows whenever `status !== "idle"`, regardless of which page the user is on. It should **only appear when the user is away from the Design Studio** (`/studio`).

### Changes Required

**File: `src/components/FloatingDesignStatus.tsx`**

1. **Hide on Studio Page**: Add logic to hide the floating component when `location.pathname === "/studio"` — it's partially there (`isOnStudio`) but not used to control visibility.

2. **Change Visibility Logic**: 
   - Current: `isVisible = status !== "idle"`
   - New: `isVisible = status !== "idle" && !isOnStudio`

3. **Navigation on Click**:
   - When generating: navigate to `/studio` (scroll to active generation)
   - When complete: navigate to `/studio?design={design_id}`, then clear result

4. **Permanent Dismiss on Complete Click**: The current `clearResult()` already handles this — just ensure it's called after navigation when complete.

5. **Remove Auto-Dismiss Timer**: Currently auto-dismisses after 30s when complete. Remove this — let user explicitly click to navigate or dismiss.

### Summary of Behavior
| User Location | Status | Floating Visible |
|---------------|--------|------------------|
| `/studio` | generating | ❌ Hidden |
| `/studio` | complete | ❌ Hidden |
| Anywhere else | generating | ✅ Visible |
| Anywhere else | complete | ✅ Visible |
| Anywhere | idle | ❌ Hidden |

