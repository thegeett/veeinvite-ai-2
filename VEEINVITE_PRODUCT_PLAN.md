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
12. [AI Chat Refinement](#12-ai-chat-refinement)
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

#### Layout 3 — South Asian Grand
```json
{
  "id": "layout-3",
  "name": "South Asian Grand",
  "description": "Full-width centered story (no photo column), generous event grid for 3 large events, centered RSVP with ornamental spacing, asymmetric editorial gallery.",
  "tags": ["south-asian", "grand", "celebratory", "ornate", "luxury", "multi-event", "rich", "dramatic", "indian", "desi"],
  "antiTags": ["minimal", "simple"],
  "bestFor": "Multi-event celebrations or couples who want a grand, rich aesthetic"
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

### RSVP form — identical in all 4 skeletons

Hardcoded. AI never generates or modifies its structure.

```html
<section class="rsvp" id="rsvp">
  <div class="rsvp-inner">
    <p class="rsvp-eyebrow reveal">{{RSVP_EYEBROW}}</p>
    <h2 class="rsvp-heading reveal reveal-d1">{{RSVP_HEADING}}</h2>
    <p class="rsvp-sub reveal reveal-d2">{{RSVP_SUB}}</p>

    <form id="rsvp-form" class="rsvp-form reveal reveal-d3">
      <input type="hidden" name="slug" value="{{SLUG}}">
      <div class="form-row">
        <div class="form-field">
          <label>First name</label>
          <input type="text" name="firstName" required>
        </div>
        <div class="form-field">
          <label>Last name</label>
          <input type="text" name="lastName" required>
        </div>
      </div>
      <div class="form-field">
        <label>Email address</label>
        <input type="email" name="email" required>
      </div>
      <div class="form-field">
        <label>Will you be attending?</label>
        <div class="rsvp-options">
          <div class="rsvp-option">
            <input type="radio" name="attending"
                   id="attending-yes" value="yes" required>
            <label for="attending-yes">{{RSVP_ACCEPT_LABEL}}</label>
          </div>
          <div class="rsvp-option">
            <input type="radio" name="attending"
                   id="attending-no" value="no">
            <label for="attending-no">{{RSVP_DECLINE_LABEL}}</label>
          </div>
        </div>
      </div>
      <div class="form-field">
        <label>Number of guests (including yourself)</label>
        <select name="guestCount">
          <option value="1">1 guest</option>
          <option value="2">2 guests</option>
          <option value="3">3 guests</option>
          <option value="4">4 guests</option>
        </select>
      </div>
      <div class="form-field">
        <label>Dietary requirements (optional)</label>
        <input type="text" name="dietary">
      </div>
      <div class="form-field">
        <label>Message for the couple (optional)</label>
        <textarea name="message" rows="3"></textarea>
      </div>
      <button type="submit" class="rsvp-submit">{{RSVP_SUBMIT_LABEL}}</button>
    </form>

    <div id="rsvp-success" class="rsvp-success" style="display:none">
      <h3 class="rsvp-success-title">{{RSVP_SUCCESS_TITLE}}</h3>
      <p class="rsvp-success-message">{{RSVP_SUCCESS_MESSAGE}}</p>
    </div>
  </div>
</section>
```

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
  {{EVENT_1_NUMBER}}  {{EVENT_1_NAME}}  {{EVENT_1_TIME}}  {{EVENT_1_VENUE}}
  {{EVENT_2_NUMBER}}  {{EVENT_2_NAME}}  {{EVENT_2_TIME}}  {{EVENT_2_VENUE}}
  {{EVENT_3_NUMBER}}  {{EVENT_3_NAME}}  {{EVENT_3_TIME}}  {{EVENT_3_VENUE}}
  {{MAP_LINK_LABEL}}

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

**Maximum 3 events across all layouts. EVENT_1 through EVENT_3 only.**

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

### Layout 3 — South Asian Grand: structural differences

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
    "EVENT_1_NUMBER": "", "EVENT_1_NAME": "",
    "EVENT_2_NUMBER": "", "EVENT_2_NAME": "",
    "EVENT_3_NUMBER": "", "EVENT_3_NAME": "",
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

## 12. AI Chat Refinement

### Instruction classification

| Message | Type | Calls | Preserved |
|---------|------|-------|-----------|
| "Make it more romantic" | Design | Call 2 only | Layout, hero |
| "Change the hero to darker" | Hero | Call 3 only | Layout, tokens |
| "Make the whole site lighter" | Global | Calls 2 + 3 | Layout only |
| "Change our names to Meera & Raj" | Data | None | Everything |
| "Add a section about our dog" | New section | Custom call | Everything |

### Design summary prevents drift

After every Call 2, store a `design_summary`:
```
"Dark midnight and deep plum backgrounds with rose gold accents throughout.
Great Vibes display font with Cormorant Garamond headings and ultra-light Jost.
Romantic South Asian aesthetic — celebratory but intimate."
```

Use `design_summary` in edit prompts — not the raw `style_history` array.

### Suggested prompts (show as chips in UI)

- "Make it more romantic"
- "Use a lighter colour palette"
- "Add gold accents"
- "Make the fonts more elegant"
- "Try a darker theme"
- "Make it feel more modern"

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
| VI-F002 | Layout selection with tag matching | CRITICAL |
| VI-F003 | Full site design with globalTokens + coherence | CRITICAL |
| VI-F004 | Hero generation using globalTokens constraints | CRITICAL |
| VI-F005 | Renderer — full assembly pipeline | CRITICAL |
| VI-F006 | 4 layout skeletons with meta.json | CRITICAL |
| VI-F007 | Dashboard preview with mobile/desktop toggle | CRITICAL |
| VI-F008 | AI chat with instruction classification | CRITICAL |
| VI-F009 | Direct data editing — no AI call | CRITICAL |
| VI-F010 | "Your designs" version history with restore | HIGH |
| VI-F011 | Layout switcher — reuses existing tokens | HIGH |
| VI-F012 | RSVP guest submission | CRITICAL |
| VI-F013 | RSVP couple dashboard with CSV export | HIGH |
| VI-F014 | Public site `/w/[slug]` | CRITICAL |
| VI-F015 | Auth + middleware | CRITICAL |
| VI-F016 | Landing page | HIGH |

### Milestone 2 — Paid Launch

| ID | Feature | Priority |
|----|---------|----------|
| VI-F017 | Stripe payment at publish | CRITICAL |
| VI-F018 | Pricing transparency | HIGH |
| VI-F019 | Publish moment + share buttons | HIGH |
| VI-F020 | Custom sections UI | HIGH |
| VI-F021 | Calendar save + directions | MEDIUM |
| VI-F022 | RSVP email notification | HIGH |
| VI-F023 | Design summary anti-drift | HIGH |

### Milestone 3 — Growth

| ID | Feature | Priority |
|----|---------|----------|
| VI-F024 | Guest list + who hasn't responded | HIGH |
| VI-F025 | "Powered by VeeInvite" footer | CRITICAL |
| VI-F026 | Photo gallery upload | HIGH |
| VI-F027 | 5th and 6th layout | MEDIUM |
| VI-F028 | Custom domain | LOW |

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
  style            TEXT,
  vibe             TEXT,
  story            TEXT,
  cultural_context TEXT,
  layout_id        TEXT,
  global_tokens    JSONB,
  theme_json       JSONB,
  hero_html        TEXT,
  design_summary   TEXT,
  custom_sections  JSONB DEFAULT '[]',
  site_html_url    TEXT,
  is_published     BOOLEAN DEFAULT false,
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
);

CREATE TABLE rsvps (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id   UUID REFERENCES couples(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  attending   BOOLEAN NOT NULL,
  guest_count INTEGER DEFAULT 1,
  dietary     TEXT,
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
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

*This document represents all confirmed product and architecture decisions.*
*Last updated: after full PM review with all three decisions confirmed.*
*Any deviation must be recorded in `docs/DECISIONS.md` with full reasoning.*
