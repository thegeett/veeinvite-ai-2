# Palette Diversity — Phased Tickets

**Initiative:** Fix the "all generated invitations look similar" bug by replacing the free-text vibe input with a structured tag picker, then routing the captured signal into a new Haiku pre-call that picks 4 expressive tokens upstream of Sonnet's Calls 2 and 3.

**Specs:**
- `doc/VIBE_TAG_PICKER_SPEC.md`
- `doc/PRECALL_IMPLEMENTATION_SPEC.md`
- `doc/precall_palette_architecture.md` (architectural rationale)
- `src/lib/cultural-content-library.json` (HSL ranges per culture)

**Branch:** `wizard-journey` already in flight; new branches per phase.

---

## How phases work

Each phase is a self-contained ticket with:
- **Goal** — what we're trying to achieve
- **Scope** — in / out of scope
- **Files touched** — concrete file list
- **Work breakdown** — ordered subtasks
- **Acceptance criteria** — testable, observable conditions
- **Test plan** — TDD: failing tests first, then make them pass
- **Code review checklist** — items to verify before merging
- **Definition of done** — the binary "shipped or not" gate
- **Effort estimate** — realistic, includes review + iteration
- **Dependencies** — which phases must complete first

**Workflow per phase:**
1. Write failing unit tests first (where applicable).
2. Implement until tests pass.
3. Run typecheck + full test suite.
4. Self-code-review against the checklist.
5. Surface review findings to operator.
6. Operator resolves review items (or accepts).
7. Operator approves commit.
8. Operator approves PR creation.

---

## Phase 0 — Spec polish ✅ DONE

**Status:** Complete. Two surgical edits already applied (operator approved):
- Bengali accent `note` strengthened in `src/lib/cultural-content-library.json` to prevent Haiku from second-guessing the cream/white-on-red duality.
- Cultural tag preview redesigned in `doc/VIBE_TAG_PICKER_SPEC.md` to use two independent bars (Decoration 0–5, Motion 0–3) so `vibrant` doesn't lie about decoration changes.

No code, no tests, no PR. Documentation only.

---

## Phase 1 — Vibe Tag Picker UI + DB columns

**ID:** PALETTE-01
**Type:** PR-bearing (frontend + DB migration)
**Effort:** ~6 hours including TDD, code review, iteration
**Dependencies:** none (independent of Haiku spike and pre-call)
**Branch:** new branch `palette-vibe-tags` off latest `main`

### Goal
Replace the free-text vibe input with the structured tag picker described in `VIBE_TAG_PICKER_SPEC.md`. Capture `vibe_tags` on the couple row. **Do not wire the pre-call yet** — the captured field is unused by Calls 2/3 in this phase. This isolates the UX win from the AI-architecture change so each can ship and be observed independently.

### Scope

**In:**
- `<VibeTagPicker>` React component — dual-mode (western 12 tags / cultural 8 tags), max-3 selection, replace-least-recent on overflow, dimmed state, mode-specific subheading copy.
- `<TagPreview>` React component — desktop hover (300 ms) / mobile long-press (400 ms). Western mode shows 3 swatches + keywords; cultural mode shows two bars (Decoration + Motion) + keywords.
- `src/lib/ai/vibeTagPicker.ts` — `WESTERN_TAGS[]`, `CULTURAL_TAGS[]`, `WESTERN_TAG_MAP`, `CULTURAL_TAG_MAP`, `selectWesternFamily()`, `applyVibeTagsToWeight()`, `WESTERN_FAMILY_IDS`. **No `parseOptionalText`** — explicitly excluded by spec.
- New migration `supabase/migrations/003_add_vibe_tags.sql`: `ALTER TABLE couples ADD COLUMN vibe_tags TEXT[] DEFAULT '{}'` and `ADD COLUMN expressive_palette JSONB`.
- `CoupleData` gains `vibe_tags: string[]` and `expressive_palette: ExpressivePalette | null` (optional).
- `rowToCouple` mapper hydrates the new columns (defaults `vibe_tags: []` and `expressive_palette: null`).
- Update `OnboardingStep2Form.tsx` to use `<VibeTagPicker>` in place of the current free-text "three words" input.
- Update `/api/generate` step 2 route to persist `vibe_tags` from the request body.
- `QuizStep2Answers` gains `vibeTags: string[]`; remove `vibeWords: string[]` (or alias for one cycle if back-compat needed — flag during review).
- Update `OnboardingStep1Form` and `OnboardingStep2Form` prefill paths to populate from `couple.vibe_tags`.

**Out:**
- The pre-call. `vibe_tags` is captured but not consumed by Calls 2/3 in Phase 1. That happens in Phase 3.
- Migration of existing `vibe` text data (operator: dev env, no production data to preserve).
- Removing the `vibe TEXT` column. Keep it nullable, deprecated, dropped in a later cleanup phase.

### Files touched

| File | Change |
|---|---|
| `supabase/migrations/003_add_vibe_tags.sql` | new |
| `src/lib/types.ts` | `CoupleData.vibe_tags`, `CoupleData.expressive_palette`, `ExpressivePalette` type, `QuizStep2Answers.vibeTags` |
| `src/lib/db/mappers.ts` | hydrate `vibe_tags`, `expressive_palette` |
| `src/lib/ai/vibeTagPicker.ts` | new — pure logic + tag definitions |
| `src/components/quiz/VibeTagPicker.tsx` | new — UI component |
| `src/components/quiz/TagPreview.tsx` | new — hover/long-press preview |
| `src/components/onboarding/OnboardingStep2Form.tsx` | replace `<input>` for vibe with `<VibeTagPicker>` |
| `src/app/api/generate/route.ts` | persist `vibe_tags` on step 2 UPDATE |
| `tests/vibeTagPicker.test.ts` | new — pure-function tests |
| `tests/mappers.test.ts` | extend — `vibe_tags` + `expressive_palette` round-trip |

### Work breakdown

1. **TDD scaffold (failing tests first).** Write `tests/vibeTagPicker.test.ts` covering `selectWesternFamily()` and `applyVibeTagsToWeight()`. Tests fail because the module doesn't exist yet. Extend `tests/mappers.test.ts` with two new cases for `vibe_tags` and `expressive_palette` round-trip.
2. **Migration + types + mapper.** Add migration, extend `CoupleData` type, hydrate in `rowToCouple`. Make existing fixture-based tests pass with `vibe_tags: []` defaults.
3. **`vibeTagPicker.ts` module.** Write `WESTERN_TAGS`, `CULTURAL_TAGS`, both `_MAP` constants, `selectWesternFamily()`, `applyVibeTagsToWeight()`. Make Phase 1 unit tests pass.
4. **`<TagPreview>` component.** Render swatches+keywords for western or two bars + keywords for cultural. Position above/below based on viewport. Mobile bottom sheet variant.
5. **`<VibeTagPicker>` component.** Wire selection state, max-3 logic, dimming, accessibility (aria-pressed, keyboard nav, reduced-motion). Compose `<TagPreview>`.
6. **Step 2 form integration.** Replace the free-text input. Pass `vibe_tags` through the submit handler.
7. **API route persistence.** `/api/generate` step 2 stores `vibe_tags` in the UPDATE payload.
8. **Self-review against checklist** (below).

### Acceptance criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | New users on `/onboarding/step-2` see the tag picker, not a free-text input | Visual QA |
| 2 | Western couples see 12 tags in a 3×4 grid; cultural couples see 8 tags in a 2×4 grid | Visual QA per culture |
| 3 | Subheading copy differs: "we'll use this to pick your color palette" (western) vs "we'll use this to set the tone and decoration" (cultural) | Visual QA |
| 4 | Selecting more than 3 tags replaces the least-recently-selected one | Manual interaction test |
| 5 | Hovering a western tag (desktop) shows 3 color swatches + 3 keywords after ~300 ms | Manual + DOM inspection |
| 6 | Long-pressing a cultural tag (mobile, can simulate via dev-tools) shows two bars + keywords | Manual + DOM inspection |
| 7 | `vibrant` cultural tag renders Decoration bar empty, Motion bar full | Visual + truth-table check |
| 8 | Submitting step 2 stores selected tags in `couples.vibe_tags` (verify via DB query or `/api/couple` GET) | Manual + DB inspection |
| 9 | Editing step 2 (returning user) prefills the tag picker with previously stored tags | Manual flow |
| 10 | `selectWesternFamily('romantic_traditional', ['romantic', 'soft'])` returns `'botanical_garden'` | Unit test |
| 11 | `applyVibeTagsToWeight(base, ['vibrant'])` changes only `animationLevel` to `'ambient'`, leaves `density` and `motifIntensity` untouched | Unit test |
| 12 | `rowToCouple` returns `vibe_tags: []` for rows where the column is null/missing | Unit test |
| 13 | `npm test` passes; `npx tsc --noEmit` clean | Build gate |
| 14 | No accessibility regressions: every tag has `aria-pressed`, keyboard arrow keys move focus, `Space`/`Enter` toggles | Manual a11y test |

### Test plan (TDD)

**Failing tests written first**, before any implementation:

```typescript
// tests/vibeTagPicker.test.ts
describe('selectWesternFamily', () => {
  it('returns botanical_garden for [romantic, soft]', () => {
    expect(selectWesternFamily('romantic_traditional', ['romantic', 'soft']))
      .toBe('botanical_garden');
  });
  it('falls back to style card when no tags match', () => {
    expect(selectWesternFamily('editorial_bold', []))
      .toBe('editorial_minimal');
  });
  it('uses style card to break ties', () => {
    expect(selectWesternFamily('romantic_traditional', ['romantic', 'elegant']))
      .toBe('botanical_garden');
  });
});

describe('applyVibeTagsToWeight', () => {
  it('vibrant changes only animationLevel — density and motifIntensity unchanged', () => {
    const base = { motifIntensity: 'medium', density: 'balanced', materialType: 'silk', animationLevel: 'gentle' };
    const result = applyVibeTagsToWeight(base, ['vibrant']);
    expect(result.animationLevel).toBe('ambient');
    expect(result.density).toBe(base.density);
    expect(result.motifIntensity).toBe(base.motifIntensity);
  });
  it('contemporary pushes density and motifIntensity down', () => {
    const base = { motifIntensity: 'prominent', density: 'ornate', materialType: 'velvet', animationLevel: 'ambient' };
    const result = applyVibeTagsToWeight(base, ['contemporary']);
    expect(result.density).toBe('minimal');
    expect(result.motifIntensity).toBe('subtle');
    expect(result.materialType).toBe('marble');
  });
});

// tests/mappers.test.ts (extended)
describe('rowToCouple — vibe_tags + expressive_palette', () => {
  it('hydrates vibe_tags: [] when column missing', () => {
    const couple = rowToCouple({ id: 'c1', user_id: 'u1', slug: 's', person1_name: 'A', person2_name: 'B' });
    expect(couple.vibe_tags).toEqual([]);
  });
  it('preserves array of selected tags', () => {
    const couple = rowToCouple({ /* ... */ vibe_tags: ['romantic', 'soft'] });
    expect(couple.vibe_tags).toEqual(['romantic', 'soft']);
  });
  it('expressive_palette null when missing', () => {
    const couple = rowToCouple({ /* ... */ });
    expect(couple.expressive_palette).toBeNull();
  });
});
```

UI components (`<VibeTagPicker>`, `<TagPreview>`) are not unit-tested — repo has no jsdom setup. Manual QA against the acceptance criteria covers them. Recorded as a follow-up: integration test infra is its own initiative.

### Code review checklist (self-review pre-commit)

- [ ] No `parseOptionalText` function exists (spec explicitly forbids).
- [ ] Free-text input is gone from `OnboardingStep2Form` — verify by grep.
- [ ] `vibrant` cultural tag maps to `{ animationLevel: 'ambient' }` *only* — no `density` or `motifIntensity` in its CULTURAL_TAG_MAP entry.
- [ ] `<TagPreview>` cultural mode renders two bars, not one — verify with `vibrant` showing empty Decoration + full Motion.
- [ ] Subheading copy differs by mode (`western` vs cultural).
- [ ] `aria-pressed` on every tag button; keyboard navigation works.
- [ ] No raw Supabase URLs in any UI code.
- [ ] `CoupleData.vibe_tags: string[]` is required (not optional) — defensive `[]` default in mapper.
- [ ] Migration runs cleanly against a fresh local DB (`supabase db reset` or equivalent).
- [ ] `npx tsc --noEmit` clean.
- [ ] All existing tests still pass (`npm test`).
- [ ] No emojis introduced into JSX or copy unless explicitly in spec.
- [ ] No commented-out code, no `console.log` left in.

### Definition of done

- Acceptance criteria 1–14 all met.
- Self-review checklist 100% green.
- Operator has reviewed surfaced findings.
- Operator has approved commit message and PR body.

---

## Phase 2 — Haiku HSL Confidence Spike

**ID:** PALETTE-02
**Type:** Investigation script (no production code, no PR)
**Effort:** ~2 hours + ~$0.05 in Haiku API calls
**Dependencies:** none — runs independently of Phase 1
**Branch:** new branch `palette-haiku-spike` (or work directly on a scratch branch and not commit)

### Goal
Verify Haiku 4.5 reliably produces `hsl(H, S%, L%)` strings within the tight library ranges, with structured-JSON output discipline. **The pre-call architecture (Phase 3) depends on this assumption.** A 2-hour investigation now is cheap insurance against a 12-hour rebuild later.

### Scope

**In:**
- Standalone script `scripts/spike-haiku-hsl.ts` — runs ~30 prompts, captures raw responses, evaluates pass/fail per the validator, writes a markdown report.
- ~30 test cases varied across culture × style card × vibe-tag combinations (with at least one case from every culture + sub-region in `cultural-content-library.json`).
- Per-case measurement: format pass (HSL pattern match), range pass (within library bounds), midpoint clustering (Euclidean distance from range midpoint < 0.1 ⇒ flagged).
- Output report `doc/spikes/2026-04-27-haiku-hsl-spike.md` with: per-test results, aggregate pass rate, format-fails count, range-fails count, midpoint-clustering rate, recommendations.

**Out:**
- Production wiring of any of this code. The script is throwaway investigation.
- The actual pre-call build — that's Phase 3, gated by this spike's outcome.

### Files touched

| File | Change |
|---|---|
| `scripts/spike-haiku-hsl.ts` | new (throwaway, may be deleted after report is written) |
| `doc/spikes/2026-04-27-haiku-hsl-spike.md` | new (the report — kept as artifact) |

### Work breakdown

1. Build a small `getCulturePaletteRanges()` reader that reads from the live `cultural-content-library.json` (lift the function from `PRECALL_IMPLEMENTATION_SPEC.md` Step 1; doesn't need to land in `src/lib/cultural/library.ts` yet).
2. Build the prompt template per `PRECALL_IMPLEMENTATION_SPEC.md` Step 3.
3. Build the validator per Step 4.
4. Author 30 test cases — each `{ cultureId, subRegion?, styleCard, vibeTags }`. Include at least one Bengali case (validates the strengthened note from Phase 0), at least 5 Hindu sub-regions, all 8 western families.
5. Run each test against Haiku 4.5 with `temperature: 1` (default), capture raw output.
6. For each: parse, validate format, validate ranges, measure midpoint clustering.
7. Aggregate and write report.

### Acceptance criteria

| # | Criterion |
|---|---|
| 1 | Script runs to completion without throwing (errors per-test are caught and logged, not fatal) |
| 2 | Report contains per-test result table (culture, style, tags, raw output, pass/fail, fail reason) |
| 3 | Report contains aggregate metrics: pass rate on attempt 1, format-fail rate, range-fail rate, midpoint-cluster rate |
| 4 | Report ends with one of three recommendations: SHIP / TUNE / PIVOT — based on the measured numbers |

### Decision gate (output of this phase)

| Pass rate | Recommendation | Action |
|---|---|---|
| ≥ 95% on attempt 1 | **SHIP** | Phase 3 proceeds as designed |
| 80–95% | **TUNE** | Phase 3 proceeds with prompt enhancements (worked examples added); 3-retry budget retained |
| < 80% | **PIVOT** | Phase 3 redesigned: broader ranges, or Sonnet for pre-call, or candidate-set approach |
| Midpoint clustering > 30% even at high pass rate | **TUNE** | Add explicit "pick at least 20% from midpoint" instruction |

### Definition of done

- Script ran 30 cases against the real Haiku API.
- Report file is committed (the script may be discarded).
- A clear SHIP / TUNE / PIVOT recommendation is documented.
- Operator has read the report and chosen the next path.

---

## Phase 3 — Pre-Call Palette + Parallel Calls 2/3

**ID:** PALETTE-03
**Type:** PR-bearing (backend + AI)
**Effort:** ~12–14 hours (was 10–12; +2 for TUNE additions per Phase 2 outcome)
**Dependencies:** Phase 1 (needs `vibe_tags` capture) AND Phase 2 (verdict received)
**Branch:** new branch `palette-precall` off latest `main`

### Phase 2 outcome — TUNE (must be honored)

The Haiku HSL spike (`doc/spikes/2026-04-27-haiku-hsl-spike.md`) returned **TUNE**:

- **Format / range / font: 100% pass** (29/29). The architecture is sound. Retry budget can be 2 instead of 3.
- **Midpoint clustering: 86%** of passing responses landed within 0.1 of their HSL range midpoint. Couples in the same culture × style × tags get virtually identical palettes — the wide library ranges go unused.

**Phase 3 must implement two TUNE additions** before it ships, otherwise the diversity-within-culture problem the spike surfaced will reach production:

#### TUNE-1 — Anti-clustering prompt block

Append this block to the pre-call prompt (`buildPalettePrompt` in `src/lib/ai/prePaletteCall.ts`), after the existing STYLE GUIDANCE block and before the OUTPUT FORMAT block:

```
DIVERSITY REQUIREMENT — IMPORTANT:
Avoid the midpoint of each range. Pick values in the upper or lower
portion of each range based on the style + tags. Two couples in the
same culture should get visibly different palettes, not the same
center-of-range values.

If your H, S, or L would land within 15% of the range center, push
toward the end that better matches the brief — saturated/dark for
"grand / dramatic / festive", quieter/lighter for "intimate / refined
/ contemporary".

Examples of GOOD divergent picks within the same range:
  Range h: [346, 360], s: [76, 96], l: [12, 22]
    Couple A (grand):     hsl(358, 94%, 14%)  — vivid red, very dark
    Couple B (intimate):  hsl(348, 80%, 20%)  — softer red, lighter
  NOT both: hsl(353, 86%, 17%) (the center — boring).
```

#### TUNE-2 — Midpoint-distance validator rule

Extend `validateExpressivePalette()` to reject responses whose average HSL midpoint distance is below a threshold. Counts as a normal validation failure → triggers the retry budget. The retry's correction block should tell Haiku exactly which colour was too central.

> **Threshold update (Phase 3.3, 2026-04-27):** the spec'd value 0.15 turned out to be unreachable for the tighter cultural ranges (e.g. Punjabi `bgPrimary` caps at ~0.118 even at corner values). Phase 3 ships with `MIDPOINT_THRESHOLD = 0.05` — see `DECISIONS [2026-16]`. The example below shows the original spec'd value; the implementation uses 0.05.

```typescript
// In validateExpressivePalette(), after the existing field/format/range/font
// checks pass:

const MIDPOINT_THRESHOLD = 0.05; // calibrated; see DECISIONS [2026-16]

const distances = {
  bgPrimary: distanceToMidpoint(parsedBgPrimary, ranges.bgPrimary),
  accent:    distanceToMidpoint(parsedAccent,    ranges.accent),
  gold:      distanceToMidpoint(parsedGold,      ranges.gold)
};
const avgDistance = (distances.bgPrimary + distances.accent + distances.gold) / 3;

if (avgDistance < MIDPOINT_THRESHOLD) {
  const tooCentral = Object.entries(distances)
    .filter(([, d]) => d < MIDPOINT_THRESHOLD)
    .map(([name]) => name);
  throw new PaletteError(
    `Palette is too close to range midpoints (avg distance ${avgDistance.toFixed(2)} < ${MIDPOINT_THRESHOLD}). ` +
    `Specifically these are too central: ${tooCentral.join(', ')}. ` +
    `Push them toward the end of their range that matches the brief.`,
    JSON.stringify(parsed)
  );
}
```

`distanceToMidpoint()` is the same helper used in the Phase 2 spike (`scripts/spike-haiku-hsl.ts`); lift it into `src/lib/ai/prePaletteCall.ts` verbatim. Hue wrapping is handled correctly there.

#### TUNE-3 — Retry budget reduced to 2

Spike showed 100% pass on attempt 1. The third retry is dead weight on the latency budget. Set `MAX_RETRIES = 2` in `runPalettePreCall`. If TUNE-2's midpoint check triggers a retry, the second attempt almost always succeeds (Haiku honours specific corrections well per the spec's correction-block design).

#### Spike artifacts kept as build references

- `scripts/spike-haiku-hsl.ts` is the working reference for the prompt template, validator, and midpoint-distance metric. Lift functions verbatim where appropriate; don't re-derive.
- `doc/spikes/2026-04-27-haiku-hsl-spike.md` is the empirical baseline. After Phase 3 ships, re-run the spike script (it's a few lines of glue change to point at the production code) and verify midpoint clustering drops below 30%.

### Goal
Implement the Haiku pre-call exactly as `PRECALL_IMPLEMENTATION_SPEC.md` describes, plus the three TUNE additions above. Restructure the pipeline to run Calls 2 and 3 in parallel against the locked 4 expressive tokens. Wire `vibe_tags` from Phase 1 into the pre-call. Save ~7 seconds of latency. Break Sonnet's wedding-default training prior. The structural fix.

### Scope

**In:**
- `src/lib/ai/prePaletteCall.ts` — `runPalettePreCall()`, `validateExpressivePalette()`, `buildPalettePrompt()`, `buildFallbackPalette()`, `hslRangeToValue()`, `hueInRange()`, `parseHsl()`, all per `PRECALL_IMPLEMENTATION_SPEC.md`.
- Extend `src/lib/cultural/library.ts`: `getCulturePaletteRanges()`, `getWesternFamily()`, `getWesternFamilyIds()`. Types: `HslRange`, `CulturePaletteRanges`, `WesternPaletteFamily`.
- `src/lib/utils/hslToHex.ts` — utility for any downstream code expecting hex (renderer may not need it; CSS accepts HSL natively).
- Update `src/lib/ai/prompt.ts`: Call 2 prompt gains "EXPRESSIVE PALETTE — USE EXACTLY" block; Call 3 prompt gains "THESE 4 VALUES ARE FIXED + FULL CREATIVE FREEDOM" block.
- Update `src/lib/validator/`: Call 2 validator checks the 4 pre-call tokens are returned unchanged; Call 3 palette-coherence check assesses against the 4 tokens, not all 12.
- Restructure `src/lib/pipeline.ts`: insert pre-call between layout selection and Calls 2/3, run Calls 2/3 with `Promise.all`, merge globalTokens (4 from pre-call + 8 from Call 2). Pass `vibe_tags` to the pre-call.
- Update `/api/generate` step 2 to persist the `expressive_palette` (added in Phase 1 as a column).
- Observability: emit `palette_precall` events with `attempt`, `status`, `culture`, `error?`.
- `selectWesternFamily()` from `vibeTagPicker.ts` (Phase 1) is invoked here when `cultureId === 'western'`.

**Out:**
- DB schema changes (the `expressive_palette JSONB` column lands in Phase 1).
- Prompt changes for cultures not in the library (none today — all 9 are covered).
- Migration of existing couples (dev env).

### Files touched

| File | Change |
|---|---|
| `src/lib/ai/prePaletteCall.ts` | new (the bulk) |
| `src/lib/cultural/library.ts` | add range readers + types |
| `src/lib/utils/hslToHex.ts` | new |
| `src/lib/ai/prompt.ts` | Call 2 + Call 3 prompt blocks |
| `src/lib/validator/*.ts` | Call 2 token-match check; Call 3 palette-coherence change |
| `src/lib/pipeline.ts` | insert pre-call, parallelise Calls 2/3, merge tokens |
| `src/app/api/generate/route.ts` | persist `expressive_palette` |
| `tests/prePaletteCall.test.ts` | new — pure-function tests + fallback flow |
| `tests/pipeline.test.ts` | extend — pre-call mocked, parallel call shape |
| `tests/cultural-library.test.ts` | new (or extend `cultural.test.ts`) — `getCulturePaletteRanges` and `getWesternFamily` |

### Work breakdown

1. **TDD scaffold.** Write failing tests for: `getCulturePaletteRanges('hindu_indian', 'punjabi')` returning the right HSL ranges; `validateExpressivePalette()` accepting valid Punjabi values and rejecting an out-of-range hue; `hueInRange()` correctly handling wrapping ranges like `[352, 8]`; `hslRangeToValue()` producing values within the range for various style cards; `selectWesternFamily()` integration with the new `getWesternFamily()` reader; `buildFallbackPalette()` returning valid output.
2. **`src/lib/cultural/library.ts` extensions.** Add `HslRange`, `CulturePaletteRanges`, `WesternPaletteFamily` types. Add the three reader functions. Make Phase-3 cultural-library tests pass.
3. **`src/lib/ai/prePaletteCall.ts`.** Build incrementally — `parseHsl`, `hueInRange`, `validateHslInRange`, `validateExpressivePalette`, `buildPalettePrompt`, `buildFallbackPalette`, `runPalettePreCall`. Make Phase-3 pre-call tests pass.
4. **Prompt updates.** Call 2 + Call 3 prompts gain their respective blocks. Existing prompt tests adjust for the new shape.
5. **Validator updates.** Call 2 token-match check. Call 3 palette-coherence narrows to 4 tokens.
6. **Pipeline restructure.** Insert pre-call between Call 1 (layout) and Calls 2/3. Wrap Calls 2/3 in `Promise.all`. Merge tokens. Persist `expressive_palette`. Update `tests/pipeline.test.ts`.
7. **Observability.** Wire `emitEvent` calls in the pre-call.
8. **Self-review against checklist.**

### Acceptance criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | A fresh generation for a Hindu Punjabi couple persists `expressive_palette` with HSL values in the Punjabi ranges | DB inspection after `/api/generate` step 2 |
| 2 | A fresh generation for a Hindu Bengali couple persists `accent` in the cream/white-tone range (saturation < 32%, lightness > 86%) | DB inspection — verifies the strengthened note works in practice |
| 3 | Total step-2 wall time decreases by ≥ 5 seconds vs the current pipeline (5 sample generations averaged) | Manual benchmark |
| 4 | Calls 2 and 3 fire concurrently (verifiable via timing logs) | Logs + observability |
| 5 | If pre-call's first attempt fails validation, the retry includes a specific correction block in the prompt | Inject an invalid response in test |
| 6 | If pre-call fails all retries (MAX_RETRIES = 2 per TUNE-3), `buildFallbackPalette()` returns deterministic library-derived values | Mock failure path |
| 7 | Call 2's returned `globalTokens` matches the pre-call's 4 tokens exactly | Integration test |
| 8 | Call 3's returned hero CSS uses only the 4 pre-call tokens (no other hex/HSL values) | Validator assertion |
| 9 | Edit flow: a "make it more romantic" instruction triggers Call 2 only, not the pre-call | Existing edit classifier coverage |
| 10 | Edit flow: a "make the hero more dramatic" instruction triggers Call 3 only against the same 4 pre-call tokens | Existing edit classifier coverage |
| 11 | Edit flow: a "start fresh, totally different style" instruction reruns the pre-call and Calls 2 + 3 | Edit classifier path |
| 12 | `validateExpressivePalette` correctly handles wrapping hue ranges (e.g. `[352, 8]`) | Unit test |
| 13 | `npm test` passes; `npx tsc --noEmit` clean | Build gate |
| 14 | `palette_precall` events emit with correct `attempt`, `status`, `culture` fields | Local logs / test mock |
| 15 | TUNE-1: pre-call prompt contains the "DIVERSITY REQUIREMENT" block before the OUTPUT FORMAT block | Snapshot test on `buildPalettePrompt` output |
| 16 | TUNE-2: `validateExpressivePalette` rejects a palette whose average midpoint distance is < `MIDPOINT_THRESHOLD` (calibrated to 0.05 per DECISIONS [2026-16]) | Unit test |
| 17 | TUNE-2: the rejection error names the specific colour(s) that were too central | Unit test on the `PaletteError.message` |
| 18 | TUNE-3: `MAX_RETRIES = 2` in `runPalettePreCall` (down from 3) | Code grep + comment |
| 19 | ~~Re-run the Phase 2 spike against the new code: midpoint-clustering rate drops below 30%~~ **NOT MET — measured 88% (baseline was 86%).** See `doc/spikes/2026-04-27-haiku-hsl-spike-v2.md` and DECISIONS [2026-18]. Phase 3 ships with the diversity goal explicitly deferred to Phase 3.5; the structural wins (parallel calls, palette persistence, edit flow, observability) are intact. | `npx tsx scripts/spike-haiku-hsl-v2.ts` produced the v2 report. |

### Test plan (TDD)

**Failing tests written first.** Cover (in order):

```typescript
// tests/cultural-library.test.ts
describe('getCulturePaletteRanges', () => {
  it('returns Punjabi sub-region ranges for hindu_indian + punjabi', () => { /* ... */ });
  it('falls back to default ranges when sub-region not found', () => { /* ... */ });
  it('returns null for western (uses families instead)', () => { /* ... */ });
});

describe('getWesternFamily', () => {
  it('returns botanical_garden HSL ranges', () => { /* ... */ });
  it('returns null for unknown family id', () => { /* ... */ });
});

// tests/prePaletteCall.test.ts
describe('hueInRange', () => {
  it('handles non-wrapping range [200, 280]', () => { /* ... */ });
  it('handles wrapping range [352, 8] — value 355 passes', () => { /* ... */ });
  it('handles wrapping range [352, 8] — value 4 passes', () => { /* ... */ });
  it('handles wrapping range [352, 8] — value 100 fails', () => { /* ... */ });
});

describe('validateExpressivePalette', () => {
  it('passes valid Punjabi red within range', () => { /* ... */ });
  it('throws on out-of-range hue', () => { /* ... */ });
  it('throws on missing fontDisplay', () => { /* ... */ });
  it('throws on font not in approved list', () => { /* ... */ });
  it('passes Bengali cream accent (saturation 12-32%, lightness 86-96%)', () => { /* ... */ });
});

describe('hslRangeToValue', () => {
  it('returns value within range for grand_celebration (high end)', () => { /* ... */ });
  it('returns value within range for elegant_minimal (low end)', () => { /* ... */ });
  it('handles wrapping hue range correctly', () => { /* ... */ });
});

describe('runPalettePreCall — fallback path', () => {
  it('returns library-derived palette when Haiku fails 2 times (mocked)', async () => { /* ... */ });
});

// TUNE additions from Phase 2:
describe('validateExpressivePalette — midpoint clustering (TUNE-2)', () => {
  it('rejects a palette whose avg midpoint distance is < 0.15', () => { /* ... */ });
  it('error message names the specific colour(s) that were too central', () => { /* ... */ });
  it('passes a palette that lives at the saturated/dramatic end of all three ranges', () => { /* ... */ });
});

describe('buildPalettePrompt — diversity requirement (TUNE-1)', () => {
  it('contains the DIVERSITY REQUIREMENT block', () => { /* ... */ });
  it('places the diversity block AFTER STYLE GUIDANCE and BEFORE OUTPUT FORMAT', () => { /* ... */ });
});

describe('distanceToMidpoint', () => {
  // Lifted from scripts/spike-haiku-hsl.ts — same function, now in production.
  it('returns 0 for a value at the exact midpoint', () => { /* ... */ });
  it('returns close to 1 for a value at the corner of the range', () => { /* ... */ });
  it('handles wrapping hue ranges like [352, 8] correctly (shortest hue distance)', () => { /* ... */ });
});
```

### Code review checklist (self-review pre-commit)

- [ ] Pre-call uses Haiku 4.5 (`claude-haiku-4-5-20251001`), not Sonnet.
- [ ] Calls 2 and 3 wrapped in `Promise.all` — no sequential `await`.
- [x] Call 2 drift on the 4 pre-call tokens is detected by the pipeline (`src/lib/pipeline.ts`). Per DECISIONS [2026-17], the pipeline **overwrites** the drifted tokens with the locked palette and emits a `console.warn` per drift event, rather than rejecting the entire Call 2 response (which would discard the 8 good non-expressive tokens too).
- [ ] Call 3 prompt explicitly says "do not invent new colors" and "no design-system tokens — Call 2 owns those."
- [ ] `expressive_palette` persists to DB on every step-2 generation.
- [ ] `getCulturePaletteRanges('western', ...)` returns `null` (western uses families).
- [ ] `selectWesternFamily()` is invoked by `runPalettePreCall` when `cultureId === 'western'`.
- [ ] No raw Anthropic API key in any committed file.
- [ ] Bengali strengthened note (Phase 0) is honored — Bengali couples get cream accents in test runs.
- [ ] Observability events emitted with `culture` field for per-culture failure-rate analysis.
- [ ] **TUNE-1**: pre-call prompt contains the "DIVERSITY REQUIREMENT" block — verified by snapshot test.
- [x] **TUNE-2**: validator rejects palettes within `MIDPOINT_THRESHOLD` of midpoint average distance — calibrated to 0.05 (see DECISIONS [2026-16]); unit test passes.
- [ ] **TUNE-2**: rejection error message names the specific too-central colours so the retry's correction block can guide Haiku.
- [ ] **TUNE-3**: `MAX_RETRIES = 2` (not 3). Code grep + comment in source explaining "spike showed 100% pass on attempt 1; second retry covers TUNE-2 corrections."
- [ ] **`distanceToMidpoint`** lifted verbatim from `scripts/spike-haiku-hsl.ts` into `src/lib/ai/prePaletteCall.ts` — same hue-wrapping semantics.
- [ ] Re-run `scripts/spike-haiku-hsl.ts` against the new prompt+validator and confirm midpoint-clustering rate drops below 30%. Save the updated report alongside the original baseline at `doc/spikes/2026-04-27-haiku-hsl-spike.md`.
- [ ] Migration not needed (column added in Phase 1).
- [ ] Edit-flow classifier coverage unchanged — no regression in `tests/ai.test.ts`.
- [ ] `npx tsc --noEmit` clean.
- [ ] All existing tests still pass.

### Definition of done

- Acceptance criteria 1–14 all met.
- Self-review checklist 100% green.
- Operator has reviewed surfaced findings.
- Operator has approved commit message and PR body.

---

## Phase 4 — Diversity Metric Script

**ID:** PALETTE-04
**Type:** Investigation script + side-by-side report (no PR-bearing change to product code)
**Effort:** ~1 hour build + ~30 minutes per run
**Dependencies:** Phase 3 to be informative, but the script can be built earlier
**Branch:** can be done on the Phase 3 branch or its own scratch branch

### Goal
Quantify "do generated invitations look more diverse after Phase 3 ships?" The script runs N generations against the live pipeline, extracts globalTokens, and computes diversity metrics. Run once **before** Phase 3 merges (baseline) and once **after** (compare).

### Scope

**In:**
- `scripts/measure-palette-diversity.ts` — runs N=50 generations with varied inputs; extracts bgPrimary/accent/gold from each; computes `distinctTuples`, hue-bucket entropy (12 buckets), average pairwise HSL Euclidean distance.
- Output report `doc/spikes/palette-diversity-baseline.md` (pre-Phase-3) and `doc/spikes/palette-diversity-after-precall.md` (post-Phase-3) with the metrics + side-by-side comparison.

**Out:**
- Productionising the metric. This is an investigation tool, not a dashboard.

### Files touched

| File | Change |
|---|---|
| `scripts/measure-palette-diversity.ts` | new (kept as ongoing-use tool) |
| `doc/spikes/palette-diversity-baseline.md` | new |
| `doc/spikes/palette-diversity-after-precall.md` | new |

### Work breakdown

1. Generate 50 varied input cases — distribute across cultures, sub-regions, style cards, vibe tag combinations.
2. Build `runOne(input)` that calls the existing `/api/generate` step 2 endpoint (or invokes `pipeline.ts::generateSite()` directly with mocks for AI to use real outputs).
3. Extract `bgPrimary`, `accent`, `gold` from each result; parse HSL.
4. Compute three metrics:
   - `distinctTuples`: count of unique `(bgPrimary, accent, gold)` triples.
   - `hueEntropy`: Shannon entropy across 12 hue buckets (each 30°) for `bgPrimary`.
   - `avgPairwiseDistance`: average HSL-space Euclidean distance over all pairs.
5. Write the report.
6. Run it on the current pipeline → baseline report.
7. After Phase 3 ships → run again → comparison report.

### Acceptance criteria

| # | Criterion |
|---|---|
| 1 | Script runs 50 generations and writes the report without crashing |
| 2 | Report shows per-metric numbers + a 3-line summary statement |
| 3 | Comparison report shows baseline vs after-Phase-3 numbers in a table |
| 4 | Report includes per-culture breakdown (which cultures gained/lost diversity) |

### Decision gate (output of this phase)

Quantitative success measure for the entire initiative. Suggested target after Phase 3 ships:

| Metric | Baseline | Target | Acceptable |
|---|---|---|---|
| `distinctTuples / 50` | TBD (likely 4–8) | ≥ 30 | ≥ 20 |
| `hueEntropy` (max 3.58) | TBD | ≥ 2.0 | ≥ 1.5 |
| `avgPairwiseDistance` | TBD | ≥ 50% increase | ≥ 25% increase |

If after-Phase-3 numbers don't move significantly (avg pairwise distance < 25% improvement), the architecture didn't deliver — we keep digging.

### Definition of done

- Both reports exist (baseline + after).
- Operator has reviewed the comparison.
- Operator has decided whether the initiative is "done" or needs further iteration.

---

## Cross-phase notes

### What ships per phase

| Phase | Ships? | Behind a flag? |
|---|---|---|
| 0 — Spec polish | ✅ Already in tree | n/a |
| 1 — Vibe picker UI | ✅ PR + merge | No — drop-in replacement, isolated |
| 2 — Haiku spike | ❌ Investigation only | n/a |
| 3 — Pre-call | ✅ PR + merge | Optional: env-flag `PALETTE_PRECALL=1` to gate gradual rollout |
| 4 — Diversity metric | ❌ Investigation tool | n/a |

### Risk register

| Risk | Resolution status | Where |
|---|---|---|
| Haiku unreliable on HSL output | ✅ Resolved by Phase 2 spike + SHIP/TUNE/PIVOT decision tree | Phase 2 → 3 |
| Bengali cream accent gets "corrected" by Haiku | ✅ Prevented by Phase 0 strengthened note; validated by Phase 3 AC #2 | Phase 0 → 3 |
| Token mismatch between pre-call and Call 2 | ✅ Validator checks the 4 tokens are returned unchanged | Phase 3 |
| Edit flow regresses (design edits regenerate hero) | ✅ `tests/ai.test.ts` classifier coverage unchanged; Phase 3 AC #9–11 explicit | Phase 3 |
| Tag picker confuses users (mode difference unclear) | ⚠️ Detected only after live use. Resolution path deferred — see `doc/future-work.md` item #12 | Phase 1 — observe in production |
| Pre-call adds latency without diversity gain | ⚠️ Detected by Phase 4 diversity metric. Fallback ladder deferred — see `doc/future-work.md` item #13 | Phase 3 → 4 — react if numbers don't move |

The two ⚠️ rows are deliberate residual risk: the phases detect them via instrumentation / metrics, and `future-work.md` carries the resolution paths for revisit later. We don't block any phase on these.
