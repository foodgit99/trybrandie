

# Plan: Video History & Management

## Problem
Video projects are persisted in `video_projects` + `video_scenes` tables but there is no UI to browse, replay, or manage them after leaving the Studio. Users lose access to their storyboards, scripts, and scene images.

## Approach

### 1. Add Video Projects tab to Design History page

Rather than a separate page, extend the existing `/history` (DesignHistory.tsx) with a tab system:
- **Designs** tab (current content)
- **Videos** tab (new)

The Videos tab shows a grid of video project cards, each displaying:
- First scene thumbnail (or placeholder)
- Intent summary (goal + platform badge)
- Scene count + total duration
- Creation date
- Status badge

### 2. Video Project Detail Viewer

When a user taps a video card, open a full-screen viewer (similar to DesignViewer) that shows:
- The VideoPreview component (already built) loaded with saved scenes
- Script variations with the ability to switch between them
- Caption + hashtags with copy button
- Strategy summary (hook style, pacing, emotional arc)
- Delete project action

### 3. Scene Image Download

Add a "Download All Scenes" button in the detail viewer that downloads scene images as individual files (using the existing storage URLs).

## Files Changed

1. **`src/pages/DesignHistory.tsx`** — Add tab system, fetch `video_projects` with their `video_scenes`, render video project grid
2. **`src/components/VideoProjectViewer.tsx`** (new) — Detail viewer dialog that renders VideoPreview with saved project data, strategy summary, and download actions
3. **`src/pages/DesignStudio.tsx`** — After successful video generation, add a "View in History" toast action linking to `/history?tab=videos`

## Technical Details

- Query: `supabase.from("video_projects").select("*, video_scenes(*)").eq("user_id", user.id).order("created_at", { ascending: false })`
- Reuse existing `VideoPreview` component — it already accepts scenes, variations, caption, hashtags as props
- Extract script variations from the `script` JSONB column (`project.script.variations`)
- Extract strategy from `storyboard` JSONB column (`project.storyboard.strategy`)

