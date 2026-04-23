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
