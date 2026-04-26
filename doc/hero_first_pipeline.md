# Architecture Decision — Hero-First Generation Pipeline

## Status

Proposed. Supersedes Section 4 and Section 9 of `VEEINVITE_PRODUCT_PLAN.md`.
Record in `docs/DECISIONS.md` when adopted.

---

## The Change

The order of AI calls is reversed.

```
BEFORE:
  Call 1 → Layout selection
  Call 2 → Site design (establishes globalTokens)
  Call 3 → Hero (constrained by Call 2's tokens)

AFTER:
  Call A → Layout selection     (was Call 1 — unchanged)
  Call B → Hero generation      (was Call 3 — now runs first)
  Call C → Site design          (was Call 2 — now receives hero's tokens)
```

The hero runs first. It produces its own design tokens. The site design receives
those tokens as hard constraints and extends them into every skeleton section.

---

## Why

### The hero is the WOW moment. It should not be constrained.

The current architecture constrains the hero. Call 2 establishes the palette
and the hero must match it. The hero is creatively subordinate to a design
system it did not create.

```
Current order — hero inherits from site design:

  Call 2 decides:  deep midnight, rose gold, Great Vibes font
  Call 3 receives: "use these exact values"
  
  Hero thinks:     how do I make something beautiful
                   within these constraints?

  Result:          coherent but potentially conservative
                   the palette was designed for sections, not drama
```

```
Proposed order — site design inherits from hero:

  Call B has:      full creative freedom within the couple's brief
  
  Hero thinks:     what is the most dramatic, beautiful expression
                   of THIS couple's brief?
  
  Call C receives: "extend these hero tokens into the skeleton"
  
  Result:          hero leads with maximum creative expression
                   site design amplifies what the hero established
```

The hero is better when it leads. The rest of the site is equally coherent
because it inherits the same tokens. The creative source is simply in the
right place.

### The intake form is still fully honored

Full creative freedom does not mean ignoring the couple's input. The intake
form is the creative brief. The hero is the creative response to that brief.

```
Call B receives the complete intake form:
  Style card        → sets the aesthetic direction
  Vibe words        → sets the emotional tone
  Cultural profile  → sets palette guidance and copy guardrails
  Names, date, venue → sets the personal content

AI does not invent freely into a vacuum.
It responds creatively to a specific brief.

"Romantic Traditional" + Hindu Punjabi
  → warm tones, marigold gold, classic fonts
  → not neon, not minimal, not cold

"Editorial Bold" + Chinese
  → high contrast, red and gold, dramatic
  → not soft, not pastel, not understated
```

The tokens the hero produces are a direct creative interpretation of the
couple's brief. Call C receives both the brief and the tokens — it extends
the creative interpretation into the skeleton.

---

## The Revised Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    INTAKE FORM                              │
│                                                             │
│  Names · Date · Venue                                       │
│  Style card · Vibe words                                    │
│  Cultural profile (culture + sub-region confirmed)          │
└──────────────────────────┬──────────────────────────────────┘
                           │  All inputs flow into every call
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CALL A — Layout Selection (unchanged)                      │
│                                                             │
│  Input:  style card → direct layout mapping                 │
│          cultural profile → suggested layout if no card yet │
│                                                             │
│  Output: { layoutId: "layout-3" }                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CALL B — Hero Generation (runs before site design)         │
│                                                             │
│  Input:  complete intake form                               │
│          cultural palette guidance                          │
│          cultural copy guardrails                           │
│          full creative freedom within the brief             │
│                                                             │
│  Output: {                                                  │
│    "html":   "inner hero HTML content",                     │
│    "style":  "all hero CSS",                                │
│    "script": "countdown timer + animations",                │
│    "tokens": {                                              │
│      bgPrimary, bgSecondary, bgCard,                        │
│      accent, accentLight, gold,                             │
│      textPrimary, textMuted, textSubtle,                    │
│      fontDisplay, fontHeading, fontBody                     │
│    }                                                        │
│  }                                                          │
│                                                             │
│  Tokens are the hero's creative interpretation of the brief │
│  They become globalTokens for the entire site               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │  Extract and validate tokens
                           │  These are now globalTokens
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  CALL C — Site Design (receives hero tokens)                │
│                                                             │
│  Input:  complete intake form (same as Call B)              │
│          cultural palette guidance (same as Call B)         │
│          skeleton HTML for selected layout                  │
│          globalTokens from Call B (hard constraints)        │
│                                                             │
│          Instruction:                                       │
│          "The hero was designed as a creative response to   │
│           this couple's brief. Use these exact token values │
│           throughout every skeleton section. Do not invent  │
│           new colors or fonts. Extend this palette into     │
│           the story, events, RSVP, gallery, FAQ, footer."   │
│                                                             │
│  Output: CSS JSON covering every skeleton selector          │
│          content values for all placeholders                │
│          designSummary for future edit prompts              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  RENDERER                                                   │
│                                                             │
│  1. Load skeleton by layoutId                               │
│  2. Build CSS from Call C styles JSON                       │
│  3. Validate CSS (strip forbidden properties)               │
│  4. Build Google Fonts link from fonts array                │
│  5. Inject CSS + fonts into skeleton <head>                 │
│  6. Build hero from Call B JSON envelope                    │
│     (section, style, html, script — we own the wrapper)     │
│  7. Prepend hero before skeleton content                    │
│  8. Inject cultural content (parents names, ceremonies etc) │
│  9. Inject AI content (copy values)                         │
│  10. Inject structured data LAST (always overwrites)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Call B — Hero Prompt Specification

### What the prompt must include

**Block 1 — Couple identity (from intake form)**

```
Couple: {PERSON1_NAME} & {PERSON2_NAME}
Wedding date: {WEDDING_DATE_DISPLAY}
Venue: {VENUE_NAME}, {VENUE_CITY}
```

**Block 2 — Style direction (from intake form)**

```
Style card: {STYLE_CARD}
Vibe: {VIBE_WORDS}

Style interpretation guide:
  "Romantic Traditional"  → warm tones, classic fonts, soft palette
  "Modern Minimalist"     → clean, restrained, neutral or monochrome
  "Grand Celebration"     → rich, celebratory, dramatic, opulent
  "Editorial Bold"        → high contrast, asymmetric, fashion-forward
  "Destination Glamour"   → cinematic, luxurious, destination aesthetic
  "Elegant Minimal"       → refined, understated, premium
  "Bohemian Garden"       → organic, earthy, natural tones
```

**Block 3 — Cultural guidance (from cultural profile)**

```
Cultural profile: {CULTURE_DISPLAY_NAME}

Design guidance:
{culturalProfile.designGuidance}

Copy tone:
{culturalProfile.copyTone}

Copy guardrails — read before generating any text:
{culturalProfile.copyGuardrails}
{culturalProfile.subRegionCopyNote}
```

**Block 4 — Token requirement**

```
Return a "tokens" field with all 12 keys.
These 12 values become the design language for the entire wedding site.
Every other section (story, events, RSVP, gallery, FAQ, footer) will
inherit these values. Be deliberate.

Your tokens must reflect the couple's style card, vibe, and cultural profile.
They are not freely invented — they are your creative interpretation of the brief.

Token meanings:
  bgPrimary   — dominant background color
  bgSecondary — slightly different bg for alternate sections
  bgCard      — subtle surface color for cards and elevated elements
  accent      — primary accent — appears in buttons, borders, highlights
  accentLight — lighter accent variant for softer applications
  gold        — warm metallic — for eyebrows, dividers, decorative text
  textPrimary — main body text color
  textMuted   — secondary text, labels
  textSubtle  — tertiary text, very quiet elements
  fontDisplay — script or display font — for names and romantic headings
  fontHeading — serif heading font — for section titles
  fontBody    — sans-serif body font — for all running text
```

**Block 5 — Output format**

```
OUTPUT FORMAT — CRITICAL:
Return a single JSON object with exactly four fields.

{
  "html":   "inner HTML content of the hero — no <section>, <style>, or <script> tags",
  "style":  "all CSS for this hero — complete, not abbreviated",
  "script": "all JavaScript for this hero — or empty string if none needed",
  "tokens": {
    "bgPrimary":   "#...",
    "bgSecondary": "#...",
    "bgCard":      "...",
    "accent":      "#...",
    "accentLight": "#...",
    "gold":        "#...",
    "textPrimary": "...",
    "textMuted":   "...",
    "textSubtle":  "...",
    "fontDisplay": "Font Name",
    "fontHeading": "Font Name",
    "fontBody":    "Font Name"
  }
}

Rules:
- Your entire response must be valid JSON
- Start with { and end with }
- No markdown fences (no ```json, no ```)
- No explanation before or after the JSON
- The html field must not contain <section>, <style>, or <script> tags
- The style field must contain all CSS
- The script field must contain all JS, or be an empty string
- Your response will be passed directly to JSON.parse()

Required content in html:
- {{PERSON1_NAME}} and {{PERSON2_NAME}} — both must appear
- A link to #rsvp — the CTA button
- {{WEDDING_DATE_DISPLAY}} and {{VENUE_NAME}}
- {{COUNTDOWN_TARGET}} in any countdown timer script
- {{CTA_LABEL}} for the CTA button text
```

---

## Call B — Validator Changes

The existing `validateHeroJson` needs one addition — validate the `tokens` field.

```typescript
// Addition to validateHeroJson.ts

const REQUIRED_TOKEN_KEYS = [
  'bgPrimary', 'bgSecondary', 'bgCard',
  'accent', 'accentLight', 'gold',
  'textPrimary', 'textMuted', 'textSubtle',
  'fontDisplay', 'fontHeading', 'fontBody',
]

const APPROVED_FONTS = [
  'great vibes', 'cormorant garamond', 'playfair display',
  'eb garamond', 'jost', 'inter', 'lato', 'raleway', 'montserrat',
  'fraunces', 'dm sans', 'libre baskerville', 'poppins',
  'josefin sans', 'crimson text', 'yeseva one',
  'noto serif sc', 'noto serif tc',
  'noto naskh arabic', 'scheherazade new',
  'frank ruhl libre', 'heebo',
]

// Add to validateHeroJson() after existing checks:

  // 10. tokens field must be present
  if (!envelope.tokens || typeof envelope.tokens !== 'object') {
    throw new HeroValidationError(
      'The "tokens" field is missing or not an object. ' +
      'Return all 12 design tokens: ' + REQUIRED_TOKEN_KEYS.join(', '),
      envelope
    )
  }

  // 11. All 12 token keys must be present and non-empty
  const missingTokens = REQUIRED_TOKEN_KEYS.filter(
    k => !envelope.tokens[k] || typeof envelope.tokens[k] !== 'string'
  )
  if (missingTokens.length > 0) {
    throw new HeroValidationError(
      `The "tokens" field is missing required keys: ${missingTokens.join(', ')}. ` +
      'All 12 token keys are required — they become the design language for the whole site.',
      envelope
    )
  }

  // 12. Font tokens must be from the approved list
  const displayFont = (envelope.tokens.fontDisplay as string).toLowerCase()
  const headingFont = (envelope.tokens.fontHeading as string).toLowerCase()
  const bodyFont    = (envelope.tokens.fontBody as string).toLowerCase()

  const unapprovedFonts = [displayFont, headingFont, bodyFont]
    .filter(f => !APPROVED_FONTS.some(a => f.startsWith(a)))

  if (unapprovedFonts.length > 0) {
    throw new HeroValidationError(
      `tokens contains unapproved font values: ${unapprovedFonts.join(', ')}. ` +
      `Approved fonts: ${APPROVED_FONTS.join(', ')}`,
      envelope
    )
  }

  // 13. Palette coherence check moves here — hero tokens are now
  //     the source of truth, so check style uses its own declared tokens
  const tokenHexValues = Object.entries(envelope.tokens)
    .filter(([, v]) => typeof v === 'string' && (v as string).startsWith('#'))
    .map(([, v]) => (v as string).toLowerCase())

  const allHexValues = envelope.style.match(/#[0-9a-f]{3,8}\b/gi) ?? []
  const uniqueHex = [...new Set(allHexValues.map(h => h.toLowerCase()))]
  const outsideTokens = uniqueHex.filter(h => !tokenHexValues.includes(h))

  if (outsideTokens.length > 5) {
    throw new HeroValidationError(
      `The "style" field contains ${outsideTokens.length} hex colors not declared ` +
      `in the "tokens" field: ${outsideTokens.slice(0, 5).join(', ')}. ` +
      'Use the colors you declared in tokens, or declare additional colors there.',
      envelope
    )
  }
```

**Note on palette coherence:** The check now compares style hex values against
the hero's *own declared tokens*, not against `globalTokens` passed in from
outside. The hero produces the tokens — they should be consistent with the
style it writes.

---

## Call B — Updated `HeroJsonEnvelope` Type

```typescript
// src/lib/types.ts — update HeroJsonEnvelope

interface HeroJsonEnvelope {
  html:    string
  style:   string
  script:  string
  tokens:  GlobalTokens   // NEW — was not present before
}
```

---

## Call B — Extracting Tokens After Validation

After `validateHeroJson` passes, extract the tokens:

```typescript
// src/lib/renderer/heroGenerator.ts

const envelope  = extractHeroJson(raw)
validateHeroJson(envelope, null)   // pass null — no external tokens to check against
                                    // hero validates against its own declared tokens

// Extract globalTokens from the hero
const globalTokens: GlobalTokens = envelope.tokens

// Save to DB
await supabase
  .from('couples')
  .update({ global_tokens: globalTokens })
  .eq('id', coupleId)

// Pass to Call C
const call2Result = await generateDesignTokensWithRetry({
  ...params,
  globalTokens,   // from hero — not generated by Call C
})
```

---

## Call C — Prompt Changes

One block changes. The existing coherence instruction becomes:

```
DESIGN TOKENS — USE EXACTLY:
The hero section has already been designed as a creative response
to this couple's brief. It established the following design language:

  Background primary:  {tokens.bgPrimary}
  Background secondary:{tokens.bgSecondary}
  Card surface:        {tokens.bgCard}
  Accent:              {tokens.accent}
  Accent light:        {tokens.accentLight}
  Gold:                {tokens.gold}
  Text primary:        {tokens.textPrimary}
  Text muted:          {tokens.textMuted}
  Text subtle:         {tokens.textSubtle}
  Display font:        {tokens.fontDisplay}
  Heading font:        {tokens.fontHeading}
  Body font:           {tokens.fontBody}

USE THESE EXACT VALUES throughout every skeleton section.
Do not invent new colors or fonts.
Do not return a tokens field — tokens are already established.

Your job is to extend this palette into:
  story, events, RSVP, gallery, FAQ, footer

The couple should scroll from hero to footer through ONE visual space.
Every section continues the story the hero opened.
```

Call C no longer returns a `tokens` field — it only returns `styles`, `fonts`,
`content`, and `designSummary`. Tokens come from Call B.

---

## Call C — Validator Changes

Remove the `globalTokens` validation from `validateCall2Json`. Tokens are now
validated in the hero validator. Call C only needs to validate that it styled
the skeleton correctly using whatever tokens it received.

The existing checks remain:
- `styles` has at least 25 selectors
- All required selectors are present
- `fonts` array contains only approved fonts
- `content` has at least 30 non-empty values
- `designSummary` is at least 30 characters

Remove:
- `globalTokens` key presence check (tokens come from Call B now)

---

## Fallback Behaviour Changes

### Call B fallback

If Call B fails after all retries, the fallback hero produces its own tokens.
The fallback `buildFallbackEnvelope` must return a `tokens` field:

```typescript
// src/lib/renderer/fallbackHero.ts

export function buildFallbackEnvelope(
  params: HeroGenerationParams
): HeroJsonEnvelope {

  // Use the cultural profile to pick sensible fallback tokens
  // rather than hardcoded values
  const t = deriveFallbackTokens(params.culturalProfile, params.styleCard)

  return {
    tokens: t,
    style: `/* fallback CSS using derived tokens */`,
    html:  `/* fallback HTML */`,
    script: '',
  }
}

function deriveFallbackTokens(
  culturalProfile: CulturalProfile,
  styleCard: string
): GlobalTokens {

  // Map style card → sensible fallback palette
  const palettes: Record<string, Partial<GlobalTokens>> = {
    'romantic_traditional': {
      bgPrimary: '#1A0F1E', accent: '#C4607A', gold: '#D4A853',
      fontDisplay: 'Great Vibes', fontHeading: 'Cormorant Garamond', fontBody: 'Jost',
    },
    'modern_minimalist': {
      bgPrimary: '#FAFAFA', accent: '#1A1A2E', gold: '#B8860B',
      fontDisplay: 'Cormorant Garamond', fontHeading: 'Cormorant Garamond', fontBody: 'Inter',
    },
    'grand_celebration': {
      bgPrimary: '#0E0A14', accent: '#C4607A', gold: '#D4A853',
      fontDisplay: 'Great Vibes', fontHeading: 'Cormorant Garamond', fontBody: 'Jost',
    },
    'editorial_bold': {
      bgPrimary: '#0A0A0A', accent: '#E63946', gold: '#FFD700',
      fontDisplay: 'Playfair Display', fontHeading: 'Playfair Display', fontBody: 'Inter',
    },
  }

  const base = palettes[styleCard] ?? palettes['grand_celebration']

  return {
    bgPrimary:   base.bgPrimary   ?? '#0E0A14',
    bgSecondary: '#1A1528',
    bgCard:      'rgba(255,255,255,0.02)',
    accent:      base.accent      ?? '#C4607A',
    accentLight: '#E8A0B0',
    gold:        base.gold        ?? '#D4A853',
    textPrimary: 'rgba(253,246,238,0.9)',
    textMuted:   'rgba(253,246,238,0.5)',
    textSubtle:  'rgba(253,246,238,0.3)',
    fontDisplay: base.fontDisplay ?? 'Great Vibes',
    fontHeading: base.fontHeading ?? 'Cormorant Garamond',
    fontBody:    base.fontBody    ?? 'Jost',
  }
}
```

The fallback tokens are derived from the style card — not hardcoded to one palette.
A modern minimalist fallback looks different from a grand celebration fallback.

### Call C has no fallback (unchanged)

If Call C fails after retries, show the couple a clear error with a retry button.
Do not show an unstyled site. This is unchanged from the previous architecture.

---

## DB Schema — No Changes Required

`global_tokens` on the `couples` table is already a JSONB column. It previously
stored Call 2's tokens. It now stores Call B's tokens. The column and its
downstream uses are identical. No migration needed.

---

## What Changes in `VEEINVITE_PRODUCT_PLAN.md`

The following sections need updating when this decision is adopted:

| Section | What changes |
|---------|-------------|
| §4 — Core Architecture pipeline diagram | Call order: A → B (hero) → C (site design) |
| §5 — Design Coherence | Hero establishes globalTokens. Site design inherits them. |
| §9 — AI Pipeline, Call overview table | Rename calls. Call B runs before Call C. |
| §9 — Call 2 prompt spec | Add "tokens from Call B as hard constraints" block |
| §9 — Call 3 prompt spec | Add "tokens" field to output. Tokens validate against own style. |
| §21 — Architecture Rules | Rule 4: "Call B (hero) establishes globalTokens. Call C inherits them." |
|                           | Rule 5: "Call C receives globalTokens from Call B as hard constraints." |

---

## Summary — What This Changes and Why

| Before | After | Why |
|--------|-------|-----|
| Call 2 establishes palette | Call B (hero) establishes palette | Hero leads creatively — it should not be constrained by a palette designed for sections |
| Call 3 hero matches site design | Call C site design matches hero | Site design amplifies the hero's creative vision rather than constraining it |
| Hero `tokens` field not present | Hero returns `tokens` as explicit named values | No CSS parsing needed. Named tokens flow cleanly into Call C prompt |
| globalTokens validated in Call 2 | globalTokens validated in Call B hero validator | Tokens are owned by the call that produces them |
| Palette coherence checks hero against Call 2 tokens | Palette coherence checks hero style against its own declared tokens | Hero is the source — it validates internal consistency |
| Fallback hero uses hardcoded palette | Fallback hero derives palette from style card | A modern minimalist fallback looks different from a grand celebration fallback |
| Intake form → Call 2 → Call 3 inherits | Intake form → Call B interprets → Call C extends | The creative chain flows in the right direction: brief → hero → site |