# Bug: Onboarding step 1 "See my site" button takes ~2 minutes

**Date:** 2026-04-26
**Branch:** `improve-cosmatic-issue`
**Streams touched:** Stream C (API route — primary), Stream A (button labels — incidental).

---

## Reported by user (verbatim)

> 3. After clicking "See my site" button at onboarding page, it takes 2 minutes to lead next page. It should not take that too long. I would like to know first what happens when user click that button.
>
> It should not make any call 2 and call 3 on step1, infact it should call after step 2 when user picks layout and cultural selection and also story info.

---

## What was happening before

Clicking **See my site** on `/onboarding` posted to `POST /api/generate` with `step: 1`. The route handler (`src/app/api/generate/route.ts`) inserted the `couples` row, then **fell through to the shared pipeline path** at the bottom of the route — which ran `generateSite()` (the full 3-call pipeline: layout selector → Call 2 design tokens → Call 3 hero), uploaded the rendered HTML to the private Supabase bucket, inserted a `site_versions` row, and updated the couple row with theme/hero/tokens. Only then did it return to the client, which redirected to `/onboarding/step-2`.

Two problems with that:

1. **The work was throwaway.** Step 1 has no `styleCard`, no `cultureId`, no story. The pipeline used defaults, generating a site that step 2 immediately regenerated as soon as the user picked a style and culture. The user paid the latency tax twice.
2. **Step 1 advertised itself as fast.** The button label `"Generating your site…"` and the spec's 2-minute promise (§28 of the product plan) implied a quick wow moment. With Sonnet 4.5 tail latency on top of two sequential calls, real-world traffic hit ~2 minutes — far past the budget of ~20s, and even the budget itself was being spent on output that step 2 would discard.

## Root cause

The route did not branch on `step` for the AI-generation path. Step 1's only meaningful work is "create a couple row so step 2 has something to update". The pipeline call belonged in step 2 alone.

## Fix

### `src/app/api/generate/route.ts`

After inserting the `couples` row in the step 1 branch, return immediately with `{ couple_id, slug }`. Do not fall through to the shared pipeline / upload / version-row / couple-update sequence. Step 2 still runs the full pipeline as before.

### `src/app/onboarding/page.tsx`

Button progress label changed from `"Generating your site…"` (no longer accurate — nothing is being generated) to `"Continuing…"`.

### `src/app/onboarding/step-2/page.tsx`

Step 2 is now where the user pays the AI latency. Two consequences:

- Added a separate `submitting` state distinct from `applying` (which today briefly toggles for 300ms after each preview pick — a fake indicator). Without separation, the *Open dashboard* button would flicker `"Generating your site…"` every time the user picks a style, which would be misleading.
- Both *Open dashboard* buttons (header + section) now show `"Generating your site…"` when `submitting` is true, and disable while in flight. The preview pane's `"• applying…"` indicator continues to use `applying` and is unaffected.

## Latency impact

| Action | Before | After |
|---|---|---|
| Click "See my site" on step 1 | ~2 min (real) / ~20s (budget) | ~500 ms (DB insert + redirect) |
| Click "Open dashboard" on step 2 | ~20s (Sonnet × 2 sequential) | ~20s (unchanged — pipeline still runs here, as it always did) |
| Total time from "names entered" to "dashboard" | ≥ ~40s (two pipeline runs) | ~20s (one pipeline run) |

Users now reach step 2 instantly. They still wait for the AI on the step 2 commit, but only once, with their actual style/culture/story preferences in hand.

## What was *not* changed

- Step 2's existing pipeline call is untouched. The fix is strictly about not running it on step 1.
- Pipeline / validator / hero JSON envelope — all unchanged.
- The §28 "2-minute promise" framing in the product plan stays accurate end-to-end (~30s of question-answering + ~20s of generation = under 2 min total user experience).

## Verification

- `npx tsc --noEmit` clean.
- Manual flow: sign in → `/onboarding` → fill step 1 → click "See my site" → reaches `/onboarding/step-2` near-instantly. No site is generated yet (step 2 preview shows the schematic `<LayoutMini>` as before — unchanged). Click "Open dashboard" on step 2 → button shows "Generating your site…" → reaches `/dashboard` after the pipeline completes.

## Follow-ups

- The pre-call expressive palette + parallel Call 2/Call 3 design (locked in `doc/precall_palette_architecture.md`, planned for M2) would bring the step 2 latency from ~20s down to ~13s. Worth implementing once the M1 surface is stable.
- Anthropic SDK timeout / retry tuning could clip tail-latency cases. See follow-up [2026-12] in DECISIONS for context.
- If the §28 wow moment is desired earlier, a future iteration could fire step 2's pipeline asynchronously (job queue / polling) the moment step 1 commits, so the site is half-rendered by the time the user finishes step 2. Out of scope for this fix.
