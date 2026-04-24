# Phase A — Prompt Constraints

> Part 1 of 3 in the AI output validation rollout.
> Phases B (extractors + validators without retry) and C (retry loop +
> observability) follow in subsequent PRs.

## What

Replace the current "CRITICAL — OUTPUT FORMAT" blocks in Call 2 and Call 3
with the framing prescribed by `doc/hero_html_extraction.md` — specifically,
the "your response will be passed directly to a [JSON/DOM] parser" framing.

No extractor, validator, or retry logic changes in this phase.
No tests removed. No runtime behaviour changed except the words sent to Claude.

## Why

### The failure mode we're addressing

Today's prompts enumerate format rules ("no markdown fences", "first character
must be `<`", etc.) as a checklist for Claude to memorise. In practice Claude
complies most of the time but continues to produce occasional violations:

- Wraps response in ` ```html ... ``` `
- Prepends "Here is your hero:"
- Appends "Hope this helps!"
- Returns `<html><body>...</body></html>` wrapping
- Returns JSON inside markdown fences

These are all **presentation decisions** Claude is making. The current prompt
tells it which presentation decisions to avoid. It does not tell it *why*
those decisions are bad.

### The framing that works

When a model is told its output will be **passed directly to a parser**, it
stops making presentation decisions. It switches mental models from
"conversational assistant giving a formatted response to a human" to
"component producing machine-readable output for another component." The
distinction is load-bearing — the first model wants to be helpful with
affordances like code fences; the second model wants to produce valid input
to the next stage.

This is not a style preference. It's a technical accuracy cue. Telling Claude
"any non-HTML character will cause a parse error" gives it a concrete
consequence to avoid, which is far more effective than a list of "don't do
X" rules.

### Why prompt-only before anything else

From `doc/hero_html_extraction.md`:

> Layer 1 — Prompt constraint
> Handles ~95% of format problems.

If Layer 1 alone gets us to a ~5% format-violation rate in production, the
extractor and validator layers handle a much smaller tail. That in turn means
fewer retry-loop invocations, lower cost, and lower p95 latency.

Shipping Layer 1 first is also the cheapest reversible change in the plan —
about 15 minutes of edits to two prompt functions, zero code structure
changes, zero migrations. If the change makes things worse we revert one
commit.

## How

### Call 2 changes

The current `buildCall2Prompt` has a single line at the top of the JSON schema:

```
REQUIRED OUTPUT — a single JSON object, no markdown fences, no prose:
{ ... }
```

Replace that line with the expanded block from the design doc:

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

---

Schema you must return:

{ ... existing schema ... }
```

The key line is **"Your response will be passed directly to JSON.parse().
Any non-JSON character will throw a parse error."** Everything before it is
the rule list; this sentence is the mental-model cue.

The existing `IMPORTANT:`, `COMPLETENESS — the site looks broken if you skip
selectors:`, and `CONTENT —` sections stay as-is.

### Call 3 changes

The current `buildCall3Prompt` ends with two separate CRITICAL blocks:
- `CRITICAL — STYLE AND SCRIPT PLACEMENT` (keep, still relevant)
- `CRITICAL — OUTPUT FORMAT` (replace)

Replace the second block with the design-doc version:

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

The key line — same mental-model cue, HTML variant: **"Your response will be
passed directly to a DOM parser. Any character that is not valid HTML will
cause a parse error."**

The `CRITICAL — STYLE AND SCRIPT PLACEMENT` block stays as-is. That block
addresses a structural concern (where style/script sit inside the section),
which is separate from output-format policing.

### What we explicitly do NOT change in Phase A

- `extractHeroHtml()` keeps its current logic (first `<` to last `>`, keep
  trailing `</style>`/`</script>`, strip prose). Phase B replaces it.
- `runCall2` / `runCall3` still use the current flow: one call, no retry.
  Phase C adds retry-with-feedback.
- No validators added. Phase B adds them.
- No observability events emitted. Phase C adds them.
- The existing `extractHeroHtml` tests stay green — we're not changing
  extraction.

## Expected outcome

For the next ~10 generations through the live pipeline, watch the existing
dev-log lines:

```
[runCall2] parsed OK — selectors=N content keys=N fonts=N summary="..."
[runCall3] hero returned — N chars, starts: <section class="hero">...
```

The hypothesis is that `selectors` trends toward 30+ consistently, hero
returns start with `<section` with no observable fence/prose bleed, and the
extractor's stripping work becomes largely a no-op (because AI stops
producing fences/prose in the first place).

If we see NO improvement — meaning fences and prose still appear at similar
rates — Layer 1 is not enough on its own, and Phase B becomes load-bearing.
We'd know that from 10 real generations, not a thousand.

## Verification

Two cheap checks that don't require live generation:

1. **Unit test fixture**: add a test that confirms both prompt builders
   include the exact phrase "passed directly to" — belt-and-braces so future
   edits don't silently drop the framing.

2. **Build + existing test suite**: `npm run build` and `npx vitest run`
   should both pass unchanged. Phase A touches only prompt strings; no
   type signatures, no control flow.

## Rollback

`git revert <commit-hash>`. One commit, one file (`src/lib/ai/prompt.ts`),
plus the new doc file. Nothing downstream depends on the prompt wording.

## Measurement after merging

After Phase A ships, collect 10 real generations from the dashboard and
record in `doc/phase-a-results.md`:

- For each run: `selectors` count, `hero chars`, any observable ``` leak
  or prose bleed in the stored HTML file
- Overall: does the trend confirm the hypothesis? If yes, Phase B priority
  can drop; if no, Phase B is still needed.

Either outcome is good data. The point of staging is to measure before
committing to more code.
