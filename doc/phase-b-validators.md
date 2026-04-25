# Phase B — Validators + JSON envelope (M1)

> Part 2 of 2 in the AI output validation rollout for M1.
> Phase A (parser-framing prompts) shipped. Phase C (retry loops with
> error context) is deferred to M2.
> Source design: `doc/hero_html_extraction.md`.

## What

Replace Call 3's raw-HTML output with a JSON envelope (`{ html, style, script }`)
and add deterministic validators for both Call 2 and Call 3. On validation
failure: Call 3 falls back to a `globalTokens`-coherent envelope, Call 2 logs
a warning and uses the AI output as-is.

No retry loops. No AbortController machinery. No structured-event observability.
Those are Phase C and M2.

## Why

### What Phase A solved (already shipped)

Phase A's parser-framing prompts ("passed directly to JSON.parse() / DOM
parser") eliminated ~95% of *format* violations: markdown fences, prose
prefixes/suffixes, document-tag wrapping. Production logs over the ~5
generations since shipping confirm the trend — `selectors=58–60`, hero
responses start cleanly with `<section class="hero">`, no fence leaks.

### What Phase A did NOT solve

Today's failure mode (per `output/actual-render.html`): AI Call 3 returned
markup with **no `<style>` block at all** and **no `</section>` close**. The
wrapper section opened by AI was never closed, so every subsequent skeleton
section nested inside the unclosed hero. The whole page renders inside one
broken `<section class="hero">` with zero hero CSS.

This is a *structural* failure, not a *format* failure. Phase A told AI to
include `<style>` and to close `</section>`, but those are advisory rules
in the prompt — Claude treats them as bullets to consider, not hard
contracts to enforce. There is no mechanism that prevents AI from
shipping incomplete output.

### The shape of the fix

Two architectural moves, each independently useful:

**Move 1 — JSON envelope (Call 3 only).** AI returns
`{ html: "...", style: "...", script: "..." }` instead of raw HTML. Our code
emits the `<section class="hero">`, `<style>`, and `<script>` tags. The
structural wrapper *cannot* go missing because AI never had it.

This eliminates the entire class of structural bugs (missing `</section>`,
missing `<style>` tag, markdown fences leaking, `<html>` wrapping) without
any validation logic. The bugs become impossible by construction.

**Move 2 — Deterministic validators (both calls).** Even with the JSON
envelope, AI can still:
- Return an empty `style` field
- Forget required placeholders in `html`
- Use colors outside `globalTokens`
- Smuggle a `<section>` tag into `html` (which would break our wrapper)
- Reference placeholders in `script` (XSS surface)
- Return Call 2 with sparse `styles` map (the original "unstyled site" bug)

Validators catch these deterministically. Failed Call 3 falls back to a
safe envelope using the couple's actual `globalTokens` so it still looks
coherent. Failed Call 2 is logged as a warning and the partial output is
used as-is — Call 2 has no fallback because it *produces* the
`globalTokens` everything else depends on.

### Why no retry loop (Phase C)

A retry loop would re-prompt Claude with the validator's error message and
get a corrected response on the next attempt. Estimated impact:

- Without retry: ~1% of generations fall back (still coherent, less creative)
- With retry: ~0.2% fall back (rest get a proper second-attempt hero)

The cost is ~60s of additional latency on the rare retry, plus implementation
complexity (AbortController, structured events, telemetry hooks). For M1 the
fallback is acceptable as a soft failure — the couple sees a styled hero,
just one of our standard templates rather than a custom-designed one. Phase C
ships in M2 when telemetry shows whether the marginal quality gain justifies
the complexity.

## How

### File map

```
src/lib/renderer/
  extractHeroJson.ts        — NEW. JSON.parse + boundaries (first { to last }).
  validateHeroJson.ts       — NEW. 11 deterministic checks per design doc.
  buildHeroFromJson.ts      — NEW. Assembler — owns <section>/<style>/<script>.
  fallbackHero.ts           — NEW. globalTokens-coherent fallback envelope.

src/lib/ai/
  validateCall2Json.ts      — NEW. 6 deterministic checks for Call 2 output.
  generate.ts               — MODIFIED. runCall3 now uses JSON envelope flow.
                              runCall2 now logs warnings on validator failure.
  prompt.ts                 — MODIFIED. Call 3 prompt asks for JSON envelope.

src/lib/types.ts            — MODIFIED. Add HeroJsonEnvelope + GlobalTokens
                              re-export if needed.

tests/
  validateHeroJson.test.ts  — NEW. ~13 cases.
  validateCall2Json.test.ts — NEW. ~7 cases.
  buildHeroFromJson.test.ts — NEW. Assembler structure tests.
```

### Call 3 flow (new)

```
runCall3(input)
  ↓
buildCall3Prompt(input)               (asks for JSON envelope)
  ↓
client.messages.create(maxTokens=6000) (was 4000 — JSON adds ~15% overhead)
  ↓
parseJsonResilient(text)               (existing function; handles ```json fences)
  ↓
extractHeroJson(parsed)                (validates shape: 3 string fields)
  ↓
validateHeroJson(envelope, globalTokens) (11 rules)
  ↓
  ┌──────────┴──────────┐
PASS                  FAIL
  ↓                     ↓
buildHeroFromJson()   buildHeroFromJson(buildFallbackEnvelope(input), true)
  ↓                     ↓
return HTML           return HTML (with data-fallback="true")
```

### Call 2 flow (modified — minimal disruption)

The existing `runCall2` already returns a parsed `ThemeJSON`. We add the
new validator inline but treat failure as a warning, not an error:

```
runCall2(input)
  ↓
client.messages.create(maxTokens=8000)  (unchanged)
  ↓
parseJsonResilient(text) → existing safety net
  ↓
validateCall2Json(parsed)               (NEW — 6 rules)
  ↓
  ┌──────────┴──────────┐
PASS                  FAIL
  ↓                     ↓
return ThemeJSON      console.warn(rule failures)
                       return ThemeJSON anyway
                       (the existing validator/index.ts fills missing
                        defaults — visible as warnings in dev log)
```

When Phase C ships in M2, this becomes:
- Call 2 failure → retry with feedback → throw if all retries fail
- Call 3 failure → retry with feedback → fallback if all retries fail

### Why no retry feels safe for M1

Both calls already have soft-fallback behaviour today:
- Call 2's `validateAll()` (in `src/lib/validator/index.ts`) fills missing
  content keys with `CONTENT_DEFAULTS` and strips forbidden CSS — even
  empty AI output renders to a usable site (just generic-looking).
- Call 3's new fallback envelope provides a clean styled hero using
  `globalTokens` — visually less custom, structurally identical.

So "validator fails, no retry" doesn't mean "couple sees a broken site." It
means "couple sees a less-custom site." Acceptable for M1 beta. Phase C
later trades complexity for marginal quality.

## Validator rules — the contract

### Call 3 (`validateHeroJson`) — 11 rules

| # | Rule | Why |
|---|------|-----|
| 1 | All 3 fields (html/style/script) present and string | Envelope shape contract |
| 2 | html length ≥ 50 chars | Empty hero markup is not usable |
| 3 | html contains no `<style>` tag | Style belongs in `style` field; nested would duplicate |
| 4 | html contains no `<script>` tag | Script belongs in `script` field |
| 5 | style length ≥ 100 chars | Trivial CSS = unstyled hero (today's bug) |
| 6 | style contains no `@import` | Renderer manages fonts; @import would load unapproved |
| 7 | html contains `{{PERSON1_NAME}}` and `{{PERSON2_NAME}}` | Names are required |
| 8 | html contains `#rsvp` | CTA must link to RSVP section |
| 9 | html contains no `<script src=…>` or `<link rel="stylesheet">` | No external resources |
| 10 | html contains no `<section>` or `</section>` | Would break our wrapper (today's bug variant) |
| 11 | script contains no `{{PLACEHOLDER}}` tokens | XSS via JS-context substitution |

### Call 2 (`validateCall2Json`) — 6 rules

| # | Rule | Why |
|---|------|-----|
| 1 | `globalTokens` has all 12 required keys | Foundation for everything |
| 2 | `styles` has ≥ 25 selectors | Sparse styles = unstyled site |
| 3 | All required selectors present in `styles` | Specific sections must be styled |
| 4 | `fonts[]` non-empty, all entries on approved list | Font safety |
| 5 | `content` has ≥ 30 non-empty values | Generic copy = personality lost |
| 6 | `designSummary` ≥ 30 chars | Used in future edit prompts to maintain coherence |

## Tests

13 cases for `validateHeroJson`, 7 for `validateCall2Json`, 4 for the
assembler. Each rule has a passing fixture and a failing fixture. The
assembler tests verify structural correctness regardless of what AI
returned. Total ~24 new test cases.

## What this commits and what it doesn't

**Ships in this PR:**
- All four new `src/lib/renderer/` files
- New `validateCall2Json.ts`
- Modifications to `generate.ts` and `prompt.ts`
- Test suites
- This Phase B doc + doc patches to `hero_html_extraction.md`

**Does NOT ship in this PR:**
- Retry loop or AbortController (Phase C / M2)
- Structured event emission with alert thresholds (Phase C / M2)
- Dashboard "fallback used" indicator UI (separate Stream A work)
- Removal of the existing `extractHeroHtml` function in `generate.ts` —
  kept as deprecated dead code in case we need to roll back (will be
  removed in a follow-up commit after Phase B has run in production)

## Verification

- `npx tsc --noEmit` clean
- `npx vitest run` — all existing tests pass plus ~24 new
- `npm run build` clean
- Manual smoke: regenerate one couple's site through the dashboard, verify
  hero loads with full CSS

## Rollback

`git revert <commit>`. The Call 3 prompt revert is the load-bearing change —
once the prompt asks for JSON, Anthropic returns JSON. Reverting the prompt
puts AI back to raw HTML and the previous extractor handles it. No data
loss.

## Phase C preview (not in this PR)

When telemetry over a few weeks of M1 usage shows fallback rate justifies
investment:

- AbortController per-attempt + total-timeout ceiling
- Retry loop (max 2 retries) with error-context prompt
- Structured event emission (`{ event, attempt, status, rules_failed, latency_ms }`)
- Alert thresholds defined in `doc/hero_html_extraction.md` §Observability
- Dashboard surfaces retry-rate metric for prompt tuning

Estimated effort: ~3 hours when we get to it.
