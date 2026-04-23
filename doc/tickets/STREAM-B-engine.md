# STREAM-B: Engine — Validator, Renderer, Layout Selector, AI Prompts, Cultural Profile, RSVP Config

**Parallel stream. Worktree: `../veeinvite-engine`. Branch: `stream-b-engine`.**

---

## Summary

Pure-function core. Everything here takes typed input and returns typed output — no I/O, no database, no UI. Stream C's API routes import and orchestrate this code. Stream A never imports from here directly.

This stream is the quality floor of the product. The validator and renderer are what make AI output safe to ship. The cultural profile system is what makes a Tamil wedding different from a Punjabi wedding.

---

## Scope (plan §§ references)

| Phase | What | Plan § |
|-------|------|--------|
| 2 | Validator + renderer | §9 step 3, §10 |
| 3 | Layout selector | §25 |
| 4 | AI prompts — all 3 calls | §9 |
| — | Cultural profile system | §26 |
| — | RSVP form builder | §29 |
| — | Bilingual flag handling (v1 pass-through) | §33 |
| — | Pipeline orchestrator | §4 |

---

## Prerequisites

Day 0 merged. You should see:

- `src/lib/types.ts` — canonical types to import
- `src/lib/cultural-content-library.json` — the cultural data
- Stub implementations of all your files returning empty values (you replace them)

---

## File Ownership

### OWNS — write freely

- `src/lib/validator/index.ts` — full implementation
- `src/lib/renderer/index.ts` — full implementation
- `src/lib/renderer/injectStructured.ts`
- `src/lib/renderer/injectCulturalContent.ts`
- `src/lib/renderer/injectHero.ts`
- `src/lib/renderer/buildEventCards.ts`
- `src/lib/renderer/buildCssFromTokens.ts`
- `src/lib/layoutSelector.ts`
- `src/lib/ai/prompt.ts` — all three call prompts
- `src/lib/ai/generate.ts` — Anthropic SDK wrapper
- `src/lib/ai/classifier.ts` — chat instruction classifier (§12, §30)
- `src/lib/cultural/library.ts` — `getCeremoniesForCouple`, `buildCulturalProfile`, `buildCulturalPromptBlock`
- `src/lib/cultural/sectionPlacement.ts` — §26 section-type injection helpers
- `src/lib/rsvp/config.ts` — `buildRSVPForm`, `smartDefaultsForProfile`
- `src/lib/tags/vibeMap.ts` — vibe word → tags dictionary (§27)
- `src/lib/pipeline.ts` — orchestrator: quiz answers → validated, rendered HTML
- `tests/**` — unit tests for the above

### SHARED — may extend, must coordinate

- `src/lib/types.ts` — you own this. If you add types, commit with message `TYPES: added X for Y reason`. Streams A and C will see it on next pull.
- `src/lib/cultural-content-library.json` — you own read logic; edit only to fix errors in the data, never to add new cultures without coordination.

### NEVER TOUCHES

- `src/components/**`, `src/app/**` — Stream A (pages) and Stream C (API routes)
- `src/lib/supabase/**`, `src/middleware.ts`, `supabase/**` — Stream C
- `layouts/**` — Stream A owns the HTML; you read it at runtime via `fs.readFile`

---

## Work Breakdown

### Phase 2 — Validator (§10)

`src/lib/validator/index.ts`. Must never throw — bad values get safe defaults (architecture rule 5).

Functions to implement:

- `validateStyles(raw)` — strips forbidden CSS properties (§10 forbidden list). Returns `{ valid: StylesMap, errors, warnings }`.
- `validateFonts(raw)` — enforces the approved fonts list (§10). Drops anything not on the list.
- `validateParticles(raw)` — clamps `count` to 0–30, `opacity` to 0–0.7, `effect` to allowed enum, `colors` to max 4.
- `validateContent(raw)` — for every placeholder token, either take the AI value or apply the safe default (§10 content defaults table).
- `validateDangerousPatterns(input)` — rejects `/javascript:/i`, `/expression\(/i`, `/<script/i`, `/@import/i`, `/behaviour:/i`, `/-moz-binding/i`. Applied to all string values in the JSON.
- `validateAll(parsed)` — master function that runs all five.

**Tests required:**

- Forbidden CSS property is stripped
- Non-approved font is dropped, approved font passes
- Particle count of 50 clamps to 30
- Missing `TAGLINE` gets default "Together forever"
- `<script>alert(1)</script>` injection is rejected
- Function never throws for any of these cases

### Phase 2 — Renderer (§4, §9 step 3)

`src/lib/renderer/index.ts`. Main `render()` function that takes:

```ts
render({
  layoutId: string,
  themeJson: ThemeJSON,
  heroHtml: string,
  culturalProfile: CulturalProfile,
  coupleData: CoupleData,
  events: EventData[],
  rsvpConfig: RSVPConfig
}): string  // final HTML
```

Steps per §4 pipeline:

1. Load skeleton HTML by `layoutId` from `layouts/layout-N-*/skeleton.html` (fs read)
2. Build CSS string from `themeJson.styles` via `buildCssFromTokens()`
3. Validate CSS (call validator)
4. Build Google Fonts `<link>` from `themeJson.fonts`
5. Inject CSS + fonts into skeleton `<head>`
6. Inject AI content into `{{PLACEHOLDER}}` tokens
7. Prepend hero HTML before the skeleton's first `<section>`
8. Inject `{{EVENTS_CARDS}}` via `buildEventCards(culturalProfile.ceremonies, themeJson)` (§26)
9. Inject `{{RSVP_FORM}}` via `buildRSVPForm(rsvpConfig, events)` (§29)
10. Inject cultural content via `injectCulturalContent(html, profile)` — routes content items to their `section` targets (§26)
11. **`injectStructured()` runs LAST** — overwrites every name/date/venue/monogram with real DB values (architecture rule 4)

**Tests required:**

- Rendered HTML contains couple names even if AI content had different names
- Forbidden CSS from theme_json does not appear in output
- `{{EVENTS_CARDS}}` is replaced with N event cards where N = confirmed ceremonies
- Cultural content item with section "hero_eyebrow" lands above hero names
- Sikh `Ik Onkar` renders with correct glyph; Muslim `Bismillah` renders with Arabic
- Render is deterministic — same input = same output

### Phase 3 — Layout Selector (§25)

`src/lib/layoutSelector.ts`. Decision tree per §25:

```ts
selectLayout(input: {
  styleCard?: StyleCard,
  culturalProfile?: CulturalProfile,
  isStep1: boolean
}): { layoutId: string, reason: string }
```

Logic:

1. If `styleCard` present → use `STYLE_CARD_TO_LAYOUT[styleCard]` (§25 table)
2. Else if `culturalProfile.id` present → use `CULTURE_TO_SUGGESTED_LAYOUT[cultureId]`
3. Else → `"layout-1"` (default)

No AI call in v1. The §6 "ambiguity → Claude confirms" is deprecated (§25 says tags no longer drive layout selection).

**Tests required:**

- Tamil culture + no style card → returns `layout-3`
- Tamil culture + "Modern Minimalist" style card → returns `layout-1` (style card wins)
- No culture + no style card → returns `layout-1`

### Phase 4 — AI Prompts (§9)

`src/lib/ai/prompt.ts`. Three prompt builders:

**`buildCall2Prompt(input)`** — the main call. Must include:

- The complete selected skeleton HTML (read from `layouts/`)
- Couple data
- Design token glossary (§9 table)
- **Coherence instruction verbatim** from §5
- **Cultural prompt block** from `buildCulturalPromptBlock(profile)` (§26) — includes `designGuidance`, `copyTone`, `copyGuardrails`, ceremonies list
- Required output schema (§9 JSON structure)
- Forbidden CSS property list (§10)
- Approved fonts list (§10)

**`buildCall3Prompt(input)`** — hero generation. Uses the exact instruction from §9 "Call 3 exact instruction" block, with `globalTokens` values substituted. Include cultural prompt block (for religious opening symbols, motif guidance).

**`buildCall1Prompt(input)`** — only used if `selectLayout` returns ambiguous (currently: never, since tags don't drive layout selection anymore). Keep for future use.

**`buildEditPrompt(input, classification)`** — per §12 routing table:

- `design` → Call 2 only, reuses layout + hero
- `hero` → Call 3 only, reuses layout + tokens
- `global` → Calls 2 + 3
- `data` → no AI call (handled by Stream C's `/api/structured`)
- `content` → targeted content rewrite, direct injection
- `new_section` → custom section generator (M2, stub in M1)

`src/lib/ai/classifier.ts` — classifier that takes a user chat message (+ optional content-picker context from §30) and returns `{ type, target?, confidence }`. Use a Claude Haiku call for speed — this is hot path. Return type matches `AIEditClassification` in `types.ts`.

### Phase 4 — Claude SDK wrapper

`src/lib/ai/generate.ts`. Wraps Anthropic SDK. One exported function per call:

```ts
async function runCall2(input: Call2Input): Promise<ThemeJSON>
async function runCall3(input: Call3Input): Promise<string>  // hero HTML
async function runClassifier(input: ClassifierInput): Promise<AIEditClassification>
```

- Use `claude-sonnet-4-5` per §23 for Calls 2 and 3
- Use `claude-haiku-4-5` for the classifier (speed + cost)
- Parse JSON responses with a resilient parser (AI sometimes wraps in markdown code fences)
- On parse failure, return safe defaults — validator then fills gaps (architecture rule 5)
- Never call Anthropic from the browser (architecture rule 10)

### Cultural Profile System (§26)

`src/lib/cultural/library.ts`:

- `loadLibrary()` — import the JSON, validate its shape with a zod-like check
- `getCeremoniesForCouple(cultureId, subRegion?)` — exact algorithm from §26. Returns `DisplayCeremony[]`.
- `buildCulturalProfile(cultureId, subRegion, confirmedContentIds, confirmedCeremonyIds, values)` — per §26
- `buildCulturalPromptBlock(profile)` — per §26, used by `buildCall2Prompt` and `buildCall3Prompt`
- `findConflicts(profiles: CulturalProfile[])` — for interfaith weddings (§26) — returns list of content items in the same section slot (e.g. two religious openings → conflict)

`src/lib/cultural/sectionPlacement.ts`:

- `injectHeroEyebrow`, `injectHeroNamesArea`, `injectHeroDateArea`, `injectHeroCtaArea` — for content items with those `section` types (§26)
- `injectFAQCulturalItems`
- `injectFooterCulturalItems`
- `injectCustomCulturalSections` (e.g. Aso-ebi, Padrinos)

**Tests required:**

- `hindu_indian / tamil` returns Tamil-correct pre-selection (Mehendi, Nischayathartham, etc.) with Sangeet / Haldi / Baraat shown unselected ("also available")
- `muslim / arab_muslim` — `copyGuardrails` forbids alcohol references and human figures
- Jewish Chuppah time lands in `hero_cta_area` (per §26 section table)
- `hindu + muslim` interfaith returns 2 religious openings → conflict surfaced

### RSVP Config (§29)

`src/lib/rsvp/config.ts`:

- `smartDefaultsForProfile(profile: CulturalProfile): RSVPConfig` — per §29 table
- `buildRSVPForm(config: RSVPConfig, events: EventData[]): string` — returns HTML fragment for `{{RSVP_FORM}}` placeholder

Per §29, the form is built at render time from config. No hardcoded 4-guest cap. Event selection appears only if 2+ events and `eventSelectionEnabled`.

### Bilingual pass-through (§33)

- Accept `profile.bilingualEnabled` flag
- Pass `{{PERSON1_NAME_BILINGUAL}}` etc. through render — if flag is false, they resolve to empty strings. v1 does not render bilingual text but architecture accommodates it.

### Pipeline Orchestrator

`src/lib/pipeline.ts` — the function Stream C's `/api/generate` calls:

```ts
async function generateSite(input: {
  quizAnswers: QuizStep1Answers | QuizStep2Answers,
  existingCouple?: CoupleData,
}): Promise<{
  html: string,
  themeJson: ThemeJSON,
  heroHtml: string,
  layoutId: string,
  globalTokens: GlobalTokens,
  designSummary: string,
  culturalProfile: CulturalProfile,
}>
```

Sequence:

1. Build cultural profile from quiz answers
2. Select layout
3. Run Call 2 → themeJson
4. Validate themeJson
5. Run Call 3 → heroHtml (with globalTokens from step 4)
6. Call `render()` with all pieces
7. Return bundle for Stream C to persist

---

## Coordination

- **Commit daily and merge to main** so Stream C can wire their routes against your real code (rather than stubs).
- If you add to `types.ts`, tag the commit: `TYPES: added X for Y reason`.
- Tests live in `tests/` — Stream C will run them in CI.
- Do not call Supabase from engine code. No database I/O. Pure functions.

---

## Acceptance Criteria

- [ ] Validator has tests for every forbidden CSS property, dangerous pattern, font, particle limit, content default
- [ ] Validator never throws (fuzz test: random JSON inputs)
- [ ] Renderer produces valid HTML from a fixture theme_json against all 4 skeletons
- [ ] `injectStructured` runs last — verified by test where AI copy says "Raj & Priya" but DB says "Meera & Arjun" → output shows "Meera & Arjun"
- [ ] Layout selector passes style-card-wins test (§25)
- [ ] `getCeremoniesForCouple("hindu_indian", "tamil")` matches the §26 Tamil expected output exactly
- [ ] Interfaith conflict detection surfaces (not auto-resolves) the duplicate religious opening case
- [ ] RSVP form builder produces a 10-guest-capable form for Hindu profile, 4-guest form for Western single-event
- [ ] Bilingual flag passes through — v1 renders empty strings for `_BILINGUAL` placeholders, no errors
- [ ] All three Claude prompts include the cultural prompt block when profile is set
- [ ] Classifier returns correct type for: "make it more romantic" → `design`; "change our names to Meera & Arjun" → `data`; "add a section about our dog" → `new_section`
- [ ] `src/lib/pipeline.ts` `generateSite()` returns a complete bundle given mock quiz answers
- [ ] `npm run build` succeeds. `npm test` passes.
- [ ] No imports from `src/app/**`, `src/components/**`, `src/lib/supabase/**` (verify with grep)

---

## Definition of Done

Stream C can call `generateSite()` with quiz answers and receive a bundle ready to persist + serve. Every AI output is validated. Every cultural profile injects the correct content to the correct skeleton section. The site always renders — bad AI output never crashes anything.

---

## First prompt for the Stream B session

> Read `doc/VEEINVITE_PRODUCT_PLAN.md` (deep-read §§4, 5, 9, 10, 25, 26, 27, 29, 30, 33), `CLAUDE.md`, and `doc/tickets/STREAM-B-engine.md`. Execute the ticket end to end, starting with Phase 2 (validator). Pure functions only — no database, no UI, no fetch calls. Commit per module. Write unit tests as you go. If you extend `types.ts`, tag the commit `TYPES: ...`. Do not touch files outside your ownership list.
