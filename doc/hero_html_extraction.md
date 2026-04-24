# AI Response Validation — Call 2 and Call 3

## Scope

This document covers validation and retry for both AI calls that produce
output injected directly into the wedding site:

- **Call 2** — full site design tokens (CSS JSON + globalTokens + content)
- **Call 3** — hero HTML fragment

Both use the same three-layer pattern. Call 2 is covered in Part 1.
Call 3 is covered in Part 2. Read both before implementing either.

---

## Why the Previous Approach Was Wrong

The previous `extractHeroHtml` function used regex stripping to remove known
bad patterns from AI responses. This is a reactive approach — every new
unexpected output format requires a code change.

```
Today:     AI wraps in ```html  →  strip ```html fences
Next week: AI adds "Here is your hero:" prose  →  strip prose prefix
Week 3:    AI adds <!-- Hero --> comment  →  strip HTML comments
Week 4:    AI returns <html><body> wrapper  →  strip document tags
```

The correct approach:
1. Tell AI what format to return and why (prevents the problem)
2. Extract by real structural boundaries, not pattern matching
3. Validate what actually matters with specific checks
4. Retry with the exact error shown to AI — not blind re-roll
5. Fall back gracefully so the couple never sees a broken page

---

## The Three-Layer Pattern

The same pattern applies to both Call 2 and Call 3.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1 — Prompt constraint                            │
│  Tell AI what format to return and why.                 │
│  "Feeds directly into a parser" framing.                │
│  Eliminates ~95% of format problems.                    │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 2 — Structural extraction                        │
│  Find real content by its actual boundaries.            │
│  For JSON: first { to last }                            │
│  For HTML: first < to last >                            │
│  No dependency on anticipated bad patterns.             │
│  Handles ~4% of remaining cases.                        │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 3 — Validation + retry with error context        │
│  Check specific rules. On failure: show AI its previous │
│  response + the exact error. Up to 2 retries.           │
│  AbortController ceiling: 180s total across all calls.  │
│  Fallback if all retries exhausted.                     │
│  Handles ~0.9% of cases.                               │
└─────────────────────────────────────────────────────────┘
```

---

# Part 1 — Call 2: Design Token Validation

## Why Call 2 Needs This

Call 2 sparse output is the worse failure mode. The couple waits 60+ seconds
and gets a site where the hero renders but every other section is unstyled.
"Only 5 selectors styled instead of 35" is harder to diagnose than a hero
format error, and the UX impact is greater.

---

## Layer 1 — Call 2 Prompt Constraint

Add this block to the Call 2 prompt:

```
OUTPUT FORMAT — CRITICAL:
Return a single JSON object only.

Rules:
- Your entire response must be valid JSON
- Start with { and end with }
- No markdown fences (no ```json, no ```)
- No explanation before or after the JSON
- Do not say "Here is the design" or anything like it

Your response will be passed directly to JSON.parse().
Any non-JSON character will throw a parse error.

COMPLETENESS REQUIREMENT:
The styles object must include ALL of the following selectors.
Missing selectors means unstyled sections for the couple.

Required selectors:
  body, nav, .nav-monogram, .nav-link,
  .story, .story-eyebrow, .story-script, .story-heading,
  .story-body, .story-quote,
  .events, .events-eyebrow, .events-heading, .event-card,
  .event-name, .event-detail,
  .rsvp, .rsvp-heading, .rsvp-sub, .rsvp-eyebrow,
  .form-field input, .form-field select, .form-field textarea,
  .rsvp-option label, .rsvp-submit,
  .faq, .faq-heading, .faq-question, .faq-answer, .faq-icon,
  .gallery, .gallery-heading, .gallery-item,
  footer, .footer-names, .footer-info, .footer-tagline

Do not return fewer than 25 styled selectors.
```

---

## Layer 2 — Call 2 JSON Extraction

```typescript
// src/lib/ai/extractCall2Json.ts

export class Call2ExtractionError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string
  ) {
    super(message)
    this.name = 'Call2ExtractionError'
  }
}

export function extractCall2Json(raw: string): unknown {

  // Step 1: find first { — discard everything before it
  const firstBrace = raw.indexOf('{')
  if (firstBrace === -1) {
    throw new Call2ExtractionError(
      'No JSON object found — response contains no { character',
      raw
    )
  }

  // Step 2: find last } — discard everything after it
  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace <= firstBrace) {
    throw new Call2ExtractionError(
      'No closing } found — JSON object is not terminated',
      raw
    )
  }

  // Step 3: extract the JSON range
  const candidate = raw.slice(firstBrace, lastBrace + 1)

  // Step 4: parse — if this throws, the extracted content is not valid JSON
  try {
    return JSON.parse(candidate)
  } catch (e) {
    throw new Call2ExtractionError(
      `Extracted content is not valid JSON: ${(e as Error).message}`,
      raw
    )
  }
}
```

---

## Layer 3 — Call 2 Validator

```typescript
// src/lib/ai/validateCall2Json.ts

const REQUIRED_SELECTORS = [
  'body', 'nav', '.nav-monogram', '.nav-link',
  '.story', '.story-eyebrow', '.story-script', '.story-heading',
  '.story-body', '.story-quote',
  '.events', '.events-eyebrow', '.events-heading', '.event-card',
  '.event-name', '.event-detail',
  '.rsvp', '.rsvp-heading', '.rsvp-sub', '.rsvp-eyebrow',
  '.form-field input', '.rsvp-submit',
  '.faq', '.faq-heading', '.faq-question', '.faq-icon',
  'footer', '.footer-names', '.footer-tagline',
]

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
  // Bilingual fonts (v2)
  'noto serif sc', 'noto serif tc',
  'noto naskh arabic', 'scheherazade new',
  'frank ruhl libre', 'heebo',
]

export class Call2ValidationError extends Error {
  constructor(
    message: string,
    public readonly parsed: unknown
  ) {
    super(message)
    this.name = 'Call2ValidationError'
  }
}

export function validateCall2Json(parsed: unknown): void {
  const data = parsed as Record<string, unknown>

  // 1. globalTokens must have all 12 required keys
  const tokens = data.globalTokens as Record<string, string> | undefined
  if (!tokens || typeof tokens !== 'object') {
    throw new Call2ValidationError(
      'Missing globalTokens object. All 12 token keys are required: ' +
      REQUIRED_TOKEN_KEYS.join(', '),
      parsed
    )
  }
  const missingTokens = REQUIRED_TOKEN_KEYS.filter(k => !tokens[k])
  if (missingTokens.length > 0) {
    throw new Call2ValidationError(
      `globalTokens is missing required keys: ${missingTokens.join(', ')}`,
      parsed
    )
  }

  // 2. styles must be present and have at least 25 selectors
  const styles = data.styles as Record<string, unknown> | undefined
  if (!styles || typeof styles !== 'object') {
    throw new Call2ValidationError(
      'Missing styles object. Return CSS properties for every skeleton selector.',
      parsed
    )
  }
  const selectorCount = Object.keys(styles).length
  if (selectorCount < 25) {
    throw new Call2ValidationError(
      `styles has only ${selectorCount} selectors — minimum 25 required. ` +
      'Every section of the skeleton must be styled or the site will appear unstyled.',
      parsed
    )
  }

  // 3. Required selectors must all be present
  const missingSelectors = REQUIRED_SELECTORS.filter(s => !styles[s])
  if (missingSelectors.length > 0) {
    throw new Call2ValidationError(
      `styles is missing required selectors: ${missingSelectors.join(', ')}. ` +
      'These selectors map directly to visible sections — missing them means unstyled UI.',
      parsed
    )
  }

  // 4. fonts must be an array with approved values only
  const fonts = data.fonts as string[] | undefined
  if (!Array.isArray(fonts) || fonts.length === 0) {
    throw new Call2ValidationError(
      'fonts must be a non-empty array of Google Font names.',
      parsed
    )
  }
  const unapprovedFonts = fonts.filter(
    f => !APPROVED_FONTS.includes(f.split(':')[0].toLowerCase())
  )
  if (unapprovedFonts.length > 0) {
    throw new Call2ValidationError(
      `fonts contains unapproved values: ${unapprovedFonts.join(', ')}. ` +
      `Approved fonts: ${APPROVED_FONTS.join(', ')}`,
      parsed
    )
  }

  // 5. content must have at least 30 non-empty string values
  const content = data.content as Record<string, string> | undefined
  if (!content || typeof content !== 'object') {
    throw new Call2ValidationError(
      'Missing content object. Return copy values for all placeholder tokens.',
      parsed
    )
  }
  const nonEmptyContent = Object.values(content).filter(
    v => typeof v === 'string' && v.trim().length > 0
  ).length
  if (nonEmptyContent < 30) {
    throw new Call2ValidationError(
      `content has only ${nonEmptyContent} non-empty values — minimum 30 required. ` +
      'Return copy for all placeholder tokens including story, FAQ, RSVP labels.',
      parsed
    )
  }

  // 6. designSummary must be a meaningful string
  const summary = data.designSummary as string | undefined
  if (!summary || typeof summary !== 'string' || summary.trim().length < 30) {
    throw new Call2ValidationError(
      'designSummary must be at least 30 characters. ' +
      'This is used in future edit prompts to maintain design coherence.',
      parsed
    )
  }
}
```

---

## Layer 3 — Call 2 Retry Loop

```typescript
// src/lib/ai/call2Generator.ts

const MAX_RETRIES = 2
const TOTAL_TIMEOUT_MS = 180_000  // 180s ceiling across all attempts

export async function generateDesignTokensWithRetry(
  params: Call2Params
): Promise<Call2Result> {

  const startTime = Date.now()
  let lastError: Call2ValidationError | Call2ExtractionError | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {

    // Hard ceiling — if we are past 180s total, stop trying
    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      emitEvent({
        event: 'call2.timeout',
        attempt,
        latency_ms: Date.now() - startTime,
      })
      throw new Error('Call 2 exceeded 180s total timeout — aborting')
    }

    const controller = new AbortController()
    // Per-attempt timeout: 60s
    const timeout = setTimeout(() => controller.abort(), 60_000)

    const prompt = buildCall2Prompt(params, lastError, attempt)

    try {
      const raw = await callClaude(prompt, {
        model: 'claude-sonnet-4-5',
        maxTokens: 4000,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const parsed = extractCall2Json(raw)
      validateCall2Json(parsed)

      emitEvent({
        event: 'call2.generate',
        attempt,
        status: 'pass',
        latency_ms: Date.now() - startTime,
      })

      return parsed as Call2Result

    } catch (error) {
      clearTimeout(timeout)

      if (
        error instanceof Call2ValidationError ||
        error instanceof Call2ExtractionError
      ) {
        lastError = error

        emitEvent({
          event: 'call2.generate',
          attempt,
          status: 'fail',
          rules_failed: [error.message.slice(0, 100)],
          latency_ms: Date.now() - startTime,
        })

        console.warn(`[Call2] Attempt ${attempt}/${MAX_RETRIES + 1} failed: ${error.message}`)

        if (attempt === MAX_RETRIES + 1) {
          // All retries exhausted — this is a critical failure
          // Call 2 has no safe fallback (unlike hero which has a fallback template)
          // Throw — the generation API route handles this and shows the couple an error
          emitEvent({
            event: 'call2.generate',
            attempt,
            status: 'fallback',
            latency_ms: Date.now() - startTime,
          })
          throw new Error(
            `Call 2 failed after ${MAX_RETRIES + 1} attempts. Last error: ${error.message}`
          )
        }
      } else {
        clearTimeout(timeout)
        throw error
      }
    }
  }

  throw new Error('Unreachable')
}
```

**Note on Call 2 fallback:** Unlike Call 3, there is no safe fallback for Call 2.
A fallback hero can use hardcoded CSS from `globalTokens`. But Call 2 *produces*
`globalTokens` — there is nothing to fall back to. If Call 2 fails after all
retries, show the couple a clear error and a "Try again" button. Do not show
a broken unstyled site.

---

# Part 2 — Call 3: Hero HTML Validation

---

## Layer 1 — Call 3 Prompt Constraint

Add this block verbatim to the Call 3 prompt:

```
OUTPUT FORMAT — CRITICAL:
Your entire response must be raw HTML only.

Rules:
- Start your response with < (the first character must be a < symbol)
- End your response with > (the last character must be a > symbol)
- No markdown code fences (no ```html, no ```)
- No explanation before the HTML
- No commentary after the HTML
- No <!DOCTYPE>, <html>, <head>, or <body> tags
- Do not say "Here is your hero section" or anything like it
- Include a <style> block with all CSS — no external stylesheets
- Include a <script> block for countdown timer and animations

Your response will be passed directly to a DOM parser.
Any character that is not valid HTML will cause a parse error.
Return only the HTML fragment.
```

The key framing: *"passed directly to a DOM parser"* gives AI the correct
mental model. It is not a style rule to memorise — it is a technical constraint
with a concrete consequence.

---

## Layer 2 — Call 3 HTML Extraction

No third-party dependencies. Boundary detection uses the real structural
signals of HTML: first `<` and last `>`.

```typescript
// src/lib/renderer/extractHeroHtml.ts

export class HeroExtractionError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string
  ) {
    super(message)
    this.name = 'HeroExtractionError'
  }
}

export function extractHeroHtml(raw: string): string {

  // Step 1: find the first < that opens a real HTML tag
  // Use /<[a-zA-Z\/!]/ to skip comparison operators like < 100px or < 4.5:1
  // that could appear in AI prose before the HTML starts
  const firstTagMatch = raw.search(/<[a-zA-Z\/!]/)
  const firstAngle = firstTagMatch !== -1 ? firstTagMatch : raw.indexOf('<')
  if (firstAngle === -1) {
    throw new HeroExtractionError(
      'No HTML found — response contains no < character. ' +
      'Possible: response is prose only or markdown without HTML.',
      raw
    )
  }

  // Step 2: find the last > character — discard everything after it
  const lastAngle = raw.lastIndexOf('>')
  if (lastAngle <= firstAngle) {
    throw new HeroExtractionError(
      'No closing > found — HTML fragment is not terminated.',
      raw
    )
  }

  // Step 3: extract the HTML range
  const candidate = raw.slice(firstAngle, lastAngle + 1)

  // Step 4: the ONLY two regex operations — narrow and justified
  // Handles the edge case where a ``` survives inside the extracted range
  const cleaned = candidate
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  // Step 5: verify at least one structural element exists
  // One regex line — no third-party parser needed
  if (!/<(section|div|header|main|article)\b/i.test(cleaned)) {
    throw new HeroExtractionError(
      'Extracted content has no structural HTML element ' +
      '(section, div, header, main, or article).',
      raw
    )
  }

  return cleaned
}
```

---

## Layer 3 — Call 3 Validator

```typescript
// src/lib/renderer/validateHeroHtml.ts

export class HeroValidationError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string
  ) {
    super(message)
    this.name = 'HeroValidationError'
  }
}

export function validateHeroHtml(
  html: string,
  globalTokens: GlobalTokens
): void {

  // 1. Must start with an HTML tag
  if (!html.trimStart().startsWith('<')) {
    throw new HeroValidationError(
      'Response does not start with an HTML tag — ' +
      'possible markdown or prose prefix survived extraction.',
      html
    )
  }

  // 2. Must not contain markdown fences
  if (html.includes('```')) {
    throw new HeroValidationError(
      'Response contains markdown code fences (```). ' +
      'Return raw HTML only — no markdown formatting.',
      html
    )
  }

  // 3. Must not contain document-level tags
  if (/<html|<body|<!DOCTYPE/i.test(html)) {
    throw new HeroValidationError(
      'Response contains document-level tags (<html>, <body>, or <!DOCTYPE>). ' +
      'Return an HTML fragment only — no document wrapper.',
      html
    )
  }

  // 4. Must contain a <style> block with CSS
  // This was the exact failure mode that prompted this redesign:
  // AI returned hero HTML with zero CSS — extractor ate the trailing <style>
  if (!/<style[\s>]/i.test(html)) {
    throw new HeroValidationError(
      'Response is missing a <style> block. ' +
      'All CSS must be inline in a <style> tag — no external stylesheets. ' +
      'The hero will appear completely unstyled without this.',
      html
    )
  }

  // 5. Style block must not be empty or trivially small
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  if (!styleMatch || styleMatch[1].trim().length < 100) {
    throw new HeroValidationError(
      'The <style> block is empty or contains less than 100 characters of CSS. ' +
      'The hero requires full CSS for layout, typography, animations, and colors.',
      html
    )
  }

  // 6. Should contain a <script> block (warning behaviour — log but don't fail)
  // Not every hero requires JS, but a missing countdown is usually a mistake
  if (!/<script[\s>]/i.test(html)) {
    console.warn(
      '[HeroValidator] No <script> block found. ' +
      'If the hero includes a countdown timer, it requires JavaScript.'
    )
    // Note: this is a warning only — do not throw
  }

  // 7. Palette coherence — hero must use globalTokens colors
  // Count hex values in the style block that are NOT in globalTokens
  const tokenHexValues = Object.values(globalTokens)
    .filter(v => typeof v === 'string' && v.startsWith('#'))
    .map(v => v.toLowerCase())

  const styleContent = styleMatch[1]
  const allHexValues = styleContent.match(/#[0-9a-f]{3,8}\b/gi) ?? []
  const uniqueHex = [...new Set(allHexValues.map(h => h.toLowerCase()))]
  const outsideTokens = uniqueHex.filter(h => !tokenHexValues.includes(h))

  // Allow up to 5 colors outside globalTokens (for transparency variants, gradients etc)
  // More than 5 suggests the hero is inventing its own palette
  if (outsideTokens.length > 5) {
    throw new HeroValidationError(
      `Hero style block contains ${outsideTokens.length} colors not in globalTokens: ` +
      `${outsideTokens.slice(0, 5).join(', ')}... ` +
      'The hero must use the design tokens established in Call 2. ' +
      `Required colors: ${tokenHexValues.join(', ')}`,
      html
    )
  }

  // 8. Must contain both name placeholders
  if (!html.includes('{{PERSON1_NAME}}') || !html.includes('{{PERSON2_NAME}}')) {
    throw new HeroValidationError(
      'Response is missing {{PERSON1_NAME}} and/or {{PERSON2_NAME}} placeholders. ' +
      'Both must appear in the hero HTML — they are replaced with real names at render time.',
      html
    )
  }

  // 9. Must contain RSVP CTA link
  if (!html.includes('#rsvp')) {
    throw new HeroValidationError(
      'Response is missing the required CTA link to #rsvp. ' +
      'The hero must include a call-to-action button that links to #rsvp.',
      html
    )
  }

  // 10. Must not load external resources
  if (/<script\s+src|<link\s+rel="stylesheet"/i.test(html)) {
    throw new HeroValidationError(
      'Response contains external resource links (<script src> or <link rel="stylesheet">). ' +
      'All CSS and JS must be inline — no external files.',
      html
    )
  }
}
```

---

## Layer 3 — Call 3 Retry Loop

```typescript
// src/lib/renderer/heroGenerator.ts

const MAX_RETRIES = 2          // Start at 2 — raise to 3 only if telemetry shows
                                // retry-2 succeeds at a meaningful rate (>5%)
const TOTAL_TIMEOUT_MS = 180_000  // 180s ceiling across all attempts

export async function generateHeroWithRetry(
  params: HeroGenerationParams
): Promise<string> {

  const startTime = Date.now()
  let lastError: HeroValidationError | HeroExtractionError | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {

    // Hard ceiling — stop if total time exceeded
    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      emitEvent({
        event: 'hero.generate',
        attempt,
        status: 'timeout',
        latency_ms: Date.now() - startTime,
      })
      return buildFallbackHero(params)
    }

    const controller = new AbortController()
    // Per-attempt timeout: 60s
    const timeout = setTimeout(() => controller.abort(), 60_000)

    const prompt = buildHeroPrompt(params, lastError, attempt)

    try {
      const raw = await callClaude(prompt, {
        model: 'claude-sonnet-4-5',
        maxTokens: 4000,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const html = extractHeroHtml(raw)
      validateHeroHtml(html, params.globalTokens)

      emitEvent({
        event: 'hero.generate',
        attempt,
        status: 'pass',
        latency_ms: Date.now() - startTime,
      })

      return html

    } catch (error) {
      clearTimeout(timeout)

      if (
        error instanceof HeroValidationError ||
        error instanceof HeroExtractionError
      ) {
        lastError = error

        emitEvent({
          event: 'hero.generate',
          attempt,
          status: 'fail',
          rules_failed: [error.message.slice(0, 100)],
          retry_reason: error.constructor.name,
          latency_ms: Date.now() - startTime,
        })

        console.warn(
          `[HeroGenerator] Attempt ${attempt}/${MAX_RETRIES + 1} failed: ${error.message}`
        )

        if (attempt === MAX_RETRIES + 1) {
          emitEvent({
            event: 'hero.generate',
            attempt,
            status: 'fallback',
            latency_ms: Date.now() - startTime,
          })
          return buildFallbackHero(params)
        }

      } else {
        throw error   // network, API, unexpected — do not retry
      }
    }
  }

  return buildFallbackHero(params)
}
```

---

### Retry Prompt — Error Context

On retry, prepend the exact error to the base prompt.
AI corrects specific concrete errors far more reliably than it corrects vague ones.

```typescript
function buildHeroPrompt(
  params: HeroGenerationParams,
  lastError: HeroValidationError | HeroExtractionError | null,
  attempt: number
): string {

  const basePrompt = buildBaseHeroPrompt(params)

  if (!lastError || attempt === 1) {
    return basePrompt
  }

  const correctionBlock = `
CORRECTION REQUIRED — YOUR PREVIOUS RESPONSE HAD AN ERROR:

Error: ${lastError.message}

Your previous response started with:
  ${lastError.rawResponse.slice(0, 300)}

Fix this specific problem. Then return the complete hero HTML.
Remember: first character must be < and last must be >.
`.trim()

  return correctionBlock + '\n\n' + basePrompt
}
```

---

## The Fallback Hero

Used when all Call 3 retries are exhausted. Uses the couple's actual
`globalTokens` so it matches the rest of the site.

**Sizing:** Uses `min-height: 60vh` not `100vh`. Pushing all skeleton sections
below the fold makes the site feel broken to the couple. 60vh gives the hero
presence while letting the story section appear without scrolling.

**Dashboard indicator:** The fallback is visually clean but the couple's
dashboard must know it fired. Show a quiet indicator:

```
⚠️ We used our standard hero template for now.
   [Generate a custom one →]
```

This is honest without being alarming. The regenerate button runs Call 3 again.

```typescript
// src/lib/renderer/fallbackHero.ts

export function buildFallbackHero(params: HeroGenerationParams): string {
  const { globalTokens: t } = params

  return `
<section class="hero" data-fallback="true" style="
  background: ${t.bgPrimary};
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 2rem;
  font-family: '${t.fontBody}', sans-serif;
">
  <style>
    .hero-fallback-names {
      font-family: '${t.fontDisplay}', serif;
      color: ${t.textPrimary};
      font-size: clamp(3rem, 10vw, 7rem);
      font-weight: 400;
      line-height: 1.1;
      margin-bottom: 2rem;
    }
    .hero-fallback-amp {
      color: ${t.accent};
      font-size: 0.55em;
      display: block;
    }
    .hero-fallback-meta {
      color: ${t.textMuted};
      font-size: 1rem;
      letter-spacing: 2px;
      margin-bottom: 3rem;
    }
    .hero-fallback-cta {
      display: inline-block;
      padding: 1rem 2.5rem;
      background: ${t.accent};
      color: white;
      text-decoration: none;
      letter-spacing: 3px;
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    .hero-fallback-eyebrow {
      color: ${t.gold};
      letter-spacing: 4px;
      font-size: 0.7rem;
      text-transform: uppercase;
      margin-bottom: 2.5rem;
    }
  </style>

  <div>
    <p class="hero-fallback-eyebrow">Together with their families</p>

    <h1 class="hero-fallback-names">
      {{PERSON1_NAME}}
      <span class="hero-fallback-amp">&amp;</span>
      {{PERSON2_NAME}}
    </h1>

    <p class="hero-fallback-meta">
      {{WEDDING_DATE_DISPLAY}} &nbsp;·&nbsp; {{VENUE_NAME}}
    </p>

    <a href="#rsvp" class="hero-fallback-cta">{{CTA_LABEL}}</a>
  </div>
</section>
`.trim()
}
```

The `data-fallback="true"` attribute lets the dashboard detect whether the
fallback fired and show the regenerate indicator.

---

## Observability

Every generation event emits a structured log. Not "add logging" — a specific schema.

```typescript
// src/lib/observability/emitEvent.ts

interface GenerationEvent {
  event:
    | 'call2.generate'
    | 'hero.generate'
    | 'call2.timeout'
    | 'hero.timeout'
  attempt: number
  status: 'pass' | 'fail' | 'fallback' | 'timeout'
  rules_failed?: string[]
  retry_reason?: string
  latency_ms: number
  tokens?: number
  couple_id?: string
}

export function emitEvent(payload: GenerationEvent): void {
  // In development: console.log
  // In production: send to your observability provider
  // (Datadog, LogRocket, Axiom, or a Supabase events table)
  console.log(JSON.stringify({ ...payload, ts: Date.now() }))
}
```

**Alert thresholds:**

| Condition | Action |
|-----------|--------|
| `call2.generate` `status: fail` on attempt 2 fires > 5% | Improve Call 2 base prompt |
| `hero.generate` `status: fail` on attempt 2 fires > 5% | Improve Call 3 base prompt |
| `hero.generate` `status: fallback` fires at all | Immediate investigation |
| `call2.generate` throws (no fallback) fires > 1% | Critical — stop and fix |
| Total latency > 120s for any generation | Check for API issues |

---

## Test Fixtures

Every validator rule must have a failing fixture and a passing fixture.
Without tests the validator decays silently when rules are added or changed.

```typescript
// src/lib/renderer/__tests__/validateHeroHtml.test.ts

describe('validateHeroHtml', () => {
  const mockTokens: GlobalTokens = {
    bgPrimary: '#0e0a14', bgSecondary: '#1a1528', bgCard: '#221e32',
    accent: '#c4607a', accentLight: '#e8a0b0', gold: '#d4a853',
    textPrimary: 'rgba(253,246,238,0.9)', textMuted: 'rgba(253,246,238,0.5)',
    textSubtle: 'rgba(253,246,238,0.3)',
    fontDisplay: 'Great Vibes', fontHeading: 'Cormorant Garamond', fontBody: 'Jost',
  }

  const validHero = `
    <section style="background: #0e0a14">
      <style>.hero { color: #c4607a; font-family: 'Great Vibes'; }
      .hero h1 { color: rgba(253,246,238,0.9); } /* 100+ chars of CSS */
      .hero p { margin: 0; padding: 0; letter-spacing: 2px; }</style>
      <script>// countdown timer code</script>
      <h1>{{PERSON1_NAME}} & {{PERSON2_NAME}}</h1>
      <a href="#rsvp">RSVP</a>
    </section>
  `

  it('passes a valid hero', () => {
    expect(() => validateHeroHtml(validHero, mockTokens)).not.toThrow()
  })

  it('fails when no <style> block', () => {
    const html = validHero.replace(/<style[\s\S]*?<\/style>/i, '')
    expect(() => validateHeroHtml(html, mockTokens))
      .toThrow('missing a <style> block')
  })

  it('fails when <style> is too small', () => {
    const html = validHero.replace(/<style[^>]*>[\s\S]*?<\/style>/i, '<style>.a{}</style>')
    expect(() => validateHeroHtml(html, mockTokens))
      .toThrow('less than 100 characters')
  })

  it('fails when too many colors outside globalTokens', () => {
    const html = validHero.replace(
      '.hero { color: #c4607a;',
      '.hero { color: #c4607a; } .a{color:#111} .b{color:#222} .c{color:#333} .d{color:#444} .e{color:#555} .f{color:#666}'
    )
    expect(() => validateHeroHtml(html, mockTokens))
      .toThrow('colors not in globalTokens')
  })

  it('fails when PERSON1_NAME placeholder missing', () => {
    const html = validHero.replace('{{PERSON1_NAME}}', 'Emma')
    expect(() => validateHeroHtml(html, mockTokens))
      .toThrow('missing {{PERSON1_NAME}}')
  })

  it('fails when #rsvp link missing', () => {
    const html = validHero.replace('href="#rsvp"', 'href="#contact"')
    expect(() => validateHeroHtml(html, mockTokens))
      .toThrow('missing the required CTA link to #rsvp')
  })

  it('warns but does not fail when no <script> block', () => {
    const html = validHero.replace(/<script[\s\S]*?<\/script>/i, '')
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    expect(() => validateHeroHtml(html, mockTokens)).not.toThrow()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No <script> block'))
    warnSpy.mockRestore()
  })

  it('activates fallback after MAX_RETRIES exhausted', async () => {
    // Mock callClaude to always return invalid HTML
    // Verify buildFallbackHero is called
    // Verify data-fallback="true" is in the output
  })
})
```

---

## Validator Rule Change Process

When a new failure mode is discovered in production:

1. **Capture the raw AI response** that caused the failure — store it as a new test fixture
2. **Write the failing test first** — it must fail before the fix
3. **Add the validator rule** — error message must be specific enough to send back to AI
4. **Verify the retry prompt** carries the new error message correctly
5. **PR review required** — validator rules are merged via PR, not hotfixed
6. **Update this document** — add the new rule to the validator section

The validator is the contract between AI output and the renderer.
Changes to it are architectural changes, not patches.

---

## File Locations

```
src/lib/ai/
  extractCall2Json.ts    — Call 2 Layer 2: JSON boundary extraction
  validateCall2Json.ts   — Call 2 Layer 3: design token validation
  call2Generator.ts      — Call 2 Layer 3: retry loop + AbortController

src/lib/renderer/
  extractHeroHtml.ts     — Call 3 Layer 2: HTML boundary extraction
  validateHeroHtml.ts    — Call 3 Layer 3: hero validation (incl. palette coherence)
  heroGenerator.ts       — Call 3 Layer 3: retry loop + AbortController
  fallbackHero.ts        — Call 3 fallback: globalTokens-aware safe hero

src/lib/observability/
  emitEvent.ts           — structured event emission for both calls

src/lib/renderer/__tests__/
  validateHeroHtml.test.ts
  validateCall2Json.test.ts
  extractHeroHtml.test.ts
```

---

## Summary — What Changed From the Previous Version

| Previous version | This version |
|-----------------|-------------|
| Regex stripping of known bad patterns | Boundary detection (first/last `<`/`>` and `{`/`}`) |
| node-html-parser dependency | No third-party parser — one regex for element check |
| Call 3 only | Both Call 2 and Call 3 covered |
| 7 validator checks, missing `<style>` and palette coherence | 10 checks including `<style>` presence, CSS length, palette coherence |
| MAX_RETRIES = 3 | MAX_RETRIES = 2 with explicit note to raise if telemetry supports |
| No timeout | AbortController with 60s per-attempt + 180s total ceiling |
| Fallback with `min-height: 100vh` | Fallback with `min-height: 60vh` + `data-fallback="true"` |
| "Add logging" | Structured event schema with specific alert thresholds |
| No test strategy | Full test fixture spec for every validator rule |
| No rule change process | Explicit 5-step process for adding new rules |