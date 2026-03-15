

# Convert Design Studio Input to Multi-line Textarea

## Change
Replace the single-line `<input>` element in the Design Studio chat box with a `<textarea>` that:
- Shows up to 3 visible lines before scrolling
- Wraps text vertically instead of overflowing horizontally
- Scrolls vertically when content exceeds 3 lines

## Implementation

**File: `src/pages/DesignStudio.tsx`**

1. Replace the `<input>` element (lines 1021-1029) with a `<textarea>`:
   - Use `rows={1}` for initial size
   - Set `max-h-[4.5rem]` (3 lines at ~1.5rem line height) with `overflow-y-auto`
   - Add `resize-none` to prevent manual resizing
   - Add `whitespace-pre-wrap` and `break-words` for proper wrapping
   - Keep all existing props (value, onChange, onKeyDown, placeholder, disabled, maxLength)

2. Update `handleKeyDown` if needed — ensure Enter sends (without Shift) and Shift+Enter adds a newline. Check current behavior at the handler definition.

