// Prompt builders for all three AI calls — plan §9.
//
// Every prompt is built from typed input so that downstream testing can lock
// the exact wording. Templates include the §5 coherence instruction verbatim
// and the §26 cultural prompt block when a profile is present.

import { APPROVED_FONTS, FORBIDDEN_CSS_PROPERTIES } from "@/lib/types";
import type {
  Call2Input,
  Call3Input,
  ClassifierInput
} from "@/lib/types";
import { buildCulturalPromptBlock } from "@/lib/cultural/library";

// ---------- §5 coherence instruction — verbatim ---------------------------

export const COHERENCE_INSTRUCTION = `You are designing the complete visual identity for a wedding website.
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
moving through ONE beautiful space — not between different designers.`;

// ---------- Design token glossary — §9 ------------------------------------

export const DESIGN_TOKEN_GLOSSARY = `Design token glossary (for reference when styling):
  nav                  Sticky top bar. Subtle frame, never distracting.
  .nav-monogram        Couple's initials. Elegant brand mark.
  .nav-link            Understated. Clear on hover.
  .story-eyebrow       Tiny uppercase label. Gold/accent color. Wide letter spacing.
  .story-script        Decorative cursive title. Soft, romantic. Lower visual weight than heading.
  .story-heading       Strong but elegant section heading. May contain <em> accent.
  .story-quote         Intimate blockquote. Left border in accent. Italic. A highlight moment.
  .event-card          One card per event. Refined. Hover state recommended.
  .event-number        Large display font. Very low opacity — watermark, not focus.
  .event-name          Event title. Guests read this first.
  .rsvp-heading        Warm, inviting. Personal ask — not a form header.
  .form-field input/select/textarea  Match site personality. Not default browser elements. Same treatment throughout.
  .rsvp-option input:checked + label  Accent color. Clear visual feedback when selected.
  .rsvp-submit         Prominent. Warm. The final meaningful act.
  .faq-question        Full width. Hover: slight color shift.
  .faq-icon            + / × toggle. Accent color.
  footer               Gentle warm closing. Slightly different bg.
  .footer-names        Couple's names in display font. Softer than hero — final echo.
  .footer-tagline      Very small. Very muted. Last whisper.`;

// ---------- Call 1 — Layout selection prompt ------------------------------
// v1 doesn't call this — selectLayout is deterministic (§25). Kept for parity
// in case Stream C wants an AI-only mode later.

export function buildCall1Prompt(input: {
  couple: Call2Input["couple"];
  layoutDescriptions: Array<{ id: string; description: string; tags: string[] }>;
}): string {
  const descs = input.layoutDescriptions
    .map((l) => `  - ${l.id}: ${l.description} (tags: ${l.tags.join(", ")})`)
    .join("\n");
  const culture = input.couple.cultural_context ?? "(none provided)";
  return `Select the best wedding layout for this couple. Return JSON only.

Couple:
  Names: ${input.couple.person1_name} & ${input.couple.person2_name}
  Date: ${input.couple.wedding_date}
  Venue: ${input.couple.venue_name}, ${input.couple.venue_city}
  Style: ${input.couple.style ?? "(not yet chosen)"}
  Vibe: ${input.couple.vibe ?? "(not yet chosen)"}
  Cultural context: ${culture}

Candidate layouts:
${descs}

Return:
{
  "layoutId": "layout-1|layout-2|layout-3|layout-4",
  "reason": "one sentence"
}`;
}

// ---------- Call 2 — Full site design prompt ------------------------------

export function buildCall2Prompt(input: Call2Input): string {
  const cultural = buildCulturalPromptBlock(input.culturalProfile);
  const tags = input.tags?.length ? input.tags.join(", ") : "(none)";
  const forbidden = FORBIDDEN_CSS_PROPERTIES.join(", ");
  const approved = APPROVED_FONTS.join(", ");
  const p = input.palette;

  return `${COHERENCE_INSTRUCTION}

COUPLE CONTEXT:
  Names: ${input.couple.person1_name} & ${input.couple.person2_name}
  Wedding date: ${input.couple.wedding_date}
  Venue: ${input.couple.venue_name}, ${input.couple.venue_city}
  Style card: ${input.couple.style ?? "(none)"}
  Vibe words: ${input.couple.vibe ?? "(none)"}
  Couple's story hint: ${input.couple.story ?? "(none)"}
  Vibe tags from quiz: ${tags}

EXPRESSIVE PALETTE — USE EXACTLY, DO NOT CHANGE:
The 4 expressive tokens below were chosen upstream and are LOCKED.
Your job is to build the design system AROUND them, not to reinvent them.

  bgPrimary:   ${p.bgPrimary}
  accent:      ${p.accent}
  gold:        ${p.gold}
  fontDisplay: ${p.fontDisplay}

You MUST produce the remaining 8 tokens that complete the design system:
  bgSecondary  — tonal variant of bgPrimary for alternate sections
  bgCard       — subtle elevated surface for cards
  accentLight  — lighter variant of accent for hover states
  textPrimary  — readable body text on bgPrimary
  textMuted    — secondary text
  textSubtle   — tertiary / quiet text
  fontHeading  — serif heading font harmonious with fontDisplay
  fontBody     — clean sans-serif body font

Return ALL 12 tokens in globalTokens. The 4 above must appear UNCHANGED.
If you return different values for bgPrimary, accent, gold, or fontDisplay,
your response will fail validation.

${cultural ? `${cultural}\n\n` : ""}LAYOUT SKELETON (CSS selectors you will style):
You MUST style every visible selector referenced in the skeleton below.
Do NOT invent layout structure — only supply design tokens.

\`\`\`html
${input.skeletonHtml}
\`\`\`

${DESIGN_TOKEN_GLOSSARY}

FORBIDDEN CSS PROPERTIES — do not emit any of these. They belong to the skeleton.
${forbidden}

APPROVED FONTS — only Google Font families from this list:
${approved}

OUTPUT FORMAT — CRITICAL:
Return a single JSON object only.

Rules:
- Your entire response must be valid JSON
- Start with { and end with }
- No markdown fences (no \`\`\`json, no \`\`\`)
- No explanation before or after the JSON
- Do not say "Here is the design" or anything like it

Your response will be passed directly to JSON.parse().
Any non-JSON character will throw a parse error.

Schema you must return:

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
  "designSummary": "2 sentences describing the complete visual identity.",
  "reasoning": { "palette": "", "fonts": "", "mood": "" }
}

IMPORTANT:
  - Do NOT populate PERSON1_NAME, PERSON2_NAME, WEDDING_DATE, VENUE_*, MONOGRAM.
    Those are structured fields — the renderer will overwrite whatever you write.
  - Every value under "styles" must be valid CSS text. Never include a forbidden property.
  - Copy must feel like this specific couple. Never "[INSERT BRIDE]". Never blank.
  - Maintain cultural guardrails listed above. If a guardrail conflicts with the style card, guardrail wins.

COMPLETENESS — the site looks broken if you skip selectors. You MUST include every
one of these selectors in "styles", each with at least a color + background (or
equivalent text color) so it reads on the page:

  body  nav  .nav-monogram  .nav-link
  .story  .story-eyebrow  .story-script  .story-heading  .story-body  .story-quote
  .events  .events-eyebrow  .events-heading  .events-grid  .event-card
  .event-number  .event-name  .event-detail
  .rsvp  .rsvp-eyebrow  .rsvp-heading  .rsvp-sub
  .rsvp-form  .form-field label  .form-field input  .form-field select  .form-field textarea
  .rsvp-option label  .rsvp-option input:checked + label  .rsvp-submit
  .gallery  .gallery-eyebrow  .gallery-heading  .gallery-sub
  .gallery-item  .gallery-placeholder
  .faq  .faq-heading  .faq-question  .faq-icon  .faq-answer
  footer  .footer-names  .footer-info  .footer-tagline

Think of this as styling a complete editorial. Sections need visible rhythm —
different background shades (tonal variants of bgPrimary), different text
weights, accent dividers. The site should NOT read as a dark void with one
hero on top.

CONTENT — populate every key in the content map. Never return empty strings;
the validator will fall back to generic defaults and you lose all
personality for this couple.`;
}

// ---------- Call 3 — Hero generation prompt -------------------------------

export function buildCall3Prompt(input: Call3Input): string {
  const p = input.palette;
  const cultural = buildCulturalPromptBlock(input.culturalProfile);
  return `You are generating the hero section for a wedding website.

EXPRESSIVE PALETTE — THESE 4 VALUES ARE FIXED:

  bgPrimary:   ${p.bgPrimary}   ← your hero canvas
  accent:      ${p.accent}      ← glow, highlights, CTA button
  gold:        ${p.gold}        ← decorative elements, dividers
  fontDisplay: ${p.fontDisplay} ← couple names

Use ONLY these colours in your hero design. Do NOT invent new colours.
Do NOT use hex values that aren't derived from these. rgba() variants
of these colours are acceptable for transparency.

You have FULL CREATIVE FREEDOM on:
  Layout and composition
  Animations and transitions
  Particle effects and ambient motion
  SVG motifs and cultural decorations
  Typography sizing and hierarchy
  Canvas effects, parallax, glow, decorative arches, florals

Do NOT think about bgCard, textSubtle, bgSecondary, or any design-system
tokens — those are handled by the site design call (which runs in parallel
with you against the same 4 expressive tokens). Your only job is to make
the hero the WOW opening of this couple's story using these 4 values.

Include in the hero markup (USE PLACEHOLDERS — do not substitute literal values,
the renderer will inject real DB values at the very end):
  countdown timer targeting {{COUNTDOWN_TARGET}},
  CTA button labelled {{CTA_LABEL}} linking to #rsvp,
  {{PERSON1_NAME}}, {{PERSON2_NAME}},
  {{WEDDING_DATE_DISPLAY}}, {{VENUE_NAME}}, {{VENUE_CITY}}.
Also include empty bilingual placeholders {{PERSON1_NAME_BILINGUAL}},
{{PERSON2_NAME_BILINGUAL}}, {{WEDDING_DATE_BILINGUAL}}, {{VENUE_NAME_BILINGUAL}} —
these resolve to empty strings in v1 but keep the layout forward-compatible.

COUPLE CONTEXT:
  Names: ${input.couple.person1_name} & ${input.couple.person2_name}
  Date: ${input.couple.wedding_date}
  Venue: ${input.couple.venue_name}, ${input.couple.venue_city}
  Style: ${input.couple.style ?? "(none)"}
  Vibe: ${input.couple.vibe ?? "(none)"}
  Story hint: ${input.couple.story ?? "(none)"}

${cultural ? `${cultural}\n\n` : ""}CSS must be scoped to .hero descendants or hero-specific classes.
Do not style body, nav, footer, .story, .events, etc — those are owned by Call 2.
Do not add a nav link for the hero — the skeleton nav is fixed (#story, #events,
#rsvp, #gallery, #faq).

OUTPUT FORMAT — CRITICAL:
Return a single JSON object with exactly three fields:

{
  "html":   "<!-- the inner HTML content of the hero — names, date, venue, countdown, CTA, decorations -->",
  "style":  "/* all CSS for this hero — complete, not abbreviated */",
  "script": "/* all JavaScript for this hero — countdown timer, animations. Empty string if none. */"
}

Rules:
- Your entire response must be valid JSON
- Start with { and end with }
- No markdown fences (no \`\`\`json, no \`\`\`)
- No explanation before or after the JSON
- The "html" field must NOT include <section>, <style>, or <script> tags —
  our code wraps your html in <section class="hero">, injects your style as a
  <style> block, and injects your script as a <script> block. Including those
  tags in "html" causes structural breakage.
- The "html" field must include {{PERSON1_NAME}}, {{PERSON2_NAME}},
  {{TAGLINE}}, {{CTA_LABEL}}, {{WEDDING_DATE_DISPLAY}}, {{VENUE_NAME}},
  {{VENUE_CITY}}, {{COUNTDOWN_TARGET}}, plus the four bilingual placeholders
  {{PERSON1_NAME_BILINGUAL}}, {{PERSON2_NAME_BILINGUAL}},
  {{WEDDING_DATE_BILINGUAL}}, {{VENUE_NAME_BILINGUAL}} (these resolve to empty
  strings in v1 but keep the layout forward-compatible for M2 bilingual support).
- The "html" field must contain a CTA link with href="#rsvp".
- The "style" field must contain all CSS — do not put <style> tags inside it,
  just raw CSS rules. Use only the colors and fonts from the design tokens above.
- The "script" field must contain all JavaScript — raw JS only, no <script> tags.
  Do NOT reference {{PLACEHOLDER}} tokens in the script field — placeholders are
  HTML-escape-safe but not JS-escape-safe (XSS surface). Use document.querySelector
  to read values from the DOM if needed.
- If you need no JavaScript, set "script" to an empty string "".

The html, style, and script fields may contain any content you need —
animations, canvas, SVG, particles, gradients, clip-paths, keyframes.
You have full creative freedom inside these fields.
The JSON envelope is the only constraint.

Your response will be passed directly to JSON.parse().
Any non-JSON character will throw a parse error.`;
}

// ---------- Classifier prompt (Haiku) -------------------------------------

export function buildClassifierPrompt(input: ClassifierInput): string {
  const picker = input.contentPickerTarget
    ? `\n\nContent picker target: ${input.contentPickerTarget}`
    : "";
  const selectors = input.elementPickerSelectors?.length
    ? `\n\nElement picker selectors: ${input.elementPickerSelectors.join(", ")}`
    : "";
  return `You are classifying a couple's edit instruction for their wedding website.
Return ONLY a JSON object. No explanation.

Edit instruction: "${input.instruction}"${picker}${selectors}

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
  "dataField": "field name if type is data, else omit",
  "target": "placeholder key or selector if identifiable, else omit"
}`;
}

// ---------- Edit prompt router (§12) --------------------------------------

import type { AIEditClassification, ThemeJSON } from "@/lib/types";

export interface EditPromptInput {
  instruction: string;
  designSummary?: string;
  themeJson?: ThemeJSON;
  heroHtml?: string;
  skeletonHtml?: string;
  couple: Call2Input["couple"];
  culturalProfile: Call2Input["culturalProfile"];
  tags?: string[];
  contentPickerTarget?: string;
  elementPickerSelectors?: string[];
}

export function buildEditPrompt(
  input: EditPromptInput,
  classification: AIEditClassification
): string {
  const header = `Current design summary: ${input.designSummary ?? "(not yet set)"}
Edit instruction: ${input.instruction}
${input.contentPickerTarget ? `Content picker target: ${input.contentPickerTarget}\n` : ""}${input.elementPickerSelectors?.length ? `Element picker selectors: ${input.elementPickerSelectors.join(", ")}\n` : ""}`;

  // PALETTE-03: pull the 4 expressive tokens out of the existing globalTokens.
  // Edit flows always have themeJson available (the couple has already gone
  // through step 2). The 4 fields are guaranteed to be present because Call 2
  // returns them unchanged from the pre-call.
  const tokens = input.themeJson?.globalTokens;
  const palette = tokens
    ? {
        bgPrimary: tokens.bgPrimary,
        accent: tokens.accent,
        gold: tokens.gold,
        fontDisplay: tokens.fontDisplay
      }
    : // Defensive fallback for an edit that somehow runs before any
      // generation. The runtime code paths shouldn't hit this; it just
      // satisfies the new required-field contract on Call2/3Input.
      {
        bgPrimary: "hsl(0, 0%, 96%)",
        accent: "hsl(0, 0%, 20%)",
        gold: "hsl(40, 50%, 50%)",
        fontDisplay: "Cormorant Garamond"
      };

  switch (classification.type) {
    case "design":
    case "global":
      return `${header}
${buildCall2Prompt({
  skeletonHtml: input.skeletonHtml ?? "(skeleton unchanged — reuse previous structure)",
  layoutId: "layout-1",
  couple: input.couple,
  culturalProfile: input.culturalProfile,
  tags: input.tags ?? [],
  palette
})}

Preserve everything the instruction does not touch. Only change what the instruction targets.`;
    case "hero":
      return `${header}
${buildCall3Prompt({
  palette,
  couple: input.couple,
  culturalProfile: input.culturalProfile
})}

Preserve the rest of the site — this call regenerates the hero only.`;
    case "content":
      return `${header}
Return JSON with ONLY the content keys that change. Do not touch styles, fonts, or globalTokens.
Example: { "content": { "STORY_QUOTE": "new quote" } }`;
    case "data":
      return `${header}
No AI call required — direct DB update. The dashboard routes this to /api/structured.`;
    case "new_section":
      return `${header}
Generate a new <section class="user-custom-section"> for the instruction above.
Use only the existing globalTokens palette (${input.themeJson?.globalTokens ? JSON.stringify(input.themeJson.globalTokens) : "(none — fall back to skeleton defaults)"}).
Return { "label": "short title", "html": "<section>...</section>" }.`;
    default:
      return `${header}\n(unknown classification — fall back to design regeneration)`;
  }
}
