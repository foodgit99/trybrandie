

## Brandie Video Engine — Implementation Plan

### Reality Check

This is one of the most ambitious features possible in this stack. Before diving in, here are the key constraints:

1. **Video generation APIs** (Veo, Runway, Kling, Sora) all require separate API keys and accounts — none are currently connected. The Lovable AI gateway does not provide video generation models.
2. **No persistent server** — everything runs through Supabase edge functions (10-second default timeout, 60s max). Full video rendering pipelines with multiple agent stages will need careful chunking.
3. **The existing design-studio edge function is already 1,928 lines** — we need a separate edge function for video, not more complexity in the same file.

### Phased Approach (Recommended)

Given the scale, this plan covers **Phase 1: MVP** — a working video pipeline using Google Veo 2 (via Lovable AI gateway image generation as fallback for storyboard frames, and a dedicated video API for actual rendering).

---

### Phase 1 Scope (What We Build Now)

#### 1. Video Mode in Studio UI
- Add `mode=video` query param support to `/studio`
- Show a **guided flow wizard** (Steps 1-5) when in video mode, before the chat interface activates
- Steps: Content Goal → Format Style → Platform → Smart Controls → Script Input
- Store selections as a `videoIntent` object passed to the pipeline

#### 2. Content Hub Integration
- Add "Create Video" button alongside existing "Create Graphic" on each content idea
- Click navigates to `/studio?mode=video&prompt={idea.prompt}&idea_id={idea.id}`

#### 3. Video Pipeline Edge Function (`supabase/functions/video-studio/index.ts`)
- **New edge function** — does NOT modify the existing design-studio function
- Pipeline stages (sequential, with parallelism where possible):
  - **Context Assembly**: Brand Centre + Audience JTBD + content idea
  - **Strategy Agent**: Takes user intent + context → outputs structure, hook style, pacing, emotional arc
  - **Script Agent**: Generates retention-optimized script with hook, body, CTA
  - **Script Evaluator**: Validates hook strength, clarity, platform fit, length — loops once if needed
  - **Storyboard Agent**: Maps script → scene-by-scene visual descriptions with timing
  - **Scene Composer**: Merges script + storyboard + brand genome + video controls into a final timeline spec
  - **Caption Agent**: Generates captions + hashtags
- All reasoning via `google/gemini-3.1-pro-preview` (the upgraded brain)
- Output: A structured JSON timeline with scenes, text overlays, transitions, and timing

#### 4. Video Rendering Strategy
- **Phase 1 approach**: Generate scene-by-scene images using existing image rendering models, then compose into a video using client-side or edge function assembly
- This requires an external video API for actual motion. We need to determine which API to integrate first.

#### 5. Database Extensions
- New table: `video_projects` (id, user_id, brand_id, intent JSON, script, storyboard, timeline, status, video_url, created_at)
- New table: `video_scenes` (id, video_project_id, scene_index, description, image_url, duration_ms, text_overlay, transition)
- Credit cost: 3 credits per video generation (configurable)

#### 6. Variation System
- Generate 2 script variations (not 4 initially — cost control)
- User picks one, then rendering proceeds
- Variations differ in hook style and energy level

---

### What's Deferred to Phase 2+

- Multi-engine routing (Runway, Kling, Sora) — requires separate API integrations
- Audio Agent (voiceover, music, SFX) — requires ElevenLabs or similar
- Feedback Agent + adaptive memory
- Full 4-variation system
- Partial regeneration / agent-specific edits
- Performance tracking integration

---

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/video-studio/index.ts` | Create | Video pipeline edge function |
| `src/pages/DesignStudio.tsx` | Modify | Add video mode detection + guided flow |
| `src/components/VideoGuidedFlow.tsx` | Create | 5-step wizard component |
| `src/components/VideoPreview.tsx` | Create | Video timeline preview + scene cards |
| `src/pages/ContentHub.tsx` | Modify | Add "Create Video" button to ideas |
| Database migration | Create | `video_projects` and `video_scenes` tables |

---

### Blocker: Video API Access

Before implementation can begin, we need to know which video generation API to use. The options are:

- **Google Veo** — available if you have Vertex AI access
- **Runway Gen-3** — requires API key from runwayml.com
- **Kling AI** — requires API key
- **Sora** — OpenAI API access

Without at least one video API key, the pipeline can generate scripts, storyboards, and scene images — but cannot produce actual video output. We can build the full intelligence layer now and plug in the renderer when an API key is available.

### Technical Details

- Edge function timeout: Video pipeline will use streaming responses to keep the connection alive during multi-stage processing
- Credit gating: 3 credits per video, checked before pipeline starts
- The guided flow wizard uses local state only — no database writes until "Generate" is clicked
- Video mode reuses the existing fixed header/footer layout from the design studio

