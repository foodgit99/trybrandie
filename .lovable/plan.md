

# Brandie – MVP Implementation Plan

## Overview
Build the core Brandie experience: a premium, Apple-inspired AI chat interface where users can set up their brand and generate on-brand social media graphics using natural language. MVP focuses on the essential loop: **Sign up → Set up brand → Chat to create designs → Download**.

---

## Phase 1: Foundation & Auth

### 1.1 Visual Identity & Design System
- Apply Brandie's premium, minimal visual language across the app
- Light neutral base, soft shadows, generous white space, 8pt grid
- Clean sans-serif typography, rounded buttons, gentle micro-transitions
- Upload and use the Brandie logo throughout the app

### 1.2 Authentication
- Email/password signup and login
- Clean, minimal auth pages matching Brandie's premium aesthetic
- User profiles table to store account data

---

## Phase 2: Brand Onboarding

### 2.1 Guided Onboarding Flow
A beautiful, step-by-step onboarding wizard (one question per screen):
1. **Brand name** – text input
2. **Tagline** – text input
3. **Brand description** – textarea
4. **Logo upload** – drag & drop upload
5. **Brand colours** – pick primary, secondary, and accent colours
6. **Typography** – choose from curated Google Fonts list
7. **Brand vibe** – select one: Minimal / Bold / Luxury / Playful / Corporate / Cinematic
8. **Inspiration uploads** – upload example designs they love (optional)

Ends with a confirmation: *"Your brand system is ready."*

### 2.2 Brand Data Storage
- Database tables for brands, brand visuals, and brand inspiration
- Secure file storage for logos and inspiration images
- One brand per user for MVP

---

## Phase 3: Home Screen

### 3.1 Home Dashboard
Minimal layout with:
- **"Create New Design"** – large, prominent primary CTA
- **Recent Designs** – grid of previously generated designs
- **Brand Centre** – quick access to view/edit brand settings
- **Account Settings** – profile and plan info

---

## Phase 4: Brand Centre

### 4.1 Brand Centre Page
A clean, organized view of all stored brand data:
- Brand info (name, tagline, description, vibe)
- Visual identity (colours, typography, logo)
- Inspiration gallery
- All fields editable inline

---

## Phase 5: Design Creation (Core Experience)

### 5.1 Two-Panel Design Studio
- **Left panel**: Chat interface with the AI creative director
- **Right panel**: Live design preview canvas (1080×1080 default)
- **Top**: Brand selector (for future multi-brand support, shows current brand for now)
- **Bottom toolbar**: Save, Download, Upvote 👍, Downvote 👎, Duplicate

### 5.2 AI Chat & Image Generation
- Chat input: *"What would you like to design?"*
- AI parses the user's request, retrieves brand data (colours, fonts, logo, vibe)
- AI generates a structured design brief/reasoning message (acting as a creative director)
- Sends prompt to Nano Banana (Gemini Flash Image) for image generation
- Renders the generated image in the preview canvas
- AI explains its design choices in a calm, professional tone

### 5.3 Chat-Based Editing
- User can refine via follow-up messages: *"Make it more premium"*, *"Bigger headline"*, *"Less text"*
- AI adjusts the prompt based on conversation history (session memory)
- Regenerates with modifications while maintaining brand consistency

### 5.4 Design History
- Save generated designs to the database
- Upvote/downvote designs (stored for future preference learning)
- View all past designs from the home screen

---

## Phase 6: Export

### 6.1 Download System
- Download generated images as **PNG** or **JPG**
- Option to select canvas size: Square (1080×1080), Story (1080×1920)

---

## Phase 7: Subscription UI & Gating

### 7.1 Plans Page
- Display four tiers: Free, Creator, Business, Agency with feature comparison
- Track generation count per user
- Free tier: 10 generations/month with watermark badge
- Gate features behind plan tiers (UI only, no real payments)
- "Upgrade" buttons that show a coming-soon state

---

## What's Deferred (Post-MVP)
- RAG system with vector embeddings for hyper-personalisation
- Preference learning engine (auto-adjusting from upvotes/downvotes)
- Multi-brand support
- Team/collaboration features
- PDF and carousel export
- Stripe payment integration
- White-label export
- Client folders (Agency tier)

