# Pre-Call Palette — Implementation Spec

## What this document is

A complete, ready-to-implement specification for the pre-call expressive palette
system. Claude Code should read this document and implement it exactly as written.

This supersedes the prompt and validator sections in `PRECALL_PALETTE_ARCHITECTURE.md`.
The architecture decisions in that document still apply. This document replaces
only the implementation details.

---

## What changes from the previous spec

The previous spec used:
- Vague prose cultural guidance in the prompt
- Hex value output only
- No connection to `cultural-content-library.json`
- A hardcoded fallback table

This spec uses:
- HSL ranges from `cultural-content-library.json` injected into the prompt
- HSL output from Haiku (not hex) — validated against the ranges
- Western aesthetic family selection before the Haiku call
- `cultural-content-library.json` as the single source of truth for palette ranges
- A fallback that also reads from the library

---

## File locations

```
src/lib/ai/
  prePaletteCall.ts          ← main file — build everything here
  prePaletteCall.test.ts     ← tests

src/lib/cultural/
  library.ts                 ← already exists — extend with getPaletteRanges()

src/lib/cultural-content-library.json  ← already updated with colorPalette field
```

---

## Step 1 — Read palette ranges from the library

Add this function to `src/lib/cultural/library.ts`.
It reads the `colorPalette` field we added to the JSON.

```typescript
// src/lib/cultural/library.ts

import libraryJson from '../cultural-content-library.json'

export interface HslRange {
  h:    [number, number]   // hue range [min, max]
  s:    [number, number]   // saturation range [min%, max%]
  l:    [number, number]   // lightness range [min%, max%]
  note: string             // cultural explanation — used in the prompt
}

export interface CulturePaletteRanges {
  bgPrimary:   HslRange
  accent:      HslRange
  gold:        HslRange
  fontDisplay: string[]    // approved candidates for this culture
}

export interface WesternPaletteFamily {
  label:       string
  description: string
  bgPrimary:   HslRange
  accent:      HslRange
  gold:        HslRange
  fontDisplay: string[]
}

/**
 * Returns HSL ranges for a cultural profile.
 * For sub-regions, returns the sub-region ranges if they exist.
 * For western, returns null — western uses aesthetic families instead.
 */
export function getCulturePaletteRanges(
  cultureId:  string,
  subRegion?: string
): CulturePaletteRanges | null {

  const culture = (libraryJson.cultures as Record<string, any>)[cultureId]
  if (!culture?.colorPalette) return null

  // Western uses families, not a single range
  if (cultureId === 'western') return null

  const palette = culture.colorPalette

  // Try sub-region first
  if (subRegion && palette.subRegions?.[subRegion]) {
    const sub = palette.subRegions[subRegion]
    return {
      bgPrimary:   sub.bgPrimary,
      accent:      sub.accent,
      gold:        sub.gold,
      fontDisplay: palette.default.fontDisplay,   // fonts from default
    }
  }

  // Fall back to default
  return {
    bgPrimary:   palette.default.bgPrimary,
    accent:      palette.default.accent,
    gold:        palette.default.gold,
    fontDisplay: palette.default.fontDisplay,
  }
}

/**
 * Returns a specific western aesthetic family by name.
 */
export function getWesternFamily(familyId: string): WesternPaletteFamily | null {
  const western = (libraryJson.cultures as Record<string, any>)['western']
  const family = western?.colorPalette?.families?.[familyId]
  if (!family) return null
  return family as WesternPaletteFamily
}

/**
 * Returns all western family IDs.
 */
export function getWesternFamilyIds(): string[] {
  const western = (libraryJson.cultures as Record<string, any>)['western']
  return Object.keys(western?.colorPalette?.families ?? {})
}
```

---

## Step 2 — Western aesthetic family selection

For western couples, the code selects which aesthetic family to use
before the Haiku call. No AI involved. Pure deterministic logic.

```typescript
// src/lib/ai/prePaletteCall.ts

export type WesternFamilyId =
  | 'botanical_garden'
  | 'dark_romance'
  | 'coastal_destination'
  | 'editorial_minimal'
  | 'warm_rustic'
  | 'french_luxury'
  | 'midnight_glamour'
  | 'scandinavian_clean'

/**
 * Selects a western aesthetic family from style card and vibe tags.
 * Vibe tags are checked first (they carry personal intent).
 * Style card is the fallback when no tags match.
 */
export function selectWesternFamily(
  styleCard:  string,
  vibeTags:   string[]     // pre-selected tags from the tag picker UI
): WesternFamilyId {

  const tags = vibeTags.map(t => t.toLowerCase())

  // Score each family by how many tags point to it
  const scores: Record<WesternFamilyId, number> = {
    botanical_garden:    0,
    dark_romance:        0,
    coastal_destination: 0,
    editorial_minimal:   0,
    warm_rustic:         0,
    french_luxury:       0,
    midnight_glamour:    0,
    scandinavian_clean:  0,
  }

  const TAG_MAP: Record<string, WesternFamilyId[]> = {
    'romantic':    ['botanical_garden', 'dark_romance'],
    'soft':        ['botanical_garden', 'french_luxury'],
    'natural':     ['botanical_garden', 'warm_rustic'],
    'garden':      ['botanical_garden'],
    'floral':      ['botanical_garden'],
    'organic':     ['botanical_garden', 'warm_rustic'],
    'dramatic':    ['dark_romance', 'midnight_glamour'],
    'dark':        ['dark_romance', 'editorial_minimal'],
    'moody':       ['dark_romance'],
    'mysterious':  ['dark_romance'],
    'coastal':     ['coastal_destination'],
    'beach':       ['coastal_destination'],
    'destination': ['coastal_destination', 'midnight_glamour'],
    'ocean':       ['coastal_destination'],
    'tropical':    ['coastal_destination'],
    'bold':        ['editorial_minimal', 'midnight_glamour'],
    'editorial':   ['editorial_minimal'],
    'modern':      ['editorial_minimal', 'scandinavian_clean'],
    'minimal':     ['editorial_minimal', 'scandinavian_clean'],
    'stark':       ['editorial_minimal'],
    'clean':       ['editorial_minimal', 'scandinavian_clean'],
    'rustic':      ['warm_rustic'],
    'barn':        ['warm_rustic'],
    'autumn':      ['warm_rustic'],
    'earthy':      ['warm_rustic'],
    'copper':      ['warm_rustic'],
    'elegant':     ['french_luxury', 'midnight_glamour'],
    'luxury':      ['french_luxury', 'midnight_glamour'],
    'classic':     ['french_luxury', 'botanical_garden'],
    'champagne':   ['french_luxury'],
    'timeless':    ['french_luxury', 'botanical_garden'],
    'glamorous':   ['midnight_glamour'],
    'glam':        ['midnight_glamour'],
    'silver':      ['midnight_glamour'],
    'festive':     ['midnight_glamour', 'warm_rustic'],
    'airy':        ['scandinavian_clean', 'coastal_destination'],
    'fresh':       ['scandinavian_clean', 'coastal_destination'],
    'simple':      ['scandinavian_clean', 'editorial_minimal'],
    'nordic':      ['scandinavian_clean'],
    'intimate':    ['botanical_garden', 'french_luxury'],
  }

  // Score each tag
  tags.forEach(tag => {
    const families = TAG_MAP[tag] ?? []
    families.forEach(f => scores[f]++)
  })

  // Find the highest scoring family
  const sorted = (Object.entries(scores) as [WesternFamilyId, number][])
    .sort(([, a], [, b]) => b - a)

  const topScore = sorted[0][1]

  if (topScore > 0) {
    // If there is a tie, use the style card to break it
    const tied = sorted.filter(([, s]) => s === topScore).map(([f]) => f)
    if (tied.length === 1) return tied[0]
    return styleCardTieBreak(styleCard, tied)
  }

  // No tags matched — fall back to style card entirely
  return styleCardToFamily(styleCard)
}

function styleCardTieBreak(
  styleCard: string,
  tied:      WesternFamilyId[]
): WesternFamilyId {
  // The style card preference order for each family
  const cardPreference: Record<string, WesternFamilyId> = {
    'modern_minimalist':    'scandinavian_clean',
    'elegant_minimal':      'french_luxury',
    'romantic_traditional': 'botanical_garden',
    'bohemian_garden':      'botanical_garden',
    'destination_glamour':  'midnight_glamour',
    'editorial_bold':       'editorial_minimal',
    'grand_celebration':    'midnight_glamour',
  }
  const preferred = cardPreference[styleCard]
  return tied.includes(preferred) ? preferred : tied[0]
}

function styleCardToFamily(styleCard: string): WesternFamilyId {
  const map: Record<string, WesternFamilyId> = {
    'modern_minimalist':    'scandinavian_clean',
    'elegant_minimal':      'french_luxury',
    'romantic_traditional': 'botanical_garden',
    'bohemian_garden':      'botanical_garden',
    'destination_glamour':  'midnight_glamour',
    'editorial_bold':       'editorial_minimal',
    'grand_celebration':    'midnight_glamour',
  }
  return map[styleCard] ?? 'botanical_garden'
}
```

---

## Step 3 — Build the Haiku prompt with HSL ranges

The prompt injects the actual HSL ranges from the library.
Haiku picks a specific value within each range.

```typescript
// src/lib/ai/prePaletteCall.ts

function buildPalettePrompt(
  ranges:     CulturePaletteRanges,
  styleCard:  string,
  vibeTags:   string[],
  cultureName: string,
  lastError:  PaletteError | null,
  attempt:    number
): string {

  const correctionBlock = lastError && attempt > 1 ? `
CORRECTION REQUIRED — YOUR PREVIOUS RESPONSE HAD AN ERROR:
${lastError.message}

Fix this specific problem. Then return the complete JSON object.
`.trim() + '\n\n' : ''

  return correctionBlock + `
You are picking exact colors for a wedding invitation.
Pick ONE specific HSL value for each color field.
Your choices must fall WITHIN the ranges given — not outside them.

Couple brief:
  Culture:    ${cultureName}
  Style card: ${styleCard}
  Vibe tags:  ${vibeTags.length > 0 ? vibeTags.join(', ') : 'none selected'}

COLOR RANGES — pick within these:

bgPrimary (the card background):
  Hue:        ${ranges.bgPrimary.h[0]}–${ranges.bgPrimary.h[1]}
  Saturation: ${ranges.bgPrimary.s[0]}%–${ranges.bgPrimary.s[1]}%
  Lightness:  ${ranges.bgPrimary.l[0]}%–${ranges.bgPrimary.l[1]}%
  Meaning:    ${ranges.bgPrimary.note}

accent (buttons, name highlights, glow effects):
  Hue:        ${ranges.accent.h[0]}–${ranges.accent.h[1]}
  Saturation: ${ranges.accent.s[0]}%–${ranges.accent.s[1]}%
  Lightness:  ${ranges.accent.l[0]}%–${ranges.accent.l[1]}%
  Meaning:    ${ranges.accent.note}

gold (decorative elements, dividers, eyebrow text):
  Hue:        ${ranges.gold.h[0]}–${ranges.gold.h[1]}
  Saturation: ${ranges.gold.s[0]}%–${ranges.gold.s[1]}%
  Lightness:  ${ranges.gold.l[0]}%–${ranges.gold.l[1]}%
  Meaning:    ${ranges.gold.note}

fontDisplay (used for couple names — choose one):
  ${ranges.fontDisplay.join(', ')}

STYLE GUIDANCE:
Use the style card and vibe tags to choose WHERE within each range.
  Romantic / intimate / soft → warmer, slightly lighter end of range
  Grand / opulent / dramatic → most saturated, most dramatic end
  Minimal / clean / modern   → cooler, quieter end of range

OUTPUT FORMAT — CRITICAL:
Return ONLY this JSON object. No explanation. No markdown fences.
Start with { and end with }.

{
  "bgPrimary":   "hsl(H, S%, L%)",
  "accent":      "hsl(H, S%, L%)",
  "gold":        "hsl(H, S%, L%)",
  "fontDisplay": "Font Name Here"
}

Rules:
- H, S, L must be integers within the ranges above
- Do not use decimal values
- fontDisplay must be exactly one of: ${ranges.fontDisplay.join(', ')}
- Pick SPECIFIC values — not the midpoint of every range
  Two couples with the same culture should get different values
`.trim()
}
```

---

## Step 4 — The validator

Validates HSL values are within the library ranges.
This replaces the hex-only validator in the previous spec.

```typescript
// src/lib/ai/prePaletteCall.ts

export interface ExpressivePalette {
  bgPrimary:   string    // "hsl(348, 88%, 16%)"
  accent:      string    // "hsl(338, 62%, 58%)"
  gold:        string    // "hsl(44, 90%, 54%)"
  fontDisplay: string    // "Great Vibes"
}

export class PaletteError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message)
    this.name = 'PaletteError'
  }
}

const HSL_PATTERN = /^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/

/**
 * Parses "hsl(H, S%, L%)" → { h, s, l }
 * Throws PaletteError if format is wrong.
 */
function parseHsl(
  value:     string,
  fieldName: string
): { h: number; s: number; l: number } {
  const match = value.trim().match(HSL_PATTERN)
  if (!match) {
    throw new PaletteError(
      `"${fieldName}" must be in hsl(H, S%, L%) format. ` +
      `Example: hsl(348, 88%, 16%). Got: ${value}`,
      value
    )
  }
  return {
    h: parseInt(match[1]),
    s: parseInt(match[2]),
    l: parseInt(match[3]),
  }
}

/**
 * Checks a hue value is within a range.
 * Handles wrapping (e.g. range [352, 8] wraps through 360/0).
 */
function hueInRange(h: number, range: [number, number]): boolean {
  if (range[0] <= range[1]) {
    return h >= range[0] && h <= range[1]
  }
  // Wrapping range e.g. [352, 8] means 352–360 and 0–8
  return h >= range[0] || h <= range[1]
}

/**
 * Validates that a parsed HSL value falls within a library range.
 */
function validateHslInRange(
  value:     string,
  range:     HslRange,
  fieldName: string
): void {
  const { h, s, l } = parseHsl(value, fieldName)

  if (!hueInRange(h, range.h)) {
    throw new PaletteError(
      `"${fieldName}" hue ${h} is outside the required range ` +
      `${range.h[0]}–${range.h[1]}. ` +
      `Cultural meaning: ${range.note}`,
      value
    )
  }
  if (s < range.s[0] || s > range.s[1]) {
    throw new PaletteError(
      `"${fieldName}" saturation ${s}% is outside the required range ` +
      `${range.s[0]}%–${range.s[1]}%. ` +
      `Cultural meaning: ${range.note}`,
      value
    )
  }
  if (l < range.l[0] || l > range.l[1]) {
    throw new PaletteError(
      `"${fieldName}" lightness ${l}% is outside the required range ` +
      `${range.l[0]}%–${range.l[1]}%. ` +
      `Cultural meaning: ${range.note}`,
      value
    )
  }
}

/**
 * Validates all 4 fields against the library ranges.
 */
export function validateExpressivePalette(
  parsed: unknown,
  ranges: CulturePaletteRanges
): ExpressivePalette {

  const p = parsed as Record<string, unknown>

  if (typeof p.bgPrimary !== 'string') {
    throw new PaletteError('"bgPrimary" field is missing or not a string', JSON.stringify(parsed))
  }
  if (typeof p.accent !== 'string') {
    throw new PaletteError('"accent" field is missing or not a string', JSON.stringify(parsed))
  }
  if (typeof p.gold !== 'string') {
    throw new PaletteError('"gold" field is missing or not a string', JSON.stringify(parsed))
  }
  if (typeof p.fontDisplay !== 'string') {
    throw new PaletteError('"fontDisplay" field is missing or not a string', JSON.stringify(parsed))
  }

  // Validate each color is within its library range
  validateHslInRange(p.bgPrimary as string, ranges.bgPrimary, 'bgPrimary')
  validateHslInRange(p.accent    as string, ranges.accent,    'accent')
  validateHslInRange(p.gold      as string, ranges.gold,      'gold')

  // Validate fontDisplay is one of the approved candidates for this culture
  const fontLower = (p.fontDisplay as string).toLowerCase()
  const approvedLower = ranges.fontDisplay.map(f => f.toLowerCase())
  if (!approvedLower.includes(fontLower)) {
    throw new PaletteError(
      `"fontDisplay" must be one of: ${ranges.fontDisplay.join(', ')}. ` +
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
```

---

## Step 5 — The fallback palette

When all Haiku retries fail, derive a palette from the library without AI.
Pick the midpoint of each HSL range and convert to hsl() string.

```typescript
// src/lib/ai/prePaletteCall.ts

/**
 * Converts an HSL range to a specific hsl() value.
 * Picks a point within the range based on the styleCard mood.
 * No AI involved — deterministic.
 */
function hslRangeToValue(
  range:     HslRange,
  styleCard: string
): string {
  // Map style card to a position in the range (0 = min, 1 = max)
  const position: Record<string, number> = {
    'grand_celebration':    0.85,   // near the dramatic end
    'editorial_bold':       0.9,    // very dramatic
    'romantic_traditional': 0.4,    // slightly warmer
    'destination_glamour':  0.75,   // dramatic
    'modern_minimalist':    0.2,    // quieter end
    'elegant_minimal':      0.15,   // very quiet
    'bohemian_garden':      0.5,    // middle
  }
  const pos = position[styleCard] ?? 0.5

  // Handle hue wrapping for ranges like [352, 8]
  let h: number
  if (range.h[0] <= range.h[1]) {
    h = Math.round(range.h[0] + (range.h[1] - range.h[0]) * pos)
  } else {
    // Wrapping range — calculate through the wrap
    const span = (360 - range.h[0]) + range.h[1]
    const raw  = range.h[0] + span * pos
    h = Math.round(raw >= 360 ? raw - 360 : raw)
  }

  const s = Math.round(range.s[0] + (range.s[1] - range.s[0]) * pos)
  const l = Math.round(range.l[0] + (range.l[1] - range.l[0]) * pos)

  return `hsl(${h}, ${s}%, ${l}%)`
}

/**
 * Builds a fallback palette from library ranges.
 * No AI. No network call. ~0ms.
 */
function buildFallbackPalette(
  ranges:    CulturePaletteRanges,
  styleCard: string
): ExpressivePalette {
  return {
    bgPrimary:   hslRangeToValue(ranges.bgPrimary, styleCard),
    accent:      hslRangeToValue(ranges.accent,    styleCard),
    gold:        hslRangeToValue(ranges.gold,       styleCard),
    fontDisplay: ranges.fontDisplay[0],   // first approved font
  }
}
```

---

## Step 6 — The main function

Puts everything together.

```typescript
// src/lib/ai/prePaletteCall.ts

export interface PalettePreCallParams {
  cultureId:       string
  subRegion?:      string
  styleCard:       string
  vibeTags:        string[]     // from the tag picker UI
  cultureName:     string       // displayName for prompt
}

export async function runPalettePreCall(
  params: PalettePreCallParams
): Promise<ExpressivePalette> {

  // Step 1 — Get palette ranges from the library
  let ranges: CulturePaletteRanges | null = null

  if (params.cultureId === 'western') {
    // Western: select aesthetic family first, then get its ranges
    const familyId = selectWesternFamily(params.styleCard, params.vibeTags)
    const family   = getWesternFamily(familyId)
    if (family) {
      ranges = {
        bgPrimary:   family.bgPrimary,
        accent:      family.accent,
        gold:        family.gold,
        fontDisplay: family.fontDisplay,
      }
    }
  } else {
    ranges = getCulturePaletteRanges(params.cultureId, params.subRegion)
  }

  // If no ranges found (culture not in library yet) — build generic fallback
  if (!ranges) {
    return buildGenericFallback(params.styleCard)
  }

  // Step 2 — Run Haiku with retries
  const MAX_RETRIES = 3
  let lastError: PaletteError | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {

    const prompt = buildPalettePrompt(
      ranges,
      params.styleCard,
      params.vibeTags,
      params.cultureName,
      lastError,
      attempt
    )

    try {
      const raw = await callClaude(prompt, {
        model:     'claude-haiku-4-5',
        maxTokens: 200,
      })

      // Extract JSON
      const firstBrace = raw.indexOf('{')
      const lastBrace  = raw.lastIndexOf('}')
      if (firstBrace === -1 || lastBrace <= firstBrace) {
        throw new PaletteError('No JSON object found in response', raw)
      }

      const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1))

      // Validate against library ranges
      const palette = validateExpressivePalette(parsed, ranges)

      emitEvent({
        event:   'palette_precall',
        attempt,
        status:  'pass',
        culture: params.cultureId,
      })

      return palette

    } catch (error) {
      if (error instanceof PaletteError || error instanceof SyntaxError) {
        lastError = error instanceof PaletteError
          ? error
          : new PaletteError(`JSON parse error: ${(error as Error).message}`, '')

        emitEvent({
          event:       'palette_precall',
          attempt,
          status:      'fail',
          culture:     params.cultureId,
          error:       lastError.message,
        })

        if (attempt === MAX_RETRIES) {
          // All retries exhausted — use library-based fallback (no AI)
          emitEvent({
            event:   'palette_precall',
            attempt,
            status:  'fallback',
            culture: params.cultureId,
          })
          return buildFallbackPalette(ranges, params.styleCard)
        }
      } else {
        throw error  // network error, API error — do not retry
      }
    }
  }

  return buildFallbackPalette(ranges, params.styleCard)
}

/**
 * Generic fallback when culture has no library entry.
 * Returns a neutral, non-embarrassing palette.
 */
function buildGenericFallback(styleCard: string): ExpressivePalette {
  const defaults: Record<string, ExpressivePalette> = {
    'grand_celebration':    { bgPrimary: 'hsl(270, 40%, 15%)', accent: 'hsl(340, 55%, 58%)', gold: 'hsl(44, 85%, 54%)', fontDisplay: 'Great Vibes' },
    'romantic_traditional': { bgPrimary: 'hsl(340, 30%, 16%)', accent: 'hsl(338, 55%, 58%)', gold: 'hsl(40, 80%, 54%)', fontDisplay: 'Great Vibes' },
    'editorial_bold':       { bgPrimary: 'hsl(0, 4%, 8%)',     accent: 'hsl(18, 85%, 52%)',  gold: 'hsl(0, 6%, 80%)',   fontDisplay: 'Playfair Display' },
    'modern_minimalist':    { bgPrimary: 'hsl(210, 10%, 95%)', accent: 'hsl(210, 30%, 30%)', gold: 'hsl(40, 40%, 55%)', fontDisplay: 'Cormorant Garamond' },
    'elegant_minimal':      { bgPrimary: 'hsl(40, 20%, 94%)',  accent: 'hsl(28, 30%, 46%)',  gold: 'hsl(38, 55%, 52%)', fontDisplay: 'EB Garamond' },
  }
  return defaults[styleCard] ?? defaults['grand_celebration']
}
```

---

## Step 7 — How the 4 tokens flow to Call 2 and Call 3

After `runPalettePreCall()` returns, pass the 4 tokens to both calls.

### In the pipeline (src/lib/pipeline.ts or equivalent)

```typescript
// After layout selection:

const palette = await runPalettePreCall({
  cultureId:   culturalProfile.id,
  subRegion:   culturalProfile.subRegion,
  styleCard:   couple.styleCard,
  vibeTags:    couple.vibeTags,            // string[] from VibeTagPicker — no free text
  cultureName: culturalProfile.displayName,
})

// Run Call 2 and Call 3 in parallel — both receive the same 4 tokens
const [call2Result, call3Result] = await Promise.all([
  generateDesignTokens({ ...params, palette }),
  generateHero({ ...params, palette }),
])

// Merge globalTokens: 4 from pre-call + 8 from Call 2
const globalTokens: GlobalTokens = {
  bgPrimary:   palette.bgPrimary,      // from pre-call — locked
  accent:      palette.accent,         // from pre-call — locked
  gold:        palette.gold,           // from pre-call — locked
  fontDisplay: palette.fontDisplay,    // from pre-call — locked
  ...call2Result.globalTokens,         // 8 remaining from Call 2
}
```

### Call 2 prompt addition

Add this block to the Call 2 prompt. The 4 tokens are injected verbatim.

```
EXPRESSIVE PALETTE — USE EXACTLY, DO NOT CHANGE:
These 4 values are fixed. Your job is to build the design system
around them, not to reinvent them.

  bgPrimary:   ${palette.bgPrimary}
  accent:      ${palette.accent}
  gold:        ${palette.gold}
  fontDisplay: ${palette.fontDisplay}

You must produce the remaining 8 tokens that complete the design system:
  bgSecondary  — tonal variant of bgPrimary for alternate sections
  bgCard       — subtle elevated surface for cards
  accentLight  — lighter variant of accent for hover states
  textPrimary  — readable body text on bgPrimary
  textMuted    — secondary text
  textSubtle   — tertiary/quiet text
  fontHeading  — serif heading font harmonious with fontDisplay
  fontBody     — clean sans-serif body font

Return ALL 12 tokens in globalTokens.
The 4 above must appear UNCHANGED in your response.
If you return different values for bgPrimary, accent, gold, or fontDisplay,
your response will fail validation.
```

### Call 2 validator — add this check

```typescript
// In validateCall2Json() — add after existing checks:

// The 4 pre-call tokens must appear unchanged in globalTokens
const PRECALL_KEYS = ['bgPrimary', 'accent', 'gold', 'fontDisplay'] as const

PRECALL_KEYS.forEach(key => {
  if (tokens[key] !== palette[key]) {
    throw new Call2ValidationError(
      `globalTokens.${key} was changed by Call 2. ` +
      `Expected "${palette[key]}", got "${tokens[key]}". ` +
      `The 4 expressive tokens from the pre-call must not be modified.`,
      parsed
    )
  }
})
```

### Call 3 prompt addition

Add this block to the Call 3 prompt. Hero only needs 4 tokens.

```
EXPRESSIVE PALETTE — THESE 4 VALUES ARE FIXED:

  bgPrimary:   ${palette.bgPrimary}   ← your hero canvas
  accent:      ${palette.accent}      ← glow, highlights, CTA button
  gold:        ${palette.gold}        ← decorative elements, dividers
  fontDisplay: ${palette.fontDisplay} ← couple names

Use ONLY these colors in your hero design.
Do not invent new colors. Do not use hex values not derived from these.
rgba() variants of these colors are acceptable for transparency.

You have FULL CREATIVE FREEDOM on:
  Layout and composition
  Animations and transitions
  Particle effects and ambient motion
  SVG motifs and cultural decorations
  Typography sizing and hierarchy
  Canvas effects, parallax, glow

Do NOT think about bgCard, textSubtle, or any design-system tokens.
Call 2 handles those. Your only job is to make the hero
the WOW opening of this couple's story using these 4 values.
```

---

## Step 8 — Converting HSL to hex for CSS use

The pre-call returns HSL strings like `"hsl(348, 88%, 16%)"`.
CSS accepts HSL natively. No conversion needed for CSS custom properties.

However, if any downstream code expects hex values, use this utility:

```typescript
// src/lib/utils/hslToHex.ts

export function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) throw new Error(`Invalid HSL string: ${hsl}`)

  let h = parseInt(match[1]) / 360
  const s = parseInt(match[2]) / 100
  const l = parseInt(match[3]) / 100

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hue2rgb(p, q, h + 1/3)
  const g = hue2rgb(p, q, h)
  const b = hue2rgb(p, q, h - 1/3)

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
```

---

## Step 9 — Tests

```typescript
// src/lib/ai/prePaletteCall.test.ts

describe('selectWesternFamily', () => {
  it('returns botanical_garden for garden + floral tags', () => {
    expect(selectWesternFamily('romantic_traditional', ['garden', 'floral']))
      .toBe('botanical_garden')
  })
  it('returns editorial_minimal for bold + modern tags', () => {
    expect(selectWesternFamily('editorial_bold', ['bold', 'modern']))
      .toBe('editorial_minimal')
  })
  it('falls back to style card when no tags match', () => {
    expect(selectWesternFamily('editorial_bold', ['beautiful', 'happy']))
      .toBe('editorial_minimal')
  })
  it('uses style card to break ties', () => {
    // romantic + elegant ties between botanical_garden and french_luxury
    // romantic_traditional style card prefers botanical_garden
    expect(selectWesternFamily('romantic_traditional', ['romantic', 'elegant']))
      .toBe('botanical_garden')
  })
})

describe('validateExpressivePalette', () => {
  const hinduRanges = getCulturePaletteRanges('hindu_indian', 'punjabi')!

  it('passes valid Punjabi red', () => {
    expect(() => validateExpressivePalette({
      bgPrimary: 'hsl(348, 88%, 16%)',
      accent:    'hsl(342, 60%, 56%)',
      gold:      'hsl(44, 90%, 54%)',
      fontDisplay: 'Great Vibes',
    }, hinduRanges)).not.toThrow()
  })

  it('fails when hue is outside range', () => {
    expect(() => validateExpressivePalette({
      bgPrimary: 'hsl(200, 88%, 16%)',  // blue — wrong for Hindu
      accent:    'hsl(342, 60%, 56%)',
      gold:      'hsl(44, 90%, 54%)',
      fontDisplay: 'Great Vibes',
    }, hinduRanges)).toThrow('hue 200 is outside the required range')
  })

  it('fails when saturation is too low', () => {
    expect(() => validateExpressivePalette({
      bgPrimary: 'hsl(348, 20%, 16%)',  // too desaturated — not vivid enough
      accent:    'hsl(342, 60%, 56%)',
      gold:      'hsl(44, 90%, 54%)',
      fontDisplay: 'Great Vibes',
    }, hinduRanges)).toThrow('saturation 20% is outside the required range')
  })

  it('fails when fontDisplay is not in approved list', () => {
    expect(() => validateExpressivePalette({
      bgPrimary: 'hsl(348, 88%, 16%)',
      accent:    'hsl(342, 60%, 56%)',
      gold:      'hsl(44, 90%, 54%)',
      fontDisplay: 'Comic Sans',
    }, hinduRanges)).toThrow('"fontDisplay" must be one of')
  })
})

describe('hslRangeToValue wrapping', () => {
  it('handles wrapping range [352, 8] correctly', () => {
    const range: HslRange = { h: [352, 8], s: [80, 98], l: [14, 26], note: '' }
    const result = hslRangeToValue(range, 'grand_celebration')
    const match = result.match(/hsl\((\d+)/)!
    const h = parseInt(match[1])
    // Should be in 352-360 or 0-8
    expect(h >= 352 || h <= 8).toBe(true)
  })
})

describe('runPalettePreCall fallback', () => {
  it('returns fallback palette when Haiku fails 3 times', async () => {
    // Mock callClaude to always return invalid response
    const result = await runPalettePreCall({
      cultureId:   'hindu_indian',
      subRegion:   'punjabi',
      styleCard:   'grand_celebration',
      vibeTags:    ['grand', 'opulent'],
      cultureName: 'Hindu — Punjabi',
    })
    // Result must be valid HSL strings within the Punjabi ranges
    expect(result.bgPrimary).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
    expect(result.fontDisplay).toBeDefined()
  })
})
```

---

## Step 10 — Observability events to add

```typescript
// Emit these in runPalettePreCall() — already shown in the main function above

// In emitEvent() — add these event types to the GenerationEvent interface:
//   'palette_precall'

// Structured event fields:
{
  event:   'palette_precall',
  attempt: number,
  status:  'pass' | 'fail' | 'fallback',
  culture: string,
  error?:  string,    // only on fail
}
```

**Alert thresholds:**

| Condition | Action |
|-----------|--------|
| `palette_precall` `status: fail` attempt 2 > 10% | Improve the HSL prompt |
| `palette_precall` `status: fallback` > 5% | Haiku is struggling — investigate |
| `palette_precall` `status: fallback` for any culture consistently | That culture's ranges may be too narrow |

---

## What changes in the DB

No new columns. `global_tokens` JSONB already stores all 12 tokens.
After merging pre-call tokens with Call 2 tokens, save all 12 as before.

Store the pre-call result separately for debugging:

```sql
-- Add to couples table:
ALTER TABLE couples ADD COLUMN expressive_palette JSONB;
-- Stores { bgPrimary, accent, gold, fontDisplay } from pre-call
-- Used for: debugging, analytics, edit flow (palette stays locked unless "Start fresh")
```

---

## Summary — what Claude Code needs to build

```
1. getCulturePaletteRanges()    in src/lib/cultural/library.ts
   getWesternFamily()           in src/lib/cultural/library.ts

2. selectWesternFamily()        in src/lib/ai/vibeTagPicker.ts
   (already specified in VIBE_TAG_PICKER_SPEC.md)
   (western aesthetic family selection — pure logic, no AI)
   Note: this function lives in vibeTagPicker.ts, not prePaletteCall.ts
   prePaletteCall.ts imports it from there

3. buildPalettePrompt()         in src/lib/ai/prePaletteCall.ts
   (injects HSL ranges from library into Haiku prompt)
   (vibeTags: string[] — no free text, no parseOptionalText)

4. validateExpressivePalette()  in src/lib/ai/prePaletteCall.ts
   (validates HSL output is within library ranges — with hue wrapping)

5. buildFallbackPalette()       in src/lib/ai/prePaletteCall.ts
   (deterministic fallback from library ranges — no AI)

6. runPalettePreCall()          in src/lib/ai/prePaletteCall.ts
   (main function — reads library, runs Haiku, validates, falls back)
   (params.vibeTags is string[] from VibeTagPicker — no optionalText)

7. hslToHex()                   in src/lib/utils/hslToHex.ts
   (utility — only if downstream code needs hex instead of hsl)

8. Pipeline changes             in src/lib/pipeline.ts
   - Insert pre-call between layout selection and Call 2/3
   - Run Call 2 and Call 3 with Promise.all (parallel)
   - Merge 4 pre-call tokens + 8 Call 2 tokens into globalTokens

9. Call 2 prompt addition       in src/lib/ai/prompt.ts
   - "EXPRESSIVE PALETTE — USE EXACTLY" block
   - Call 2 validator: check 4 tokens match pre-call values

10. Call 3 prompt addition      in src/lib/ai/prompt.ts
    - "THESE 4 VALUES ARE FIXED" block
    - "FULL CREATIVE FREEDOM on everything else" statement

11. Tests                       in src/lib/ai/prePaletteCall.test.ts
    (validateExpressivePalette, hslRangeToValue wrapping, fallback activation)
    Note: selectWesternFamily tests live in vibeTagPicker.test.ts

12. DB change                   in supabase migration
    ALTER TABLE couples ADD COLUMN expressive_palette JSONB
    (vibe_tags TEXT[] and the migration script are in VIBE_TAG_PICKER_SPEC.md)
```