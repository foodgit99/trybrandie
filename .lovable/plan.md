

## Plan: Brandie Sales Team — Feature Inventory PDF

A polished, branded PDF (Beige #FAF8F5 / Charcoal #2B2D33 / Gold #C4993B per the project's design language) covering every feature currently shipped, formatted as a sales-enablement document.

### Document structure

**Cover page**
- Brandie wordmark, tagline ("The AI Brand Studio for Small Business"), document title, "For Internal Use — Sales Enablement", date.

**Section 1 — Positioning (1 page)**
- One-sentence pitch, the three differentiators (Brand-aware AI / Audience-aware persuasion / Trend-aware intelligence), what Brandie is NOT.

**Section 2 — Target personas (1 page)**
- Entrepreneur, Creator, Agency — pains, ideal pitch angle.

**Section 3 — Feature catalogue (the bulk, ~12-15 pages)**

Each feature gets a structured "sales spec" card:
- **Feature name** + short tagline
- **What it does** (1-2 sentences)
- **How it works** (the AI/tech under the hood, in plain English)
- **Customer pain solved**
- **Best for** (which persona cares most)
- **Demo talking point** (one line a rep can say live)
- **Objection handler** (anticipated pushback + counter)

**Features covered (grouped):**

*Brand Intelligence*
1. Brand Centre (colors, typography, logo, tone, personality, products & services)
2. Website Brand Scraper (auto-import from URL via Firecrawl)
3. Logo Designer (Gemini 3 Pro generation during onboarding)
4. Audience Intelligence / JTBD Module (5-section questionnaire → persuasion profile)
5. Trend Lab (visual trend presets + 0-100 intensity slider)
6. Visual Style Genome (8-category design DNA system)

*Creation Tools*
7. Design Studio — conversational chat-to-design (Gemini 3 Pro Image, 2 credits)
8. Carousel Creator — 2–10 slide narrative arcs (Nano Banana 2, 1.5 credits/slide)
9. Brand Strategist (Plan mode — branding advice agent)
10. Video Engine (Veo 3.1 pipeline — noted as "in development")

*Planning & Automation*
11. Content Hub — pillars, series, campaigns, weekly ideas
12. Content Autopilot — scheduled background generation with retries
13. Holiday Calendar Engine (regional/industry-aware planning)
14. Industry Trend Scout (cached real-world trend research)
15. Daily Reminder + Streak system

*Account & Growth*
16. Onboarding Flow (10-step guided + scan shortcut)
17. Authentication (email + Google OAuth, password reset)
18. Credit System (Free monthly + Bonus + Reward + Paid hierarchy)
19. Plans / Paystack Checkout (credit-pack billing)
20. Referral System (5-credit bonus, 3/month cap)
21. Affiliate Program (2-tier commissions, milestone gamification)
22. Transactional Emails (Resend, branded lifecycle alerts)
23. Low-Credit Banner

*Admin / Operations (mention briefly — not customer-facing)*
24. Admin Panel (gallery, user mgmt, queue approvals)
25. AI Traces dashboard (7-day analytics)
26. CRM & Email Campaign Manager (segmented sends)

*Reliability foundations (one-paragraph block)*
- Circuit breakers, validation triggers, model fallback, brand hex enforcement, Design Stability Score.

**Section 4 — Pricing snapshot (1 page)**
- Free / Entrepreneur / Creator / Agency tiers from the PRD, with credit costs (Single = 2, Carousel = floor(slides × 1.5)).

**Section 5 — Competitive framing (½ page)**
- Why Brandie ≠ Canva / ≠ Midjourney / ≠ ChatGPT.

**Closing page**
- Quick demo script (3-step: Brand Centre → first design → carousel), support contact placeholder.

### Build approach
- Generate with **ReportLab** (Platypus) using the warm neutral palette + Georgia/Calibri-style serif+sans pairing matching Brandie's landing page.
- Save to `/mnt/documents/brandie-sales-feature-guide.pdf`.
- Mandatory visual QA: convert every page to JPG and inspect for overflow, contrast, spacing — fix and re-render until clean.
- Deliver via `<lov-artifact>` for one-click download.

### Verification after build
- Every page passes visual QA (no overflow, readable contrast, consistent spacing).
- All 26 features present with the 7-field sales spec.
- Pricing matches current production (Single 2 credits, Carousel floor(slides × 1.5)).
- File downloadable from chat.

