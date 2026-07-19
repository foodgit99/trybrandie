# Rename Inspiration → Gallery, and use those images literally

Today the "Inspiration" section is treated by the renderer as **style-only** ("match style, composition, palette energy ONLY — do not copy its content"). We're flipping the meaning: the section becomes the brand's **Gallery** of real assets (product shots, storefront, team, screenshots, etc.), and the renderer should prefer these actual pixels over any AI-generated stand-ins.

This is a UI + agent-prompt change. We keep the existing `brand_inspiration` table and `brand-inspiration` storage bucket (rename would churn migrations, RLS, storage paths, and every existing user's uploaded files for no user-visible gain). Only labels and prompt semantics change.

## 1. UI rename (Brand Centre)

`src/pages/BrandCentre.tsx` and `src/pages/v2/BrandCentre.tsx`:
- Section title "Inspiration" → **"Gallery"**.
- Helper copy → "Real brand photos Brandie will feature in your designs — products, screenshots, team, premises, packaging, etc. Brandie uses these exact images instead of generating stand-ins."
- Upload button label "Add inspiration" → "Add to gallery".
- Empty-state copy updated to match.

No table, column, bucket, query-key, or ref-name changes — internal identifiers (`brand_inspiration`, `inspirationUrls`, etc.) stay to avoid a churn migration.

## 2. Renderer priority change

`supabase/functions/_shared/render-refs.ts`:
- Change the label for the `inspiration` role from *"match style… do not copy its content"* to something like *"brand gallery photo (real brand asset — feature these exact pixels in the design when relevant; do not replace with a generated stand-in)"*.
- Bump priority so gallery images sit alongside product/user images rather than behind them. New order: logo → previous render → user upload → **gallery (up to 2)** → product photos. Raise `maxRefs` default from 4 → 5 so a logo + previous + user + 2 gallery can all attach.
- Keep the existing 4MB / content-type validation.

`supabase/functions/_shared/render-refs.ts` legend text (`buildRefLegend`) updated so the model is told gallery references are literal brand assets to use, not style hints.

## 3. Prompt copy in design-studio

`supabase/functions/design-studio/index.ts`:
- Update the two lines that describe `inspirationUrls` in the design brief prompt (single + carousel paths) to say: "The brand's Gallery contains N real brand photos. Feature these exact images in the composition wherever relevant instead of generating substitutes." (currently says "inspiration image(s) that define the desired visual aesthetic. Match this visual style closely.")
- Keep the existing style-tag analysis pipeline (it still gives the preset picker useful signal about the brand's visual world), but rename log lines and internal comments from "inspiration" → "gallery" only where it's user-visible; leave variable names untouched to keep the diff small.

## 4. Landing / marketing copy

Skip. Landing page uses "inspiration" in a different marketing context and isn't user-editable brand data.

## Out of scope
- No DB migration, no storage bucket rename, no changes to `brand.inspiration_examples` column, no changes to `admin-action`, `brand-strategist`, `brand-engine`, `autopilot-planner`, or `brand-updates` (they read the same URLs; semantics are enforced at render time).
- No change to how many images a user can upload.

## Technical notes
- `src/integrations/supabase/types.ts` is auto-generated; unchanged.
- Query keys (`brand_inspiration`) unchanged so cached data stays valid across the rename.
- The `RefRole` type keeps `"inspiration"` as its identifier; only the human-facing `label` string in the prompt changes.
