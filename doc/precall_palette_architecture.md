# Architecture Decision — Pre-Call Expressive Palette

## Status

Adopted. Supersedes the Hero-First Pipeline proposal.
Record in `docs/DECISIONS.md`.

```
Decision: Expressive palette pre-call (Haiku) picks 4 tokens upfront.
          Call 2 and Call 3 then run in parallel against those 4 tokens.
Date: [today]
Supersedes: Hero-First Pipeline proposal (rejected — see rationale below)
Relates to: VEEINVITE_PRODUCT_PLAN.md §4, §9
```

---

## Why the Hero-First Proposal Was Rejected

The hero-first proposal correctly identified that the creative chain should flow
in one direction — brief → creative decision → everything else inherits.

But it placed that creative decision in the wrong place: the hero.

**The hero should not be in design system author mode.**

The tokens the hero actually uses to create drama:
```
bgPrimary    → the hero canvas
accent       → glow, names highlight, CTA button color
gold         → eyebrow text, decorative dividers
fontDisplay  → couple names — the most emotional element
```

The tokens the hero was being asked to produce but never uses:
```
bgCard       → event card surfaces
textSubtle   → FAQ secondary text
bgSecondary  → story section background variant
accentLight  → soft hover states on RSVP options
```

Asking the hero to choose `bgCard` and `textSubtle` puts it in
"design system author" mode — the opposite of "WOW moment" mode.
The constraint was not removed. It was moved onto the hero.

**Edit flow was a regression.**

```
Current:  "Make it more romantic" → Call 2 only → 10-15s → hero untouched
Proposed: "Make it more romantic" → regenerate hero for new tokens
                                  → then Call C to extend them
                                  → hero changes when user wanted a palette tweak
                                  → 20-30s and potentially lost animation/composition
```

**Fallback failure was louder.**

Current: Call 3 fails → fallback hero, site palette intact.
Proposed: Call B fails → fallback hero AND fallback palette across entire site.

**Creative freedom claim was empirical, not proven.**

We do not know whether the hero is better when it leads. It might be more
generic without constraints forcing composition. Restructuring the pipeline
on an untested hypothesis is the wrong call.

---

## The Correct Solution — Pre-Call Expressive Palette

A tiny Haiku call (~1 second) picks the 4 tokens that drive visual drama.
Call 2 and Call 3 then run in parallel against those 4 tokens.

The creative chain flows correctly:
```
Brief → 4 expressive tokens → hero + site design both inherit
```

The hero gets full creative freedom on layout, animation, and composition.
It does not have to think about `bgCard` or `textSubtle`.
Call 2 fills the remaining 8 tokens from the design system perspective.
Both calls share the same creative source.

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
│  CALL 1 — Layout Selection (unchanged)                      │
│                                                             │
│  Input:  style card → direct layout mapping                 │
│          cultural profile → suggested layout if no card yet │
│  Output: { layoutId: "layout-3" }                          │
│  Model:  Haiku — cheap, fast                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PRE-CALL — Expressive Palette (NEW)                        │
│                                                             │
│  Input:  style card + vibe words + cultural profile         │
│                                                             │
│  Output: {                                                  │
│    "bgPrimary":   "#3D0C1A",                                │
│    "accent":      "#C4607A",                                │
│    "gold":        "#D4A853",                                │
│    "fontDisplay": "Great Vibes"                             │
│  }                                                          │
│                                                             │
│  Model:  Haiku (~1 second, ~20x cheaper than Sonnet)        │
│  These 4 tokens are the creative source for the whole site  │
└──────────┬───────────────────────────────────────┬──────────┘
           │                                       │
           │  Both calls receive the same 4 tokens │
           │  Both calls run in PARALLEL            │
           ▼                                       ▼
┌────────────────────────┐           ┌─────────────────────────┐
│  CALL 2 — Site Design  │           │  CALL 3 — Hero          │
│                        │           │                         │
│  Input:                │           │  Input:                 │
│    Skeleton HTML        │           │    Couple data          │
│    4 expressive tokens  │           │    4 expressive tokens  │
│    Full brief           │           │    Full brief           │
│    Cultural profile     │           │    Cultural profile     │
│                        │           │                         │
│  Produces:             │           │  Produces:              │
│    Remaining 8 tokens  │           │    Hero JSON envelope   │
│    Full site CSS JSON  │           │    { html, style,       │
│    Content values      │           │      script }           │
│    designSummary       │           │                         │
│                        │           │  Full creative freedom  │
│  Call 2 owns:          │           │  on layout, animation,  │
│    bgSecondary, bgCard │           │  composition            │
│    accentLight         │           │                         │
│    textPrimary/Muted/  │           │  Must use:              │
│    Subtle              │           │    bgPrimary, accent,   │
│    fontHeading/Body    │           │    gold, fontDisplay    │
└──────────┬─────────────┘           └──────────┬──────────────┘
           │                                    │
           └──────────────┬─────────────────────┘
                          │  Both complete — merge results
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  MERGE globalTokens                                         │
│                                                             │
│  From pre-call:  bgPrimary, accent, gold, fontDisplay       │
│  From Call 2:    bgSecondary, bgCard, accentLight,          │
│                  textPrimary, textMuted, textSubtle,         │
│                  fontHeading, fontBody                       │
│                                                             │
│  Combined = complete globalTokens (all 12 keys)             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  RENDERER (unchanged assembly order)                        │
│                                                             │
│  1. Load skeleton by layoutId                               │
│  2. Build CSS from Call 2 styles JSON                       │
│  3. Validate CSS                                            │
│  4. Build Google Fonts link                                 │
│  5. Inject CSS + fonts into skeleton <head>                 │
│  6. Build hero from Call 3 JSON envelope                    │
│  7. Prepend hero before skeleton content                    │
│  8. Inject cultural content                                 │
│  9. Inject AI content (copy values)                         │
│  10. Inject structured data LAST                            │
└─────────────────────────────────────────────────────────────┘
```

---

## The Pre-Call — Specification

### Why Haiku, not Sonnet

The pre-call is picking 4 values from a brief. This is a classification task,
not a creative generation task. Haiku costs ~20x less than Sonnet and responds
in ~1 second. The quality difference for this task is negligible.

### Prompt

```
You are picking a visual palette for a wedding website.
Return a JSON object with exactly 4 keys.

Couple brief:
  Style card:   {STYLE_CARD}
  Vibe:         {VIBE_WORDS}
  Culture:      {CULTURAL_DISPLAY_NAME}

Cultural palette guidance:
{culturalProfile.designGuidance}

Return:
{
  "bgPrimary":   "the dominant background color — sets the emotional canvas",
  "accent":      "the primary accent — appears in CTAs, highlights, name glow",
  "gold":        "a warm metallic — for eyebrows, dividers, ornamental text",
  "fontDisplay": "the script or display font — used for couple names"
}

Rules:
- bgPrimary, accent, gold must be hex values (#RRGGBB)
- fontDisplay must be one of the approved fonts listed below
- Your choices must reflect the style card and cultural guidance
- Return only the JSON object — no explanation, no markdown fences

Approved fonts:
  Great Vibes, Cormorant Garamond, Playfair Display, EB Garamond,
  Yeseva One, Fraunces, Crimson Text, Josefin Sans

Style interpretation:
  "Romantic Traditional"  → warm deep tones, rose or burgundy accent,
                            Great Vibes or Cormorant Garamond
  "Modern Minimalist"     → near-white or deep charcoal bg, restrained accent,
                            Josefin Sans or Cormorant Garamond
  "Grand Celebration"     → deep rich bg, bold accent, warm gold,
                            Great Vibes display
  "Editorial Bold"        → high contrast black bg, strong accent,
                            Playfair Display or Yeseva One
  "Destination Glamour"   → cinematic dark bg, metallic accent,
                            Cormorant Garamond or Playfair Display
  "Elegant Minimal"       → soft neutral bg, muted accent, refined font,
                            Cormorant Garamond or EB Garamond
  "Bohemian Garden"       → warm earthy bg, terracotta or sage accent,
                            Fraunces or Crimson Text

Cultural overrides take priority over style card:
  Hindu Indian            → deep red or maroon acceptable as bgPrimary,
                            marigold gold strongly preferred
  Chinese                 → red bgPrimary expected, strong gold
  Nigerian                → rich jewel tone bg, vibrant accent
  Jewish                  → deep blue acceptable, warm gold
  Muslim                  → deep green or midnight bg, gold accent
```

### Validator

```typescript
// src/lib/ai/prePaletteCall.ts

const APPROVED_DISPLAY_FONTS = [
  'great vibes', 'cormorant garamond', 'playfair display',
  'eb garamond', 'yeseva one', 'fraunces', 'crimson text', 'josefin sans',
]

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

interface ExpressivePalette {
  bgPrimary:   string
  accent:      string
  gold:        string
  fontDisplay: string
}

export class PaletteError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message)
    this.name = 'PaletteError'
  }
}

export function validateExpressivePalette(parsed: unknown): ExpressivePalette {
  const p = parsed as Record<string, unknown>

  if (!HEX_PATTERN.test(p.bgPrimary as string)) {
    throw new PaletteError(
      '"bgPrimary" must be a 6-digit hex color e.g. #3D0C1A',
      JSON.stringify(parsed)
    )
  }
  if (!HEX_PATTERN.test(p.accent as string)) {
    throw new PaletteError(
      '"accent" must be a 6-digit hex color e.g. #C4607A',
      JSON.stringify(parsed)
    )
  }
  if (!HEX_PATTERN.test(p.gold as string)) {
    throw new PaletteError(
      '"gold" must be a 6-digit hex color e.g. #D4A853',
      JSON.stringify(parsed)
    )
  }

  const font = (p.fontDisplay as string)?.toLowerCase()
  if (!APPROVED_DISPLAY_FONTS.includes(font)) {
    throw new PaletteError(
      `"fontDisplay" must be one of: ${APPROVED_DISPLAY_FONTS.join(', ')}. ` +
      `Got: ${p.fontDisplay}`,
      JSON.stringify(parsed)
    )
  }

  return {
    bgPrimary:   p.bgPrimary   as string,
    accent:      p.accent      as string,
    gold:        p.gold        as string,
    fontDisplay: p.fontDisplay as string,
  }
}

export async function runPalettePreCall(
  params: PalettePreCallParams
): Promise<ExpressivePalette> {

  // MAX_RETRIES = 3 here — Haiku is fast and cheap
  // Retrying 3 times costs ~$0.001 total
  const MAX_RETRIES = 3
  let lastError: PaletteError | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

    const prompt = buildPalettePrompt(params, lastError, attempt)
    const raw = await callClaude(prompt, {
      model: 'claude-haiku-4-5',
      maxTokens: 150,
    })

    try {
      const firstBrace = raw.indexOf('{')
      const lastBrace  = raw.lastIndexOf('}')
      const parsed     = JSON.parse(raw.slice(firstBrace, lastBrace + 1))
      return validateExpressivePalette(parsed)

    } catch (error) {
      if (error instanceof PaletteError) {
        lastError = error
        if (attempt === MAX_RETRIES) {
          // Fall back to style-card derived palette
          return deriveFallbackPalette(params.styleCard, params.culturalProfile)
        }
      } else {
        throw error
      }
    }
  }

  return deriveFallbackPalette(params.styleCard, params.culturalProfile)
}
```

### Fallback palette (pre-call only)

If the pre-call fails after 3 retries — still only ~3 seconds lost — derive
the palette deterministically from the style card and cultural profile.
No AI needed. This is a table lookup.

```typescript
function deriveFallbackPalette(
  styleCard: string,
  culturalProfile: CulturalProfile
): ExpressivePalette {

  const base: Record<string, ExpressivePalette> = {
    'romantic_traditional': { bgPrimary: '#1A0F1E', accent: '#C4607A', gold: '#D4A853', fontDisplay: 'Great Vibes' },
    'modern_minimalist':    { bgPrimary: '#FAFAFA', accent: '#2C2C3E', gold: '#B8860B', fontDisplay: 'Cormorant Garamond' },
    'grand_celebration':    { bgPrimary: '#0E0A14', accent: '#C4607A', gold: '#D4A853', fontDisplay: 'Great Vibes' },
    'editorial_bold':       { bgPrimary: '#0A0A0A', accent: '#E63946', gold: '#FFD700', fontDisplay: 'Playfair Display' },
    'destination_glamour':  { bgPrimary: '#0D0D1A', accent: '#9B72CF', gold: '#C9A84C', fontDisplay: 'Cormorant Garamond' },
    'elegant_minimal':      { bgPrimary: '#F5F0E8', accent: '#8B7355', gold: '#B8860B', fontDisplay: 'EB Garamond' },
    'bohemian_garden':      { bgPrimary: '#2D1B0E', accent: '#C17F4A', gold: '#D4A853', fontDisplay: 'Fraunces' },
  }

  // Cultural overrides
  const culturalOverrides: Record<string, Partial<ExpressivePalette>> = {
    'hindu_indian':         { gold: '#D4A853' },
    'chinese':              { bgPrimary: '#8B0000', gold: '#FFD700' },
    'nigerian_yoruba':      { bgPrimary: '#4A0E4E', accent: '#9B59B6' },
    'nigerian_igbo':        { bgPrimary: '#1A0A2E', accent: '#8E44AD' },
    'jewish':               { bgPrimary: '#0A1628', accent: '#4A7FB5' },
    'muslim':               { bgPrimary: '#0A2010', accent: '#2ECC71' },
  }

  const palette = base[styleCard] ?? base['grand_celebration']
  const override = culturalOverrides[culturalProfile.id] ?? {}

  return { ...palette, ...override }
}
```

---

## How Call 2 and Call 3 Use the 4 Tokens

### Call 2 — receives 4 tokens, produces the remaining 8

```
Call 2 prompt addition:

EXPRESSIVE PALETTE — USE EXACTLY:
The creative palette for this site has been established:

  bgPrimary:   {palette.bgPrimary}
  accent:      {palette.accent}
  gold:        {palette.gold}
  fontDisplay: {palette.fontDisplay}

Build the complete design system around these 4 values.
You must produce the remaining 8 tokens:
  bgSecondary  — a tonal variant of bgPrimary for alternate sections
  bgCard       — subtle elevated surface for cards
  accentLight  — lighter variant of accent for hover states
  textPrimary  — readable body text on bgPrimary
  textMuted    — secondary text
  textSubtle   — tertiary/quiet text
  fontHeading  — serif heading font (harmonious with fontDisplay)
  fontBody     — clean sans-serif body font

Return globalTokens with all 12 keys. The first 4 must match exactly.
```

### Call 3 — receives 4 tokens, has full creative freedom on everything else

```
Call 3 prompt addition:

EXPRESSIVE PALETTE — THESE 4 VALUES ARE FIXED:
  bgPrimary:   {palette.bgPrimary}   ← use this as your hero canvas
  accent:      {palette.accent}      ← use this for glow, highlights, CTA
  gold:        {palette.gold}        ← use this for decorative elements
  fontDisplay: {palette.fontDisplay} ← use this for the couple's names

You have full creative freedom on:
  Layout and composition
  Animations and transitions
  Particle effects (using the colors above)
  Decorative elements (arch, florals, geometric, glow)
  Typography sizing and hierarchy
  Canvas effects, SVG motifs, parallax
  All other visual choices

You do NOT need to specify bgCard, textSubtle, or any design-system
tokens — those are handled by the site design call. Focus entirely
on making the hero the WOW opening of this couple's story.
```

This is the key sentence: **"Focus entirely on making the hero the WOW opening."**
The hero is freed from design system thinking. It only needs to use 4 values.
Everything else is its creative decision.

---

## Edit Flow — Unchanged and Correct

The pre-call approach preserves the current edit flow exactly.

```
"Make it more romantic"
  → classifier: design edit
  → Call 2 only
  → new bgSecondary, bgCard, accentLight, text tokens
  → hero untouched
  → 10-15 seconds
  → ✓ correct — user wanted a palette tweak, not a new hero

"Make the hero more dramatic"
  → classifier: hero edit
  → Call 3 only with same 4 expressive tokens
  → new composition, animation, layout
  → site design untouched
  → 5-8 seconds
  → ✓ correct

"Start fresh with a completely different style"
  → classifier: global edit
  → pre-call reruns (1s) → new 4 tokens
  → Call 2 + Call 3 in parallel with new tokens
  → complete regeneration
  → ✓ correct
```

The only edit type that re-runs the pre-call is a global edit — where the
couple explicitly wants a completely different direction. Everything else
leaves the 4 expressive tokens intact and only regenerates what changed.

---

## Latency Comparison

```
BEFORE (sequential):
  Call 1:  2s  (layout)
  Call 2: 10s  (site design)
  Call 3:  8s  (hero)
  Total:  20s

AFTER (pre-call + parallel):
  Call 1:   2s  (layout)
  Pre-call: 1s  (4 tokens — Haiku)
  Call 2 + Call 3 in parallel:
    Call 2: 10s
    Call 3:  8s
    Wall time: 10s (the longer of the two)
  Total: 13s

Saving: ~7 seconds (~35% faster)
```

The parallelism is the latency win. The pre-call adds 1 second but removes
the sequential dependency between Call 2 and Call 3.

---

## Fallback Behaviour — Simpler Than Before

```
Pre-call fails (all 3 retries):
  → deriveFallbackPalette(styleCard, culturalProfile)
  → table lookup, ~0ms
  → Call 2 and Call 3 proceed with deterministic palette
  → no visible degradation to couple

Call 2 fails (all retries):
  → throw — no safe fallback for full site design
  → show couple clear error + "Try again" button
  → unchanged from current architecture

Call 3 fails (all retries):
  → buildFallbackHero(params) using globalTokens from Call 2
  → site palette is intact — only hero is fallback
  → dashboard shows "Generate a custom hero →"
  → unchanged from current architecture — and simpler than hero-first proposal
```

Each call's failure is isolated. A Call 3 failure does not affect the site
palette. This is strictly better than the hero-first proposal where a Call B
failure took down the entire palette.

---

## DB Schema — No Changes

`global_tokens` on the `couples` table stores all 12 keys as before.
The pre-call's 4 tokens are merged with Call 2's 8 tokens before storage.
No new columns. No migration.

```typescript
// After both Call 2 and Call 3 complete:

const globalTokens: GlobalTokens = {
  // 4 from pre-call — the creative source
  bgPrimary:   palette.bgPrimary,
  accent:      palette.accent,
  gold:        palette.gold,
  fontDisplay: palette.fontDisplay,

  // 8 from Call 2 — the design system extension
  bgSecondary: call2Result.globalTokens.bgSecondary,
  bgCard:      call2Result.globalTokens.bgCard,
  accentLight: call2Result.globalTokens.accentLight,
  textPrimary: call2Result.globalTokens.textPrimary,
  textMuted:   call2Result.globalTokens.textMuted,
  textSubtle:  call2Result.globalTokens.textSubtle,
  fontHeading: call2Result.globalTokens.fontHeading,
  fontBody:    call2Result.globalTokens.fontBody,
}

await supabase
  .from('couples')
  .update({ global_tokens: globalTokens })
  .eq('id', coupleId)
```

---

## What Changes in `VEEINVITE_PRODUCT_PLAN.md`

| Section | What changes |
|---------|-------------|
| §4 — Pipeline diagram | Add pre-call step. Show Call 2 + Call 3 running in parallel. |
| §9 — Call overview table | Add pre-call row. Update Call 2 and Call 3 descriptions. |
| §9 — Call 2 prompt | Add "4 tokens are fixed, produce remaining 8" instruction. |
| §9 — Call 3 prompt | Add "4 tokens fixed, full freedom on everything else." Remove "no tokens needed" note. |
| §21 — Architecture Rules | Rule 4: "Pre-call establishes 4 expressive tokens. Call 2 extends to 12. Call 3 uses the 4." |

---

## What Changes in `HERO_HTML_EXTRACTION.md`

| Section | What changes |
|---------|-------------|
| Call 3 validator — palette coherence | Check hero style against the 4 pre-call tokens only (not all 12 — Call 3 was only given 4). |
| Call 2 validator | Add check: the 4 pre-call tokens must appear unchanged in Call 2's returned globalTokens. |

---

## Summary

| Concern | Hero-First Proposal | Pre-Call Approach |
|---------|--------------------|--------------------|
| Hero creative freedom | Hero leads but owns design system | Hero uses 4 expressive tokens, full freedom on everything else |
| Design system responsibility | Hero (wrong place) | Call 2 (correct place) |
| Edit flow | Regression — design edits regenerate hero | Unchanged — design edits hit Call 2 only |
| Fallback failure surface | Large — hero failure takes down palette | Small — each call's failure is isolated |
| Latency | ~same as current (sequential) | ~35% faster (Call 2 + Call 3 parallel) |
| Haiku usage | No | Yes — pre-call is Haiku (~1s, ~$0.0003) |
| Creative source upstream | Yes — hero leads | Yes — pre-call leads, hero + site both inherit |
| DB changes | None | None |
| Architecture risk | High — unproven creative quality hypothesis | Low — deterministic improvement |