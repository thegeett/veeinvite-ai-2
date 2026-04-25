# AI Response Validation — Call 2 and Call 3

## Architecture Decision

**This document supersedes the previous HTML-extraction approach.**

Call 3 no longer asks AI to return raw HTML. It asks AI to return a JSON
envelope with three fields: `html`, `style`, and `script`. Our code assembles
the final hero section. This eliminates the entire class of structural bugs.

Record this in `docs/DECISIONS.md`:

```
Decision: Call 3 returns JSON envelope, not raw HTML
Date: [today]
Supersedes: §9 "Call 3 returns self-contained hero HTML"
Reason: JSON envelope eliminates structural bugs (missing <style>, unclosed
        <section>, markdown fence leaks) while preserving full creative freedom.
        AI still writes all CSS, HTML content, and JavaScript.
        We own the structural wrapper.
```

---

## The Core Insight

The previous approach tried to solve a *structural* problem with *content* validation.
Missing `<style>` blocks, unclosed `<section>` tags, markdown fence leaks — these are
structural. Validating content cannot reliably catch structural failures.

The JSON envelope takes structure out of AI's hands entirely.

```
BEFORE — AI owns structure and content:

  AI returns:
    <section class="hero">
      <style>/* CSS */</style>
      <!-- HTML content -->
      <script>/* JS */</script>
    </section>

  Risks: AI can mess up any part of this. The <style> can go missing.
         The </section> can be omitted. Markdown fences can leak in.

AFTER — We own structure. AI owns content:

  AI returns:
    {
      "html":   "<!-- inner HTML content only -->",
      "style":  "/* all CSS for this hero */",
      "script": "/* all JS for this hero */"
    }

  We emit:
    <section class="hero">
      <style>{json.style}</style>
      {json.html}
      <script>{json.script}</script>
    </section>

  Structural elements we control: <section>, <style>, <script> wrappers.
  These never go missing. AI cannot accidentally omit or malform them.
```

---

## Three Flavors — Why Flavor 3

There are three ways to use JSON for the hero. We use Flavor 3.

| Flavor | What AI returns | Creative freedom | Build cost |
|--------|----------------|-----------------|------------|
| 1 — Template + params | `{ "variant": "elegant_arch", "animation": "fireflies" }` | Low — picks from N templates | Medium — need 5–10 hand-built templates |
| 2 — Rich design schema | Full design as structured data — background type, name treatment, etc | Medium — constrained to schema vocabulary | High — schema design + renderer, every new idea needs schema update |
| 3 — JSON envelope | `{ "html": "...", "style": "...", "script": "..." }` | Maximum — same as today | Low — ~4 hours |

**Flavor 1** would limit AI to picking from hero templates we built ourselves.
Every couple's hero would be structurally the same. Reliable but not the WOW factor.

**Flavor 2** would give AI a schema vocabulary to describe designs. We emit
pixel-perfect HTML from it. But the schema becomes a long-term maintenance burden
and limits the hero to visual ideas we anticipated when writing the schema.

**Flavor 3** keeps full creative freedom. AI still writes all the CSS, HTML, and
JavaScript. We only take the structural wrapper out of AI's hands.

---

## Scope

This document covers validation and retry for both AI calls that produce output
injected into the wedding site:

- **Call 2** — full site design tokens (CSS JSON + globalTokens + content)
- **Call 3** — hero JSON envelope (`{ html, style, script }`)

Both use the same three-layer pattern.

---

## The Three-Layer Pattern

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1 — Prompt constraint                             │
│  Tell AI what format to return and why.                  │
│  "Feeds directly into JSON.parse()" framing.             │
│  Eliminates ~95% of format problems.                     │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 2 — Structural extraction                         │
│  Find JSON by first { and last }.                        │
│  JSON.parse() — no regex archaeology.                    │
│  Handles ~4% of remaining cases.                         │
└──────────────────────────────┬───────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 3 — Validation + fallback (M1)                    │
│  Simple string checks on guaranteed-present fields.      │
│  On failure: use the fallback envelope (Call 3) or       │
│  log warning + use AI output as-is (Call 2).             │
│                                                          │
│  Layer 3+ — Retry with error context (M2 — see §M2)      │
│  Up to 2 retries with previous-response feedback before  │
│  falling back. Adds ~60s p95 latency, reduces fallback   │
│  rate from ~1% to ~0.2%.                                 │
└──────────────────────────────────────────────────────────┘
```

## M1 vs M2 Scope

| Layer | M1 | M2 |
|-------|----|----|
| Prompt constraints (Layer 1) | ✓ shipped | already in place |
| JSON extraction (Layer 2) | ✓ shipped | already in place |
| Validators (Layer 3 — checks) | ✓ ship now | unchanged |
| Fallback envelope (Layer 3 — Call 3 safety) | ✓ ship now | unchanged |
| Retry with error context (Layer 3 — Phase C) | deferred | ship in M2 |
| Observability events | partial — log only | full schema + alerts |

The retry loop is deliberately deferred. Without it, ~1% of generations
fall back to the safe hero envelope (still styled with `globalTokens`,
just less creative). With it, the fallback rate drops to ~0.2% but adds
runtime complexity. M2 ships retries when production data justifies them.

---

# Part 1 — Call 2: Design Token Validation

Call 2 already uses the JSON pattern. This section documents its validation rules
for completeness and consistency with Call 3.

---

## Layer 1 — Call 2 Prompt Constraint

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

  // Find first { — discard everything before it (prose, markdown fences)
  const firstBrace = raw.indexOf('{')
  if (firstBrace === -1) {
    throw new Call2ExtractionError(
      'No JSON object found — response contains no { character.',
      raw
    )
  }

  // Find last } — discard everything after it
  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace <= firstBrace) {
    throw new Call2ExtractionError(
      'No closing } found — JSON object is not terminated.',
      raw
    )
  }

  // Extract the JSON range and parse
  const candidate = raw.slice(firstBrace, lastBrace + 1)
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
  'noto serif sc', 'noto serif tc',
  'noto naskh arabic', 'scheherazade new',
  'frank ruhl libre', 'heebo',
]

export class Call2ValidationError extends Error {
  constructor(message: string, public readonly parsed: unknown) {
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

  // 2. styles must be present with at least 25 selectors
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
      'Every section must be styled or the site will appear unstyled.',
      parsed
    )
  }

  // 3. All required selectors must be present
  const missingSelectors = REQUIRED_SELECTORS.filter(s => !styles[s])
  if (missingSelectors.length > 0) {
    throw new Call2ValidationError(
      `styles is missing required selectors: ${missingSelectors.join(', ')}. ` +
      'These map directly to visible sections — missing them means unstyled UI.',
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

  // 5. content must have at least 30 non-empty values
  const content = data.content as Record<string, string> | undefined
  if (!content || typeof content !== 'object') {
    throw new Call2ValidationError(
      'Missing content object. Return copy for all placeholder tokens.',
      parsed
    )
  }
  const nonEmptyContent = Object.values(content)
    .filter(v => typeof v === 'string' && v.trim().length > 0).length
  if (nonEmptyContent < 30) {
    throw new Call2ValidationError(
      `content has only ${nonEmptyContent} non-empty values — minimum 30 required.`,
      parsed
    )
  }

  // 6. designSummary must be meaningful
  const summary = data.designSummary as string | undefined
  if (!summary || typeof summary !== 'string' || summary.trim().length < 30) {
    throw new Call2ValidationError(
      'designSummary must be at least 30 characters. ' +
      'Used in future edit prompts to maintain design coherence.',
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
const TOTAL_TIMEOUT_MS = 180_000

export async function generateDesignTokensWithRetry(
  params: Call2Params
): Promise<Call2Result> {

  const startTime = Date.now()
  let lastError: Call2ValidationError | Call2ExtractionError | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {

    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      emitEvent({ event: 'call2.timeout', attempt, latency_ms: Date.now() - startTime })
      throw new Error('Call 2 exceeded 180s total timeout')
    }

    const controller = new AbortController()
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

      emitEvent({ event: 'call2.generate', attempt, status: 'pass', latency_ms: Date.now() - startTime })
      return parsed as Call2Result

    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Call2ValidationError || error instanceof Call2ExtractionError) {
        lastError = error
        emitEvent({ event: 'call2.generate', attempt, status: 'fail', rules_failed: [error.message.slice(0, 100)], latency_ms: Date.now() - startTime })
        if (attempt === MAX_RETRIES + 1) {
          // Call 2 has no safe fallback — it produces globalTokens
          // which nothing else can substitute. Surface a clear error.
          throw new Error(`Call 2 failed after ${MAX_RETRIES + 1} attempts: ${error.message}`)
        }
      } else {
        throw error
      }
    }
  }

  throw new Error('Unreachable')
}
```

**Note:** Call 2 has no fallback. It produces `globalTokens` — the foundation
everything else depends on. If all retries fail, surface a clear error to the
couple with a "Try again" button. Do not show an unstyled site.

---

# Part 2 — Call 3: Hero JSON Envelope

---

## Layer 1 — Call 3 Prompt Constraint

```
OUTPUT FORMAT — CRITICAL:
Return a single JSON object with exactly three fields.

{
  "html":   "<!-- the inner HTML content of the hero, no <section> wrapper -->",
  "style":  "/* all CSS for this hero — complete, not abbreviated */",
  "script": "/* all JavaScript for this hero — countdown timer, animations */"
}

Rules:
- Your entire response must be valid JSON
- Start with { and end with }
- No markdown fences (no ```json, no ```)
- No explanation before or after the JSON
- The html field must NOT include <section>, <style>, or <script> tags
  (our code wraps your html field in the section and injects style and script)
- The style field must contain all CSS — do not put CSS inside the html field
- The script field must contain all JavaScript — do not put scripts inside html
- If you need no JavaScript, set "script" to an empty string ""

Your response will be passed directly to JSON.parse().
Any non-JSON character will throw a parse error.

The html, style, and script fields may contain any content you need —
animations, canvas, SVG, particles, gradients, clip-paths, keyframes.
You have full creative freedom inside these fields.
The JSON envelope is the only constraint.
```

---

## Layer 2 — Call 3 JSON Extraction

Same extraction pattern as Call 2. First `{` to last `}`. JSON.parse. No HTML
boundary detection. No regex archaeology.

```typescript
// src/lib/renderer/extractHeroJson.ts

export class HeroExtractionError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string
  ) {
    super(message)
    this.name = 'HeroExtractionError'
  }
}

export function extractHeroJson(raw: string): HeroJsonEnvelope {

  // Find first { — discard everything before it
  const firstBrace = raw.indexOf('{')
  if (firstBrace === -1) {
    throw new HeroExtractionError(
      'No JSON object found — response contains no { character. ' +
      'Return a JSON object with html, style, and script fields.',
      raw
    )
  }

  // Find last } — discard everything after it
  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace <= firstBrace) {
    throw new HeroExtractionError(
      'No closing } found — JSON object is not terminated.',
      raw
    )
  }

  // Extract and parse
  const candidate = raw.slice(firstBrace, lastBrace + 1)
  try {
    const parsed = JSON.parse(candidate)
    return parsed as HeroJsonEnvelope
  } catch (e) {
    throw new HeroExtractionError(
      `Extracted content is not valid JSON: ${(e as Error).message}. ` +
      'Check that CSS and JavaScript inside the fields have correct JSON escaping.',
      raw
    )
  }
}

interface HeroJsonEnvelope {
  html:   string
  style:  string
  script: string
}
```

---

## Layer 3 — Call 3 Validator

Validation is now simple string checks on guaranteed-present fields.
No HTML boundary detection. No tag-level parsing.

```typescript
// src/lib/renderer/validateHeroJson.ts

export class HeroValidationError extends Error {
  constructor(
    message: string,
    public readonly envelope: HeroJsonEnvelope
  ) {
    super(message)
    this.name = 'HeroValidationError'
  }
}

export function validateHeroJson(
  envelope: HeroJsonEnvelope,
  globalTokens: GlobalTokens
): void {

  // 1. All three fields must be present and be strings
  if (typeof envelope.html !== 'string') {
    throw new HeroValidationError(
      'The "html" field is missing or not a string. ' +
      'Return the inner HTML content of the hero in this field.',
      envelope
    )
  }
  if (typeof envelope.style !== 'string') {
    throw new HeroValidationError(
      'The "style" field is missing or not a string. ' +
      'Return all CSS for the hero in this field.',
      envelope
    )
  }
  if (typeof envelope.script !== 'string') {
    throw new HeroValidationError(
      'The "script" field is missing or not a string. ' +
      'Return all JavaScript in this field, or an empty string if none needed.',
      envelope
    )
  }

  // 2. html must have meaningful content
  if (envelope.html.trim().length < 50) {
    throw new HeroValidationError(
      `The "html" field is too short (${envelope.html.trim().length} chars). ` +
      'The hero HTML must include name headings, date, venue, and a CTA link.',
      envelope
    )
  }

  // 3. html must NOT contain <style> or <script> tags
  // (the assembler wraps them — duplicates cause problems)
  if (/<style[\s>]/i.test(envelope.html)) {
    throw new HeroValidationError(
      'The "html" field contains a <style> tag. ' +
      'Put all CSS in the "style" field — our code injects it correctly.',
      envelope
    )
  }
  if (/<script[\s>]/i.test(envelope.html)) {
    throw new HeroValidationError(
      'The "html" field contains a <script> tag. ' +
      'Put all JavaScript in the "script" field — our code injects it correctly.',
      envelope
    )
  }

  // 4. style must have meaningful CSS
  if (envelope.style.trim().length < 100) {
    throw new HeroValidationError(
      `The "style" field is too short (${envelope.style.trim().length} chars). ` +
      'The hero requires full CSS for layout, typography, colors, and animations.',
      envelope
    )
  }

  // 5. style must not contain @import
  // (fonts are already loaded by the renderer — @import causes duplication
  //  and could load unapproved fonts)
  if (/@import\s/i.test(envelope.style)) {
    throw new HeroValidationError(
      'The "style" field contains @import. ' +
      'Do not import fonts or external CSS — the renderer injects all approved fonts. ' +
      'Use the font families already available from globalTokens.',
      envelope
    )
  }

  // 6. html must contain both name placeholders
  if (!envelope.html.includes('{{PERSON1_NAME}}') ||
      !envelope.html.includes('{{PERSON2_NAME}}')) {
    throw new HeroValidationError(
      'The "html" field is missing {{PERSON1_NAME}} and/or {{PERSON2_NAME}}. ' +
      'Both must appear in the hero HTML — replaced with real names at render time.',
      envelope
    )
  }

  // 7. html must contain the RSVP CTA link
  if (!envelope.html.includes('#rsvp')) {
    throw new HeroValidationError(
      'The "html" field is missing a link to #rsvp. ' +
      'The hero must include a CTA button linking to #rsvp.',
      envelope
    )
  }

  // 8. Palette coherence — hero style must use globalTokens colors
  // Count hex values in style that are NOT in globalTokens
  const tokenHexValues = Object.values(globalTokens)
    .filter(v => typeof v === 'string' && v.startsWith('#'))
    .map(v => v.toLowerCase())

  const allHexValues = envelope.style.match(/#[0-9a-f]{3,8}\b/gi) ?? []
  const uniqueHex = [...new Set(allHexValues.map(h => h.toLowerCase()))]
  const outsideTokens = uniqueHex.filter(h => !tokenHexValues.includes(h))

  if (outsideTokens.length > 5) {
    throw new HeroValidationError(
      `The "style" field contains ${outsideTokens.length} colors not in globalTokens: ` +
      `${outsideTokens.slice(0, 5).join(', ')}. ` +
      'The hero must use the design tokens established in Call 2. ' +
      `Required colors: ${tokenHexValues.join(', ')}`,
      envelope
    )
  }

  // 9. html must not load external resources
  if (/<script\s+src|<link\s+rel="stylesheet"/i.test(envelope.html)) {
    throw new HeroValidationError(
      'The "html" field contains external resource links. ' +
      'All CSS must be in the "style" field. All JS must be in the "script" field.',
      envelope
    )
  }

  // 10. html must NOT contain <section> or </section>
  // Our assembler wraps html in <section class="hero">…</section>. If the
  // html field contains its own section tag, the parser auto-closes our
  // wrapper at the inner </section>, leaving the rest of the hero floating
  // outside the section and a stray closer at the bottom.
  if (/<\/?section[\s>]/i.test(envelope.html)) {
    throw new HeroValidationError(
      'The "html" field contains a <section> tag. ' +
      'Our code wraps your html in <section class="hero"> — do not include <section> yourself. ' +
      'A nested or stray </section> would break the page structure.',
      envelope
    )
  }

  // 11. script must NOT reference {{PLACEHOLDER}} tokens
  // Placeholders are HTML-escape-safe via injectStructured(), but not
  // JS-escape-safe. A name like `</script><script>alert(1)</script>` would
  // escape the script context entirely (self-XSS). Keep script logic
  // generic — read names from the DOM via document.querySelector instead.
  if (/\{\{[A-Z_]+\}\}/.test(envelope.script)) {
    throw new HeroValidationError(
      'The "script" field contains {{PLACEHOLDER}} tokens. ' +
      'Placeholders are HTML-escape-safe but not JS-escape-safe — embedding them ' +
      'in a script context creates an XSS surface. Keep script logic generic ' +
      '(no name/date/venue references). Use document.querySelector to read values from the DOM if needed.',
      envelope
    )
  }
}
```

---

## The Assembler — `buildHeroFromJson`

This is where we control structure. We write the `<section>`, `<style>`, and
`<script>` wrappers. AI cannot accidentally omit or malform them.

```typescript
// src/lib/renderer/buildHeroFromJson.ts

export function buildHeroFromJson(
  envelope: HeroJsonEnvelope,
  isFallback = false
): string {

  const { html, style, script } = envelope

  return `
<section class="hero"${isFallback ? ' data-fallback="true"' : ''}>
  <style>
${style}
  </style>

${html}

${script.trim() ? `  <script>
${script}
  </script>` : ''}
</section>
`.trim()
}
```

The `<section>` open and close tags are written by us. They cannot go missing.
The `<style>` tag is written by us. It cannot go missing.
The `<script>` tag is only emitted if `script` is non-empty — no empty `<script></script>` in the DOM.

---

## Layer 3 — Call 3 Retry Loop

```typescript
// src/lib/renderer/heroGenerator.ts

const MAX_RETRIES = 2
const TOTAL_TIMEOUT_MS = 180_000

export async function generateHeroWithRetry(
  params: HeroGenerationParams
): Promise<string> {

  const startTime = Date.now()
  let lastError: HeroValidationError | HeroExtractionError | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {

    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      emitEvent({ event: 'hero.timeout', attempt, latency_ms: Date.now() - startTime })
      return buildHeroFromJson(buildFallbackEnvelope(params), true)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    const prompt = buildHeroPrompt(params, lastError, attempt)

    try {
      const raw = await callClaude(prompt, {
        model: 'claude-sonnet-4-5',
        // 6000 not 4000 — JSON encoding of HTML/CSS/JS adds ~15% overhead from
        // string escaping (\", \n etc). A hero approaching 4000 raw chars
        // becomes ~4600 chars of JSON, which can hit the token ceiling and
        // truncate. Truncated JSON = parse failure = wasted retry. Bumping
        // gives headroom; cost difference is negligible per call.
        maxTokens: 6000,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      const envelope = extractHeroJson(raw)
      validateHeroJson(envelope, params.globalTokens)

      emitEvent({ event: 'hero.generate', attempt, status: 'pass', latency_ms: Date.now() - startTime })
      return buildHeroFromJson(envelope)

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
          latency_ms: Date.now() - startTime,
        })

        console.warn(`[HeroGenerator] Attempt ${attempt}/${MAX_RETRIES + 1} failed: ${error.message}`)

        if (attempt === MAX_RETRIES + 1) {
          emitEvent({ event: 'hero.generate', attempt, status: 'fallback', latency_ms: Date.now() - startTime })
          return buildHeroFromJson(buildFallbackEnvelope(params), true)
        }
      } else {
        throw error
      }
    }
  }

  return buildHeroFromJson(buildFallbackEnvelope(params), true)
}
```

---

### Retry Prompt — Error Context

```typescript
function buildHeroPrompt(
  params: HeroGenerationParams,
  lastError: HeroValidationError | HeroExtractionError | null,
  attempt: number
): string {

  const basePrompt = buildBaseHeroPrompt(params)

  if (!lastError || attempt === 1) return basePrompt

  // The error message names the specific JSON field and what was wrong.
  // AI corrects specific concrete errors far more reliably than vague ones.
  const correctionBlock = `
CORRECTION REQUIRED — YOUR PREVIOUS RESPONSE HAD AN ERROR:

Error: ${lastError.message}

Previous response (first 300 chars):
  ${lastError instanceof HeroExtractionError
    ? lastError.rawResponse.slice(0, 300)
    : JSON.stringify(lastError.envelope).slice(0, 300)
  }

Fix this specific problem. Then return the complete JSON object.
The response must start with { and end with }.
`.trim()

  return correctionBlock + '\n\n' + basePrompt
}
```

---

## The Fallback Envelope

When all retries are exhausted, we build a safe fallback envelope and pass it
through the same `buildHeroFromJson` assembler. The `<section>`, `<style>`, and
`<script>` wrappers are still ours — the fallback cannot be structurally broken.

```typescript
// src/lib/renderer/fallbackHero.ts

export function buildFallbackEnvelope(
  params: HeroGenerationParams
): HeroJsonEnvelope {

  const { globalTokens: t } = params

  return {
    style: `
.hero { background: ${t.bgPrimary}; min-height: 60vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 4rem 2rem; font-family: '${t.fontBody}', sans-serif; }
.hero-eyebrow { color: ${t.gold}; letter-spacing: 4px; font-size: 0.7rem; text-transform: uppercase; margin-bottom: 2.5rem; }
.hero-names { font-family: '${t.fontDisplay}', serif; color: ${t.textPrimary}; font-size: clamp(3rem, 10vw, 7rem); font-weight: 400; line-height: 1.1; margin-bottom: 2rem; }
.hero-amp { color: ${t.accent}; font-size: 0.55em; display: block; }
.hero-meta { color: ${t.textMuted}; font-size: 1rem; letter-spacing: 2px; margin-bottom: 3rem; }
.hero-cta { display: inline-block; padding: 1rem 2.5rem; background: ${t.accent}; color: white; text-decoration: none; letter-spacing: 3px; font-size: 0.75rem; text-transform: uppercase; }
    `.trim(),

    html: `
<div>
  <p class="hero-eyebrow">Together with their families</p>
  <h1 class="hero-names">
    {{PERSON1_NAME}}
    <span class="hero-amp">&amp;</span>
    {{PERSON2_NAME}}
  </h1>
  <p class="hero-meta">{{WEDDING_DATE_DISPLAY}} &nbsp;·&nbsp; {{VENUE_NAME}}</p>
  <a href="#rsvp" class="hero-cta">{{CTA_LABEL}}</a>
</div>
    `.trim(),

    script: '',
  }
}
```

**`data-fallback="true"`** is added by `buildHeroFromJson(envelope, true)`.
The dashboard reads this attribute and shows:

```
⚠ We used our standard hero template — [Generate a custom one →]
```

**`min-height: 60vh` not `100vh`** — prevents all skeleton sections being
pushed below the fold, making the site feel broken.

---

## Observability

```typescript
// src/lib/observability/emitEvent.ts

interface GenerationEvent {
  event:
    | 'call2.generate' | 'call2.timeout'
    | 'hero.generate'  | 'hero.timeout'
  attempt:      number
  status?:      'pass' | 'fail' | 'fallback' | 'timeout'
  rules_failed?: string[]
  latency_ms:   number
  couple_id?:   string
}

export function emitEvent(payload: GenerationEvent): void {
  console.log(JSON.stringify({ ...payload, ts: Date.now() }))
  // Production: send to Datadog / Axiom / Supabase events table
}
```

**Alert thresholds:**

| Condition | Action |
|-----------|--------|
| `hero.generate` `status: fail` attempt 2 > 5% | Improve Call 3 base prompt |
| `call2.generate` `status: fail` attempt 2 > 5% | Improve Call 2 base prompt |
| `hero.generate` `status: fallback` fires at all | Immediate investigation |
| `call2` throws (no fallback) > 1% | Critical — stop and fix |

---

## Test Fixtures

```typescript
// src/lib/renderer/__tests__/validateHeroJson.test.ts

describe('validateHeroJson', () => {
  const mockTokens: GlobalTokens = {
    bgPrimary: '#0e0a14', bgSecondary: '#1a1528', bgCard: '#221e32',
    accent: '#c4607a', accentLight: '#e8a0b0', gold: '#d4a853',
    textPrimary: 'rgba(253,246,238,0.9)', textMuted: 'rgba(253,246,238,0.5)',
    textSubtle: 'rgba(253,246,238,0.3)',
    fontDisplay: 'Great Vibes', fontHeading: 'Cormorant Garamond', fontBody: 'Jost',
  }

  const validEnvelope: HeroJsonEnvelope = {
    html: '<div><h1>{{PERSON1_NAME}} & {{PERSON2_NAME}}</h1><a href="#rsvp">RSVP</a></div>',
    style: '.hero { background: #0e0a14; color: #c4607a; font-family: "Great Vibes"; min-height: 60vh; display: flex; align-items: center; justify-content: center; padding: 4rem; }',
    script: 'console.log("hero loaded")',
  }

  it('passes a valid envelope', () => {
    expect(() => validateHeroJson(validEnvelope, mockTokens)).not.toThrow()
  })

  it('fails when html field is missing', () => {
    const e = { ...validEnvelope, html: undefined as unknown as string }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('"html" field is missing')
  })

  it('fails when html contains a <style> tag', () => {
    const e = { ...validEnvelope, html: '<style>.a{}</style><div>{{PERSON1_NAME}} & {{PERSON2_NAME}}<a href="#rsvp">x</a></div>' }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('"html" field contains a <style>')
  })

  it('fails when style field is too short', () => {
    const e = { ...validEnvelope, style: '.a{}' }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('"style" field is too short')
  })

  it('fails when style contains @import', () => {
    const e = { ...validEnvelope, style: "@import url('https://fonts.googleapis.com/css2?family=Roboto'); " + validEnvelope.style }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('"style" field contains @import')
  })

  it('fails when PERSON1_NAME placeholder is missing', () => {
    const e = { ...validEnvelope, html: '<div><h1>Emma & {{PERSON2_NAME}}</h1><a href="#rsvp">x</a></div>' }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('missing {{PERSON1_NAME}}')
  })

  it('fails when #rsvp link is missing', () => {
    const e = { ...validEnvelope, html: '<div><h1>{{PERSON1_NAME}} & {{PERSON2_NAME}}</h1><a href="#story">x</a></div>' }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('missing a link to #rsvp')
  })

  it('fails when too many colors outside globalTokens', () => {
    const rogueColors = '.a{color:#111} .b{color:#222} .c{color:#333} .d{color:#444} .e{color:#555} .f{color:#666}'
    const e = { ...validEnvelope, style: validEnvelope.style + rogueColors }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('colors not in globalTokens')
  })

  it('assembles correctly — section, style, html, script all present', () => {
    const result = buildHeroFromJson(validEnvelope)
    expect(result).toContain('<section class="hero">')
    expect(result).toContain('<style>')
    expect(result).toContain('</style>')
    expect(result).toContain('<script>')
    expect(result).toContain('</section>')
  })

  it('assembles fallback with data-fallback attribute', () => {
    const result = buildHeroFromJson(validEnvelope, true)
    expect(result).toContain('data-fallback="true"')
  })

  it('omits script tags when script field is empty', () => {
    const e = { ...validEnvelope, script: '' }
    const result = buildHeroFromJson(e)
    expect(result).not.toContain('<script>')
  })

  it('fails when html contains <section> (would break wrapper)', () => {
    const e = { ...validEnvelope, html: '<section>nested</section>' + validEnvelope.html }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('contains a <section> tag')
  })

  it('fails when html contains </section> (would close wrapper early)', () => {
    const e = { ...validEnvelope, html: validEnvelope.html + '</section>' }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('contains a <section> tag')
  })

  it('fails when script references {{PLACEHOLDER}} tokens (XSS)', () => {
    const e = { ...validEnvelope, script: 'console.log("{{PERSON1_NAME}}")' }
    expect(() => validateHeroJson(e, mockTokens)).toThrow('{{PLACEHOLDER}} tokens')
  })
})
```

---

## Validator Rule Change Process

When a new failure mode is discovered in production:

1. Capture the raw AI response — save as a test fixture
2. Write the failing test first — it must fail before the fix
3. Add the validator rule — error message must be specific enough to send back to AI
4. Verify the retry prompt carries the new error message correctly
5. PR review required — validator changes are architectural, not patches
6. Update this document

---

## File Locations

```
src/lib/ai/
  extractCall2Json.ts       — Call 2 JSON extraction
  validateCall2Json.ts      — Call 2 validator
  call2Generator.ts         — Call 2 retry loop

src/lib/renderer/
  extractHeroJson.ts        — Call 3 JSON extraction (replaces extractHeroHtml.ts)
  validateHeroJson.ts       — Call 3 validator
  buildHeroFromJson.ts      — assembler — we own structure, AI owns content
  heroGenerator.ts          — Call 3 retry loop
  fallbackHero.ts           — fallback envelope using globalTokens

src/lib/observability/
  emitEvent.ts              — structured event emission

src/lib/renderer/__tests__/
  validateHeroJson.test.ts
  validateCall2Json.test.ts
```

---

## What This Approach Eliminates vs The Previous Version

| Bug class | Previous HTML approach | JSON envelope approach |
|-----------|----------------------|----------------------|
| Missing `<style>` block | Validator check — caught on retry | Cannot happen — we emit `<style>` |
| Unclosed `</section>` | Not caught | Cannot happen — we emit `</section>` |
| Markdown fences leak | HTML boundary extraction | Cannot happen — JSON.parse fails if fences present |
| Prose before/after HTML | Boundary detection (first `<`) | Cannot happen — JSON.parse finds `{` directly |
| Palette coherence | Regex on style block | String check on `envelope.style` — same logic, cleaner |
| `@import` in styles | Separate validator check | String check on `envelope.style` |
| Missing RSVP link | String check on full HTML | String check on `envelope.html` |
| Missing placeholders | String check on full HTML | String check on `envelope.html` |