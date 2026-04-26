# Bugs: Interfaith data loss + missing event venue fallback

**Date:** 2026-04-26
**Branch:** `improve-cosmatic-issue`
**Streams touched:** A (frontend), B (engine), C (API). All three.

---

## Reported by user (verbatim)

After tracing what happens on "Open dashboard" (step 2 → `/api/generate`), I flagged two structural gaps. The user replied:

> Yes, fix both of them, First write unit test and then implement it, then ask for commit.

---

## Bug 1 — Interfaith couples lost everything except `selections[0]`

### Symptom

`src/components/onboarding/CulturalConfigurator.tsx` is built for multi-select. It exposes `selections: CultureSelection[]`, calls `findConflicts(selections)` to detect interfaith conflicts, and lets a couple add a second/third culture. The product's landing page commits to it: *"Interfaith conflicts surfaced, never silently resolved."*

But `src/app/onboarding/step-2/page.tsx::onFinish` was sending only `selections[0]`:

```ts
const first = selections[0];
const answers = {
  cultureId: first?.cultureId,
  subRegion: first?.subRegion,
  confirmedContentItemIds: first?.confirmedContentItemIds ?? [],
  confirmedCeremonyIds: first?.confirmedCeremonyIds ?? [],
  ...
};
```

A couple who picked **Hindu Punjabi + Jewish** generated a site reflecting only Hindu Punjabi — Jewish ceremonies, content items, design guidance, and `copyGuardrails` (e.g. *"Chuppah time must be prominent"*) were silently dropped. The configurator's `findConflicts()` UI surfaced conflicts at config time, but the submit pipeline didn't carry the couple's interfaith intent forward; the second culture was *silently resolved by deletion*. That is exactly what §26 promises will never happen.

### Fix

**Cross-stream:**

1. **`src/lib/types.ts`** — promoted `CultureSelection` from a UI-only type (in `CulturalConfigurator.tsx`) to a canonical API contract type. Replaced four fields on `QuizStep2Answers` (`cultureId`, `subRegion`, `confirmedContentItemIds`, `confirmedCeremonyIds`) with one: `cultures: CultureSelection[]`.

2. **`src/lib/cultural/library.ts`** — new `buildMergedCulturalProfile(selections, contentValues, bilingual?)`. Merge strategy (recorded in DECISIONS [2026-13]):
   - Empty list → `null`.
   - Single selection → calls `buildCulturalProfile` once, returns it (regression-safe — no behavioural change for non-interfaith couples).
   - Multiple selections:
     - **Primary** (`selections[0]`) wins for scalar/design fields: `id`, `displayName`, `designGuidance`, `copyTone`, bilingual flags. The site has one visual identity (CLAUDE.md §5).
     - **`copyGuardrails`** are HARD constraints — concatenated (deduped) so both cultures' rules apply. Muslim's *no alcohol* still binds even if the primary is Hindu Punjabi.
     - **`contentItems`** and **`ceremonies`** merged across all selections, deduplicated by id (first occurrence wins).

3. **`src/app/api/generate/route.ts`** — step 2 path now calls `buildMergedCulturalProfile(a.cultures, a.contentValues)` instead of the single-culture `buildCulturalProfile`. `cultural_context` column on the `couples` row is set from `a.cultures[0]?.cultureId` (the primary).

4. **`src/lib/pipeline.ts`** — same swap on the pipeline orchestrator.

5. **`src/app/onboarding/step-2/page.tsx::onFinish`** — sends `cultures: selections` instead of unpacking only `selections[0]`.

6. **`src/components/onboarding/CulturalConfigurator.tsx`** — imports `CultureSelection` from `@/lib/types` and re-exports it for any callers that previously imported it from this file.

### Why primary wins on scalar fields

The cultural library encodes design guidance (`bgPrimary` hint, font palette, motif vocabulary) as a coherent voice per culture. Mixing two cultures' design guidance verbatim would either confuse the AI in Call 2 or produce a visually fragmented site. Letting the primary culture lead the design while the secondary contributes ceremonies + content + (hard) copy guardrails is the smallest workable merge.

`copyGuardrails` is the exception because it is a HARD rule block injected verbatim into Call 2 and Call 3 prompts. Keeping only the primary's rules would let the AI write copy that violates the secondary culture's hard constraints (e.g. mentioning alcohol on a site that should not). Concatenation is the safe default.

---

## Bug 2 — Event cards showed "Venue to be announced" even when a venue was on the couple row

### Symptom

`src/lib/renderer/buildEventCards.ts:72` resolved venue with this chain:

```ts
venue: match?.venue || ceremony.venue || "Venue to be announced"
```

Cultural ceremonies in the library don't carry venues. Until we hand-edit per-event venues into the events table, every ceremony card showed "Venue to be announced" — even though the couple gave us their venue in step 1 (`couples.venue_name`). The dashboard has no events editor, so couples saw "to be announced" with no obvious path to fix it.

### Fix

`BuildEventCardsInput` now optionally carries `couple: Pick<CoupleData, "venue_name">`. Fallback chain becomes:

```ts
venue: match?.venue || ceremony.venue || coupleVenue || "Venue to be announced"
```

Same change applied to the EventData fallback path (`e.venue || coupleVenue || "Venue to be announced"`).

`src/lib/renderer/index.ts` forwards `input.couple` into the call.

Couple-row venue is the *last-resort* fallback — explicit per-event venues (set on EventData by future onboarding/dashboard editing) and ceremony-level venues (set by future cultural library evolution) both still take precedence.

---

## Tests (TDD — written first, watched fail, then made green)

**`tests/cultural.test.ts`** — new `describe("buildMergedCulturalProfile")`:
- Empty list → null
- Single selection → equivalent to `buildCulturalProfile`
- Primary wins for scalar/design fields
- `copyGuardrails` contains rules from both cultures
- `contentItems` merged + deduped by id
- `ceremonies` merged + deduped by id
- Same culture twice is idempotent (defensive)

**`tests/renderer.test.ts`** — new event-card cases:
- Cultural-profile path falls back to `couple.venue_name` when `ceremony.venue` is empty
- Matched-EventData venue still beats `couple.venue_name` (precedence preserved)
- Placeholder appears only when *no* venue exists anywhere in the chain

`npm test` — 159/159 passing.
`npx tsc --noEmit` — clean.

---

## Files changed

| File | Reason |
|---|---|
| `src/lib/types.ts` | Add `CultureSelection`; replace four fields on `QuizStep2Answers` with `cultures` |
| `src/lib/cultural/library.ts` | Add `buildMergedCulturalProfile` |
| `src/lib/pipeline.ts` | Use merged builder |
| `src/lib/renderer/buildEventCards.ts` | Couple-venue fallback |
| `src/lib/renderer/index.ts` | Forward `couple` into `buildEventCards` |
| `src/app/api/generate/route.ts` | Use merged builder + new payload shape |
| `src/app/onboarding/step-2/page.tsx` | Send `cultures: selections` |
| `src/components/onboarding/CulturalConfigurator.tsx` | Re-export `CultureSelection` from types |
| `tests/cultural.test.ts` | 7 new tests |
| `tests/renderer.test.ts` | 3 new tests |
| `tests/pipeline.test.ts` | Update fixture to new payload shape |

---

## Follow-ups

- Step 2 currently always passes `contentValues: {}`. Once the configurator collects per-field values (parents, muhurat, ketubah etc.) those should flow through here unchanged.
- An events editor in the dashboard would let couples override per-ceremony venue when they don't want the headline venue to be the default everywhere. Filed as a known M1 gap.
- The merge keeps primary culture's `subRegion` only. If we want sub-region awareness for the secondary culture (rare but possible), the `CulturalProfile` schema would need a `secondaryProfile` field — non-trivial. Recorded but not pursued.
