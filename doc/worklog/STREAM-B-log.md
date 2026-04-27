# Stream B — Engine worklog

Per-phase narrative of Stream B's work: validator, renderer, layout selector, AI prompts, cultural profile system, RSVP config, pipeline orchestrator.

**Owner:** Stream B Claude Code session (`stream-b-engine` branch)
**Ticket:** `doc/tickets/STREAM-B-engine.md`
**Format:** See `doc/worklog/README.md`

Append new entries to the bottom of this file. Do not reorder or edit prior entries — they're the historical record.

---

<!-- ENTRIES BELOW THIS LINE -->

## Phase 2 — Validator
**Completed:** 2026-04-23
**Files touched:** 4 (validator, types import usage, package.json, vitest.config.ts, tests/validator.test.ts)

### What was built
Replaced the Day-0 validator stub with the real implementation in `src/lib/validator/index.ts`. Five pure functions — `validateStyles`, `validateFonts`, `validateParticles`, `validateContent`, `validateDangerousPatterns` — plus `validateAll` that composes them into a `ValidationResult`. Added `vitest` as the test runner with 22 tests covering every forbidden CSS property, approved/non-approved fonts, particle clamping, content defaults, script-injection rejection, and a fuzz loop that confirms no input shape makes the validator throw.

### Why
Split errors vs warnings so Stream C can log warnings (missing fonts, stripped props) without blocking a generation, while errors (dangerous patterns) surface to operator dashboards later. Kept dropped selectors as empty blocks rather than deleting them — `buildCssFromTokens` in the renderer will simply skip empty blocks and we avoid coupling the two modules.

### Contracts emitted
- `validateAll(parsed: unknown) → ValidationResult` — never throws.
- `containsDangerousPattern(value: string) → boolean` — reusable by renderer/injection helpers if they ever need the same scan.
- `validateDangerousPatterns(input: unknown) → string[]` — deep scan, circular-safe.

### Tests
- `tests/validator.test.ts` — 22 cases. Covers: never-throws invariant (10 explicit inputs + 25 random fuzz), every `FORBIDDEN_CSS_PROPERTIES` entry, dangerous-pattern rejection inside CSS values, font approved-list enforcement, particle clamping, content-default fallback, empty-string content ignored.

## Phase 2 — Renderer
**Completed:** 2026-04-23
**Files touched:** 9 (renderer/*, rsvp/config.ts, cultural/library.ts, cultural/sectionPlacement.ts, tests/*)

### What was built
Full §4 renderer pipeline. `render()` loads the skeleton via `fs`, builds the `<style>` + Google Fonts link from validated `theme_json`, replaces `{{EVENTS_CARDS}}` with `buildEventCards()` (cultural ceremonies or EventData fallback, clamped to 6), replaces `{{RSVP_FORM}}` with `buildRSVPForm()` (data-driven per `rsvp_config`), prepends Call 3's hero HTML before the first `<section>`, routes cultural content items to their `section` targets via `injectCulturalContent()` + `sectionPlacement.ts` (hero eyebrow / names / date / cta / faq / footer / custom), runs content substitution, and finally `injectStructured()` — which escapes all DB values and substitutes PERSON1/2_NAME, dates, venues, monogram, and photo markers.

Also landed alongside: the real `buildRSVPForm` + `smartDefaultsForProfile` (§29) and the full cultural library (`loadLibrary`, `getCeremoniesForCouple`, `buildCulturalProfile`, `buildCulturalPromptBlock`, `findConflicts`) because the renderer depends on them. These unlock Phase 3–4 tickets too.

### Why
Chose to run content substitution AFTER hero prepend and RSVP/cultural injection, not after loading the skeleton, because Call 3 emits hero HTML with `{{TAGLINE}}` and the RSVP form fragment contains `{{RSVP_SUBMIT_LABEL}}`. A single late pass is simpler than chasing each fragment individually — see DECISIONS [2026-03]. Reserved a hard-coded `STRUCTURED_KEYS` set so that stray `{{PERSON1_NAME}}` entries in an AI content map never consume a structured placeholder — injectStructured is still last.

### How
Order inside `render()`:
1. Validate theme (defensive — pipeline validates too)
2. Head injection — fonts `<link>` + `<style id="veeinvite-theme">`
3. Particle script before `</body>` if effect ≠ none and count > 0
4. `{{EVENTS_CARDS}}` substitution
5. `{{RSVP_FORM}}` substitution
6. Prepend hero
7. `injectCulturalContent(profile)` — routes content items by `section`
8. User-authored custom sections before `<footer`
9. Content map substitution (skips `STRUCTURED_KEYS`)
10. `injectStructured()` LAST (escapes HTML, emits `{{PHOTO:<path>}}` markers from `photo_urls`, resolves bilingual fields to empty strings when flag is off)

### Contracts emitted
- `render(input, options?)` — pure; accepts `{ skeletonHtml?, layoutsRoot? }` so Stream C can pass an in-memory skeleton for restore flows or tests.
- `loadSkeleton(layoutId, root?)` — reads `layouts/<id>/skeleton.html` with an upward search so it works from either the engine or backend worktree.
- `buildCssFromTokens(styles)`, `buildFontsLink(fonts)`, `buildEventCards({ profile, events })`, `buildRSVPForm(config, events)`, `injectStructured({ html, couple, bilingualFields })`.
- Cultural exports: `loadLibrary`, `getCeremoniesForCouple`, `buildCulturalProfile`, `buildCulturalPromptBlock`, `findConflicts`, section-placement helpers.

### Architecture touch-points
- `{{PHOTO:<idx>}}` and `{{PHOTO:<path>}}` resolution — documented in `ARCHITECTURE.md §Photos` (already present from Day 0).
- `{{EVENTS_CARDS}}` dynamic fragment — added §Events below to `ARCHITECTURE.md`.
- Structured-key ownership split — DECISIONS [2026-03].

### Tests
- `tests/renderer.test.ts` — 19 tests covering: `injectStructured` runs last (hallucinated name in content map doesn't reach placeholder), forbidden CSS stripped from output, non-approved fonts dropped, photo-marker rule (no `supabase.co/storage`), `{{EVENTS_CARDS}}` replaced with Tamil ceremonies (4 event cards), RSVP form rendered with `first_name`, determinism, Sikh Ik Onkar glyph preserved, bilingual flag off → empty placeholders, no `{{...}}` leak (except `PHOTO:`).
- `tests/renderer-real-layout.test.ts` — reads the real `layouts/layout-1-modern/skeleton.html` when present (in veeinvite-frontend worktree) and renders against it. Skips when the skeleton hasn't merged to the current worktree. Currently green for layout-1; layouts 2–4 skip until Stream A builds them.

## Phase 3 — Layout Selector
**Completed:** 2026-04-23
**Files touched:** 4 (types.ts + CULTURE_TO_SUGGESTED_LAYOUT export, layoutSelector.ts, tests/layoutSelector.test.ts, tests/cultural.test.ts, tests/rsvp.test.ts)

### What was built
Replaced the Day-0 stub with the §25 decision tree. `selectLayout` is deterministic: style card wins > culture suggestion > default `layout-1`. No AI call. The `CULTURE_TO_SUGGESTED_LAYOUT` table lives in `types.ts` so Streams A + C can import it too (the onboarding UI can show the suggested layout before the config is confirmed).

### Contracts emitted
- `CULTURE_TO_SUGGESTED_LAYOUT: Record<string, LayoutId>` — exported from `types.ts` (tagged in the commit as `TYPES: added CULTURE_TO_SUGGESTED_LAYOUT...`).
- `selectLayout({ styleCard?, culturalProfile?, isStep1? }) → { layoutId, reason }` — the `reason` string is short and human-readable so the dashboard can surface "Why this layout?" without another call.

### Tests
- `tests/layoutSelector.test.ts` — 7 cases including the acceptance-criterion style-card-wins: Tamil culture + Modern Minimalist → layout-1.
- `tests/cultural.test.ts` — 11 cases including Tamil ceremony algorithm (pre-selected Nischayathartham / Mangala Snanam / Oonjal / Maalai Maatral; Sangeet + Baraat + Haldi appear as unselected defaults; Sumangali + Panda Kaal as sub-region additional); Arab Muslim guardrails forbid alcohol; Hindu+Muslim interfaith conflict detection on `hero_eyebrow`.
- `tests/rsvp.test.ts` — 7 cases covering §29 table: Hindu → 10-guest form, childrenSeparate, event selection; Western single-event → 4-guest form; Chinese → meal choice with Standard/Vegetarian.

## Phase 4 — AI prompts, Anthropic wrapper, classifier, vibe map, pipeline
**Completed:** 2026-04-23
**Files touched:** 6 (ai/prompt.ts, ai/generate.ts, ai/classifier.ts, tags/vibeMap.ts, pipeline.ts, types.ts) + tests/ai.test.ts + tests/pipeline.test.ts

### What was built
All three prompt builders (`buildCall2Prompt`, `buildCall3Prompt`, `buildClassifierPrompt`) plus `buildEditPrompt` router per §12. The §5 coherence instruction and §9 design-token glossary are embedded verbatim. Every prompt pulls the cultural prompt block automatically when a profile is set — Tamil guardrails land in Call 2/3, Muslim guardrails forbid alcohol and human figures, Sikh guardrails call out the Gurdwara customs FAQ.

`runCall2`, `runCall3`, `runClassifier` wrap the Anthropic SDK. Model constants come from §23: `claude-sonnet-4-5` for Calls 2 + 3 and `claude-haiku-4-5-20251001` for the classifier. A resilient JSON parser strips markdown fences; on parse failure the runners return safe fallback themes/hero/classification (architecture rule 5). `__setClientForTesting` lets Stream C and tests inject a stub SDK — the AI test suite uses this to mock 6 scenarios without a real API key.

The classifier module adds two deterministic helpers Stream C can use to skip a Haiku round-trip when the instruction is unambiguous: `detectDataField` (regex match for names / venue / date / rsvp deadline) and `keywordFastPath` ("start fresh" → global, "add a section about X" → new_section).

`tagsFromQuiz` maps the style card, vibe words, and culture id to the §27 tag taxonomy. Unknown vibe words are silently ignored.

`generateSite` in `pipeline.ts` composes cultural profile → layout selection → skeleton load → Call 2 → validate → Call 3 → render. Tests use `themeOverride` + `heroOverride` to bypass Anthropic for determinism.

### Why
TYPES change: widened `GenerateSiteInput` to `{ quizAnswers, couple, events?, themeOverride?, heroOverride? }`. Stream C needs the full `CoupleData` (photos, custom sections, rsvp config) at render time — the earlier `existingCoupleId` variant forced the pipeline to re-fetch from Supabase, which breaks the architecture rule that engine code does no I/O. Commit tagged `TYPES: ...`.

The classifier coerces low-confidence "data" to "design" so a bad Haiku call never silently drops a couple's work. Better to over-generate a design pass than corrupt a structured field.

### Contracts emitted
- `buildCall2Prompt(input)`, `buildCall3Prompt(input)`, `buildClassifierPrompt(input)`, `buildEditPrompt(input, classification)` — pure string builders.
- `runCall2(input) → ThemeJSON`, `runCall3(input) → string`, `runClassifier(input) → AIEditClassification` — server-only SDK wrappers.
- `parseJsonResilient<T>(raw)` — public so Stream C can reuse when parsing chat-panel responses.
- `__setClientForTesting(client)` — test-only override.
- `tagsFromQuiz({ styleCard?, vibeWords?, cultureId? }) → string[]`.
- `detectDataField(instruction)`, `keywordFastPath(input)` — classifier fast-path helpers.
- `generateSite(input: GenerateSiteInput) → GenerateSiteOutput` — the end-to-end orchestrator.

### Tests
- `tests/ai.test.ts` — 19 cases covering: `parseJsonResilient` (plain, fenced, prose-wrapped, garbage), Call 2 prompt embeds coherence + forbidden + approved fonts + cultural block, Call 3 prompt substitutes globalTokens + cultural block, classifier prompt lists all 6 types, edit prompt routes per classification; `runCall2` parses + falls back; `runCall3` unfences; `runClassifier` maps types and coerces low-confidence data → design; `detectDataField`/`keywordFastPath` regression tests for the "make it more romantic" / "change our names" / "add a section" examples in the acceptance criteria.
- `tests/pipeline.test.ts` — 2 cases: Hindu-Tamil step-2 quiz produces layout-3 with Tamil ceremonies and injected religious opening, no placeholder leaks, no Supabase URLs; Western fallback → layout-1.

### Final totals
- 87 tests across 8 files, all green.
- `npm run build` succeeds.
- No engine import crosses into `src/app/**`, `src/components/**`, or `src/lib/supabase/**` (verified with grep).

---

## Polish — Interfaith merge + event venue fallback (test-first)
**Completed:** 2026-04-26
**Branch:** `improve-cosmatic-issue`
**Files touched:** 5 engine files (`src/lib/types.ts`, `src/lib/cultural/library.ts`, `src/lib/pipeline.ts`, `src/lib/renderer/buildEventCards.ts`, `src/lib/renderer/index.ts`) + 1 component re-export, 1 API route, 1 onboarding page, 3 test files.

### What was built
Two structural bugs surfaced while tracing the step-2 "Open dashboard" flow. Fixed both with TDD (tests first, watched fail, then made green).

**Bug 1 — interfaith data loss.** The configurator is multi-select but the submit handler shipped only `selections[0]` to the server, and `buildCulturalProfile` was single-culture by signature. Added `buildMergedCulturalProfile(selections, contentValues)` that merges N profiles per the rules in DECISIONS [2026-13]: primary leads design, `copyGuardrails` unioned, `contentItems` + `ceremonies` deduped by id. `QuizStep2Answers` simplified — four loose fields collapsed into one `cultures: CultureSelection[]`. `CultureSelection` promoted from a component-local type to a canonical type in `src/lib/types.ts`.

**Bug 2 — event venue fallback.** `buildEventCards` showed "Venue to be announced" even when `couples.venue_name` was set, because the fallback chain stopped at `ceremony.venue || "Venue to be announced"`. Cultural ceremonies don't carry venues in the library. Added `couple` (typed `Pick<CoupleData, "venue_name">`) to `BuildEventCardsInput` and slotted it into the chain as the last-resort fallback before the placeholder. The renderer entry point (`render()`) forwards `input.couple` into the call.

### Why (non-obvious decisions only)
See DECISIONS [2026-13]. The big call was the merge strategy — primary-leads-design + guardrails-union, rather than equal-weight merge or a schema-level multi-profile. Recorded with four rejected alternatives.

### Contracts emitted
- `buildMergedCulturalProfile(selections: CultureSelection[], contentValues, bilingual?): CulturalProfile | null` — exported from `@/lib/cultural/library`.
- `CultureSelection` type — moved to `@/lib/types`. The configurator component re-exports for back-compat with any callers that imported it from there.
- `QuizStep2Answers` payload shape changed: `cultures: CultureSelection[]` replaces the four loose fields. Stream A's onboarding step 2 already updated; Stream C's `/api/generate` route already updated.
- `BuildEventCardsInput.couple?: Pick<CoupleData, "venue_name">` — optional. Existing callers without `couple` keep their current behaviour (fallback to placeholder).

### Follow-ups
- [ ] `cultural_context` column on the `couples` row records only the primary culture id. If we want analytics on interfaith couples, add a `cultures: jsonb` column and store all selections. Severity: low.
- [ ] Sub-region awareness applies only to the primary culture in the merged profile. Couples picking Hindu Punjabi + Muslim Arab get Punjabi's sub-region note but not Arab's. Schema-level fix is invasive; non-blocker for M1.
- [ ] Couples still need a dashboard editor for per-event date/time/venue overrides — until that lands, all events default to `couples.venue_name`. Filed as a known M1 gap.

### Tests
- `tests/cultural.test.ts` — 7 new cases under `describe("buildMergedCulturalProfile")` covering empty list, single-selection equivalence, primary-wins, guardrail union, content/ceremony dedupe, idempotence.
- `tests/renderer.test.ts` — 3 new cases: couple-venue fallback in cultural-profile path, EventData precedence preserved, placeholder still appears when no venue exists anywhere.
- `tests/pipeline.test.ts` — fixture updated to the new `cultures: [...]` shape.
- `npm test` — 159/159 passing. `npx tsc --noEmit` — clean.

---

## Phase 3 — PALETTE-03 pre-call + parallel Calls 2/3 (TDD, with TUNE additions and an honest diversity miss)

**Completed:** 2026-04-27
**Branch:** `improve-cosmatic-issue`
**Files touched:** new `src/lib/ai/prePaletteCall.ts`, `src/lib/observability/events.ts`, `src/lib/editPipelineGlobal.ts`, `scripts/spike-haiku-hsl-v2.ts`, `doc/spikes/2026-04-27-haiku-hsl-spike-v2.md`; modified `src/lib/cultural/library.ts`, `src/lib/ai/prompt.ts`, `src/lib/ai/generate.ts`, `src/lib/pipeline.ts`, `src/lib/renderer/fallbackHero.ts`, `src/lib/types.ts`, `src/app/api/generate/route.ts`, `src/app/api/edit/route.ts`; new tests `tests/prePaletteCall.test.ts`, `tests/observability.test.ts`, `tests/editPipelineGlobal.test.ts`; fixture updates in `tests/ai.test.ts`, `tests/pipeline.test.ts`, `tests/heroJsonEnvelope.test.ts`. DECISIONS gained [2026-16], [2026-17], [2026-18]. Ticket `doc/tickets/PALETTE_DIVERSITY_TICKETS.md` updated. Future-work item #13 updated with a Phase 3.5 follow-up.

### What was built

A Haiku 4.5 pre-call that picks the 4 expressive tokens (`bgPrimary`, `accent`, `gold`, `fontDisplay`) upstream of Calls 2 and 3, plus the pipeline restructure that runs Calls 2 and 3 in parallel against the locked palette. The pre-call validates HSL values against `cultural-content-library.json` ranges (TUNE-2 midpoint check), retries once with a correction block on validation failure, and falls back to a deterministic library-derived palette if both attempts fail. Edit flows now derive the palette from the persisted `expressive_palette` column for design / hero edits (preserving the user's expressive choices) and re-run the pre-call for "global / start fresh" edits. Observability events (`palette_precall` with `attempt`, `status`, `culture`, `subRegion`, `error`) emit at every retry / fallback boundary so log-mining can compute per-culture failure rates without a separate service.

### Why (non-obvious decisions)

Three calibrations differ from the original Phase 3 spec and are recorded in DECISIONS:

- **MIDPOINT_THRESHOLD = 0.05 (not 0.15)** — DECISIONS [2026-16]. The spec'd 0.15 is unreachable for tight cultural ranges (Punjabi `bgPrimary` averages cap at ~0.118 even at corner values). Empirically calibrated.
- **Call 2 drift handling: overwrite-and-warn, not reject** — DECISIONS [2026-17]. Rejecting drift on the 4 expressive tokens routes to Call 2's full fallback, discarding the 8 good non-expressive tokens. The pipeline forces the locked values and `console.warn`s the drift instead.
- **Phase 3 ships with the diversity goal explicitly unmet** — DECISIONS [2026-18]. Spike v2 measured 88% midpoint clustering vs the 30% target. Structural wins (parallel calls, `expressive_palette` persistence, edit-flow palette stability, observability) are intact. The diversity gap is a Phase 3.5 follow-up (`doc/future-work.md` item #13.A).

### How (load-bearing details)

- Pipeline: pre-call runs after layout selection; Calls 2 + 3 wrapped in `Promise.all` against the locked palette; pipeline overwrites Call 2's drifted tokens before validation. Same overwrite contract is enforced in `runGlobalEditPipeline`.
- Edit flow: `deriveEditPalette(couple)` reads `couple.expressive_palette`, with a `globalTokens`-derived fallback for legacy couples. `case "global"` in `/api/edit/route.ts` calls `runGlobalEditPipeline`, then persists the freshly chosen palette so subsequent design / hero edits inherit it.
- Spike v2 imports the production `buildPalettePrompt` / `validateExpressivePalette` / `MAX_RETRIES` / `MIDPOINT_THRESHOLD` from `@/lib/ai/prePaletteCall`. The original spike file remains as the baseline.

### Contracts emitted

- `runPalettePreCall({ cultureId, subRegion?, styleCard, vibeTags, cultureName }) → ExpressivePalette` — Stream B's pre-call entry point. Production code calls it from the pipeline; tests can substitute `paletteOverride` on `GenerateSiteInput`.
- `ExpressivePalette` (type) — the 4 locked tokens. Persisted to `couples.expressive_palette` (JSONB column, added in Phase 1).
- `runGlobalEditPipeline({ couple, layoutId, skeletonHtml }) → { themeJson, heroHtml, palette }` — pure helper used by `/api/edit/route.ts` for the global-edit branch. Caller persists `palette` to the DB.
- `emitEvent(name, fields)` — minimal structured-log helper at `@/lib/observability/events`. One JSON line per call via `console.log`. Replaceable later by a real sink.
- `Call2Input.palette: ExpressivePalette` — required (was missing in Phase 2). `Call3Input.palette: ExpressivePalette` — replaces the prior `globalTokens: GlobalTokens` field. Both updates land in `src/lib/types.ts`.

### Follow-ups

- [ ] **Phase 3.5 — diversity tuning** (`doc/future-work.md` #13.A). Two specific fixes proposed: (1) widen the tightest 4–5 cultural ranges by ~30% so a higher `MIDPOINT_THRESHOLD` (0.10) becomes reachable, then raise the threshold; (2) change `buildFallbackPalette` to pick a corner or hash-based off-centre point instead of midpoints. Re-run spike v2 after each change. Estimated 3 hours.
- [ ] **Latency benchmark (AC #3)** — manual measurement of the ≥ 5s wall-time decrease vs the pre-Phase-3 sequential pipeline still pending. The spike v2 mean total latency for the pre-call alone (1603ms with retries; ~600ms baseline) is consistent with the parallelism gain, but a full-pipeline 5-sample average is the authoritative number.
- [ ] **Observability event sink** — events currently land in `console.log`. When a real log pipeline (Datadog / Logflare / Sentry) is wired, swap the implementation in `src/lib/observability/events.ts`. No call-site changes needed.

### Tests

- `tests/prePaletteCall.test.ts` — 38 cases: `parseHsl`, `hueInRange` (incl. wrapping ranges), `distanceToMidpoint`, `validateExpressivePalette` (happy path + failure paths + TUNE-2 midpoint), `buildPalettePrompt` (TUNE-1 structure + diversity block placement), `buildFallbackPalette`, `runPalettePreCall` (mocked Haiku, retry path, fallback path, observability events emitted with correct `attempt` / `status` / `culture` / `error`).
- `tests/observability.test.ts` — 4 cases: `emitEvent` shape, JSON envelope, ISO timestamp, undefined-field tolerance.
- `tests/editPipelineGlobal.test.ts` — 1 case: `runGlobalEditPipeline` runs the pre-call (proven by the returned palette differing from the persisted one), then Calls 2 + 3 in parallel, then locks the fresh palette into `globalTokens`. Three Anthropic calls fire.
- `tests/ai.test.ts`, `tests/pipeline.test.ts`, `tests/heroJsonEnvelope.test.ts` — fixtures updated to include `palette: TEST_PALETTE` and `paletteOverride` so the AI calls run deterministically against the locked tokens.
- **`npm test` — 260/260 passing. `npx tsc --noEmit` — clean.**
- Spike v2 (`scripts/spike-haiku-hsl-v2.ts`) ran live against Haiku 4.5 with 29 cases; report at `doc/spikes/2026-04-27-haiku-hsl-spike-v2.md`. Headline finding: clustering rate 88% (target < 30%) — see DECISIONS [2026-18].
