# Future Work — Deferred Items and Ideas

A single landing pad for work that has been scoped or considered but is not in
the current build. Each item carries its own context: what it is, why we'd
revisit, what the effort looks like, and what (if anything) blocks it.

This file is the inverse of `doc/DECISIONS.md` — that captures what we *did*
and why; this captures what we *deliberately didn't do yet*.

---

## 1. LLM provider abstraction (Anthropic ↔ OpenAI)

**What.** Introduce a thin `LLMProvider` interface in `src/lib/ai/generate.ts`
with one method (`complete(prompt, maxTokens) → string`), and two adapters
(Anthropic, OpenAI). A single env var (`LLM_PROVIDER=anthropic|openai`) picks
one at startup. Per-tier model IDs become env vars too:

```
LLM_PROVIDER=anthropic
LLM_MODEL_DESIGN=claude-sonnet-4-5
LLM_MODEL_HERO=claude-sonnet-4-5
LLM_MODEL_CLASSIFIER=claude-haiku-4-5-20251001
```

**Why.** Lets us A/B test design output across providers without code changes,
and keeps model selection out of the source tree (cheaper iteration on Claude
4.x → 5.x bumps and similar). The current code has Anthropic baked into one
file and three call sites — the abstraction stays small (~150 LOC).

**Tradeoff to know up front.** The prompts in `src/lib/ai/prompt.ts` are tuned
for Claude (parser-framing language, JSON envelope wording, glossary tone). A
same-prompt A/B is fast but slightly apples-to-oranges — OpenAI may under- or
over-perform purely because the prompt wasn't written for it. For an
eyeball-comparison this is fine. For a serious eval, pair this work with item
#5 below (per-provider prompt variants).

**Effort.** ~1–2 hours including the OpenAI adapter and updating tests'
`__setClientForTesting` shim. No prompt changes, no validator changes.

**When.** Whenever we want a real provider comparison. Not blocking M1.

---

## 2. Phase C — Retry loops with error-context prompts

**What.** When `validateHeroJson` rejects Call 3's output, re-prompt Claude
with the rule failures appended ("you returned an envelope where the html field
was missing `{{PERSON1_NAME}}` — please fix and return again"). Same for Call 2.
Max 2 retries, then fall back. AbortController per attempt + a total-time
ceiling so we don't blow the 2-minute promise.

**Why.** Phase B's deterministic validators catch ~99% of failures and produce
a coherent fallback — but the fallback is a standard template, not a
custom-designed hero. Phase C trades latency and complexity for marginal
quality on the fallback rate. Estimated impact (per `doc/phase-b-validators.md`):
~1% of generations fall back today; with retry, ~0.2%.

**Why deferred.** ~3 hours of work for a marginal gain we can't justify until
telemetry proves the fallback rate matters. The fallback is a *soft* failure
(couple sees a styled hero, just not custom) — not a broken site.

**Blocker.** Item #3 (observability). Without per-attempt telemetry we can't
measure whether retries actually help.

---

## 3. Structured event observability for AI calls

**What.** Replace `console.log` / `console.warn` in `runCall2` / `runCall3`
with structured events:

```ts
{ event: "call3.attempt", attempt: 1, status: "validator_fail", rules_failed: ["rule_5", "rule_8"], latency_ms: 12480, model: "claude-sonnet-4-5" }
```

Emit to a structured sink (Supabase table, Logflare, or whatever we land on).
Define alert thresholds (e.g. fallback rate > 5% in any 1-hour window pages
oncall) per `doc/hero_html_extraction.md` §Observability.

**Why.** Right now we have no idea what % of generations fall back, which
rules trigger most often, or whether prompt changes regress quality. Without
this we can't make data-driven prompt tuning decisions or justify Phase C.

**Effort.** ~2 hours for the emitter + sink + a starter dashboard. Alert
thresholds are a separate decision once we have a baseline.

**When.** Before Phase C. Probably the second M2 item to ship.

---

## 4. Dashboard "fallback used" indicator

**What.** Surface `data-fallback="true"` on the rendered hero to the dashboard
preview so couples (and we) can see when their hero was a fallback rather than
a custom generation. A small badge in the editor header, plus a "regenerate
hero" button that's slightly more prominent in this state.

**Why.** Today fallback is invisible to the couple — they see a styled hero
and assume that's their custom design. If they regenerate, they might get a
better result; if they don't know fallback happened, they won't try.

**Owner.** Stream A (frontend). Independent of items #1–3.

**Effort.** ~1 hour; the data-attribute is already emitted by `buildHeroFromJson`.

---

## 5. Per-provider prompt variants

**What.** Move from one prompt template per call to N templates per call —
one per LLM provider. Live in `src/lib/ai/prompts/{anthropic,openai}/call3.ts`
and selected by the same `LLM_PROVIDER` env var.

**Why.** Item #1 lets us swap providers; this lets us compare them honestly.
Without per-provider prompts, we're really comparing "Claude with a Claude-tuned
prompt" vs "OpenAI with a Claude-tuned prompt" — not a fair test of design
output quality.

**Why deferred.** Only worth doing if we actually adopt OpenAI as a real
production option. For one-off comparisons, the same-prompt approach is fine.

**Blocker.** Item #1 must ship first. Probably also wait for one round of
single-prompt A/B results to know whether it's even worth tuning.

---

## 6. Remove deprecated `extractHeroHtml`

**What.** Delete `extractHeroHtml` and its tests from `src/lib/ai/generate.ts`
and `tests/ai.test.ts`. It was kept as deprecated dead code in the Phase B
commit so we could revert the Call 3 prompt change without losing the old
extractor.

**When.** After Phase B has run in production for ~2 weeks with no rollback.
At that point the rollback path is irrelevant and the dead code is just noise.

**Effort.** 10 minutes. A single small commit.

---

## 7. Bilingual rendering activation (plan §33)

**What.** v1 already accommodates bilingual output — Call 3 emits empty
`{{PERSON1_NAME_BILINGUAL}}` / `{{WEDDING_DATE_BILINGUAL}}` / etc. placeholders
that resolve to empty strings today. M2 activates them: cultural profile
config gains a `bilingualEnabled` toggle, the structured editor gains
secondary-language fields, and the renderer substitutes both strings into
`.bilingual-pair` / `.bilingual-secondary` markup that already exists in the
skeletons.

**Why deferred.** Plan §33 explicitly stages this for M2. v1's job is to ship
the architectural seam (placeholders, classes, types like
`CulturalProfile.bilingualLanguage`); M2's job is to wire the UI.

**Effort.** Probably ~1 day end-to-end including UI, types, and renderer
substitution. Single-stream work — Stream A drives, Stream B reviews.

---

## 8. Rebuild `fallbackHero.ts` via the frontend-design skill

**What.** The Phase B fallback hero in `src/lib/renderer/fallbackHero.ts` was
written ad-hoc — a generic centred layout with the couple's `globalTokens`
applied. It works structurally (passes the validator, includes all required
placeholders) but it visually reads as "fallback template" rather than
"distinctive design."

**Why.** CLAUDE.md mandates the `frontend-design` skill for any visible UI
surface in this repo precisely to avoid the generic-AI-design failure mode.
The fallback hero is exactly that kind of surface: it's what couples see when
AI Call 3 fails, and right now ~1% of generations land on it. A skill-designed
fallback would still pass `validateHeroJson` (same placeholder contract, same
`min-height: 60vh` spec) but would feel intentional rather than perfunctory.

**Constraints to preserve when redesigning:**
- Must include all required placeholders (`{{PERSON1_NAME}}`, `{{PERSON2_NAME}}`,
  `{{WEDDING_DATE_DISPLAY}}`, `{{VENUE_NAME}}`, `{{CTA_LABEL}}`, etc.)
- Must use only `globalTokens` values (passed in as a parameter at runtime)
- Must contain a CTA link to `#rsvp`
- Must NOT contain `<section>`, `<style>`, or `<script>` tags in the html field
  (the assembler owns those)
- Must contain no `@import` in the style field
- Output must pass `validateHeroJson` — there's already a test for this
  (`tests/heroJsonEnvelope.test.ts > buildFallbackEnvelope > passes validateHeroJson`)

**Effort.** ~1 hour: invoke the skill with the constraints above, replace the
contents of `fallbackHero.ts`, run `npx vitest run tests/heroJsonEnvelope.test.ts`
to confirm validator still passes.

**When.** Before any visible production rollout — or sooner if observability
(item #3) shows the fallback rate is non-trivial.

---

## 9. Reference-invitation exercise (lift Call 2/3 quality)

**What.** Use the `frontend-design` skill to design 6–10 hand-curated reference
wedding invitations across diverse style cards and cultures (e.g. South Asian
Grand × Hindu, Editorial Bold × Western, Romantic Traditional × Jewish, Bohemian
Garden × Latin American Catholic, etc.). Each reference is a complete styled
HTML invitation — not a couple's real site, just a concrete example of what
"good" looks like in that combination.

Then distill the references into prompt material:
- **Tokens**: extract each reference's actual `globalTokens` (palette, fonts)
  and feed them into Call 2's prompt as palette exemplars per (style × culture)
- **Motifs**: catalogue the decorative patterns (arches, garlands, gold leaf,
  geometric overlays) and add them as Call 3 prompt fragments per culture
- **Typography**: capture working font pairings as exemplars instead of leaving
  AI to guess from the approved-fonts list
- **Copy tone**: pull representative phrasings and inject as content exemplars
  in Call 2's prompt for the relevant culture

**Why.** Today the AI prompts describe what good looks like in *abstract*
language ("South Asian Grand: jewel-toned palette, ornate decorative
motifs"). Abstract descriptors give AI room to compose competently but rarely
brilliantly. Concrete references — even one per (style × culture) — give AI
something to *anchor* against, which historically lifts output quality more
than any prompt-rewording does. This is the cheapest way to raise the design
ceiling without touching the runtime architecture.

**How (workflow):**

1. List the (style card × culture) cells we actually serve. Skip rare
   combinations — pick the 6–10 that cover the most couples.
2. For each cell, run the `frontend-design` skill with the cell's design
   guidance (from `cultural-content-library.json`) as input. Get a complete
   HTML invitation back.
3. Save each as `references/<style>-<culture>.html`. Treat these as
   design-time fixtures, not runtime templates.
4. For each reference, fill out a structured extraction:
   `{ tokens, motifs, typography, copyExemplars }`. Store as JSON next to
   the HTML.
5. Wire the extracted material into the Call 2 / Call 3 prompts conditionally:
   if the couple's (style × culture) matches a reference, inject its
   exemplars; otherwise fall back to the existing abstract description.

**Tradeoffs:**
- **Cost**: each real designer-quality reference is hours of skill-driven
  iteration plus human review. 6–10 refs is a 1–2 day exercise, not a sprint.
- **Drift risk**: too many refs, or refs that are too prescriptive in the
  prompt, and AI starts copying rather than composing — kills the "every
  site is unique" promise (plan §5 / §28). The injection should be
  exemplary, not template-like.
- **Maintenance**: refs date with design trends. Plan for a refresh every
  6–12 months or when a style card is added/changed.

**Effort.** ~1 day to design refs + ~half day to wire prompt exemplars.

**When.** Best done *after* item #3 (observability) is in place — that way
we can measure whether ref-injection actually moves any quality metric (e.g.
fallback rate, regenerate-rate, user-edit-rate per generated site) instead
of guessing. Without metrics this becomes a vibes-based exercise.

**Adjacent.** This pairs with item #5 (per-provider prompt variants) — the
extraction output (tokens / motifs / typography) is provider-agnostic, so
the references serve both Anthropic and OpenAI prompts.

---

## How to use this document

- Add an entry when work is explicitly deferred — not for every speculative
  idea. Speculation belongs in a notebook, not the repo.
- Keep entries narrative (what / why / why deferred / effort / when), not just
  a checklist title.
- When an item ships, **delete it from this file** and reference it in
  `doc/DECISIONS.md` if it warranted a decision record. Don't leave shipped
  items here as historical residue.
- If an item turns out to be a bad idea, leave it here with a "**Discarded:**"
  prefix and a one-line reason. Future-you might reconsider.
