# Wizard journey — four-step authoring flow

**Date:** 2026-04-26
**Branch:** `wizard-journey`
**Streams touched:** A (frontend), B (types), C (API + migration). All three.

This is a deliberate redesign rather than a bug fix, but it is in `doc/bugs/` because it closes the same family of user-reported symptoms that earlier patches kept circling around without solving structurally. See plan §34 for the canonical spec; this doc captures the user-facing motivation and a build-time verification trail.

---

## What the user reported (over multiple sessions)

> 1. There are multiple issue by the way, when user are in dashboard page and hit the sign out. Then next sign in they have to fill all form again. there is no way to get previously created invitation and continue modification.
> 2. After signin there should be old invitation where user can re work on it, or must have button to start new, if new user then start step1 it returning user and had previously created invitation then show them with new button.
> 3. Secondly if user hit back button of browser on dashboard, as I said all selections are gone, It should be fetched either from DB or cache. This is useful feature, because user may want to change thir selection. After changing the selection it should update the invitation think like it is in edit mode. It should not create brand new invitation.
> Currently we have continue editing button at welcome page but there is no way we can update layout selection or culture selection modification. It is correct that continue editing goes to dashboard, but no way to update layout and cultural selection. There is a detail tab but also do not contain cultural.
> Here os big change proposal. What if we have steps progress bar. Like Step1-Wedding Info (Couple info with date nad venue), Step 2-Layout,cultural, Story, step3 design (current dahsboard). On step 3 we have AI chat edit, Design History, Photos, RSVP and guest management will be on next step, which we will develop later. How about this?
> For returning user, there should be welcome page when they clcik continue editing then it goes to step 3. I like the idea of stat over in step 1 as well.

The pattern across reports: **the original two-stage model (onboarding → dashboard) treated each surface as an island**, and there was no shared frame for "I'm authoring an invitation that lives across multiple pages." Each fix that targeted one symptom (e.g. landing returning users on an overview card) left other symptoms (e.g. no way to redo culture from the dashboard) untouched.

## What the wizard journey replaces

The fix unifies the authoring surfaces under one mental model — **a four-step journey** — with shared chrome (`<JourneyProgress>`) at the top of every step. Plan §34 covers the full spec; the highlights:

- **Step 1 — Basics** (`/onboarding`) — names, date, venue. Always entry-point for new users. Submit upserts (UPDATE if user already has a couple, INSERT otherwise) so back-and-forth navigation never duplicates rows. Has a quiet "Start over" link for users mid-edit.
- **Step 2 — Brief** (`/onboarding/step-2`) — style card, vibe words, cultural profile (one or more), story. Server-prefetches the couple by `?couple=…` and passes it to the form, so back-button from later steps restores every selection — including interfaith secondary cultures via the new `cultures jsonb` column.
- **Step 3 — Studio** (`/dashboard`) — long-lived editing surface. Tabs cleaned up: **Refine** (was "Edit"), **Design history** (was "Your designs"), RSVPs, Photos. The old "Details" tab is removed; everything it covered now lives in Steps 1–2 as first-class fields.
- **Step 4 — Guests** — placeholder pill in the progress bar with a "Coming soon" footnote. Will host RSVP outreach + guest list when built (M2). RSVPs stay on Step 3 until then.

Each step has matching way-finding at the **bottom** of the page (`<JourneyFooter>`, plan §34.4a): a Previous link to the prior step on the left, and a Next button on the right that either submits the form (Steps 1 and 2) or signposts the next step (Step 3 → "Guests · Coming soon"). This mirrors the JourneyProgress bar at the top so the user can scroll a long form and still have step navigation in view. Layout order on every page is now:

```
[Vee logo                                    Sign out + page actions]
─────────────────────────────────────────────────────────────────
[01 Basics    02 Brief    03 Studio    04 Guests Coming soon]   ← top
─────────────────────────────────────────────────────────────────
[Page content]
─────────────────────────────────────────────────────────────────
[← Previous step                            Next step →]   ← bottom
```

**Login routing:** new users → `/onboarding` (Step 1 form). Returning users → `/welcome` (the editorial ticket-stub overview with **Continue editing** → `/dashboard` and **Start over** → DELETE → fresh Step 1).

## Forward-and-backward navigation invariants

These five rules (§34.5) are the contract that makes the journey feel like one document:

1. Every step server-fetches the couple row on mount (no URL-param state).
2. Every step's submit is an upsert, never a blind INSERT.
3. Going back to any earlier step prefills every field (including the `cultures` array).
4. The pipeline runs only on Step 2 submit (~20 s); Step 1 is fast.
5. Start over is a single DELETE flow, available from `/welcome` (primary) and Step 1 (secondary).

## Files changed

**Migration:**
- `supabase/migrations/002_add_cultures_column.sql` — adds `couples.cultures jsonb default '[]'::jsonb`. Required for round-trippable interfaith editing. **Must be applied in production before deploy.**

**Types + DB:**
- `src/lib/types.ts` — `CoupleData.cultures: CultureSelection[]`
- `src/lib/db/mappers.ts` — hydrate `cultures`, default to `[]`
- `src/lib/db/auth.ts` — new `getMostRecentCoupleForUser(userId)` helper

**API:**
- `src/app/api/couple/route.ts` — new `DELETE` handler with ownership check + storage cleanup
- `src/app/api/generate/route.ts` — Step 1 upsert (UPDATE when `couple_id` provided), Step 2 persists `cultures`
- `src/app/auth/actions/index.ts` — login dispatches to `/welcome` or `/onboarding` based on couple existence

**Middleware:**
- `src/middleware.ts` — `/welcome` and `/onboarding/*` added to protected-page list

**Frontend (Stream A):**
- `src/components/journey/JourneyProgress.tsx` (new, frontend-design skill) — typeset table-of-contents bar with reachability flags + lock states
- `src/components/journey/JourneyFooter.tsx` (new) — bottom-of-page Previous / Next pair (plan §34.4a). Submit-type Next on Steps 1 and 2; link-type Next on Step 3 (disabled "Coming soon" until Guests ships).
- `src/components/onboarding/InvitationOverview.tsx` (new) — editorial ticket-stub for `/welcome`
- `src/components/onboarding/OnboardingStep1Form.tsx` (new) — extracted from old `/onboarding/page.tsx`, prefills + upserts + Start over link + JourneyFooter (Next only)
- `src/components/onboarding/OnboardingStep2Form.tsx` (new) — extracted from old step-2, prefills from DB including `cultures`, JourneyFooter (Previous → Basics + Next → Open studio)
- `src/app/welcome/page.tsx` (new) — server component, renders InvitationOverview
- `src/app/onboarding/page.tsx` — server dispatcher (replaces old client form)
- `src/app/onboarding/step-2/page.tsx` — server prefetch (replaces old client component)
- `src/app/dashboard/page.tsx` — JourneyProgress at top (below masthead), tabs renamed/cleaned, `Details` tab removed, JourneyFooter at bottom (Previous → Brief + Next → Guests Coming soon)

**Tests:**
- `tests/mappers.test.ts` (new) — 3 cases for `cultures` round-trip
- `tests/journeyProgress.test.ts` (new) — 8 cases for the wizard helpers (`computeReachable` reachability gating + `hrefFor` route resolver). The helpers were extracted into `src/components/journey/helpers.ts` so vitest can import them without tripping on the JSX in `JourneyProgress.tsx` (vitest's import-analysis can't parse `.tsx` content under the current config). `JourneyProgress.tsx` re-exports `computeReachable` for unchanged callers.
- 5 fixture updates (`tests/{renderer,pipeline,priya-arjun-example,render-all-layouts,renderer-real-layout}.test.ts`) for new required `cultures` field

**Docs:**
- `doc/VEEINVITE_PRODUCT_PLAN.md` — new §34 (Wizard Journey — Four-Step Authoring Flow), 11 subsections
- This bug doc
- DECISIONS [2026-15] — captures the wizard-vs-overview-only trade-off and rejected alternatives
- Stream A worklog entry + Stream C worklog entry

## Verification

- `npx tsc --noEmit` — clean
- `npm test` — 162/162 passing (3 new mapper tests + 159 existing)
- Manual flow path:
  - Sign up new user → `/onboarding` (Step 1, no progress bar lockouts beyond Steps 3–4) → submit → `/onboarding/step-2` (Brief) → Open studio → `/dashboard` (Studio with all four tabs).
  - Sign out → sign in → `/welcome` shows ticket-stub card with last-saved time → Continue editing → `/dashboard`.
  - Browser back from dashboard → `/onboarding/step-2` (Brief) fully prefilled, including any interfaith secondary cultures.
  - Click Step 1 in progress bar from Studio → `/onboarding` prefilled with names/date/venue → save and continue → back to step 2 prefilled → Open studio → back at dashboard, no duplicate couple row.
  - On `/welcome` or Step 1, Start over → confirm dialog → couple deleted → Step 1 form, fresh.

## Follow-ups

- Migration `002_add_cultures_column.sql` must be applied in production. The mapper defaults to `[]` for missing columns so the code is forward-safe, but interfaith state won't persist until the migration runs.
- The dashboard's missing-`?couple=` redirect is still client-side `useEffect`. Server-side redirect would skip a brief loading flash. Recorded as polish.
- Step 4 (Guests) build-out is out of scope. RSVPs stay on Step 3 until then; when Step 4 ships the tab will migrate.
- Cross-step preview synchronisation (Step 2 right-pane currently shows `<LayoutMini>` schematic, not the live site) is M2 polish.
