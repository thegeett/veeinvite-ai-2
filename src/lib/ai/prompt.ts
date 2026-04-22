import type { CoupleData, ThemeJSON, WeddingEvent } from '../types';

const GLOSSARY = `
DESIGN TOKEN GLOSSARY — purpose of every class the AI may style.

nav                — Sticky top bar. Subtle frame, never distracting.
.nav-monogram      — Couple's initials. Elegant brand mark.
.nav-links         — Anchor links. Small, spaced, uppercase.
.nav-link          — Individual anchor. Subtle hover state.

.hero              — Full viewport. Sets entire emotional tone.
.hero-content      — Container for hero text, sits above particle canvas.
.hero-ornament     — Small decorative element above names.
.hero-names        — THE most important element. Large, beautiful,
                     emotionally impactful. What guests remember.
.hero-name-1       — Equal visual weight with .hero-name-2.
.hero-name-2       — Equal visual weight with .hero-name-1.
.hero-connector    — Connector between names. MUST be smaller and
                     more delicate than the names themselves. Connects,
                     does not compete. Usually italic, softer colour.
.hero-tagline      — One romantic line beneath names. A whisper after
                     the names shout.
.hero-divider      — Thin decorative line. Punctuation.
.hero-date-wrap    — Container for date and venue.
.hero-date         — Wedding date. Prominent, secondary to the names.
.hero-venue        — Venue name + city. More muted than the date.
.hero-countdown    — Wraps the four countdown items.
.countdown-item    — Individual countdown cell.
.countdown-num     — Large number. Focal point. Grand.
.countdown-label   — Label (DAYS / HRS). Very small, muted, uppercase.
.hero-cta          — RSVP button. MUST be clearly clickable. This is
                     the primary call-to-action on the whole site.
.hero-scroll-hint  — Very subtle scroll indicator.
.scroll-mouse      — Little mouse icon. Treat as a small decorative dot.
.scroll-text       — Tiny label beneath the mouse.
#particle-canvas   — Background canvas in the hero. Do not style size.

.story             — Section background. Breathing room from hero.
.story-grid        — Grid wrapper. Do not touch.
.story-photo-wrap  — Photo frame treatment (border, shadow, radius).
.story-photo-placeholder — Styling for the placeholder text.
.story-text        — Right-column text stack.
.story-eyebrow     — Tiny uppercase label. Accent colour.
.story-script      — Decorative cursive. Soft, romantic, lower weight.
.story-heading     — Strong but elegant section heading.
.story-body        — Body copy paragraphs.
.story-quote       — Intimate blockquote. Left border in accent colour.
                     Italic. A highlight moment.

.events            — Section background. Creates visual rhythm.
.events-inner      — Content wrapper.
.events-header     — Header row (eyebrow + heading).
.events-eyebrow    — Tiny uppercase label.
.events-heading    — Section heading.
.events-grid       — Grid of event cards. Do not touch layout.
.event-card        — One card per event. Refined, elegant. Subtle
                     background. Gentle hover state recommended.
.event-number      — Large display font. Very low opacity — watermark
                     effect, never the focus.
.event-name        — Event title. Guests read this first.
.event-detail      — Time / venue rows.
.event-detail-icon — Tiny leading icon.
.events-map-link   — CTA-style link at bottom.

.rsvp              — Often a dark panel. Dedicated moment in the page.
.rsvp-inner        — Content wrapper.
.rsvp-eyebrow      — Tiny uppercase label.
.rsvp-heading      — Warm, inviting. Personal ask.
.rsvp-sub          — Supporting copy.
.rsvp-form         — Form wrapper.
.form-row          — Row wrapper. Do not touch layout.
.form-field        — Field wrapper. Label + input stacked.
.form-field label  — Tiny uppercase label, muted.
.form-field input, .form-field select, .form-field textarea
                   — Match site personality. Same treatment across all
                     fields. Do NOT leave them as default browser elements.
.rsvp-options      — Accept / decline radio tiles.
.rsvp-option       — Wrapper for one radio + label pair.
.rsvp-option input:checked + label
                   — Accent colour, clear visual feedback when selected.
.rsvp-submit       — Prominent. Warm. The final meaningful act on the page.
#rsvp-success      — Thank-you block after submission.
.rsvp-success-title, .rsvp-success-message — typography only.

.gallery           — Section background.
.gallery-header    — Header row.
.gallery-eyebrow   — Tiny uppercase label.
.gallery-heading   — Section heading.
.gallery-sub       — Short supporting line.
.gallery-grid      — Grid layout. Do not touch layout.
.gallery-item      — Individual tile.
.gallery-placeholder — Placeholder styling for empty tiles.

.faq               — Section background.
.faq-inner         — Content wrapper.
.faq-heading       — Section heading.
.faq-list          — List wrapper.
.faq-item          — Individual Q&A row.
.faq-question      — Question button. Tap-friendly.
.faq-answer        — Answer block. Padding and colour only — do not
                     change the accordion animation.
.faq-icon          — Plus / cross indicator.

footer             — Gentle warm closing.
.footer-names      — Names in display font. Large, romantic. Softer
                     than the hero — a final echo.
.footer-info       — Date and venue beneath the names.
.footer-tagline    — Very small. Very muted. The last whisper.

VISUAL HIERARCHY (most → least important):
  1. .hero-names
  2. .hero-cta
  3. .countdown-num
  4. Section headings (.story-heading, .events-heading, .rsvp-heading, .gallery-heading, .faq-heading)
  5. .event-name, .story-quote
  6. Body text, labels
  7. .hero-connector, .countdown-label, .footer-tagline
`;

const JSON_TEMPLATE = `{
  "styles": {
    ".hero": { "background": "...", "color": "..." },
    ".hero-names": { "color": "...", "font-family": "'Great Vibes', cursive", "font-size": "clamp(4rem, 14vw, 9rem)" }
    // ...every selector from the glossary that you want to style
  },
  "fonts": ["Great Vibes", "Cormorant+Garamond:ital,wght@0,300;0,400;1,300"],
  "particles": {
    "effect": "petals",      // one of: none, petals, snow, fireflies, sparkles
    "colors": ["rgba(196,96,122,.7)", "rgba(212,168,83,.5)"],
    "count": 28,             // 0..30
    "opacity": 0.55          // 0..0.7
  },
  "content": {
    "TAGLINE": "...",
    "CTA_LABEL": "...",
    "STORY_EYEBROW": "...",
    "STORY_SCRIPT_TITLE": "...",
    "STORY_HEADING": "...",
    "STORY_P1": "...",
    "STORY_QUOTE": "...",
    "STORY_P2": "...",
    "EVENTS_EYEBROW": "...",
    "EVENTS_HEADING": "...",
    "EVENT_1_NUMBER": "One",
    "EVENT_1_NAME": "...",
    "EVENT_2_NUMBER": "Two",
    "EVENT_2_NAME": "...",
    "EVENT_3_NUMBER": "Three",
    "EVENT_3_NAME": "...",
    "MAP_LINK_LABEL": "...",
    "RSVP_EYEBROW": "...",
    "RSVP_HEADING": "...",
    "RSVP_SUB": "...",
    "RSVP_ACCEPT_LABEL": "...",
    "RSVP_DECLINE_LABEL": "...",
    "RSVP_SUBMIT_LABEL": "...",
    "RSVP_SUCCESS_TITLE": "...",
    "RSVP_SUCCESS_MESSAGE": "...",
    "GALLERY_EYEBROW": "...",
    "GALLERY_HEADING": "...",
    "GALLERY_SUB": "...",
    "FAQ_HEADING": "...",
    "FAQ_1_Q": "...", "FAQ_1_A": "...",
    "FAQ_2_Q": "...", "FAQ_2_A": "...",
    "FAQ_3_Q": "...", "FAQ_3_A": "...",
    "FAQ_4_Q": "...", "FAQ_4_A": "...",
    "FAQ_5_Q": "...", "FAQ_5_A": "...",
    "FAQ_6_Q": "...", "FAQ_6_A": "...",
    "FOOTER_TAGLINE": "..."
  },
  "reasoning": {
    "palette": "Why these colours were chosen",
    "fonts": "Why these fonts were chosen",
    "mood": "The overall design mood"
  }
}`;

const FORBIDDEN_LIST =
  'display, position, flex-direction, flex-wrap, grid-template-columns, ' +
  'grid-template-rows, grid-column, grid-row, overflow, overflow-x, ' +
  'overflow-y, width, height, min-height, max-height, min-width, ' +
  'max-width, float, clear, pointer-events, top, left, right, bottom, ' +
  'inset, align-items, justify-content, gap, flex, flex-grow, ' +
  'flex-shrink, flex-basis';

const APPROVED_FONTS_LIST =
  'Great Vibes, Cormorant Garamond, Playfair Display, EB Garamond, ' +
  'Jost, Inter, Lato, Raleway, Montserrat, Fraunces, DM Sans, ' +
  'Libre Baskerville, Poppins, Josefin Sans, Crimson Text, Yeseva One';

function formatEvents(events: WeddingEvent[]): string {
  if (!events || events.length === 0) return '(no events provided)';
  return events
    .map(
      (e, i) =>
        `  ${i + 1}. ${e.name || '(unnamed)'} — ${e.eventDate || ''} ${
          e.eventTime || ''
        } @ ${e.venue || ''}`,
    )
    .join('\n');
}

export function buildPrompt(
  skeleton: string,
  couple: CoupleData,
  events: WeddingEvent[],
): string {
  return `TASK
====
You are a wedding website visual designer. Read the HTML skeleton
carefully. Design a complete visual identity for this couple. Return
ONLY valid JSON. No markdown fences. No explanation. The entire site
must feel like ONE coherent design, not section by section.

SKELETON HTML
=============
[SKELETON START]
${skeleton}
[SKELETON END]

COUPLE DATA
===========
Names: ${couple.person1Name} & ${couple.person2Name}
Style: ${couple.style}
Vibe: ${couple.vibe}
Story: ${couple.story}
Cultural context: ${couple.culturalContext || '(none provided)'}
Events:
${formatEvents(events)}

${GLOSSARY}

JSON RESPONSE STRUCTURE
=======================
Return EXACTLY this shape (example values only):
${JSON_TEMPLATE}

RULES
=====
NEVER set these CSS properties (they are layout, owned by the skeleton):
  ${FORBIDDEN_LIST}

ONLY use fonts from this list:
  ${APPROVED_FONTS_LIST}

For font-family values, quote the font name: "'Great Vibes', cursive".
Particles: effect must be one of none/petals/snow/fireflies/sparkles.
  count max 30, opacity max 0.7.

Design specifically for THIS couple. ONE coherent design — palette,
typography, mood, and copy all reinforcing the same feeling. Do not
leave placeholder text in the content fields — write original copy
that sounds like it was written for this specific couple.

Return only the JSON object. No text before or after.
`;
}

export function buildEditPrompt(
  skeleton: string,
  currentThemeJson: ThemeJSON,
  couple: CoupleData,
  events: WeddingEvent[],
  instruction: string,
): string {
  return `TASK
====
You are a wedding website visual designer. The couple already has a
design you built earlier. They want a targeted change. Preserve what
works, update what the instruction asks for, and return the COMPLETE
updated ThemeJSON (same shape as before). Return ONLY valid JSON. No
markdown fences.

INSTRUCTION
===========
${instruction}

CURRENT DESIGN
==============
${JSON.stringify(currentThemeJson, null, 2)}

SKELETON HTML
=============
[SKELETON START]
${skeleton}
[SKELETON END]

COUPLE DATA
===========
Names: ${couple.person1Name} & ${couple.person2Name}
Style: ${couple.style}
Vibe: ${couple.vibe}
Story: ${couple.story}
Cultural context: ${couple.culturalContext || '(none provided)'}
Events:
${formatEvents(events)}

${GLOSSARY}

JSON RESPONSE STRUCTURE
=======================
Return EXACTLY this shape (full object, not a partial):
${JSON_TEMPLATE}

RULES
=====
NEVER set these CSS properties:
  ${FORBIDDEN_LIST}

ONLY use fonts from this list:
  ${APPROVED_FONTS_LIST}

Preserve decisions from the current design that aren't affected by
the instruction. Return the complete object, not just a diff.

Return only the JSON object. No text before or after.
`;
}
