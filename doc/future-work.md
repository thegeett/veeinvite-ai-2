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

## 10. Pre-call expressive palette + parallel Call 2/Call 3 (target architecture)

**Status.** Design locked-in (`doc/precall_palette_architecture.md`). Implementation pending.

**What.** Insert a tiny Haiku pre-call between Call 1 (layout) and the
generation calls. The pre-call picks **only 4 expressive tokens** — `bgPrimary`,
`accent`, `gold`, `fontDisplay` — from the couple's brief. Call 2 (site design)
and Call 3 (hero) then run **in parallel** against those 4 tokens. Call 2 fills
the remaining 8 tokens (bgSecondary, bgCard, accentLight, three text shades,
fontHeading, fontBody) from the design-system perspective. Hero gets full
creative freedom on layout/animation/composition while sharing the same
creative source as the rest of the site.

**Why.** Three wins in one change:

1. **Creative coherence** — the chain flows correctly (brief → 4 tokens → both
   expressions inherit), without putting the hero in design-system-author mode.
2. **Latency** — ~35% faster (~20s → ~13s) because Call 2 and Call 3 stop
   being sequential. The pre-call costs ~1s (Haiku, ~20× cheaper than Sonnet)
   but unlocks parallelism worth ~7s.
3. **Edit flow stays correct** — design edits hit Call 2 only (hero
   untouched); hero edits hit Call 3 only; only "start fresh" reruns the
   pre-call. Zero regression vs current architecture.

**Why it's not item #1.** It is, in priority terms — but the existing items
1–9 all stand on their own merits and shouldn't be blocked by this one.
Implementation order is for separate planning.

**Implementation outline.**
- New `src/lib/ai/prePaletteCall.ts` with `runPalettePreCall` + 3-retry loop
  + deterministic `deriveFallbackPalette(styleCard, culturalProfile)` table
  lookup
- New `validateExpressivePalette` (4 hex/font checks)
- `runCall2` and `runCall3` accept `expressivePalette` param; their prompts
  add the "use these exact 4 values" block
- Pipeline orchestrator (`src/lib/pipeline.ts`) gains the pre-call step
  and uses `Promise.all([runCall2, runCall3])` for parallelism
- `validateHeroJson` palette-coherence rule narrows to checking style's hex
  values against the 4 pre-call tokens (not all 12)
- `validateCall2Json` adds: the 4 pre-call tokens must appear unchanged in
  Call 2's returned globalTokens
- Merge step: combine 4 pre-call tokens + 8 from Call 2 → store as
  `globalTokens` (no DB schema change — column is already JSONB)

**Effort.** ~half day end-to-end including tests. Mostly additive; existing
fallback paths remain.

**Blocker.** None strict. Worth doing observability (item #3) first so we can
A/B the latency claim and measure whether parallelism affects coherence
quality. Without metrics we can't prove the 35% latency win translates to
better couple experience (might just feel the same and load slightly faster).

**Pairs with.** Item #1 (LLM provider abstraction) — the pre-call is one
more place that benefits from provider-agnostic wiring.

---

## 11. Hero-first pipeline proposal — **HELD**

**Status.** On hold. Superseded by item #10 for now.
**Doc.** `doc/hero_first_pipeline.md`.

**What it proposed.** Invert the call order: hero runs first and produces all
12 globalTokens; site design runs second and inherits them.

**Why held.** The proposal correctly identified that the creative chain
should flow in one direction, but placed that decision in the wrong place
(the hero, which then ends up as design-system author). Three concrete
costs documented in `doc/precall_palette_architecture.md`:

1. Hero is asked to choose tokens it never visually uses
   (`bgCard`, `textSubtle`, `bgSecondary`, `accentLight`) — moves the
   constraint onto the hero rather than removing it.
2. Edit flow regresses — "make it more romantic" must regenerate the
   hero before extending tokens, even though the user wanted a palette tweak.
3. Fallback failure mode is louder — Call B failure takes down the entire
   site palette (item #10's failure is isolated per call).

The pre-call approach (item #10) preserves the proposal's good intuition
("creative source upstream") without these costs.

**Resurrection criteria.** Reconsider this if:
- Item #10 ships and observability (item #3) shows the hero is measurably
  *less* creative than expected
- We find we need the hero's stylistic choices to inform body design in
  ways the pre-call's 4 tokens can't capture
- Couples consistently regenerate heroes and the resulting heroes feel
  generic — suggesting the hero needs more design authority

Until one of those signals appears, item #10 is the right path.

**Action.** None pending. Doc kept for context.

---

## 12. Vibe tag picker — UX validation (mode-difference comprehension)

**Status.** Risk surfaced during the palette-diversity review (`doc/tickets/PALETTE_DIVERSITY_TICKETS.md`). Detection deferred from Phase 1.

**What.** The vibe tag picker (Phase 1 of the palette-diversity initiative) is a dual-mode component: for western couples, the selected tags **pick a color palette**; for cultural couples, the selected tags **adjust design weight only — the palette is fixed by culture**. The two modes look identical in the UI but produce fundamentally different outcomes. The spec mandates mode-specific subheading copy ("we'll use this to pick your color palette" vs "we'll use this to set the tone and decoration") to surface the distinction. That's design intent. We have no way to *observe* whether real couples actually understand the difference.

**Why.** If couples don't internalise the mode difference, two failure modes appear:

1. Cultural couples expect their tags to change the palette, regenerate, and feel betrayed when the colors stay the same.
2. Western couples treat tags as decoration-weight knobs and regenerate, expecting subtle tweaks but getting wholesale palette swaps.

Either failure undercuts the whole reason we replaced the free-text input.

**What we'd add.**

Two paths, ranked by cost.

- **(a) Lightweight — instrumentation only.** Emit two analytics events from the picker: `vibe_tags_selected` (`{ tags: string[], mode: 'western' | 'cultural', cultureId: string }`) and `step2_completion_time_ms`. After the picker has been live for 2 weeks, define thresholds:
  - Median completion time should not regress > 15% vs the free-text baseline.
  - Tag-selection distribution should show variety — not 80% of couples picking the same 3 tags (suggests the picker is being used as a "click anything to advance" mechanism rather than a real signal).
  - Per-mode regenerate-rate within 24 hours of step 2 commit — if cultural couples regenerate more than western couples, that hints at the mode-confusion failure.
- **(b) Heavier — usability test.** 3–5 couple-friend "concept testers" walk through Step 2 narrating their thinking. Observe whether the mode difference lands. Operator-driven research, not engineering.

**Why deferred.** Phase 1 ships a UX *replacement* — by every measurable signal we have today (silent-fallback rate at the free-text input), it can only be an improvement. The instrumentation we'd add is for spotting *new* failure modes the new UX introduces, which we'll see in production data anyway. Lightweight instrumentation can land later as a sub-1-hour follow-up if we see odd regenerate patterns; full usability testing is its own product-research investment outside the engineering phases.

**Effort.** ~30 minutes for the analytics events (option a). ~3 hours operator-led for the usability test (option b).

**When.** Item (a) — first weekly review after Phase 1 ships, if regenerate-rate or step-2 completion time looks off. Item (b) — only if (a) data confirms a real comprehension problem.

**Pairs with.** Item #3 (structured event observability). The same emitter / sink stack will carry these events.

---

## 13. Palette pre-call diversity — fallback ladder

**Status.** Risk surfaced during the palette-diversity review (`doc/tickets/PALETTE_DIVERSITY_TICKETS.md`). Detection mechanism (Phase 4 diversity metric) ships with the initiative; **resolution path is what's deferred here**.

**What.** Phase 4 of the palette-diversity initiative writes a comparison report (`doc/spikes/palette-diversity-baseline.md` vs `palette-diversity-after-precall.md`) measuring three numbers across 50 generations: distinct (bgPrimary, accent, gold) tuples, hue-bucket entropy, average pairwise HSL distance. **What's not yet documented is what we do if the pre-call ships and the after-numbers don't move.**

**Why.** Without a pre-defined response, "the architecture didn't deliver" becomes an open-ended investigation under deadline pressure. A fallback ladder turns it into a sequence of bounded next steps with predictable effort each.

**The four-step fallback ladder.**

If `avgPairwiseDistance` improves by less than 25% vs baseline after Phase 3 ships:

1. **Read the per-culture breakdown in the report.** Is the failure cultural (one or two cultures' HSL ranges too tight for meaningful within-range variation) or universal (every culture flat)?
2. **If cultural — broaden the failing culture's HSL ranges in `cultural-content-library.json`.** No code change. Re-run Phase 4. ~15 minutes per culture, no AI cost beyond the rerun.
3. **If universal — Haiku is picking midpoints.** Add explicit *"pick at least 20% from midpoint"* instruction to the pre-call prompt. Add a midpoint-distance check in the validator (reject if distance < 0.1 from range center; counts toward the 3-retry budget). Re-run Phase 4. ~1 hour.
4. **If still flat after both — Sonnet for the pre-call instead of Haiku.** Cost goes from ~$0.0003 to ~$0.005 per generation (16× spend). Worth it if it's the difference between working and not. Estimated quality lift comes from Sonnet's better range-aware sampling and longer context for the cultural-override block. ~30 minutes.

If steps 1–4 still don't move the needle, the architecture itself is wrong and we revert Phase 3 (keep Phase 1's UX win) and re-architect.

**Why deferred.** Implementing the ladder up front means writing fallback code that may never run. Documenting it now gives future-us a clear sequence; *building* it is reactive — only when the diversity metric tells us we need to.

**Effort.** Each rung of the ladder is its own small change (~15 min – 1 hour). The full ladder, if all four rungs are needed, is ~3 hours total.

**When.** Triggered by Phase 4's after-comparison report. Until then, do nothing.

**Pairs with.** Item #3 (observability) — per-culture diversity metrics need event emission to monitor over time after the initial measurement, not just point-in-time comparison reports.

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
