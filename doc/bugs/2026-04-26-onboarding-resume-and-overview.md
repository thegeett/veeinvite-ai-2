# Bug: Returning users were sent through onboarding from scratch + back-button lost selections

**Date:** 2026-04-26
**Branch:** `improve-cosmatic-issue`
**Streams touched:** A (frontend), B (types), C (API + migration). All three.

---

## Reported by user (verbatim)

> 1. There are multiple issue by the way, when user are in dashboard page and hit the sign out. Then next sign in they have to fill all form again. there is no way to get previously created invitation and continue modification.
> 2. After signin there should be old invitation where user can re work on it, or must have button to start new, if new user then start step1 it returning user and had previously created invitation then show them with new button.
> 3. Secondly if user hit back button of browser on dashboard, as I said all selections are gone, It should be fetched either from DB or cache. This is useful feature, because user may want to change thir selection. After changing the selection it should update the invitation think like it is in edit mode. It should not create brand new invitation.

---

## Root cause (one bug producing three symptoms)

`login()` in `src/app/auth/actions/index.ts` redirected to `/dashboard` with no params. `/dashboard` requires `?couple=…` and (line 49–52) `useEffect`s `router.push("/onboarding")` when missing. So every returning user got bounced to onboarding step 1, where:

- The form values are React `useState` only — nothing read from the DB.
- Submitting unconditionally `INSERT`s a new couple row (no upsert / no dedup check).

That single broken route created all three of the user-visible symptoms: re-onboarding after sign-in, lost selections on back-button, and silently-multiplying duplicate invitation rows.

---

## Fix — four parts

### Part 1 — Login routes to existing invitation

`login()` now redirects to `/onboarding`, which is no longer "the new-user form" — it's a server dispatcher (see Part 2). The dashboard's existing client-side `router.push("/onboarding")` for missing `?couple=` params now lands users on the same dispatcher, which routes them correctly.

### Part 2 — `/onboarding` becomes a server dispatcher

`src/app/onboarding/page.tsx` is now an `async` server component:

- If the authenticated user has a couple → render `<InvitationOverview couple={…} />`.
- If not → render `<OnboardingStep1Form />` (the existing form, extracted to `src/components/onboarding/OnboardingStep1Form.tsx`).

`InvitationOverview` is a new editorial "ticket-stub" component (built via the `frontend-design` skill — see DECISIONS [2026-14] for the design call) that shows the couple's names, date, venue, style/culture summary, and last-saved timestamp, plus two actions:

- **Continue editing →** — link to `/dashboard?couple=…&slug=…`.
- **Start over** — opens a confirm dialog ("Discard your current invitation?"). Confirming `fetch DELETE /api/couple?id=…`, then `router.push("/onboarding")` + `router.refresh()`. The dispatcher re-evaluates and now shows the step 1 form.

The dialog uses the same canvas/ink/blush palette as the rest of the system, with an outlined-blush destructive button. Backdrop blur, no click-outside-to-cancel (destructive actions require explicit cancel).

### Part 3 — Step 2 prefill from DB

`/onboarding/step-2/page.tsx` was a client component that read everything from URL params — back-button hits showed an empty form even though all values lived in `couples`. Refactor:

- `src/app/onboarding/step-2/page.tsx` is now an `async` server component. Fetches couple by `?couple=…`, verifies ownership, hands the row to `<OnboardingStep2Form couple={…} />`.
- `src/components/onboarding/OnboardingStep2Form.tsx` (new file, the existing client logic moved here) initialises React state from `couple`: `style`, `vibe`, `story`, `cultures`. Submitting still `UPDATE`s the existing row — no duplicate inserts.

A user editing from the dashboard, then hitting browser back on step 2, lands on a fully-prefilled form. Editing and resubmitting updates the invitation in place.

### Part 4 — `cultures jsonb` column for full configurator round-trip

The previous PR's `buildMergedCulturalProfile` made the **forward** path correct (configurator → API → engine), but we only persisted the merged `cultural_profile`. For interfaith couples, the original `CultureSelection[]` array (with secondary cultures) couldn't be reconstructed from the merged profile.

- New migration `supabase/migrations/002_add_cultures_column.sql` adds `cultures jsonb default '[]'::jsonb` to the `couples` table.
- `CoupleData` gains `cultures: CultureSelection[]`.
- `rowToCouple` mapper hydrates the new column (defaults to `[]` when missing).
- `/api/generate` step 2 stores `a.cultures` alongside `cultural_profile` on UPDATE.
- `OnboardingStep2Form` initialises `selections` from `couple.cultures`.

An interfaith couple can now leave the dashboard, return to step 2, and find both their primary and secondary cultures intact. See DECISIONS [2026-14].

---

## DELETE endpoint for "Start over"

`/api/couple` route gains a `DELETE ?id=…` handler:

1. Verify the authenticated user owns the couple.
2. Best-effort storage cleanup: remove `invitation-sites/{slug}.html` and all photos under `couple-photos/{id}/`. Failures don't block the row delete (orphaned files can be GC'd later — the data is the source of truth).
3. `DELETE FROM couples WHERE id = …`. FK cascades handle `events`, `site_versions`, `rsvp_*`, `preview_tokens`.

---

## Files changed

**Engine + types (Stream B):**
- `src/lib/types.ts` — `CoupleData.cultures` field

**Database (Stream C):**
- `supabase/migrations/002_add_cultures_column.sql` — new
- `src/lib/db/mappers.ts` — hydrate `cultures`
- `src/lib/db/auth.ts` — new `getMostRecentCoupleForUser()` helper

**API (Stream C):**
- `src/app/api/couple/route.ts` — new `DELETE` handler
- `src/app/api/generate/route.ts` — store `cultures` on step 2 UPDATE
- `src/app/auth/actions/index.ts` — login redirects to `/onboarding`

**Frontend (Stream A):**
- `src/app/onboarding/page.tsx` — server dispatcher
- `src/app/onboarding/step-2/page.tsx` — server prefetch
- `src/components/onboarding/OnboardingStep1Form.tsx` — new (extracted client form)
- `src/components/onboarding/OnboardingStep2Form.tsx` — new (extracted client form, prefills from DB)
- `src/components/onboarding/InvitationOverview.tsx` — new (editorial overview card + confirm dialog)

**Tests:**
- `tests/mappers.test.ts` — new (3 cases for `cultures` round-trip)
- `tests/renderer.test.ts`, `tests/pipeline.test.ts`, `tests/render-all-layouts.test.ts`, `tests/renderer-real-layout.test.ts`, `tests/priya-arjun-example.test.ts` — fixture updates for new `cultures` field

**Docs:**
- This file
- `doc/DECISIONS.md` — `[2026-14]`
- `doc/worklog/STREAM-A-log.md` — overview UI polish entry
- `doc/worklog/STREAM-C-log.md` — migration + API polish entry

---

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` — 162/162 passing (3 new mapper tests + the existing 159).
- Manual flow:
  - Sign up → step 1 → step 2 → dashboard → sign out → sign in → land on overview → click Continue editing → back in dashboard.
  - Sign in returning user → overview shows last-saved timestamp + style/culture summary → click Start over → confirm dialog → invitation deleted → step 1 form.
  - From dashboard, browser-back → step 2 form fully prefilled (style, vibe, story, all cultural selections including secondary).
  - Submitting step 2 again `UPDATE`s the same row — no new couple created.

---

## Follow-ups

- Migration `002_add_cultures_column.sql` needs to be applied in production. Operator runs it via `supabase db push` (or whatever the team's deploy convention is).
- Cultural-configurator UI displays selections by cultureId — for the overview card we title-case the id (`hindu_indian` → `Hindu Indian`). Could be prettier with a lookup against the cultural library, but bundling the library JSON into the overview just for display strings isn't worth it today.
- The dashboard's client-side `router.push("/onboarding")` for missing params still flickers a "Loading…" state before redirecting. Server-side redirect would be smoother — recorded as a polish item.
