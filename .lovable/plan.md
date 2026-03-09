

# Add Special Instructions to Brand Centre

## What
A new "Special Instructions" field in the Brand Centre that acts as a persistent, high-priority directive for all design generations. These are always-on rules the AI must follow (e.g., "Never use stock photos of people", "Always include our website URL", "Use Yoruba language for headlines").

## Schema Change
Add `special_instructions` (text, nullable, default null) column to the `brands` table.

## UI Change (BrandCentre.tsx)
Add a new collapsible/inline section between the existing brand fields and the Advanced Settings (Audience/Trend Lab). It will contain:
- A `Textarea` for free-text special instructions
- Inline edit/save pattern matching existing Brand Centre sections
- A brief helper text explaining the high-priority nature

## AI Integration (design-studio edge function)
Inject special instructions into `brandContext` with explicit high-priority framing, placed right after the "CRITICAL RULES" section:

```
SPECIAL INSTRUCTIONS (HIGHEST PRIORITY — ALWAYS OBEY):
${brand.special_instructions}
```

This ensures the instructions override default design philosophy but still defer to the user's per-message intent.

## Files to Change
1. **Migration** — Add `special_instructions` column to `brands`
2. **`src/pages/BrandCentre.tsx`** — Add editing section for special instructions
3. **`supabase/functions/design-studio/index.ts`** — Inject into brand context prompt

