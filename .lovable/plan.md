# Brandie Design Engine — Studio-only pilot

## My honest read

The direction is right, and it's the correct long-term architecture. "Data first, pixels second" is what unlocks precise editing, resizing, carousels, variations, and real preference learning. I'd proceed — but as a contained pilot on `/studio` behind a flag, not as a pipeline swap.

Two things I'd push back on:

1. **Don't let the canvas engine own the whole picture.** Fully composited-from-primitives designs made by an LLM look flat and "template-y" compared to what the image model produces today. The version that wins is hybrid: the image model generates the *art* (background, hero/product scene, texture, decorative shapes) with **no text in it**, and the canvas engine composes text, logo, CTA, and layout deterministically on top. That keeps today's visual quality while making every element addressable.
2. **The schema must be small and strict.** If the schema is open-ended, the LLM will invent fields and the renderer will drift. Version it (`schema_version: 1`), validate it, and reject/repair anything off-spec before rendering.

## What could break (real risks)

- **Quality regression.** Text baked by the image model currently carries the composition. Deterministic text placement can look worse until layout rules are tuned. Mitigation: pilot flag, side-by-side compare, keep legacy path as default until quality is judged equal or better.
- **Text-in-image leakage.** The image model loves adding words. The asset prompt must aggressively forbid text; assets with text will look wrong under our own headline. Mitigation: explicit negative instruction + optional retry.
- **Font rendering.** We need real font files at render time (self-hosted WOFF/TTF), consistent between browser preview and server render, or preview and export won't match. Mitigation: fixed bundled font set for v1 (2–4 families mapped from the genome), same files used both sides.
- **Overflow / collisions.** Long headlines break fixed boxes. Mitigation: measured text fitting (auto-shrink within min/max, max lines, ellipsis guard) and a post-layout overlap check.
- **Render environment limits.** Server rendering in an edge function has memory/time ceilings, especially for carousels. Mitigation: single-slide render calls, reuse the existing job queue, and keep the fallback to the legacy renderer on any render error.
- **Existing consumers.** `/cockpit`, `/post`, autopilot, WhatsApp/email delivery, history, and carousels all read `designs.image_url`. As long as we always write a real `image_url`, none of them change or break.
- **Editing UX scope creep.** A manual editor is where this project balloons. v1 ships select/move/resize/text/colour/replace-image/delete/duplicate/layer/undo — nothing more.

## Scope of this pilot

Only the `/studio` manual path, behind a per-user opt-in toggle ("Structured design (beta)"). Autopilot, Blueprint, Cockpit, `/post`, and the carousel path keep using the current pipeline untouched.

## Plan

### 1. Schema
Add a versioned Brandie Design Schema (`schema_version`, `canvas`, `background`, `elements[]`) with element types `text | image | logo | shape | button | group` and properties: position, size, rotation, opacity, colour, typography, z-order, plus `role` (headline, subhead, body, cta, product, logo, decor) and optional `constraints` (maxLines, minFontSize, fit).
Ship a validator/normaliser: clamps to canvas, fills defaults, enforces brand colours and font mapping, repairs or rejects unknown fields.

### 2. Creative Director → schema
Extend the existing Creative Director step (which already emits `layout_schema`) with a second strict tool call that returns a full design schema, plus a short list of **asset requests** ("hero product on marble, no text"). Genome + brand tokens drive fonts, colours, spacing, and ratios so output is deterministic where it should be.

### 3. Asset generation
Reuse the current image model as an asset engine only: render each asset request at the needed aspect ratio, text explicitly forbidden, upload to storage, and bind returned URLs into the schema's image/background elements. Gallery images (`prefer_gallery_first`) take priority over generated assets, as today.

### 4. Renderer
One renderer, two hosts, same code: schema → SVG-ish layout with bundled fonts → PNG.
- Server render inside the existing design job pipeline for the saved `image_url` and export.
- Browser render for live editing preview.
Any renderer failure falls back to the current end-to-end image generation so the user always gets a design.

### 5. Persistence
Store the schema in `designs.design_schema` (new JSONB column) alongside the existing `image_url`. Version history rows for undo/redo and revert. Nothing existing is removed.

### 6. Conversational editing
Add an edit classifier that maps a request to a **schema patch** (element id + property deltas) instead of a regeneration, then re-renders. Full-regeneration remains the fallback when the request is structural ("make it more premium", "different concept"). Patch-only edits shouldn't cost a render credit beyond the re-render.

### 7. Minimal manual editor
In `/studio`, when a design has a schema: click to select an element, drag to move, handles to resize, inline text edit, font/colour controls, replace image (gallery or upload), delete, duplicate, layer up/down, undo/redo, export PNG/JPG/WebP. AI chat stays the primary surface; manual controls are a side panel.

### 8. Learning hook
Record which properties users change (headline size down, CTA lower, logo smaller) into the existing preference layer so future genomes lean that way. Read-only for now — no automatic genome mutation until we have volume.

### 9. Validation before wider rollout
Generate the same brief through both paths for several brands and compare quality, speed, and cost; verify autopilot and `/post` are unchanged; then decide whether to extend to carousels and the autonomous engine.

## Technical notes

- New column: `designs.design_schema jsonb` (nullable). No table drops, no policy changes.
- New shared module for schema types + validation, reused by function and client so there's one source of truth.
- Fonts: a fixed self-hosted set for v1, mapped from genome `font_personality`; the same files load in the browser and the renderer.
- Feature flag stored on the profile so it can be enabled per account for testing.
- Carousels stay on the current pipeline in this phase.
