# VeeInvite — Complete Product & Architecture Plan

> **Read this entire document before writing any code.**
> This is the product strategy, architecture decisions, and build plan
> agreed between the product owner and senior PM.
> Every decision here has been discussed and confirmed.
> Any deviation must be recorded in `docs/DECISIONS.md` with full reasoning.

---

## Table of Contents

1. [What VeeInvite Is](#1-what-veeinvite-is)
2. [Product Vision](#2-product-vision)
3. [The Three User Journeys](#3-the-three-user-journeys)
4. [Core Architecture — The CSS JSON Pipeline](#4-core-architecture--the-css-json-pipeline)
5. [Design Coherence — The Most Important Principle](#5-design-coherence--the-most-important-principle)
6. [The Layout Library](#6-the-layout-library)
7. [How to Build Each Skeleton](#7-how-to-build-each-skeleton)
8. [Skeleton Review Checklist](#8-skeleton-review-checklist)
9. [AI Pipeline — Three Calls](#9-ai-pipeline--three-calls)
10. [Design Tokens and Validation](#10-design-tokens-and-validation)
11. [Version History](#11-version-history)
12. [AI Chat Refinement — Instruction Classifier](#12-ai-chat-refinement--instruction-classifier)
13. [Custom Sections](#13-custom-sections)
14. [Guest Experience](#14-guest-experience)
15. [Publishing](#15-publishing)
16. [Feature List by Milestone](#16-feature-list-by-milestone)
17. [Release Strategy — Three Milestones](#17-release-strategy--three-milestones)
18. [Build Phases](#18-build-phases)
19. [Risk Register](#19-risk-register)
20. [Key Metrics](#20-key-metrics)
21. [Architecture Rules — Never Break These](#21-architecture-rules--never-break-these)
22. [Documentation Structure](#22-documentation-structure)
23. [Environment and Tech Stack](#23-environment-and-tech-stack)
24. [Two-Axis System — Structure and Culture Are Independent](#24-two-axis-system--structure-and-culture-are-independent)
25. [Layout Selection — Revised Logic](#25-layout-selection--revised-logic)
26. [Cultural Profile System](#26-cultural-profile-system)
27. [Tag Taxonomy — Vibe Context Only](#27-tag-taxonomy--vibe-context-only)
28. [Step 1 Generation Contract — The 2-Minute Promise](#28-step-1-generation-contract--the-2-minute-promise)
29. [RSVP Form — Data-Driven Configuration](#29-rsvp-form--data-driven-configuration)
30. [Chat Editing — Content Picker and Element Picker](#30-chat-editing--content-picker-and-element-picker)
31. [Post-Wedding Lifecycle](#31-post-wedding-lifecycle)
32. [Growth Mechanics](#32-growth-mechanics)
33. [Bilingual Rendering](#33-bilingual-rendering)

---

## 1. What VeeInvite Is

VeeInvite is an AI-native wedding invitation website builder.

A couple answers a short quiz. AI reads their vibe and style answers, selects the most appropriate layout from a pre-built library, generates a unified visual identity covering every section of the site, and creates a stunning hero that connects to the rest of the design. The result is a complete, personalised wedding website — unique to every couple — in under 2 minutes.

Guests visit the URL, see the site, and RSVP. The couple manages everything from a dashboard.

**What makes it different from competitors (Zola, The Knot, Minted):**

- AI selects the layout based on the couple's actual vibe — not a template picker
- Every section shares one coherent visual identity — not sections styled independently
- Hero is the WOW moment within a unified design — not a disconnected showpiece
- Version history with one-click restore — no competitor has this
- Under 2 minutes from landing to first preview

---

## 2. Product Vision

> **VeeInvite is the fastest way for a couple to go from engaged to having a beautiful, working wedding website.**
>
> Under 2 minutes. No design skills needed. Unique to every couple.
> Every section feels like it belongs together. Guests can RSVP instantly.

Every feature decision is evaluated against this vision.
If a feature does not serve the 2-minute promise or the coherence promise — it waits for a later milestone.

---

## 3. The Three User Journeys

### Journey 1 — The Couple (primary)
```
Land → names + date + venue → see preview → refine → publish
```
- **Time target:** Under 5 minutes total
- **Emotional target:** "This looks like us — every part of it"

### Journey 2 — The Guest (critical path)
```
Receive link → open on phone → find key info → RSVP
```
- **Time target:** Under 60 seconds to RSVP
- **Emotional target:** "This is a beautiful, coherent invitation"

### Journey 3 — The Couple returns (retention)
```
Login → see dashboard → make a change → see it immediately
```
- **Time target:** Under 30 seconds to see a change
- **Emotional target:** "I'm in control of this"

---

## 4. Core Architecture — The CSS JSON Pipeline

This is the most important architectural decision in VeeInvite. Read it fully.

### The problem it solves

Asking AI to generate full HTML every time produces:
- Inconsistent quality between sections
- Layout breaks on mobile
- No visual coherence guarantee
- No quality floor

### The solution

AI **never generates HTML structure**. AI generates **JSON that describes the visual design**. Your code builds the HTML from that JSON.

```
Skeleton (your code)  +  CSS JSON (AI output)  =  Styled site
```

### Full pipeline flow

```
┌─────────────────────────────────────────────────────┐
│            COUPLE QUIZ — STEP 1 (fast)               │
│  Names · Date · Venue (30 seconds)                   │
│  Generate preview immediately with defaults          │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│           AI CALL 1 — LAYOUT SELECTION               │
│                                                      │
│  Input:  names + date + venue                        │
│          default style tags (refined in step 2)      │
│          layout library meta.json files              │
│                                                      │
│  Output: { layoutId: "layout-2", reason: "..." }     │
│                                                      │
│  Logic:  tag matching first (deterministic, free)    │
│          AI confirms only if top two scores tied     │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│    AI CALL 2 — FULL SITE DESIGN TOKEN GENERATION     │
│                                                      │
│  Input:  complete selected skeleton HTML             │
│          (nav + all sections — AI sees everything)   │
│          couple data                                 │
│          design token glossary                       │
│          coherence instruction:                      │
│          "Design entire site as ONE visual identity" │
│                                                      │
│  Output: {                                           │
│    globalTokens: { bgPrimary, accent, fontDisplay,   │
│                    fontHeading, fontBody, ... },      │
│    styles: { every CSS selector → properties },      │
│    fonts: [...],                                     │
│    particles: { ... },                               │
│    content: { "TAGLINE": "...", ... },               │
│    designSummary: "2-sentence visual identity",      │
│    reasoning: { ... }                                │
│  }                                                   │
│                                                      │
│  KEY RULE: Same colors and fonts used throughout.    │
│  globalTokens is established ONCE for the whole site.│
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│      AI CALL 3 — HERO GENERATION (WOW FACTOR)        │
│                                                      │
│  Input:  couple data + vibe + story                  │
│          globalTokens from Call 2 (HARD constraints) │
│          must use same bg, accent, gold, fonts       │
│          full creative freedom on layout/animation   │
│                                                      │
│  Output: self-contained hero HTML with embedded      │
│          CSS and JS. Uses {{PLACEHOLDER}} tokens.    │
│          Visually connected to the rest of the site. │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│                  YOUR RENDERER                       │
│                                                      │
│  1. Load layout skeleton by layoutId                 │
│  2. Build CSS string from Call 2 styles JSON         │
│  3. Validate CSS (strip forbidden properties)        │
│  4. Build Google Fonts link from fonts array         │
│  5. Inject CSS + fonts into skeleton <head>          │
│  6. Inject AI content into {{PLACEHOLDER}} tokens    │
│  7. Prepend hero HTML before skeleton body content   │
│  8. Inject structured data LAST — always overwrites  │
│     (names, dates, venues from DB, never AI copy)    │
│  9. Return complete self-contained HTML file         │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│         COUPLE SEES PREVIEW + STEP 2 REFINES         │
│                                                      │
│  Style · Vibe · Story collected alongside preview    │
│  Each answer triggers targeted regeneration          │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│               STORAGE + SERVING                      │
│                                                      │
│  HTML → Supabase Storage                             │
│  globalTokens → Supabase DB (source of truth)        │
│  theme_json → Supabase DB (source of truth)          │
│  hero_html → Supabase DB (source of truth)           │
│  layout_id → Supabase DB                             │
│  design_summary → Supabase DB                        │
│  Version snapshot created                            │
│  Served at /w/[slug] as raw HTML                     │
└─────────────────────────────────────────────────────┘
```

### Data separation — critical

| Data type | Stored where | Updated how | AI touches? |
|-----------|-------------|-------------|-------------|
| Names, dates, venues | Supabase DB | Direct update — no AI | Never |
| globalTokens | Supabase DB | Call 2 regeneration | Yes — AI output |
| theme_json (full CSS JSON) | Supabase DB | Call 2 regeneration | Yes — AI output |
| hero_html | Supabase DB | Call 3 regeneration | Yes — AI output |
| site HTML file | Supabase Storage | Rebuilt from DB values | Never directly |

**The HTML file in storage is always derived. It is never the source of truth.**

When anything changes — rebuild from `layout_id + theme_json + hero_html + couple DB data`.

---

## 5. Design Coherence — The Most Important Principle

Design coherence is the difference between a product couples love and one they abandon.

### The problem without coherence

```
WITHOUT coherence:

  Hero:    Dark midnight, Great Vibes script, rose gold
  Story:   AI independently picks warm ivory and sage
  Events:  AI independently picks white with blue
  RSVP:    AI independently picks something else

  Result:  Hero looks stunning
           Rest looks like three different sites
           Couple says "hero is great but rest looks wrong"
           They don't publish. They don't recommend it.
```

### How coherence is achieved

Call 2 designs the **entire site as one visual system** in a single API call.
AI sees all skeleton sections simultaneously and must maintain consistency.

```
WITH coherence:

  Call 2 establishes globalTokens ONCE:
    bgPrimary: #0E0A0F
    accent: #C4607A
    gold: #D4A853
    fontDisplay: Great Vibes
    fontHeading: Cormorant Garamond
    fontBody: Jost

  Every skeleton section draws from these values:
    Story bg → tonal variant of bgPrimary
    Event card borders → accent at low opacity
    RSVP button → accent color
    Footer names → fontDisplay
    Dividers → gold at low opacity

  Call 3 hero receives globalTokens as HARD CONSTRAINTS:
    Must use same bgPrimary, accent, gold, fonts
    Free to add: animations, particles, glow, arch motifs
    NOT free to: invent new colors or fonts

  Result: Couple scrolls from hero to footer —
          ONE visual space, not four separate designs
```

### The globalTokens block

Call 2 must return this at the top of its JSON:

```json
{
  "globalTokens": {
    "bgPrimary": "#0E0A0F",
    "bgSecondary": "#1A0F1E",
    "bgCard": "rgba(255,255,255,0.02)",
    "accent": "#C4607A",
    "accentLight": "#E8A0B0",
    "gold": "#D4A853",
    "textPrimary": "rgba(253,246,238,0.9)",
    "textMuted": "rgba(253,246,238,0.5)",
    "textSubtle": "rgba(253,246,238,0.3)",
    "fontDisplay": "Great Vibes",
    "fontHeading": "Cormorant Garamond",
    "fontBody": "Jost"
  }
}
```

The renderer extracts `globalTokens` and passes them verbatim to Call 3.

### The coherence instruction (include verbatim in Call 2 prompt)

```
You are designing the complete visual identity for a wedding website.
This is ONE design — not separate designs for each section.

Rules for coherence:
1. Establish your color palette in globalTokens FIRST
2. Every section draws from those same token values
3. Do not introduce new colors in individual sections
4. The same accent color appears in: nav hover, story eyebrow,
   event card details, RSVP button, FAQ icons, footer accent
5. The same font families appear throughout — no new fonts per section
6. Section backgrounds may vary slightly (tonal variants of bgPrimary)
   to create visual rhythm — but never introduce a new palette
7. The hero will be generated separately using your globalTokens
   as hard constraints — design with that continuity in mind

The couple should scroll from hero to footer feeling they are
moving through ONE beautiful space — not between different designers.
```

---

## 6. The Layout Library

### What a layout is

A pre-built HTML skeleton file containing:
- Nav section (structure only — styled by Call 2)
- All content sections (story, events, RSVP, gallery, FAQ, footer)
- Layout CSS only — no colors, fonts, shadows, borders
- All class names defined and consistent
- All `{{PLACEHOLDER}}` tokens
- Working JavaScript (FAQ, scroll reveal, RSVP UI state, nav scroll)
- A `meta.json` file with tags for layout selection

**The hero section is NOT in the skeleton.**
It is generated by Call 3 and prepended by the renderer.

### The 4 layouts

#### Layout 1 — Modern Minimalist
```json
{
  "id": "layout-1",
  "name": "Modern Minimalist",
  "description": "Equal two-column story, horizontal event card row, centered single-column RSVP, uniform 3-column gallery. Maximum white space.",
  "tags": ["modern", "clean", "minimal", "airy", "western", "simple", "contemporary"],
  "antiTags": ["grand", "ornate", "traditional", "south-asian", "maximalist"],
  "bestFor": "Couples who describe themselves as modern, clean, or understated"
}
```

#### Layout 2 — Romantic Traditional
```json
{
  "id": "layout-2",
  "name": "Romantic Traditional",
  "description": "Two-column story with offset photo decoration, event cards with watermark numbers, split RSVP with decorative left panel, asymmetric editorial gallery.",
  "tags": ["romantic", "traditional", "warm", "classic", "western", "intimate", "elegant"],
  "antiTags": ["modern", "editorial", "minimal", "bold"],
  "bestFor": "Couples who describe themselves as romantic, warm, or classic"
}
```

#### Layout 3 — Grand Celebration
```json
{
  "id": "layout-3",
  "name": "Grand Celebration",
  "description": "Full-width centered story (no photo column), generous event grid supporting up to 6 large event cards, centered RSVP with ornamental spacing, asymmetric editorial gallery.",
  "tags": ["grand", "celebratory", "ornate", "luxury", "multi-event", "rich", "dramatic"],
  "antiTags": ["minimal", "simple"],
  "bestFor": "Multi-event celebrations or couples who want a grand, impressive aesthetic regardless of culture"
}
```

#### Layout 4 — Editorial Bold
```json
{
  "id": "layout-4",
  "name": "Editorial Bold",
  "description": "Asymmetric 60/40 story with text-first layout, two-column magazine events, full-width bold RSVP header, CSS masonry gallery.",
  "tags": ["editorial", "bold", "contemporary", "asymmetric", "destination", "dramatic", "luxury"],
  "antiTags": ["traditional", "warm", "ornate", "south-asian", "soft"],
  "bestFor": "Dramatic, fashion-forward, or destination wedding aesthetic"
}
```

### Layout selection logic

```
Stage 1 — Tag matching (your code, deterministic, no AI cost):
  Quiz answers → tags array
  Score: +1 per matching tag, -2 per antiTag
  Clear winner (≥2 points ahead) → use it

Stage 2 — AI confirmation (only if top two within 1 point):
  Send: top 2 layout descriptions + couple cultural context
  Returns: { layoutId: string, reason: string }
```

---

## 7. How to Build Each Skeleton

Each skeleton is built by Claude Code following this exact specification.

**Golden rule:** Structure must be correct. AI styles it — wrong structure cannot be fixed by styling.

---

### Shared HTML document structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{PERSON1_NAME}} & {{PERSON2_NAME}}</title>
  <!-- NO font links — renderer injects after Call 2 -->
  <style>
    /* Layout CSS only */
  </style>
</head>
<body>
  <nav>...</nav>
  <!-- NO hero here — renderer prepends hero HTML from Call 3 -->
  <section class="story" id="story">...</section>
  <section class="events" id="events">...</section>
  <section class="rsvp" id="rsvp">...</section>
  <section class="gallery" id="gallery">...</section>
  <section class="faq" id="faq">...</section>
  <footer>...</footer>
  <script>/* all scripts */</script>
</body>
</html>
```

---

### Allowed CSS in skeleton

```
display, position, flex-direction, flex-wrap,
align-items, justify-content, gap,
grid-template-columns, grid-column, aspect-ratio,
width, height, min-height, max-width,
margin, padding, overflow, box-sizing,
text-align, list-style, cursor, text-decoration,
resize, appearance, scroll-behavior,
top, left, right, bottom, z-index, pointer-events, inset,
transform (translate/scale only),
transition (hover — opacity and transform only),
opacity (scroll reveal initial state only)
```

### Forbidden CSS in skeleton

```
color, background, background-color, background-image,
border (except ONE structural border on form fields),
box-shadow, text-shadow, font-family, font-size,
font-weight, font-style, letter-spacing,
line-height, text-transform
```

### Form field structural exception (all skeletons)

```css
.form-field input,
.form-field select,
.form-field textarea {
  border: 1px solid #ccc; /* structural only — overridden by Call 2 */
  outline: none;
  width: 100%;
  padding: 0.9rem 1rem;
  font-family: inherit;
}
```

### Scroll reveal CSS (all skeletons)

```css
.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.9s ease, transform 0.9s ease;
}
.reveal.visible { opacity: 1; transform: translateY(0); }
.reveal-d1 { transition-delay: 0.1s; }
.reveal-d2 { transition-delay: 0.25s; }
.reveal-d3 { transition-delay: 0.4s; }
```

### Mobile breakpoints (all skeletons)

```css
@media (max-width: 768px) {
  nav .nav-links { display: none; }
  /* layout-specific responsive rules added per layout */
}
@media (max-width: 480px) {
  .form-row { grid-template-columns: 1fr; }
  .events-grid { grid-template-columns: 1fr; }
}
```

### JavaScript (all skeletons)

```javascript
// Scroll reveal
const revealObs = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible')
  }),
  { threshold: 0.1 }
)
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el))

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const answer = btn.nextElementSibling
    const isOpen = answer.style.display === 'block'
    document.querySelectorAll('.faq-answer')
      .forEach(a => a.style.display = 'none')
    document.querySelectorAll('.faq-icon')
      .forEach(i => i.textContent = '+')
    if (!isOpen) {
      answer.style.display = 'block'
      btn.querySelector('.faq-icon').textContent = '×'
    }
  })
})

// RSVP form UI state
document.getElementById('rsvp-form')
  ?.addEventListener('submit', e => {
    e.preventDefault()
    document.getElementById('rsvp-form').style.display = 'none'
    document.getElementById('rsvp-success').style.display = 'block'
  })

// Nav smooth scroll
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault()
    document.querySelector(link.getAttribute('href'))
      ?.scrollIntoView({ behavior: 'smooth' })
  })
})
```

---

### NAV — identical in all 4 skeletons

Nav is part of the skeleton. Call 2 styles it to match the whole site.

```html
<nav>
  <div class="nav-monogram">{{MONOGRAM}}</div>
  <ul class="nav-links">
    <li><a class="nav-link" href="#story">Our Story</a></li>
    <li><a class="nav-link" href="#events">Events</a></li>
    <li><a class="nav-link" href="#rsvp">RSVP</a></li>
    <li><a class="nav-link" href="#gallery">Gallery</a></li>
    <li><a class="nav-link" href="#faq">FAQ</a></li>
  </ul>
</nav>
```

```css
nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2rem 3rem;
}
.nav-links { display: flex; gap: 2.5rem; list-style: none; }
@media (max-width: 768px) {
  nav .nav-links { display: none; }
  nav { justify-content: center; }
}
```

**Critical:** Anchor IDs `#story #events #rsvp #gallery #faq` must match section IDs exactly.
The hero generated by Call 3 must NOT add a nav link for itself.

---

### RSVP form — config-driven, not hardcoded

**The RSVP form is NOT hardcoded HTML in the skeleton.**

The skeleton contains only the RSVP section shell. The form fields are built
at render time by `buildRSVPForm(config, events, content)` using the couple's
`rsvp_config` from Supabase. See Section 29 for the full spec.

```html
<section class="rsvp" id="rsvp">
  <div class="rsvp-inner">
    <p class="rsvp-eyebrow reveal">{{RSVP_EYEBROW}}</p>
    <h2 class="rsvp-heading reveal reveal-d1">{{RSVP_HEADING}}</h2>
    <p class="rsvp-sub reveal reveal-d2">{{RSVP_SUB}}</p>

    {{RSVP_FORM}}
    <!-- renderer injects the complete form HTML here
         built from rsvp_config + events + content
         see buildRSVPForm() in Section 29 -->

    <div id="rsvp-success" class="rsvp-success" style="display:none">
      <h3 class="rsvp-success-title">{{RSVP_SUCCESS_TITLE}}</h3>
      <p class="rsvp-success-message">{{RSVP_SUCCESS_MESSAGE}}</p>
    </div>
  </div>
</section>
```

**What `buildRSVPForm()` generates varies by rsvp_config:**
- Guest count dropdown: 1 to `rsvp_config.guestCountMax` (default 10, not 4)
- Children count: only if `rsvp_config.childrenSeparate` is true
- Event checkboxes: only if `rsvp_config.eventSelectionEnabled` and 2+ ceremonies
- Meal choice: only if `rsvp_config.mealChoiceEnabled`
- Plus-one name field: only if `rsvp_config.plusOneEnabled`
- Song request: only if `rsvp_config.songRequestEnabled`

The form structure is always generated server-side. AI never generates RSVP form HTML.

---

### FAQ — identical in all 4 skeletons

```html
<section class="faq" id="faq">
  <div class="faq-inner">
    <h2 class="faq-heading reveal">{{FAQ_HEADING}}</h2>
    <div class="faq-list">
      <div class="faq-item">
        <button class="faq-question">
          {{FAQ_1_Q}}<span class="faq-icon">+</span>
        </button>
        <div class="faq-answer" style="display:none"><p>{{FAQ_1_A}}</p></div>
      </div>
      <!-- Repeat for FAQ_2 through FAQ_6 -->
    </div>
  </div>
</section>
```

---

### FOOTER — identical in all 4 skeletons

```html
<footer>
  <p class="footer-names">{{PERSON1_NAME}} & {{PERSON2_NAME}}</p>
  <p class="footer-info">{{WEDDING_DATE_DISPLAY}} · {{VENUE_NAME}}</p>
  <p class="footer-tagline">{{FOOTER_TAGLINE}}</p>
</footer>
```

---

### All placeholder tokens — use exactly as written

```
{{PERSON1_NAME}}  {{PERSON2_NAME}}  {{MONOGRAM}}  {{SLUG}}
{{WEDDING_DATE_DISPLAY}}  {{VENUE_NAME}}  {{VENUE_CITY}}
{{COUNTDOWN_TARGET}}

Hero only (in Call 3 hero HTML, not in skeleton):
  {{TAGLINE}}  {{CTA_LABEL}}

Story:
  {{STORY_EYEBROW}}  {{STORY_SCRIPT_TITLE}}  {{STORY_HEADING}}
  {{STORY_P1}}  {{STORY_QUOTE}}  {{STORY_P2}}

Events:
  {{EVENTS_EYEBROW}}  {{EVENTS_HEADING}}
  {{EVENTS_CARDS}}
  (renderer builds event cards dynamically from culturalProfile.ceremonies
   — no hardcoded EVENT_1/2/3 slots. See Section 26 for the loop.
   Maximum 6 ceremony cards. Skeleton CSS supports up to 6 auto-fit cards.)

RSVP:
  {{RSVP_EYEBROW}}  {{RSVP_HEADING}}  {{RSVP_SUB}}
  {{RSVP_ACCEPT_LABEL}}  {{RSVP_DECLINE_LABEL}}
  {{RSVP_SUBMIT_LABEL}}  {{RSVP_SUCCESS_TITLE}}  {{RSVP_SUCCESS_MESSAGE}}

Gallery:
  {{GALLERY_EYEBROW}}  {{GALLERY_HEADING}}  {{GALLERY_SUB}}

FAQ:
  {{FAQ_HEADING}}
  {{FAQ_1_Q}}  {{FAQ_1_A}}    {{FAQ_2_Q}}  {{FAQ_2_A}}
  {{FAQ_3_Q}}  {{FAQ_3_A}}    {{FAQ_4_Q}}  {{FAQ_4_A}}
  {{FAQ_5_Q}}  {{FAQ_5_A}}    {{FAQ_6_Q}}  {{FAQ_6_A}}

Footer:
  {{FOOTER_TAGLINE}}
```

**Event cards are dynamic.** The renderer loops over `culturalProfile.ceremonies` and builds each card. No hardcoded EVENT_1/EVENT_2/EVENT_3 limit. Maximum 6 cards — skeleton CSS supports up to 6 auto-fit cards.

---

### Layout 1 — Modern Minimalist: structural CSS

#### Story
```css
.story { padding: clamp(4rem,10vw,8rem) clamp(1.5rem,6vw,5rem); }
.story-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 4rem; max-width: 1080px; margin: 0 auto; align-items: center;
}
.story-photo { width: 100%; aspect-ratio: 3/4; }
.story-photo-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
@media (max-width: 768px) {
  .story-grid { grid-template-columns: 1fr; gap: 2rem; }
}
```

#### Events
```css
.events { padding: clamp(4rem,10vw,8rem) clamp(1.5rem,6vw,5rem); }
.events-inner { max-width: 1000px; margin: 0 auto; text-align: center; }
.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 2px; margin-top: 3rem;
}
.event-card { padding: 2.5rem 2rem; }
.event-detail { display: flex; align-items: flex-start; gap: 0.7rem; margin-bottom: 0.4rem; }
```

#### RSVP
```css
.rsvp { padding: clamp(4rem,10vw,8rem) clamp(1.5rem,6vw,5rem); }
.rsvp-inner { max-width: 600px; margin: 0 auto; text-align: center; }
.rsvp-form { text-align: left; margin-top: 2rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.form-field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
.rsvp-options { display: flex; gap: 1rem; }
.rsvp-option { flex: 1; }
.rsvp-option input[type="radio"] { position: absolute; opacity: 0; }
.rsvp-option label { display: block; padding: 0.9rem; text-align: center; cursor: pointer; }
.rsvp-submit { width: 100%; padding: 1rem; margin-top: 1.5rem; cursor: pointer; }
```

#### Gallery — uniform 3-column
```css
.gallery { padding: clamp(4rem,10vw,8rem) clamp(1.5rem,6vw,5rem); }
.gallery-header { text-align: center; margin-bottom: 3rem; }
.gallery-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 8px; max-width: 1080px; margin: 0 auto;
}
.gallery-item { aspect-ratio: 1; overflow: hidden; }
.gallery-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
@media (max-width: 768px) {
  .gallery-grid { grid-template-columns: repeat(2, 1fr); }
}
```

---

### Layout 2 — Romantic Traditional: structural differences

#### Story — offset photo decoration element
```html
<div class="story-photo-wrap">
  <div class="story-photo-decoration"></div>
  <div class="story-photo">
    <div class="story-photo-placeholder"><span>Photo coming soon</span></div>
  </div>
</div>
```
```css
.story-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 4rem; max-width: 1080px; margin: 0 auto; align-items: center;
}
.story-photo-wrap { position: relative; }
.story-photo-decoration {
  position: absolute; bottom: -16px; right: -16px;
  width: 80%; height: 80%; z-index: -1;
}
.story-photo { width: 100%; aspect-ratio: 3/4; overflow: hidden; }
@media (max-width: 768px) {
  .story-grid { grid-template-columns: 1fr; }
  .story-photo-decoration { display: none; }
}
```

#### Events — watermark number
```css
.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 2px; margin-top: 3rem;
}
.event-card { padding: 3rem 2rem; position: relative; overflow: hidden; }
.event-number {
  position: absolute; top: 0.5rem; right: 1rem;
  font-size: 5rem; opacity: 0.07; line-height: 1; pointer-events: none;
}
```

#### RSVP — split layout with decorative left panel
```html
<section class="rsvp" id="rsvp">
  <div class="rsvp-inner rsvp-split">
    <div class="rsvp-decorative">
      <p class="rsvp-decorative-quote">{{STORY_QUOTE}}</p>
      <p class="rsvp-decorative-names">{{PERSON1_NAME}} & {{PERSON2_NAME}}</p>
    </div>
    <div class="rsvp-form-wrap">
      <p class="rsvp-eyebrow reveal">{{RSVP_EYEBROW}}</p>
      <h2 class="rsvp-heading reveal reveal-d1">{{RSVP_HEADING}}</h2>
      <p class="rsvp-sub reveal reveal-d2">{{RSVP_SUB}}</p>
      <!-- RSVP form (shared structure) -->
    </div>
  </div>
</section>
```
```css
.rsvp { padding: clamp(4rem,10vw,8rem) clamp(1.5rem,6vw,5rem); }
.rsvp-split {
  display: grid; grid-template-columns: 2fr 3fr;
  gap: 4rem; max-width: 1000px; margin: 0 auto; align-items: start;
}
.rsvp-decorative {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 3rem 2rem; text-align: center; min-height: 300px;
}
@media (max-width: 768px) {
  .rsvp-split { grid-template-columns: 1fr; }
  .rsvp-decorative { display: none; }
}
```

#### Gallery — asymmetric 12-column editorial
```css
.gallery-grid {
  display: grid; grid-template-columns: repeat(12, 1fr);
  gap: 3px; max-width: 1080px; margin: 0 auto;
}
.gallery-item { overflow: hidden; }
.gallery-item:nth-child(1) { grid-column: 1/6;   aspect-ratio: 4/5;  }
.gallery-item:nth-child(2) { grid-column: 6/10;  aspect-ratio: 4/3;  }
.gallery-item:nth-child(3) { grid-column: 10/13; aspect-ratio: 3/4;  }
.gallery-item:nth-child(4) { grid-column: 1/4;   aspect-ratio: 1;    }
.gallery-item:nth-child(5) { grid-column: 4/9;   aspect-ratio: 16/9; }
.gallery-item:nth-child(6) { grid-column: 9/13;  aspect-ratio: 3/4;  }
@media (max-width: 768px) {
  .gallery-grid { grid-template-columns: 1fr 1fr; }
  .gallery-item { grid-column: unset !important; aspect-ratio: 1 !important; }
  .gallery-item:nth-child(1) {
    grid-column: 1/-1 !important; aspect-ratio: 16/9 !important;
  }
}
```

---

### Layout 3 — Grand Celebration: structural differences

#### Story — full-width centered text, no photo column
```html
<section class="story" id="story">
  <div class="story-centered">
    <p class="story-eyebrow reveal">{{STORY_EYEBROW}}</p>
    <p class="story-script reveal reveal-d1">{{STORY_SCRIPT_TITLE}}</p>
    <h2 class="story-heading reveal reveal-d1">{{STORY_HEADING}}</h2>
    <div class="story-body reveal reveal-d2">
      <p>{{STORY_P1}}</p>
      <blockquote class="story-quote">{{STORY_QUOTE}}</blockquote>
      <p>{{STORY_P2}}</p>
    </div>
  </div>
</section>
```
```css
.story { padding: clamp(5rem,12vw,10rem) clamp(1.5rem,6vw,5rem); }
.story-centered { max-width: 800px; margin: 0 auto; text-align: center; }
.story-quote { padding: 2rem 3rem; margin: 2rem auto; max-width: 600px; text-align: center; }
```

#### Events — generous auto-fit, watermark number
```css
.events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2px; margin-top: 3rem;
}
.event-card { padding: 3.5rem 2.5rem; position: relative; overflow: hidden; }
.event-number {
  position: absolute; top: 0.5rem; right: 1rem;
  font-size: 5rem; opacity: 0.07; line-height: 1; pointer-events: none;
}
```

#### RSVP — generous centered
```css
.rsvp { padding: clamp(5rem,12vw,10rem) clamp(1.5rem,6vw,5rem); }
.rsvp-inner { max-width: 680px; margin: 0 auto; text-align: center; }
```

#### Gallery — same asymmetric 12-column as Layout 2

---

### Layout 4 — Editorial Bold: structural differences

#### Story — asymmetric 60/40, text left
```html
<section class="story" id="story">
  <div class="story-grid">
    <div class="story-text">
      <p class="story-eyebrow reveal">{{STORY_EYEBROW}}</p>
      <p class="story-script reveal reveal-d1">{{STORY_SCRIPT_TITLE}}</p>
      <h2 class="story-heading reveal reveal-d1">{{STORY_HEADING}}</h2>
      <div class="story-body reveal reveal-d2">
        <p>{{STORY_P1}}</p>
        <blockquote class="story-quote">{{STORY_QUOTE}}</blockquote>
        <p>{{STORY_P2}}</p>
      </div>
    </div>
    <div class="story-photo-wrap">
      <div class="story-photo"></div>
    </div>
  </div>
</section>
```
```css
.story { padding: clamp(4rem,10vw,8rem) clamp(1.5rem,6vw,5rem); }
.story-grid {
  display: grid; grid-template-columns: 3fr 2fr;
  gap: 4rem; max-width: 1200px; margin: 0 auto; align-items: center;
}
.story-photo { width: 100%; aspect-ratio: 4/5; overflow: hidden; }
@media (max-width: 768px) {
  .story-grid { grid-template-columns: 1fr; }
  .story-grid .story-text { order: 1; }
  .story-grid .story-photo-wrap { order: 2; }
}
```

#### Events — two-column magazine grid
```css
.events-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 2px; margin-top: 3rem;
}
.event-card { padding: 4rem 3rem; }
@media (max-width: 480px) {
  .events-grid { grid-template-columns: 1fr; }
}
```

#### RSVP — full-width bold header
```html
<section class="rsvp" id="rsvp">
  <div class="rsvp-header-full">
    <p class="rsvp-eyebrow reveal">{{RSVP_EYEBROW}}</p>
    <h2 class="rsvp-heading reveal reveal-d1">{{RSVP_HEADING}}</h2>
  </div>
  <div class="rsvp-inner">
    <p class="rsvp-sub reveal">{{RSVP_SUB}}</p>
    <!-- RSVP form (shared structure) -->
  </div>
</section>
```
```css
.rsvp { padding: clamp(4rem,10vw,8rem) 0; }
.rsvp-header-full {
  padding: 4rem clamp(1.5rem,6vw,5rem);
  text-align: center; max-width: 100%;
}
.rsvp-inner {
  max-width: 600px; margin: 0 auto;
  padding: 0 clamp(1.5rem,6vw,5rem); text-align: center;
}
```

#### Gallery — CSS masonry
```css
.gallery-grid { columns: 3; column-gap: 6px; max-width: 1080px; margin: 0 auto; }
.gallery-item { break-inside: avoid; margin-bottom: 6px; overflow: hidden; }
.gallery-item:nth-child(3n+1) { aspect-ratio: 4/5; }
.gallery-item:nth-child(3n+2) { aspect-ratio: 3/4; }
.gallery-item:nth-child(3n)   { aspect-ratio: 1/1; }
@media (max-width: 768px) { .gallery-grid { columns: 2; } }
```

---

### Complete class name reference

```
nav  .nav-monogram  .nav-links  .nav-link

.story  .story-grid (L1, L2, L4)  .story-centered (L3 only)
.story-photo-wrap  .story-photo  .story-photo-placeholder (L1, L2)
.story-photo-decoration (L2 only)
.story-text  .story-eyebrow  .story-script  .story-heading
.story-body  .story-quote

.events  .events-inner  .events-header  .events-eyebrow
.events-heading  .events-grid  .event-card  .event-number
.event-name  .event-detail  .event-detail-icon  .events-map-link

.rsvp  .rsvp-inner
.rsvp-split (L2 only)  .rsvp-decorative  .rsvp-decorative-quote
.rsvp-decorative-names  .rsvp-form-wrap (L2 only)
.rsvp-header-full (L4 only)
.rsvp-eyebrow  .rsvp-heading  .rsvp-sub  .rsvp-form
.form-row  .form-field  .rsvp-options  .rsvp-option
.rsvp-submit  #rsvp-success  .rsvp-success-title  .rsvp-success-message

.gallery  .gallery-header  .gallery-eyebrow  .gallery-heading
.gallery-sub  .gallery-grid  .gallery-item  .gallery-placeholder

.faq  .faq-inner  .faq-heading  .faq-list  .faq-item
.faq-question  .faq-answer  .faq-icon

footer  .footer-names  .footer-info  .footer-tagline

.reveal  .reveal-d1  .reveal-d2  .reveal-d3
```

---

## 8. Skeleton Review Checklist

After building each skeleton, open in browser and verify:

### Structure
- [ ] Nav present at top with `{{MONOGRAM}}` and 5 anchor links
- [ ] No hero section in the skeleton
- [ ] Sections in order: story, events, rsvp, gallery, faq, footer
- [ ] Section IDs: `#story` `#events` `#rsvp` `#gallery` `#faq`

### Mobile (390px width)
- [ ] Nav links hidden, monogram centered
- [ ] Story stacks to single column
- [ ] Event cards stack to single column
- [ ] RSVP form rows stack to single column
- [ ] Nothing overflows horizontally

### Placeholders (search source for `{{`)
- [ ] Every token from the list is present
- [ ] No hardcoded names, dates, venues
- [ ] `<input type="hidden" name="slug" value="{{SLUG}}">`

### JavaScript
- [ ] No console errors
- [ ] FAQ opens/closes, one at a time
- [ ] RSVP submit shows success state
- [ ] Nav links scroll smoothly

### CSS (check source)
- [ ] No `color:` in skeleton CSS
- [ ] No `background:` in skeleton CSS
- [ ] No `font-family:` in skeleton CSS
- [ ] No `font-size:` in skeleton CSS
- [ ] Structural border on form inputs

### Layout-specific

**L1:** Story uses 1fr 1fr. Gallery uses 3-column uniform.

**L2:** Photo has offset decoration. Event cards have watermark number. RSVP has split layout.

**L3:** Story is `.story-centered` — NO photo. Gallery uses 12-column asymmetric.

**L4:** Story is 3fr 2fr text-left. Events is 2-column grid (not auto-fit). RSVP has `.rsvp-header-full`. Gallery uses CSS `columns` masonry.

---

## 9. AI Pipeline — Three Calls

### Call overview

| Call | Does | Returns | Runs when |
|------|------|---------|-----------|
| 1 | Selects layout | `{ layoutId, reason }` | After quiz step 1 |
| 2 | Designs entire site | CSS JSON + globalTokens + content | After layout selected |
| 3 | Generates hero | Self-contained hero HTML | After Call 2 |

---

### Call 1 — Layout Selection

**Initial tags** (before style/vibe collected):
```
If cultural_context contains south-asian/indian/desi → ['south-asian', 'grand']
Otherwise → ['modern', 'clean']
Re-run after couple provides style/vibe in step 2
```

**Stage 1 — tag matching:**
```typescript
// Score each layout, pick winner if ≥2 points ahead
// Otherwise go to Stage 2
```

**Stage 2 — AI confirmation (only if ambiguous):**
```
Input:  top 2 layout descriptions + couple context
Output: { layoutId: string, reason: string }
```

---

### Call 2 — Full Site Design Token Generation

**This call designs the entire site as one visual identity.**

**Input:** Complete skeleton HTML + couple data + design token glossary + coherence instruction

**Required output:**
```json
{
  "globalTokens": {
    "bgPrimary": "", "bgSecondary": "", "bgCard": "",
    "accent": "", "accentLight": "", "gold": "",
    "textPrimary": "", "textMuted": "", "textSubtle": "",
    "fontDisplay": "", "fontHeading": "", "fontBody": ""
  },
  "styles": {
    "body": { "background": "...", "color": "..." },
    "nav": { ... },
    ".nav-monogram": { ... },
    ".nav-link": { ... },
    ".story": { ... },
    ".story-eyebrow": { ... },
    ".story-heading": { ... },
    ".story-quote": { ... },
    ".event-card": { ... },
    ".event-name": { ... },
    ".rsvp": { ... },
    ".rsvp-heading": { ... },
    ".form-field input, .form-field select, .form-field textarea": { ... },
    ".rsvp-option input:checked + label": { ... },
    ".rsvp-submit": { ... },
    ".faq-question": { ... },
    ".faq-icon": { ... },
    "footer": { ... },
    ".footer-names": { ... },
    ".footer-tagline": { ... }
  },
  "fonts": ["Font Name:weights", "..."],
  "particles": {
    "effect": "none|petals|snow|fireflies|sparkles",
    "colors": [],
    "count": 0,
    "opacity": 0.0
  },
  "content": {
    "TAGLINE": "", "CTA_LABEL": "",
    "STORY_EYEBROW": "", "STORY_SCRIPT_TITLE": "",
    "STORY_HEADING": "", "STORY_P1": "", "STORY_QUOTE": "", "STORY_P2": "",
    "EVENTS_EYEBROW": "", "EVENTS_HEADING": "",
    "EVENT_NAMES": [],
    "MAP_LINK_LABEL": "",
    "RSVP_EYEBROW": "", "RSVP_HEADING": "", "RSVP_SUB": "",
    "RSVP_ACCEPT_LABEL": "", "RSVP_DECLINE_LABEL": "",
    "RSVP_SUBMIT_LABEL": "", "RSVP_SUCCESS_TITLE": "", "RSVP_SUCCESS_MESSAGE": "",
    "GALLERY_EYEBROW": "", "GALLERY_HEADING": "", "GALLERY_SUB": "",
    "FAQ_HEADING": "",
    "FAQ_1_Q": "", "FAQ_1_A": "", "FAQ_2_Q": "", "FAQ_2_A": "",
    "FAQ_3_Q": "", "FAQ_3_A": "", "FAQ_4_Q": "", "FAQ_4_A": "",
    "FAQ_5_Q": "", "FAQ_5_A": "", "FAQ_6_Q": "", "FAQ_6_A": "",
    "FOOTER_TAGLINE": ""
  },
  "designSummary": "2-sentence description of the complete visual identity.",
  "reasoning": {
    "palette": "", "fonts": "", "mood": ""
  }
}
```

**After Call 2:** Extract and save `globalTokens` and `designSummary` to DB separately. Pass `globalTokens` to Call 3.

---

### Call 3 — Hero Generation

**Full creative freedom within globalTokens constraints.**

**Exact instruction to include in prompt:**
```
You are generating the hero section for a wedding website.
The rest of the site uses this exact visual language — match it:

  Background:   {globalTokens.bgPrimary}
  Secondary bg: {globalTokens.bgSecondary}
  Accent:       {globalTokens.accent}
  Accent light: {globalTokens.accentLight}
  Gold:         {globalTokens.gold}
  Text:         {globalTokens.textPrimary}
  Display font: {globalTokens.fontDisplay}
  Heading font: {globalTokens.fontHeading}
  Body font:    {globalTokens.fontBody}

USE THESE EXACT VALUES. Do not introduce new colors or fonts.

Creative freedom on: layout, animations, particles, decorative
elements, glow effects, arch motifs, typography sizing, drama.

Include: countdown timer targeting {{COUNTDOWN_TARGET}},
CTA button {{CTA_LABEL}} linking to #rsvp,
{{PERSON1_NAME}}, {{PERSON2_NAME}}, {{WEDDING_DATE_DISPLAY}},
{{VENUE_NAME}}, {{VENUE_CITY}}.

Return complete hero HTML with embedded CSS and JS.
Do NOT include <html>, <head>, or <body> tags.
Return only the hero section content to be prepended to the page.
```

---

### Design Token Glossary (include in Call 2 prompt)

| Class | Purpose |
|-------|---------|
| `nav` | Sticky top bar. Subtle frame, never distracting. |
| `.nav-monogram` | Couple's initials. Elegant brand mark. |
| `.nav-link` | Understated. Clear on hover. |
| `.story-eyebrow` | Tiny uppercase label. Gold/accent color. Wide letter spacing. |
| `.story-script` | Decorative cursive title. **Soft, romantic. Lower visual weight than heading.** |
| `.story-heading` | Strong but elegant section heading. May contain `<em>` accent. |
| `.story-quote` | **Intimate blockquote. Left border in accent. Italic. A highlight moment.** |
| `.event-card` | One card per event. Refined. **Hover state recommended.** |
| `.event-number` | Large display font. **Very low opacity — watermark, not focus.** |
| `.event-name` | Event title. Guests read this first. |
| `.rsvp-heading` | Warm, inviting. **Personal ask — not a form header.** |
| `.form-field input/select/textarea` | Match site personality. **Not default browser elements.** Same treatment throughout. |
| `.rsvp-option input:checked + label` | Accent color. **Clear visual feedback when selected.** |
| `.rsvp-submit` | **Prominent. Warm. The final meaningful act.** |
| `.faq-question` | Full width. Hover: slight color shift. |
| `.faq-icon` | + / × toggle. Accent color. |
| `footer` | Gentle warm closing. Slightly different bg. |
| `.footer-names` | **Couple's names in display font. Softer than hero — final echo.** |
| `.footer-tagline` | **Very small. Very muted. Last whisper.** |

**Visual hierarchy (most → least important):**
1. Hero names (in hero HTML)
2. Hero CTA (in hero HTML)
3. Section headings
4. `.event-name`, `.story-quote`
5. Body text, labels
6. `.footer-tagline`, eyebrows

---

## 10. Design Tokens and Validation

### The validator

Every field in Call 2's JSON is validated before the browser sees it.

```typescript
validateStyles(raw)    → { valid: StylesMap, errors[], warnings[] }
validateFonts(raw)     → string[]
validateParticles(raw) → ParticleConfig
validateContent(raw)   → { valid: ContentMap, errors[], warnings[] }
validateAll(parsed)    → ValidationResult
```

**The validator never throws.** Bad values get safe defaults.

### Forbidden CSS properties (validator strips these)

```
display, position, flex-direction, flex-wrap,
grid-template-columns, grid-template-rows, grid-column, grid-row,
overflow, overflow-x, overflow-y,
width, height, min-height, max-height, min-width, max-width,
float, clear, pointer-events,
top, left, right, bottom, inset,
align-items, justify-content, gap,
flex, flex-grow, flex-shrink, flex-basis
```

### Approved fonts

```
Great Vibes, Cormorant Garamond, Playfair Display,
EB Garamond, Jost, Inter, Lato, Raleway, Montserrat,
Fraunces, DM Sans, Libre Baskerville, Poppins,
Josefin Sans, Crimson Text, Yeseva One
```

### Dangerous patterns (validator rejects)

```
/javascript:/i   /expression\(/i   /<script/i
/@import/i       /behaviour:/i     /-moz-binding/i
```

### Particle limits

```
effect:  none | petals | snow | fireflies | sparkles
count:   clamp 0–30
opacity: clamp 0–0.7
colors:  max 4 items
```

### Content defaults (no `{{TOKEN}}` ever reaches guests)

| Token | Default |
|-------|---------|
| TAGLINE | Together forever |
| CTA_LABEL | RSVP Now |
| STORY_EYEBROW | Our Story |
| STORY_HEADING | Our journey together |
| RSVP_HEADING | Will you join us? |
| RSVP_SUBMIT_LABEL | Send with Love |
| FOOTER_TAGLINE | Made with love, for the people we love. |
| *(all others)* | Sensible wedding-appropriate defaults |

---

## 11. Version History

### What gets saved

Every generation creates a new append-only row in `site_versions`. Never delete rows.

```sql
site_versions (
  id              UUID PRIMARY KEY,
  couple_id       UUID,
  version_number  INTEGER,
  layout_id       TEXT,
  hero_html       TEXT,
  global_tokens   JSONB,
  theme_json      JSONB NOT NULL,
  design_summary  TEXT,
  instruction     TEXT,
  label           TEXT,
  created_at      TIMESTAMPTZ
)
```

### One-click restore

```
Couple clicks "Switch to this design" on version N:
  Load: layout_id + hero_html + theme_json + global_tokens from version N
  Run renderer with those values + CURRENT couple DB data
    (names/dates always come from current DB)
  Save new HTML to storage
  Create new version: label "Restored from v{N}"
  Preview updates
```

### UX language

| Technical | Couple-friendly |
|-----------|----------------|
| Version history | Your designs |
| Restore | Switch to this design |
| Version 3 | Design from [date] |

---

## 12. AI Chat Refinement — Instruction Classifier

### Why the classifier matters

The edit loop is the most-used feature after initial generation. Every chat message must be classified before any action is taken. The classification determines which AI calls are made, how long the couple waits, and what the API costs per edit.

Misclassification in either direction is expensive:
- Burning a full Call 2 for a data edit wastes 8–12 seconds and API cost
- Treating a design change as a data edit produces no visible change

---

### The classifier — concrete implementation

**A single cheap Claude Haiku call. Not keyword rules. Not embeddings.**

One small call that returns JSON classification in ~300ms.

```typescript
// lib/ai/classifier.ts

type EditType =
  | "data"          // direct DB update — no AI calls
  | "content"       // update copy only — no design calls
  | "hero"          // regenerate hero only — Call 3
  | "design"        // regenerate design tokens — Calls 2 + 3
  | "global"        // regenerate everything — Calls 2 + 3
  | "new_section"   // generate a new custom section

interface ClassificationResult {
  type: EditType
  confidence: "high" | "low"
  reasoning: string
  dataField?: "person1_name" | "person2_name" | "wedding_date"
             | "venue_name" | "venue_city" | "rsvp_deadline"
}

// Model: claude-haiku-4-5 — 20x cheaper than Sonnet, ~300ms response
// Max tokens: 150 — classification needs no more
// When confidence is "low" → default to "design" (safer to over-generate)
```

**Classifier prompt:**
```
You are classifying a couple's edit instruction for their wedding website.
Return ONLY a JSON object. No explanation.

Edit instruction: "{instruction}"

Types:
"data"        — changes a factual field: names, date, venue, city
"content"     — changes written copy but not visual design
                (story text, tagline, FAQ answers, event names)
"hero"        — changes only the hero section
"design"      — changes design of sections below the hero
                or overall color/font treatment
"global"      — changes the whole site feel including hero
"new_section" — requests a section that does not exist yet

When unsure between "hero" and "design": use "design" (safer).
When unsure between "design" and "global": use "global" (safer).
When confidence is low: default to "design".

Return:
{
  "type": "data|content|hero|design|global|new_section",
  "confidence": "high|low",
  "reasoning": "one sentence",
  "dataField": "field name if type is data, else omit"
}
```

---

### What happens per classification type

| Type | DB update | Call 2 | Call 3 | Wait time |
|------|-----------|--------|--------|-----------|
| `data` | Yes | No | No | < 1 second |
| `content` | Yes (copy fields) | No | No | < 1 second |
| `hero` | No | No | Yes | 5–8 seconds |
| `design` | No | Yes | Yes | 10–15 seconds |
| `global` | No | Yes | Yes | 10–15 seconds |
| `new_section` | Yes (custom_sections) | No | Separate call | 5–8 seconds |

---

### Ambiguous cases — explicitly resolved

```
"Make the names bigger"
  → hero (names live in the hero HTML, not the skeleton)

"Change the color of Raj's name to red"
  → hero (name styling is in hero HTML)
  → AI receives instruction within globalTokens constraints
  → If red conflicts with palette, AI uses accent color

"Make it more intimate"
  → design (affects section feel throughout)

"Change our story"
  → content (direct text injection, no AI design call)

"Add gold to the hero"
  → low confidence between hero and design
  → default to design (safer — covers both)

"Start fresh"
  → global
```

---

### Design summary prevents drift

After every Call 2, store a 2-sentence `design_summary`. Use it in all future edit prompts — never the raw `style_history` array.

```
Edit prompt context:
  Current design: {design_summary}
  Instruction: {instruction}

  Update based on the instruction.
  Preserve everything the instruction does not touch.
```

---

### Suggested prompts (show as chips in UI)

| Chip | Classification |
|------|---------------|
| "Make it more romantic" | design |
| "Use a lighter colour palette" | design |
| "Add gold accents" | design |
| "Make it darker" | global |
| "Make the hero more dramatic" | hero |
| "Rewrite our story" | content |
| "Start fresh with a new style" | global |

---

## 13. Custom Sections

### Triggered by "+ Add a section" button

Show preset suggestions:
- Our pets
- Travel guide for guests
- Message from the family
- Our favourite memories
- Something else...

### What AI generates

A self-contained HTML block using the same `globalTokens` values.
No layout-breaking CSS. No cross-page scripts. No external fetches.

### Storage

```json
// couples.custom_sections JSONB array
[
  {
    "id": "section-abc123",
    "label": "Our pets",
    "html": "<section class='custom-pets'>...</section>",
    "position": 4,
    "createdAt": "..."
  }
]
```

Appended before footer. Each individually deletable.

---

## 14. Guest Experience

### Milestone 1
- RSVP form that works on mobile
- Countdown timer
- Clear date, time, venue
- FAQ section

### Milestone 2
- Save to calendar (ICS download)
- Get directions (deep link to Maps)
- Dress code clearly visible

### Principle
Guests open on phones in group settings. Date, venue, dress code, RSVP must be findable in 10 seconds.

---

## 15. Publishing

### Flow

1. Couple clicks "Publish"
2. M1 beta: skip payment → step 4
3. M2+: Stripe payment (£29 one-time)
4. `couples.is_published = true`
5. Publish moment overlay:
   - "Your wedding site is live"
   - URL large with copy button
   - Share to WhatsApp
   - Share to Instagram story
   - Confetti animation
6. Dashboard continues

### Before publish
- Free to create, preview, edit
- `/w/[slug]` shows "Coming soon" to guests

### After publish
- Site live at `/w/[slug]`
- Edits rebuild and re-serve
- No additional payment for edits

---

## 16. Feature List by Milestone

### Milestone 1 — Private Beta

| ID | Feature | Priority |
|----|---------|----------|
| VI-F001 | Fast onboarding: step 1 → preview → step 2 refine | CRITICAL |
| VI-F002 | Layout selection — style card primary, culture suggests | CRITICAL |
| VI-F003 | Full site design with globalTokens + coherence | CRITICAL |
| VI-F004 | Hero generation using globalTokens constraints | CRITICAL |
| VI-F005 | Renderer — full assembly pipeline including cultural injection | CRITICAL |
| VI-F006 | 4 layout skeletons with meta.json (Layout 3 renamed Grand Celebration) | CRITICAL |
| VI-F007 | Dashboard preview with mobile/desktop toggle | CRITICAL |
| VI-F008 | AI chat with instruction classifier | CRITICAL |
| VI-F009 | Direct data editing — no AI call | CRITICAL |
| VI-F010 | "Your designs" version history with restore | HIGH |
| VI-F011 | **Cultural profile configurator** — quiz step 2, ceremony selection, content fields, sub-regions | CRITICAL |
| VI-F012 | RSVP guest submission — config-driven form | CRITICAL |
| VI-F013 | RSVP couple dashboard with CSV export | HIGH |
| VI-F014 | Public site `/w/[slug]` | CRITICAL |
| VI-F015 | Auth + middleware | CRITICAL |
| VI-F016 | Landing page | HIGH |
| VI-F017 | **Photo gallery upload** — couples upload photos to gallery section | HIGH |

**VI-F017 moved from M3 to M1.** A paid product where couples cannot add their own photos will fail.
Guests need to see the couple's faces — placeholder cells are better than nothing but not good enough for launch.

**Layout switcher removed from M1.** Couples pick their layout in quiz step 2 and can change it in the dashboard settings. A dedicated switcher UI is M2 polish, not M1 requirement.

### Milestone 2 — Paid Launch

| ID | Feature | Priority |
|----|---------|----------|
| VI-F018 | Stripe payment at publish | CRITICAL |
| VI-F019 | Pricing transparency | HIGH |
| VI-F020 | Publish moment + share buttons | HIGH |
| VI-F021 | Custom sections UI (+ Add a section) | HIGH |
| VI-F022 | Calendar save + directions | MEDIUM |
| VI-F023 | RSVP email notification | HIGH |
| VI-F024 | Design summary anti-drift | HIGH |
| VI-F025 | Layout switcher UI in dashboard | MEDIUM |
| VI-F026 | Bilingual text support (Chinese / Hebrew / Arabic) | HIGH |

### Milestone 3 — Growth

| ID | Feature | Priority |
|----|---------|----------|
| VI-F027 | Guest list + who hasn't responded | HIGH |
| VI-F028 | "Powered by VeeInvite" footer attribution | CRITICAL |
| VI-F029 | Guest-to-creator conversion CTA on every wedding site | CRITICAL |
| VI-F030 | Culture-aware SEO landing pages | HIGH |
| VI-F031 | 5th and 6th layout | MEDIUM |
| VI-F032 | Custom domain | LOW |

---

## 17. Release Strategy — Three Milestones

### Milestone 1 — Private Beta
- **Goal:** Validate 2-minute promise and output quality
- **Target:** 10 real couples, free
- **Success:** 5/10 publish, 3+ say "I'd pay", avg time < 2 min

### Milestone 2 — Paid Launch
- **Goal:** First revenue
- **Target:** 50 paying couples
- **Success:** £1,000 in first month, NPS > 50, < 10% design complaints

### Milestone 3 — Growth
- **Goal:** Word of mouth growth engine
- **Target:** 200+ couples
- **Success:** 20%+ from referrals, 80% retention at 1 month

---

## 18. Build Phases

### Milestone 1

| Phase | Name | Key deliverable |
|-------|------|----------------|
| 0 | Setup + docs | Project runs, all docs created |
| 1 | Layout library | 4 skeletons pass review checklist |
| 2 | Types + validator + renderer | Pipeline works with mock data |
| 3 | Layout selector | Tag matching works correctly |
| 4 | All 3 AI prompts | All 3 Claude calls work end to end |
| 5 | Database + Supabase | Schema live, clients working |
| 6 | API routes | `/api/generate` returns a real site URL |
| 7 | Auth + middleware | Signup, login, route protection |
| 8 | Fast onboarding (2-step) | Step 1 → generate → preview → step 2 |
| 9 | Dashboard core | Preview + chat edit + layout switcher + mobile toggle |
| 10 | Version history | "Your designs" with one-click restore |
| 11 | RSVP dashboard | Couple sees and exports RSVPs |
| 12 | Public site route | `/w/[slug]` works for guests |
| 13 | Landing page | Homepage clear and functional |
| 14 | End to end test | Full flow without errors |

### Milestone 2

| Phase | Name |
|-------|------|
| 15 | Stripe integration |
| 16 | Publish moment |
| 17 | Custom sections |
| 18 | Guest experience + emails |
| 19 | Design summary anti-drift |
| 20 | M2 end to end test |

---

## 19. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hero doesn't match rest of site | Medium | Critical | globalTokens passed to Call 3 as hard constraints |
| Sections have inconsistent colors | Medium | High | Call 2 coherence instruction. One palette established via globalTokens. |
| AI generates nav links with wrong IDs | Medium | High | Call 3 prompt specifies required IDs. Post-generation check. |
| Generation takes > 15 seconds | Medium | High | Parallel calls where possible. Good loading UX. |
| Mobile rendering breaks | Medium | High | Skeleton owns all breakpoints. AI never touches them. Mobile preview toggle. |
| AI drift after many edits | High | Medium | Design summary replaces style_history in edit prompts. |
| Couples don't know what to type | High | Medium | Suggested prompt chips in chat UI. |
| Scope creep delays M1 | High | High | Strictly follow M1 feature list. Backlog doc for everything else. |

---

## 20. Key Metrics

### Primary metric

> **Time from landing to first preview**

| Time | Status |
|------|--------|
| < 2 minutes | You have a product |
| 2–5 minutes | Work to do |
| > 5 minutes | Couples leave before seeing value |

### Supporting metrics

| Metric | Target |
|--------|--------|
| Couples who publish | > 50% |
| "All sections feel coherent" | > 90% |
| Published couples who share | > 80% |
| NPS from published couples | > 50 |
| Support about incoherent design | < 5% |

---

## 21. Architecture Rules — Never Break These

1. **App name is VeeInvite** everywhere.

2. **Never modify layout skeleton files** after Phase 1. Skeletons contain nav + all sections except hero.

3. **Hero section is NOT in any skeleton.** Generated by Call 3, prepended by renderer.

4. **Call 2 designs the entire site as one visual identity.** Covers every class. Establishes `globalTokens` once. No section introduces its own palette.

5. **Call 3 receives `globalTokens` as hard constraints.** Same background, accent, gold, fonts. Full creative freedom on everything else.

6. **`theme_json`, `globalTokens`, and `hero_html` are sources of truth.** HTML in storage is always derived. Never treat it as canonical.

7. **`injectStructured()` always runs LAST in the renderer.** Real names/dates/venues always overwrite AI copy.

8. **Validator never throws.** Bad values get safe defaults. Site always renders.

9. **RSVP form structure is never generated by AI.** Hardcoded in every skeleton. AI only styles it via Call 2 CSS JSON.

10. **All Claude API calls are server-side only.** Never expose API key to the browser.

11. **`/w/[slug]` returns raw HTML.** Not wrapped in Next.js layout. Standalone wedding site.

12. **AI never sets layout CSS properties.** `display`, `position`, `flex-direction`, `grid-template-columns`, `overflow`, `width`, `height` — always owned by skeleton CSS.

13. **Nav anchor IDs are fixed.** Must be exactly: `#story`, `#events`, `#rsvp`, `#gallery`, `#faq`. Match skeleton section IDs.

14. **Layout switching reuses existing tokens.** Applying existing `theme_json` to new skeleton — no AI call needed.

15. **Design summary replaces raw style_history** in edit prompts. Prevents incoherence after many edits.

---

## 22. Documentation Structure

```
/
├── CLAUDE.md                        ← AI context. Update after every phase.
├── CONTEXT.md                       ← Quick onboarding. 1 page max.
├── VEEINVITE_PRODUCT_PLAN.md        ← This file.
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── BACKLOG.md
│   └── tickets/
│       ├── VI-001.md  ← Phase 0
│       └── ...        ← one per phase
```

### Decision log format

```markdown
## Decision: [title]
**Date:** YYYY-MM-DD
**Status:** Accepted

### Context / Decision / Consequences / Alternatives considered
```

### Ticket format

```markdown
# VI-00N: [Phase Title]
## Summary / Background / Work Required
## Technical Notes / Acceptance Criteria / Definition of Done
```

---

## 23. Environment and Tech Stack

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| Language | TypeScript strict |
| Database | Supabase (Postgres + Auth + Storage) |
| AI | Anthropic `claude-sonnet-4-5` |
| UI | Tailwind CSS (dashboard only) |
| Payments | Stripe (M2) |
| Email | Resend (M2) |
| Hosting | Vercel |

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=        (M2)
STRIPE_WEBHOOK_SECRET=    (M2)
NEXT_PUBLIC_STRIPE_KEY=   (M2)
RESEND_API_KEY=            (M2)
```

### Database schema

```sql
CREATE TABLE couples (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  slug             TEXT UNIQUE NOT NULL,
  person1_name     TEXT NOT NULL,
  person2_name     TEXT NOT NULL,
  wedding_date     TEXT NOT NULL,
  wedding_date_iso TIMESTAMPTZ NOT NULL,
  venue_name       TEXT NOT NULL,
  venue_city       TEXT NOT NULL,
  rsvp_deadline    DATE,

  -- Quiz step 2 — collected alongside first preview
  style            TEXT,        -- style card selection e.g. "modern_minimalist"
  vibe             TEXT,        -- 3 vibe words typed by couple
  story            TEXT,        -- couple's written story (replaces placeholder)

  -- Cultural profile — replaces loose cultural_context TEXT
  -- Confirmed CulturalProfile object from quiz step 2 configurator
  -- Drives: ceremony list, content fields, AI prompts, design guidance, RSVP defaults
  cultural_profile JSONB DEFAULT '{}',

  -- Layout + design
  layout_id        TEXT,
  global_tokens    JSONB,
  theme_json       JSONB,
  hero_html        TEXT,
  design_summary   TEXT,

  -- Custom sections and config
  custom_sections  JSONB DEFAULT '[]',

  -- RSVP form configuration — config-driven, not hardcoded
  -- See Section 29 for full RSVPConfig interface
  rsvp_config      JSONB DEFAULT '{}',

  -- Site state
  site_html_url    TEXT,
  is_published     BOOLEAN DEFAULT false,
  -- wedding_status added in v2: 'upcoming' | 'post_wedding' | 'archived'

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id   UUID REFERENCES couples(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  event_date  TEXT NOT NULL,
  event_time  TEXT NOT NULL,
  venue       TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0
  -- Note: ceremonies are primarily driven by cultural_profile.ceremonies
  -- This table stores the confirmed ceremony details (date/time/venue) once filled in
);

CREATE TABLE rsvps (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id        UUID REFERENCES couples(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  attending        BOOLEAN NOT NULL,
  guest_count      INTEGER DEFAULT 1,
  children_count   INTEGER DEFAULT 0,       -- only used if rsvp_config.childrenSeparate
  plus_one_name    TEXT,                    -- only used if rsvp_config.plusOneEnabled
  events_attending TEXT[],                  -- array of ceremony IDs attending
  meal_choice      TEXT,                    -- only used if rsvp_config.mealChoiceEnabled
  dietary          TEXT,
  song_request     TEXT,                    -- only used if rsvp_config.songRequestEnabled
  message          TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE site_versions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id      UUID REFERENCES couples(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  layout_id      TEXT,
  hero_html      TEXT,
  global_tokens  JSONB,
  theme_json     JSONB NOT NULL,
  design_summary TEXT,
  instruction    TEXT,
  label          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

### Project structure

```
veeinvite-ai-2/
├── CLAUDE.md
├── CONTEXT.md
├── VEEINVITE_PRODUCT_PLAN.md
├── layouts/
│   ├── layout-1-modern/   (skeleton.html + meta.json)
│   ├── layout-2-romantic/
│   ├── layout-3-grand/
│   └── layout-4-editorial/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── BACKLOG.md
│   └── tickets/
└── src/
    ├── app/
    │   ├── page.tsx
    │   ├── layout.tsx
    │   ├── auth/login/page.tsx
    │   ├── auth/signup/page.tsx
    │   ├── onboarding/page.tsx
    │   ├── dashboard/page.tsx
    │   ├── w/[slug]/route.ts
    │   └── api/
    │       ├── generate/route.ts
    │       ├── edit/route.ts
    │       ├── structured/route.ts
    │       ├── custom-section/route.ts
    │       ├── restore/route.ts
    │       ├── rsvp/route.ts
    │       └── publish/route.ts
    ├── lib/
    │   ├── types.ts
    │   ├── layoutSelector.ts
    │   ├── ai/prompt.ts
    │   ├── ai/generate.ts
    │   ├── validator/index.ts
    │   ├── renderer/index.ts
    │   ├── supabase/client.ts
    │   └── supabase/server.ts
    └── components/
        ├── onboarding/QuizForm.tsx
        ├── dashboard/SitePreview.tsx
        ├── dashboard/EditPanel.tsx
        ├── dashboard/StructuredEditor.tsx
        ├── dashboard/VersionHistory.tsx
        ├── dashboard/LayoutSwitcher.tsx
        ├── dashboard/RSVPDashboard.tsx
        └── ui/Button.tsx + Input.tsx + LoadingScreen.tsx
```

---

## 24. Two-Axis System — Structure and Culture Are Independent

This is the most important architectural decision made after the initial build plan.
Every decision downstream flows from this.

### The two axes

```
AXIS 1 — STRUCTURE (Layout)        AXIS 2 — CULTURE (Profile)
What the page looks like            What content goes in it

Layout 1 — Modern Minimalist        Western
Layout 2 — Romantic Traditional     Hindu Indian (10 sub-regions)
Layout 3 — Grand Celebration        Sikh
Layout 4 — Editorial Bold           Muslim (3 sub-regions)
                                    Chinese
                                    Jewish
                                    Nigerian / Yoruba
                                    Nigerian / Igbo
                                    Latin American / Catholic
```

Any layout can hold any culture profile.
A Tamil couple can pick Layout 1 (Modern Minimalist).
A Jewish couple can pick Layout 4 (Editorial Bold).
Layout controls structure. Culture controls content.

### They are independent but inform each other

They do not dictate each other. The quiz collects both.
After culture is selected, the system suggests a layout.
The couple can override with any style card.

```
Culture selected: Hindu Indian
System suggests: Layout 3 (multi-event structure fits naturally)
Couple picks: Layout 1 (they want modern and clean)
Result: Layout 1 structure + Hindu Indian cultural profile
        Modern minimalist page with correct Indian ceremonies,
        parents names, Ganesh opening, correct palette guidance
```

### What each axis drives

```
STRUCTURE (layout) drives:
  - HTML skeleton file used
  - Section layouts (story columns, event grid, gallery type)
  - RSVP layout style (centered / split / bold-header)
  - Maximum number of event card slots

CULTURE (profile) drives:
  - Content fields to collect (parents names, religious opening etc)
  - Ceremony list (pre-selected correct ones, optional ones available)
  - Design palette guidance sent to AI Call 2
  - Copy tone and copy guardrails sent to AI Call 2 + Call 3
  - Smart RSVP defaults (guest count max, event selection etc)
  - Custom sections (aso-ebi, padrinos)
```

### How they combine at generation time

```
Call 2 receives:
  layout skeleton HTML         → from structure axis
  culturalProfile.designGuidance → from culture axis
  culturalProfile.copyGuardrails → from culture axis
  culturalProfile.ceremonies   → which events to include
  couple data

Call 3 receives:
  globalTokens from Call 2
  culturalProfile.copyTone     → from culture axis
  culturalProfile.copyGuardrails

Renderer uses:
  layout skeleton file         → structure
  culturalProfile.ceremonies   → builds event cards dynamically
  culturalProfile.contentFields → which family fields to inject
  custom sections from profile → aso-ebi, padrinos etc
  theme_json                   → AI styling
  hero_html                    → AI hero
```

### DB columns

```sql
-- Two columns on couples table — one per axis
layout_id         TEXT    -- "layout-3"
cultural_profile  JSONB   -- confirmed CulturalProfile object
```

These are stored and updated independently.
Switching layout does not change the cultural profile.
Updating cultural profile does not change the layout.

---

## 25. Layout Selection — Revised Logic

Tags no longer drive layout selection.
The two-axis system makes this cleaner.

### The complete decision tree

```
Did couple pick a style card in quiz step 2?
  YES → use that layout directly
        style card always wins
        cultural profile applies on top
        done

  NO (step 1 only — style not yet collected):
    Does cultural profile suggest a layout?
      YES → use that as the default for first preview
            couple overrides with style card in step 2
      NO (no cultural context given):
        → default to Layout 1
          couple overrides in dashboard
```

### Style card → layout mapping (direct, no scoring)

| Style card | Layout |
|-----------|--------|
| Modern Minimalist | Layout 1 |
| Romantic Traditional | Layout 2 |
| Bohemian Garden | Layout 1 |
| Elegant Minimal | Layout 1 |
| Grand Celebration | Layout 3 |
| Destination Glamour | Layout 4 |
| Editorial Bold | Layout 4 |

### Cultural profile → suggested layout (step 1 default only)

| Cultural profile | Suggested layout | Reason |
|-----------------|-----------------|--------|
| Hindu Indian (any sub-region) | Layout 3 | Multi-event structure, generous event grid |
| Sikh | Layout 3 | Multi-event, grand structure |
| Muslim | Layout 3 | Multi-event (Nikah + Walima) |
| Chinese | Layout 4 | Bold, high contrast — closer to red/gold aesthetic |
| Jewish | Layout 2 | Romantic traditional — closest structurally |
| Nigerian | Layout 4 | Bold, editorial — closer to vibrant aesthetic |
| Latin American | Layout 2 | Romantic traditional — Catholic formal |
| Western | Layout 1 | Clean, minimal default |
| No context given | Layout 1 | Most universal |

**This is a suggestion only.** The couple overrides it with any style card.
The cultural profile never forces a layout. It guides the default.

### Style card wins — always

If the couple explicitly picks a style card, that is their structure choice.
Even if their culture suggests Layout 3, picking Modern Minimalist gives them Layout 1.
Culture provides the content. Structure is the couple's aesthetic preference.
This is the correct resolution. Do not override an explicit style card choice.

### Tags — their new role

Tags are no longer used for layout selection.
They are still generated from quiz answers and used as vibe context in Call 2 and Call 3 prompts.
They help AI understand the couple's aesthetic beyond just the style card label.
See Section 27 for the tag taxonomy.

### Layout switcher in dashboard

Because the axes are independent, switching layout in the dashboard is clean:

```
Your layout
  Currently: Grand Celebration

  [L1 Modern] [L2 Romantic] [L3 Grand ✓] [L4 Editorial]

  "Switching layout keeps your cultural profile, your content,
   and your visual style. Only the page structure changes."

  [Switch to Modern Minimalist]
```

Switching applies existing theme_json to the new skeleton.
No AI call needed. Cultural profile unchanged.

---

## 26. Cultural Profile System

### What a cultural profile is

A structured object produced when a couple selects their cultural background in quiz step 2.
It drives everything: content fields, ceremonies, design guidance, copy guardrails.

```typescript
interface CulturalProfile {
  id: string                  // "hindu_indian"
  subRegion?: string          // "tamil"
  displayName: string         // "Hindu — Tamil"

  contentItems: Array<{
    id: string
    label: string
    section: SectionType
    fields: Field[]
    included: boolean         // couple confirmed this
    values: Record<string, string>  // actual data filled in
  }>

  ceremonies: Array<{
    id: string
    name: string
    included: boolean         // couple confirmed this
    date?: string
    time?: string
    venue?: string
    source: "subregion" | "default" | "additional"
  }>

  designGuidance: string      // injected into Call 2 prompt
  copyTone: string            // injected into Call 2 + Call 3 prompts
  copyGuardrails: string      // injected into Call 2 + Call 3 prompts
}
```

### Where it comes from — the cultural content library

All culture definitions live in a single JSON file:

```
src/lib/cultural-content-library.json
```

This file defines for every culture:
- Every content item with its section placement and fields
- Default ceremony list (pre-selected)
- Sub-region ceremony lists (override default pre-selection)
- Additional ceremonies (from default list, shown unselected)
- Design guidance, copy tone, copy guardrails

**Reference file:** `cultural-content-library.json` (in `src/lib/` — read this before building anything cultural)

**Cultures covered:** western, hindu_indian (10 sub-regions: punjabi, gujarati, bengali, tamil, marathi, telugu, kannada, kerala_malayali, marwari_rajasthani, jain), sikh, muslim (3 sub-regions: south_asian_muslim, arab_muslim, west_african_muslim), chinese, jewish, nigerian_yoruba, nigerian_igbo, latin_american_catholic.

---

### Cultural content library — full structure for Claude Code

**Read this before building the quiz configurator, the renderer, or any cultural logic.**

The JSON has three top-level keys:

```
version          → schema version string
sectionTypes     → dictionary of all valid section placement values with descriptions
cultures         → one object per culture — the main data
universalContent → content items available to all cultures (dress code, accommodation etc)
```

---

#### Top-level: `sectionTypes`

Defines where each piece of content can be placed on the wedding site.
These are the only valid values for `contentItem.section`.

```typescript
type SectionType =
  | "hero_eyebrow"       // above couple names — religious opening, symbols
  | "hero_names_area"    // around couple names — parents names, family hosts
  | "hero_date_area"     // below date — alternative calendar dates
  | "hero_cta_area"      // near RSVP button — critical ceremony times
  | "story"              // story section — family narrative
  | "events"             // event cards — each ceremony as a card
  | "rsvp"               // RSVP form configuration
  | "gallery"            // photo gallery
  | "faq"                // FAQ section — dress code, guidance for guests
  | "custom_section"     // new full section before footer
  | "footer"             // footer — secondary family names, closing blessing
```

---

#### Top-level: `cultures[cultureId]`

Each culture object has this shape:

```typescript
interface CultureDefinition {
  id: string                 // "hindu_indian"
  displayName: string        // "Hindu — Indian"
  description: string        // one sentence description
  philosophy: string         // how this culture thinks about weddings
  suggestedLayout: string    // "layout-3" — default layout suggestion for step 1
  subRegions?: string[]      // e.g. ["punjabi", "tamil", "gujarati", ...]
  designGuidance: string     // injected verbatim into Call 2 prompt
  copyTone: string           // injected verbatim into Call 2 + Call 3 prompts
  copyGuardrails?: string    // injected verbatim into Call 2 + Call 3 prompts — HARD RULES

  contentItems: ContentItemDefinition[]
  ceremonies: {
    default: CeremonyDefinition[]
    subRegions: Record<string, SubRegionCeremonies>
  }
}
```

---

#### `contentItems` array

Each content item defines a piece of cultural content, where it goes, and what fields to collect.

```typescript
interface ContentItemDefinition {
  id: string                 // unique e.g. "hindu_religious_opening"
  label: string              // shown in quiz configurator UI
  description: string        // helper text for the couple
  section: SectionType       // WHERE it goes on the site
  fields: FieldDefinition[]  // what data to collect from the couple
  defaultIncluded: boolean   // pre-selected in configurator (true) or available to add (false)
  optional: boolean          // can couple remove it (true) or is it required (false)
  displayNote?: string       // additional note shown in configurator UI
  customSectionLabel?: string // if section is "custom_section" — the section title
}

interface FieldDefinition {
  key: string           // used as the DB storage key
  type: "text" | "textarea" | "select" | "boolean" | "array"
  label: string         // shown in the form
  placeholder?: string  // example value
  required: boolean
  options?: string[]    // for "select" type
  default?: any         // for "boolean" type
  itemFields?: FieldDefinition[]  // for "array" type (e.g. padrinos list)
}
```

**How `section` drives the renderer:**

```
"hero_eyebrow"    → renderer injects into hero HTML above couple names
                    (hero is generated by Call 3 — renderer passes this as a constraint)

"hero_names_area" → renderer injects into hero HTML below couple names
                    formatted as: "Son/Daughter of [parents names]"

"hero_date_area"  → renderer injects into hero HTML near the date
                    e.g. "Muhurat: 11:17 AM" or "15 Tammuz 5785"

"hero_cta_area"   → renderer injects into hero HTML near the CTA button
                    used for Chuppah time (Jewish) — must be impossible to miss

"events"          → renderer builds this into the event cards via the ceremony loop
                    (most ceremony content uses this path, not contentItems)

"faq"             → renderer injects as a FAQ item
                    e.g. Gurdwara guidance, Ketubah note, tea ceremony note

"custom_section"  → renderer generates a new full section before the footer
                    uses customSectionLabel as the section heading
                    e.g. Aso-Ebi section, Padrinos section

"footer"          → renderer injects into footer below couple names
                    e.g. grandparents names, closing dua
```

---

#### `ceremonies` object

Two sub-keys: `default` and `subRegions`.

```typescript
interface CeremonyDefinition {
  id: string             // "mehendi" — unique across all cultures
  name: string           // "Mehendi Ceremony" — display name
  defaultIncluded: boolean  // pre-selected in configurator
  optional: boolean      // can couple remove it
  description: string    // shown in configurator
  note?: string          // extra note e.g. "Called Pithi in Gujarati"
  subRegionOnly?: string[]    // only show for these sub-regions (not used — legacy, ignore)
  subRegionExclusions?: string[] // not used — legacy, ignore
}
```

**The sub-regions object:**

```typescript
interface SubRegionCeremonies {
  note: string           // factual note about this sub-region's wedding style
  copyNote: string       // injected into AI prompts — specific cultural accuracy rules
  selected: Array<{
    id: string           // matches an id in the default list OR is sub-region specific
    name?: string        // optional override of the default name
    defaultIncluded: boolean
    note?: string        // e.g. "Called Vatna in Punjabi tradition"
    description?: string
  }>
  additional: Array<{    // sub-region specific ceremonies NOT in the default list
    id: string
    name: string
    description: string
  }>
}
```

---

#### How to load ceremonies for a couple — the algorithm

This is the most important function in the cultural system.
It produces the full list of ceremonies shown in the configurator.

```typescript
function getCeremoniesForCouple(
  cultureId: string,
  subRegion?: string
): DisplayCeremony[] {

  const culture = library.cultures[cultureId]
  const defaultList = culture.ceremonies.default

  // No sub-region — return default list as-is
  if (!subRegion || !culture.ceremonies.subRegions?.[subRegion]) {
    return defaultList.map(c => ({
      ...c,
      displaySource: "default" as const,
    }))
  }

  const sub = culture.ceremonies.subRegions[subRegion]
  const selectedIds = new Set(sub.selected.map(c => c.id))
  const result: DisplayCeremony[] = []

  // Step 1 — sub-region's own selected list (correct pre-selection for this sub-region)
  sub.selected.forEach(s => {
    // Find base definition from default list if exists
    const base = defaultList.find(d => d.id === s.id)
    result.push({
      id: s.id,
      name: s.name ?? base?.name ?? s.id,
      defaultIncluded: s.defaultIncluded,
      optional: base?.optional ?? true,
      description: s.description ?? base?.description ?? "",
      note: s.note,
      displaySource: "subregion" as const,
    })
  })

  // Step 2 — default ceremonies NOT already in sub-region selected list
  // These are shown UNSELECTED — available but not typical for this sub-region
  // This is the "Bollywood inspiration" use case
  defaultList
    .filter(d => !selectedIds.has(d.id))
    .forEach(d => result.push({
      ...d,
      defaultIncluded: false,      // always unselected for this sub-region
      displaySource: "default" as const,
      availabilityNote: "Not traditional for this region — available to add",
    }))

  // Step 3 — sub-region additional ceremonies (sub-region specific, not in default list)
  // Also shown UNSELECTED — optional extras
  sub.additional
    ?.filter(a => !selectedIds.has(a.id))
    .forEach(a => result.push({
      id: a.id,
      name: a.name,
      defaultIncluded: false,
      optional: true,
      description: a.description,
      displaySource: "additional" as const,
    }))

  return result
}
```

---

#### How to build a CulturalProfile from the library

When couple confirms their cultural selection in the configurator:

```typescript
function buildCulturalProfile(
  cultureId: string,
  subRegion: string | undefined,
  confirmedContentItems: string[],  // IDs the couple kept
  confirmedCeremonies: string[],    // IDs the couple kept
  contentValues: Record<string, string>  // field values filled in
): CulturalProfile {

  const def = library.cultures[cultureId]
  const subDef = subRegion
    ? def.ceremonies.subRegions?.[subRegion]
    : undefined

  return {
    id: cultureId,
    subRegion,
    displayName: subRegion
      ? `${def.displayName} — ${subRegion}`
      : def.displayName,

    contentItems: def.contentItems
      .filter(item => confirmedContentItems.includes(item.id))
      .map(item => ({
        id: item.id,
        label: item.label,
        section: item.section,
        customSectionLabel: item.customSectionLabel,
        fields: item.fields,
        included: true,
        values: contentValues,
      })),

    ceremonies: getCeremoniesForCouple(cultureId, subRegion)
      .filter(c => confirmedCeremonies.includes(c.id))
      .map(c => ({
        id: c.id,
        name: c.name,
        included: true,
        date: undefined,
        time: undefined,
        venue: undefined,
        source: c.displaySource,
      })),

    designGuidance: def.designGuidance,
    copyTone: def.copyTone,
    copyGuardrails: def.copyGuardrails ?? "",

    // Sub-region copy note is ADDED to the guardrails — more specific rules
    subRegionCopyNote: subDef?.copyNote ?? "",
  }
}
```

---

#### How to inject cultural profile into AI prompts

**In Call 2 prompt:**

```typescript
function buildCulturalPromptBlock(profile: CulturalProfile): string {
  if (!profile.id || profile.id === "western") return ""

  return `
CULTURAL CONTEXT:
Culture: ${profile.displayName}

Design guidance:
${profile.designGuidance}

Copy tone:
${profile.copyTone}

COPY GUARDRAILS — READ BEFORE GENERATING ANY TEXT:
${profile.copyGuardrails}
${profile.subRegionCopyNote ? `\nSub-region specific rules:\n${profile.subRegionCopyNote}` : ""}

Ceremonies included (use these exact names):
${profile.ceremonies.map(c => `  - ${c.name}`).join('\n')}
  `.trim()
}
```

Include this block in every Call 2 and Call 3 prompt when cultural profile is present.
The `copyGuardrails` field is a HARD RULE block — it tells AI what it must never write.
For Tamil: never use Sangeet, Pheras, Baraat as ceremony names.
For Muslim: no alcohol references, no human figures.
For Jewish: Chuppah time must be prominent.

---

#### How to inject cultural content into the renderer

After Call 2 and Call 3 are complete, the renderer injects cultural content into the HTML.
Content is injected per `section` type:

```typescript
function injectCulturalContent(
  html: string,
  profile: CulturalProfile
): string {

  // Group confirmed content items by section
  const bySection = groupBy(
    profile.contentItems.filter(i => i.included),
    i => i.section
  )

  // Hero content items — pass to hero injection functions
  if (bySection.hero_eyebrow) {
    html = injectHeroEyebrow(html, bySection.hero_eyebrow, profile)
  }
  if (bySection.hero_names_area) {
    html = injectHeroNamesArea(html, bySection.hero_names_area, profile)
  }
  if (bySection.hero_date_area) {
    html = injectHeroDateArea(html, bySection.hero_date_area, profile)
  }
  if (bySection.hero_cta_area) {
    html = injectHeroCtaArea(html, bySection.hero_cta_area, profile)
  }

  // FAQ items — each content item in faq section becomes a FAQ item
  if (bySection.faq) {
    html = injectFAQCulturalItems(html, bySection.faq, profile)
  }

  // Footer items — appended to footer
  if (bySection.footer) {
    html = injectFooterCulturalItems(html, bySection.footer, profile)
  }

  // Custom sections — generated and inserted before footer
  if (bySection.custom_section) {
    html = injectCustomCulturalSections(html, bySection.custom_section, profile)
  }

  return html
}
```

**Ceremony injection** — separate from content items:

```typescript
function buildEventCards(
  profile: CulturalProfile,
  themeJson: ThemeJSON
): string {
  const confirmedCeremonies = profile.ceremonies.filter(c => c.included)

  return confirmedCeremonies.map((ceremony, index) => `
    <div class="event-card reveal reveal-d${Math.min(index + 1, 3)}">
      <div class="event-number">${numberWord(index + 1)}</div>
      <h3 class="event-name">${ceremony.name}</h3>
      <div class="event-detail">
        <span class="event-detail-icon">🕐</span>
        <span>${ceremony.time ?? ceremony.date ?? "Time to be announced"}</span>
      </div>
      <div class="event-detail">
        <span class="event-detail-icon">📍</span>
        <span>${ceremony.venue ?? "Venue to be announced"}</span>
      </div>
    </div>
  `).join('\n')
}
```

---

#### `universalContent` — always available

Content items in `universalContent.items` are shown to ALL couples regardless of culture.
These are dress code, accommodation, transport, registry, children policy, unplugged ceremony.
Load them alongside the cultural content items in the configurator.
They use the same `FieldDefinition` structure and the same injection mechanism.

### How ceremonies work — default + sub-region + additional

```
hindu_indian default ceremonies:
  ✓ Mehendi
  ✓ Haldi
  ✓ Sangeet
  ✗ Baraat (optional)
  ✓ Wedding Ceremony (Pheras)
  ✓ Reception

Tamil sub-region overrides the pre-selection:
  ✓ Mehendi (Tamil default)
  ✓ Nischayathartham (Tamil default)
  ✓ Kashi Yatra (Tamil default — but optional)
  ✓ Oonjal (Tamil default)
  ✓ Maalai Maatral (Tamil default)
  ✓ Wedding Ceremony — Saptapadi (Tamil default)
  ✓ Reception (Tamil default)

Also shown unselected (from the default Indian list):
  ○ Haldi — not traditional Tamil but available
  ○ Sangeet — not traditional Tamil but available
  ○ Baraat — not traditional Tamil but available

Also shown unselected (Tamil-specific optional):
  ○ Gauri Puja
  ○ Sumangali Prarthana
  ○ Panda Kaal Muhurtham
```

The couple sees their correct ceremonies pre-selected.
Non-traditional-but-available ones are right there, just not ticked.
One click to add a Sangeet if they were inspired by Bollywood.

### The quiz step 2 — cultural configurator UI

```
Step 2 — alongside the first preview:

  "Tell us about your wedding traditions"

  Culture (multi-select — choose all that apply):
    ☐ Western / No specific tradition
    ☐ Hindu — Indian  →  Sub-region: [Punjabi / Gujarati /
                          Bengali / Tamil / Marathi / Telugu /
                          Kannada / Kerala / Marwari / Jain / Other]
    ☐ Sikh
    ☐ Muslim          →  Sub-region: [South Asian / Arab / West African]
    ☐ Chinese
    ☐ Jewish
    ☐ Nigerian — Yoruba
    ☐ Nigerian — Igbo
    ☐ Latin American / Catholic
    ☐ Other (free text)

  After selection, system shows the configurator:

  ┌─────────────────────────────────────────┐
  │  YOUR CONTENT                           │
  │                                         │
  │  ✓ Religious opening (Ganesh)   [ × ]  │
  │  ✓ Bride's parents names        [ × ]  │
  │  ✓ Groom's parents names        [ × ]  │
  │  ○ Grandparents names           [ + ]  │
  │  ○ Auspicious Muhurat time      [ + ]  │
  │                                         │
  │  YOUR CEREMONIES                        │
  │                                         │
  │  ✓ Mehendi                      [ × ]  │
  │  ✓ Nischayathartham             [ × ]  │
  │  ✓ Wedding Ceremony (Saptapadi) [ × ]  │
  │  ✓ Reception                    [ × ]  │
  │                                         │
  │  Also available:                        │
  │  ○ Haldi   ○ Sangeet   ○ Baraat        │
  │  ○ Kashi Yatra   ○ Gauri Puja          │
  │                                         │
  │  [ Looks right — continue ]             │
  └─────────────────────────────────────────┘
```

### Interfaith / multi-culture weddings

Couple selects multiple cultures. System shows merged list.
Conflicts are surfaced — not silently resolved.

```
Couple selects: Hindu + Muslim

System shows:
  Content:
    ✓ Bismillah opening (Muslim)     [ × ]
    ✓ Ganesh invocation (Hindu)      [ × ]
    ⚠ Both religious openings selected
      [Keep both]  [Keep one: Muslim ▾]

  Ceremonies (merged):
    ✓ Mehendi
    ✓ Nikah
    ✓ Sangeet
    ✓ Hindu Wedding Ceremony
    ✓ Walima / Reception
```

The couple decides. The system surfaces conflicts, never resolves them silently.

### Section placements — who decides what goes where

Three levels of ownership:

```
YOU (the cultural content library) decide:
  WHICH section type each cultural element belongs to
  hero_eyebrow / hero_names_area / events / faq / custom_section / footer
  This is defined once, culturally informed, does not change per generation

AI decides:
  How to style each element within its section
  What copy to generate for text fields
  How to make it coherent with the whole design

Couple decides:
  Which cultural elements to include or exclude
  The actual values (parents names, ceremony times etc)
  Whether to keep or remove any pre-selected element
```

### Section type reference

| Section type | What goes there |
|-------------|----------------|
| `hero_eyebrow` | Religious opening, 囍, ב׳ס׳ד׳, Bismillah, Ik Onkar |
| `hero_names_area` | Parents names, both families, grandparents |
| `hero_date_area` | Muhurat time, Hijri date, Hebrew date, lunar date |
| `hero_cta_area` | Chuppah time (Jewish — must be prominent near RSVP button) |
| `events` | Every ceremony as an event card |
| `faq` | Dress code, Gurdwara guidance, Ketubah note, tea ceremony note |
| `custom_section` | Aso-ebi (Nigerian), Padrinos (Latin American) |
| `footer` | Grandparents names, closing dua (Muslim) |

### Events section is now dynamic

Because culture drives ceremonies, the events section is no longer 3 fixed slots.
The renderer builds event cards from the confirmed ceremony list.

```
Western:     2 events  (ceremony + reception)
Hindu:       5–7 events depending on sub-region
Muslim:      2–3 events (nikah + optional mehndi + walima)
Nigerian:    3 events  (traditional + church + reception)
Jewish:      2–3 events
Chinese:     2–3 events (optional tea ceremony + wedding + banquet)
```

**Skeleton change:** The events section uses `{{EVENTS_CARDS}}` as a single placeholder.
The renderer loops through `culturalProfile.ceremonies` and builds each card.
No hardcoded EVENT_1 through EVENT_3 limit.

```html
<!-- Events section — renderer injects dynamically -->
<section class="events" id="events">
  <div class="events-inner">
    <p class="events-eyebrow reveal">{{EVENTS_EYEBROW}}</p>
    <h2 class="events-heading reveal reveal-d1">{{EVENTS_HEADING}}</h2>
    <div class="events-grid">
      {{EVENTS_CARDS}}
    </div>
  </div>
</section>
```

Maximum 6 ceremony slots. Skeleton CSS supports up to 6 auto-fit cards.

---

## 27. Tag Taxonomy — Vibe Context Only

**Tags no longer drive layout selection.** That is now handled by the style card (Section 25).

Tags are still generated from quiz answers and used as vibe context in AI prompts.
They help Call 2 and Call 3 understand the couple's aesthetic intent.

### Tags are generated from

```
1. Style card choice → primary tag source
2. Vibe words (3 words typed by couple)
3. Cultural profile (cultural tags — inform tone)
```

### Tags are used in

```
Call 2 prompt: as supplementary vibe context for design token generation
Call 3 prompt: as supplementary vibe context for hero generation

NOT used for: layout selection (style card handles this)
```

### Style card → tags

| Style card | Tags |
|-----------|------|
| Modern Minimalist | modern, clean, minimal, airy, contemporary, western |
| Romantic Traditional | romantic, warm, traditional, classic, intimate, elegant |
| Bohemian Garden | bohemian, natural, earthy, organic, garden, whimsical |
| Grand Celebration | grand, celebratory, ornate, luxury, multi-event, rich, dramatic |
| Destination Glamour | destination, dramatic, luxury, editorial, bold |
| Editorial Bold | editorial, bold, asymmetric, contemporary, dramatic |
| Elegant Minimal | minimal, elegant, refined, clean, soft |

### Vibe word → tags dictionary

The vibe field is 3 words. Each word mapped against a lookup dictionary.

```typescript
const VIBE_TAG_MAP: Record<string, string[]> = {
  "romantic":    ["romantic", "warm", "traditional", "elegant"],
  "intimate":    ["romantic", "intimate", "warm"],
  "grand":       ["grand", "ornate", "luxury", "celebratory"],
  "lavish":      ["luxury", "grand", "ornate"],
  "luxurious":   ["luxury", "grand", "elegant"],
  "festive":     ["celebratory", "grand", "warm"],
  "vibrant":     ["celebratory", "bold", "warm"],
  "modern":      ["modern", "clean", "contemporary", "minimal"],
  "clean":       ["clean", "minimal", "modern", "airy"],
  "minimal":     ["minimal", "clean", "modern", "airy"],
  "simple":      ["simple", "clean", "minimal", "airy"],
  "sleek":       ["modern", "clean", "contemporary", "editorial"],
  "bold":        ["bold", "editorial", "dramatic", "contemporary"],
  "dramatic":    ["dramatic", "editorial", "bold", "destination"],
  "elegant":     ["elegant", "traditional", "classic", "soft"],
  "classic":     ["classic", "traditional", "elegant"],
  "timeless":    ["classic", "traditional", "elegant"],
  "natural":     ["natural", "bohemian", "earthy", "organic"],
  "rustic":      ["earthy", "natural", "bohemian", "organic"],
  "bohemian":    ["bohemian", "natural", "whimsical", "organic"],
  "boho":        ["bohemian", "natural", "whimsical"],
  "whimsical":   ["whimsical", "bohemian", "natural", "soft"],
  "glamorous":   ["destination", "luxury", "dramatic", "bold"],
  "destination": ["destination", "dramatic", "luxury", "editorial"],
  "cinematic":   ["dramatic", "editorial", "bold"],
  "desi":        ["south-asian", "grand", "indian", "celebratory"],
  "indian":      ["south-asian", "indian", "grand", "celebratory"],
  // ... approximately 50 words total
}
```

Unknown words are silently ignored. Does not affect layout selection.

---

## 28. Step 1 Generation Contract — The 2-Minute Promise

### What "2 minutes" means and does not mean

```
✓ WHAT IT MEANS:
  Couple sees their names on a beautiful, styled, coherent
  wedding website within 2 minutes of arriving.
  The WOW moment happens in 2 minutes.
  Good enough to share with close friends immediately.

✗ WHAT IT DOES NOT MEAN:
  The site is 100% complete and ready to publish.
  Every section has their real content.
  Photos are uploaded.
  Their story has been written.
```

This distinction is honest and communicated clearly in the UI via a completion indicator.

### What step 1 generation produces

| Section | What is generated | Quality |
|---------|------------------|---------|
| Nav | Styled with their monogram | ✓ Real |
| Hero | Full AI creative — names, date, venue, countdown | ✓ Real WOW |
| Story | AI-written beautiful placeholder copy | ◐ Placeholder — good quality |
| Events | Cards from cultural profile ceremonies if culture known, placeholders otherwise | ◐ Partial |
| RSVP | Fully functional — ready for guest submissions | ✓ Real |
| Gallery | 6 styled placeholder cells in couple's color palette | ◐ Placeholder — looks intentional |
| FAQ | 6 AI-generated items based on venue + date + culture | ◐ Placeholder — useful |
| Footer | Their names, date, venue | ✓ Real |

### Placeholder copy quality standard

AI placeholder copy must be beautiful, not obviously placeholder.
References their names. Fits their style and cultural context.
Never uses `[INSERT]` style markers.
Gets replaced when couple adds real content — but works fine if they never do.

**Example for Priya & Arjun (Hindu, Grand Celebration layout):**

```
STORY_EYEBROW: "Our Story"
STORY_SCRIPT_TITLE: "A love story"
STORY_HEADING: "Written in <em>the stars</em>"
STORY_P1: "Every great love story has a moment — a single unremarkable
           instant that turns out to be the beginning of everything.
           For Priya and Arjun, that moment arrived quietly, the way
           the best things always do."
STORY_QUOTE: "Some connections feel less like a beginning and more
              like a return to somewhere you always belonged."
```

### Gallery placeholder treatment

```
Each gallery cell:
  Background: couple's accent color at 8% opacity on their primary bg
  Border: accent color at 20% opacity
  Center: couple's monogram in display font at 15% opacity

Looks like a curated photo grid — not a broken empty grid.
Caption: "Your photos will appear here. Upload anytime from your dashboard."
```

### Completion indicator UI

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Your site is coming together

  ████████████████░░░░  70%

  ✓ Names and date
  ✓ Visual design and layout
  ✓ RSVP form (ready for guests)
  ✓ Ceremonies (from your cultural profile)
  ◐ Your story         → [Tell us your story]
  ◐ Family details     → [Add parents names]
  ○ Photos             → [Upload when ready]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### What triggers regeneration in step 2

| Content added | Regenerates | AI calls |
|--------------|-------------|----------|
| Style card selected | Layout + design tokens | Calls 1+2+3 if layout changes, Calls 2+3 if same |
| Vibe words entered | Design tokens refined | Calls 2+3 |
| Culture selected | Layout suggestion + ceremonies | Call 1 suggestion, then Calls 2+3 |
| Story written | Content injected only | No AI call — direct injection |
| Events updated | Content injected only | No AI call — direct injection |
| Parents names | Content injected only | No AI call — direct injection |

Story text, parents names, and event details never trigger design regeneration.
Only style and culture signals affect the design.

---

## 29. RSVP Form — Data-Driven Configuration

### The problem with a hardcoded form

A hardcoded form capped at 4 guests with no event selection breaks for:
- A Gujarati family of 8 RSVPing for Mehendi + Wedding + Reception separately
- A Nigerian family confirming Traditional ceremony only, not Church
- Any Layout 3 couple — the layout's whole pitch is multi-event South Asian

**The fix:** RSVP form fields are built at render time from `rsvp_config` JSONB.

### RSVP config stored in DB

```typescript
interface RSVPConfig {
  guestCountEnabled: boolean      // default: true
  guestCountMax: number           // default: 10 (not 4)
  childrenSeparate: boolean       // default: false
  childrenMax: number             // default: 5
  plusOneEnabled: boolean         // default: false
  eventSelectionEnabled: boolean  // default: true if 2+ events
  mealChoiceEnabled: boolean      // default: false
  mealOptions: string[]
  dietaryEnabled: boolean         // default: true
  messageEnabled: boolean         // default: true
  songRequestEnabled: boolean     // default: false
}
```

### Smart defaults per cultural profile

| Cultural profile | RSVP defaults |
|-----------------|--------------|
| Hindu (any sub-region) | guestCountMax: 10, childrenSeparate: true, eventSelectionEnabled: true |
| Muslim | eventSelectionEnabled: true (Nikah + Walima separate) |
| Jewish | eventSelectionEnabled: true (Chuppah critical) |
| Nigerian | guestCountMax: 10, eventSelectionEnabled: true |
| Chinese | guestCountMax: 8, mealChoiceEnabled: true |
| Western (1 event) | guestCountMax: 4 |

These are defaults only — couples override everything in the dashboard.

### Updated rsvps DB table

```sql
CREATE TABLE rsvps (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id        UUID REFERENCES couples(id) ON DELETE CASCADE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  attending        BOOLEAN NOT NULL,
  guest_count      INTEGER DEFAULT 1,
  children_count   INTEGER DEFAULT 0,
  plus_one_name    TEXT,
  events_attending TEXT[],           -- array of ceremony IDs
  meal_choice      TEXT,
  dietary          TEXT,
  song_request     TEXT,
  message          TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

---

## 30. Chat Editing — Content Picker and Element Picker

### Overview

The chat box handles all types of edits. The classifier routes them correctly.
Content picker and element picker are targeting aids — they add context to chat messages
to reduce ambiguity. Both are optional. AI handles intent from text alone without them.

### Content picker — what it is

Couple clicks on text content in the preview iframe. That content field
is added as context to the next chat message.

```
Without content picker:
  Couple types: "rewrite this"
  AI does not know what "this" refers to

With content picker:
  Couple clicks on the story quote in preview
  Context chip appears: [ Story quote × ]
  Couple types: "make this feel more intimate"
  AI knows exactly: rewrite STORY_QUOTE
  Returns new STORY_QUOTE value only
  Direct injection — no design regeneration
```

**This is a Phase 1 feature.** It is simple, high value, and directly useful.

**Technical mechanism:**
- Preview iframe has a click listener when in edit mode
- Click on any text element → captures the placeholder key (e.g. `STORY_QUOTE`)
- Posts to parent dashboard via postMessage
- Dashboard shows context chip above chat input: `[ Story quote × ]`
- Couple clicks X to remove from context
- On send: instruction + placeholder key sent to AI
- AI rewrites that specific field only

**Content changes always do two things:**
1. Update `theme_json.content` in Supabase (source of truth)
2. Re-inject into live HTML (preview reloads)
   Both must happen together. If only HTML is updated, the next full rebuild loses the change.

### Element picker — CSS element targeting

Couple clicks on a visual element (not just text) to add it as context.
Targets specific CSS changes to one element rather than triggering a full redesign.

**Honest advice on when this is useful:**
Most couple edit requests are either global ("more romantic") or clear enough
that AI understands from text alone. The element picker is highest value
when couples have a very specific precise request about one element — probably
20% of edit interactions.

**This is a Phase 2 feature.** Build text chat and content picker first.
Add element picker after beta — based on whether couples actually struggle
with ambiguity in practice.

**Technical mechanism when built:**

```
Dashboard has: [ 🔍 Inspect ] button (no edit mode toggle needed)

On click:
  Button highlights — inspect mode active
  Iframe gets overlay intercepting mouse events

On hover over element:
  Dashed rectangular border around element (accent color)
  Small tooltip: "Event card" / "Story heading" / "Hero names"

On click:
  Element selector added to chat context
  Chip above input: [ Event card × ]
  Multiple elements can be selected
  X removes element from context

On send:
  Instruction + selected selectors sent to classifier and AI
  Inspect mode deactivates
  Context cleared

After send:
  AI returns targeted CSS update for that selector only
  Merged into theme_json — only that key changes
  Faster, cheaper, more precise than full regeneration
```

**Element label map (human-readable names for selectors):**

```typescript
const ELEMENT_LABELS: Record<string, string> = {
  ".hero-names":      "Hero names",
  ".hero-tagline":    "Hero tagline",
  ".hero-cta":        "RSVP button",
  ".story-heading":   "Story heading",
  ".story-quote":     "Story quote",
  ".story-eyebrow":   "Story label",
  ".event-card":      "Event card",
  ".event-name":      "Event name",
  ".rsvp-heading":    "RSVP heading",
  ".rsvp-submit":     "Submit button",
  ".faq-question":    "FAQ question",
  ".footer-names":    "Footer names",
  ".footer-tagline":  "Footer tagline",
  "nav":              "Navigation",
  ".nav-monogram":    "Monogram",
}
```

**Hero elements vs skeleton elements:**
Hero HTML has its own embedded `<style>` block — not in `theme_json`.
Clicking a hero element triggers Call 3 (hero regeneration with the instruction).
Clicking a skeleton element triggers a targeted CSS update to `theme_json`.
The element picker handles both paths.

### AI still handles intent without the picker

```
"Make the story quote stand out more"
  → No element selected
  → Classifier: type = "design"
  → AI infers from "story quote" → updates .story-quote in CSS JSON
  → Works fine without picker

"Make THIS stand out more" [with .story-quote selected]
  → AI has exact element + instruction
  → More precise, same outcome

Both paths work.
Picker removes ambiguity when couples want to be specific.
```

### All edits update Supabase and HTML together

This applies to all edit types — data, content, design, hero:

```
Data edit:
  1. Update couples table field
  2. Re-inject structured data into HTML
  3. Save to storage

Content edit:
  1. Update theme_json.content in Supabase
  2. Re-inject content into HTML
  3. Save to storage

Design edit:
  1. Run Call 2 → new theme_json
  2. Run Call 3 → new hero_html
  3. Rebuild full HTML
  4. Save all to Supabase + Storage
  5. Create version row
```

If only one side is updated, the next full rebuild loses the change.
Always update the source of truth (Supabase) AND the live HTML together.

---

## 31. Post-Wedding Lifecycle

### The gap

VeeInvite v1 is a pre-wedding product. After the wedding date passes — nothing is defined.
The most emotionally valuable moments for photo sharing and guest revisit happen post-wedding.

### v1 — two fixes required, everything else deferred

**Fix 1 — Countdown timer must not show zeros after the wedding date.**

This is a visible bug. Costs 10 lines of JavaScript in the skeleton.
Fix in Phase 1 (skeleton build).

```javascript
function tick() {
  const diff = new Date('{{COUNTDOWN_TARGET}}') - new Date()
  if (diff <= 0) {
    // Wedding has passed
    document.querySelector('.hero-countdown')?.style.display = 'none'
    // Or show a celebratory state
    return
  }
  // Normal countdown
}
```

**Fix 2 — DB schema ready for future post-wedding status.**

Do not build the feature now. But leave the door open.

```sql
-- For v2 — do not implement in v1
-- wedding_status: 'upcoming' | 'post_wedding' | 'archived'
-- Derive from wedding_date comparison in v1
-- Add as a real column in v2
```

### v2+ post-wedding features (backlog)

```
VI-FUTURE-010  Post-wedding gallery
  Couple uploads professional photos
  Gallery fills — guests notified

VI-FUTURE-011  Thank-you page
  Auto-generate thank-you message after wedding date
  Email to each RSVP guest

VI-FUTURE-012  Memory mode
  Site transitions from invitation to memory
  "We got married" hero state
  Gallery becomes the focus
  RSVP replaced with guest book

VI-FUTURE-013  Anniversary reminder
  Email to couple 1 year after wedding
  Re-engagement touchpoint
```

---

---

## 32. Growth Mechanics

### The problem

M2 targets 50 paying couples and £1,000 in month one.
The plan does not explain how couples find VeeInvite.
Without in-product growth hooks, the product ships into a vacuum.

This section defines the in-product mechanics only — not a full marketing plan.

---

### Hook 1 — "Powered by VeeInvite" footer attribution (M3, VI-F028)

Every published wedding site has a small footer line:

```
Made with VeeInvite
```

This is a hyperlink to VeeInvite's landing page.
Every guest who visits a wedding site is a potential future couple.
Wedding guests are statistically likely to be getting married themselves in the next 2 years.

**Implementation:**
- Added as the last line of every generated footer
- Styled to match the site's muted footer text — not intrusive
- Couple cannot remove it on the free tier
- Couple can optionally remove it on a paid upgrade (M3 premium feature)
- Link goes to `veeinvite.com` with UTM parameters tracking the source site

---

### Hook 2 — Guest-to-creator CTA on every wedding site (M3, VI-F029)

When a guest visits `/w/[slug]` and successfully submits their RSVP, they see:

```
Thank you, your RSVP is confirmed.

💌 Want a wedding website as beautiful as this one?
   Create yours in under 2 minutes — free.
   [ Create my site ]
```

This is the most powerful conversion moment.
The guest has just experienced the product as a user.
They know it works, they found it beautiful, and they may be getting married themselves.

**Implementation:**
- Shown in the RSVP success state — not before submission
- Links to VeeInvite with UTM `source=guest_rsvp&site=[slug]`
- Tracks which wedding sites drive the most new signups
- Never shown before RSVP is submitted — not distracting, not pushy

---

### Hook 3 — Sharable preview before signup (M1)

Couples can share a preview link before they publish.

```
Your site is ready to preview.
Share this link with your partner or family:
veeinvite.com/preview/[token]

The preview expires in 7 days.
Publish your site to make it permanent.
```

The preview is read-only — RSVP is disabled.
Visitors see the site and the "Create yours" CTA.
This lets couples share the product virally even before they pay.

**Implementation:**
- Preview tokens are generated when step 2 is complete
- Stored in DB with 7-day expiry
- `/preview/[token]` serves the site HTML with RSVP form replaced by signup CTA
- Token expires on publish (permanent URL takes over)

---

### Hook 4 — Culture-aware SEO landing pages (M3, VI-F030)

Wedding site builders are SEO goldmines.
Long-tail search terms are high-intent:

```
"Tamil wedding invitation website"
"Indian wedding website builder"
"Jewish wedding website with Chuppah"
"Nigerian wedding invitation site"
"Punjabi wedding website"
```

Each culture profile in the library corresponds to a landing page.
The page shows a real example site for that culture, explains what is included
(correct ceremony names, parents names, cultural opening), and converts to signup.

**Implementation:**
- One static landing page per culture in `cultural-content-library.json`
- URL pattern: `veeinvite.com/[culture]-wedding-website`
  e.g. `veeinvite.com/tamil-wedding-website`
  `veeinvite.com/jewish-wedding-website`
  `veeinvite.com/nigerian-wedding-website`
- Metadata describes culture-specific features (correct ceremony names, bilingual etc.)
- Links to signup with `culture=[id]` param pre-filled in quiz

---

### Growth loop summary

```
Guest visits wedding site
  → sees "Powered by VeeInvite"
  → RSVPs → sees "Create yours" CTA
  → signs up → creates site
  → their guests visit
  → loop repeats

Couple shares preview
  → family sees the site
  → some are getting married → sign up

SEO
  → high-intent search
  → culture-specific landing page
  → converts to signup with culture pre-filled
```

---

## 33. Bilingual Rendering

### The problem

The cultural content library defines Chinese, Muslim (Arabic), and Jewish (Hebrew) profiles.
All three commonly want bilingual invitations — English alongside the heritage language.
`copyGuardrails` covers tone but there is no spec for how bilingual text renders.

Without this, a Chinese couple gets English-only output despite picking "Chinese" culture,
and elders who read Chinese primarily get a worse experience.

### v1 architectural decision — accommodate, do not implement

**v1 does not render bilingual text.** Bilingual is a M2 feature.

But M1 skeletons must be built to accommodate it.
This means:
- No CSS that assumes all text is LTR
- No fixed-width text containers that would break when doubled
- A bilingual mode flag in `cultural_profile` that can be activated without skeleton changes

### What bilingual needs in v1 (architecture only)

**1. Flag in cultural profile:**

```typescript
interface CulturalProfile {
  // ... existing fields
  bilingualEnabled: boolean       // default false — activated in M2
  bilingualLanguage?: string      // "zh" | "ar" | "he"
  bilingualDirection?: "ltr" | "rtl"  // for Arabic and Hebrew
}
```

**2. Skeleton CSS must not break when bilingual is activated:**

```css
/* BAD — fixed width containers that break for double content */
.hero-names { max-width: 400px; }

/* GOOD — flexible containers */
.hero-names { max-width: 80%; text-align: center; }

/* Include RTL support from day one — costs nothing */
[dir="rtl"] .hero-names { direction: rtl; }
[dir="rtl"] .story-body { direction: rtl; }
```

**3. Hero HTML must use `{{PERSON1_NAME_BILINGUAL}}` placeholders (even if empty in v1):**

```
Bilingual placeholders — included in skeleton and hero from day one:
  {{PERSON1_NAME_BILINGUAL}}   — e.g. "惠玲" (empty string if not bilingual)
  {{PERSON2_NAME_BILINGUAL}}   — e.g. "建明"
  {{WEDDING_DATE_BILINGUAL}}   — e.g. "二〇二五年十一月十四日"
  {{VENUE_NAME_BILINGUAL}}     — e.g. "瑰麗酒店"
```

In v1 these resolve to empty strings — no visible change.
In M2 they are populated from `cultural_profile.bilingualFields`.

### What bilingual looks like in M2

**Desktop layout:**

```
Two columns — LTR language left, heritage language right:

  Emma & James              艾美 & 詹姆士
  Saturday, 14 June 2025    二〇二五年六月十四日
  The Ritz, London          倫敦麗茲酒店
```

**Mobile layout:**

```
Stacked — primary language first, heritage language below in smaller text:

  Emma & James
  艾美 & 詹姆士

  Saturday, 14 June 2025
  二〇二五年六月十四日
```

**RTL (Arabic, Hebrew) — right column is the primary language:**

```
Desktop:

  إيما وجيمس              Emma & James
  السبت، ١٤ يونيو ٢٠٢٥    Saturday, 14 June 2025
```

### Font loading for non-Latin scripts

Non-Latin scripts require specific font families.
The approved font list in Section 10 must be extended in M2:

```
Chinese:  "Noto Serif SC" (Simplified), "Noto Serif TC" (Traditional)
Arabic:   "Noto Naskh Arabic", "Scheherazade New"
Hebrew:   "Frank Ruhl Libre", "Heebo"
Devanagari (future): "Noto Serif Devanagari"
```

These are Google Fonts — use the same font loading mechanism already in place.
The validator must accept these fonts when `bilingualEnabled` is true.

### The v1 commit

**Before Phase 1 skeleton build:**
- Add bilingual CSS variables to every skeleton (no visual effect yet)
- Add `[dir="rtl"]` CSS overrides to every skeleton
- Add bilingual placeholder tokens to skeleton and hero (resolve to empty in v1)
- Add `bilingualEnabled: false` to `CulturalProfile` interface

**This costs 2 hours in Phase 1 and saves a skeleton rewrite in M2.**

---

*This document represents all confirmed product and architecture decisions.*
*Last updated: all six documentation contradictions fixed, photo upload moved to M1, growth mechanics added (Sec 32), bilingual rendering spec added (Sec 33).*
*Any deviation must be recorded in `docs/DECISIONS.md` with full reasoning.*