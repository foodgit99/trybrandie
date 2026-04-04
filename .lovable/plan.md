

# Plan: Seamless End-to-End Video Generation

## Current Flow (Problem)
1. User completes 5-step guided flow → clicks "Generate Video"
2. System calls `video-studio` → returns storyboard scenes with images (3 credits)
3. User sees a storyboard preview and must **manually** click "Render Video" (5 more credits)
4. Rendering takes 10-20 minutes with Veo, requiring polling

The user is exposed to intermediate storyboard state and has to take a second action.

## New Flow (Solution)
1. User completes guided flow → clicks "Generate Video"
2. System calls `video-studio` (storyboard) → then **automatically** calls `video-render`
3. User sees a single, elegant progress screen through all stages
4. When done, user sees the completed video with download button

**Total cost: 8 credits** (3 storyboard + 5 render), shown upfront on the button.

## Changes

### 1. `src/pages/DesignStudio.tsx` — Auto-chain render after storyboard

Update `handleVideoGenerate`:
- After `video-studio` returns successfully, immediately call `video-render` with the returned `project_id`
- Update `videoStatus` through stages: "scripting" → "storyboarding" → "rendering"
- Start polling for render completion (same logic as `VideoProjectViewer`)
- Store the final rendered video URL in state
- Update the "Generate Video" button label to show "Generate Video (8 credits)"
- On insufficient credits, check against 8 total (not 3)

### 2. `src/components/VideoPreview.tsx` — Add rendering + completed states

- Add new props: `renderStatus`, `renderedVideoUrl`, `onDownload`
- When `renderStatus === "rendering"`: show progress UI with estimated time ("This may take 10-15 minutes")
- When `renderStatus === "rendered"` and `renderedVideoUrl` exists: show full-screen video player with download button
- Remove the storyboard scene-by-scene preview for the inline flow (user doesn't need to see intermediate storyboard)

### 3. `src/components/VideoGuidedFlow.tsx` — Update button text

- Change "Generate Video" to "Generate Video (8 credits)" on the final step

### 4. Credit check update in `video-studio` edge function

- The credit check in `video-studio` should validate against **8 credits** (total pipeline cost) instead of 3, so users aren't charged 3 credits only to fail at the render step due to insufficient remaining credits

## What stays the same
- `video-render` edge function — no changes needed
- `VideoProjectViewer` — still works for viewing past projects from history
- All backend rendering logic unchanged

## Files Changed
1. `src/pages/DesignStudio.tsx` — auto-trigger render, polling, status tracking
2. `src/components/VideoPreview.tsx` — rendering progress + completed video states  
3. `src/components/VideoGuidedFlow.tsx` — button label update
4. `supabase/functions/video-studio/index.ts` — credit check for 8 instead of 3

