# Bug: Auth-aware landing header + stale sign-in CTA on onboarding

**Date:** 2026-04-26
**Branch:** `improve-cosmatic-issue`
**Streams touched:** Stream A (frontend) — files inside `src/app/page.tsx` and `src/app/onboarding/page.tsx`.

---

## Reported by user (verbatim)

> 1. Once we sign in and click on veeinvite default landing page, signing context get lost. We have sign in again. Also there is no button to sign out.
> 2. On onboarding page, which come after signin, we still see the message, "Prefer to sign in first? Your site will attach automatically. Sign in". It should not be there as user has already signed in.

---

## Bug 1 — Landing page is not auth-aware; no sign-out anywhere

### Symptom

After a successful sign-in, navigating back to `/` (the marketing landing page) renders the page as if the visitor is signed-out — the header still shows **Sign in** and **Start yours**, both of which point at `/auth/login` and `/auth/signup`. There is no sign-out control on the landing page or anywhere else in the app.

### Root cause

`src/app/page.tsx` was a synchronous server component that never read the Supabase session. It rendered the same auth CTAs unconditionally for every visitor.

The `logout()` server action already existed at `src/app/auth/actions/index.ts:31` but was unwired — no UI surface invoked it.

### Fix

Converted `src/app/page.tsx` to an `async` server component that reads the user once via `createClient().auth.getUser()` and gates four UI surfaces on `isAuthed`:

| Surface | Logged out | Logged in |
|---|---|---|
| Masthead (right side) | "Sign in" link + "Start yours" pill | "Sign out" form button + "Dashboard" pill |
| Hero CTA | "Start yours — it's free" → `/auth/signup` | "Continue to your dashboard" → `/dashboard` |
| Final CTA (dark section) | Signup pill + "I already have an account" link | "Continue to your dashboard" pill (secondary link hidden) |
| Footer links | "Sign up", "Sign in", Layouts, Cultures | "Dashboard", "Sign out", Layouts, Cultures |

Sign-out uses `<form action={logout}>` against the existing server action — no new client component, works without JavaScript.

Aesthetic preserved: same `rounded-full bg-ink px-5 py-2.5 …` primary button, same `veein-meta hover:text-ink transition-colors` for ghost links. No new tokens introduced.

### Files changed

- `src/app/page.tsx`
  - Added imports: `createClient` from `@/lib/supabase/server`, `logout` from `@/app/auth/actions`
  - Made the default export `async`; read `user` and computed `isAuthed`
  - Conditional rendering in masthead, hero CTA, final CTA, and footer

---

## Bug 2 — Onboarding shows a stale "sign in first" CTA

### Symptom

The onboarding page (`/onboarding`) — which the user lands on **after** signing in or signing up — displayed:

> Prefer to sign in first? Your site will attach automatically. **Sign in**

This is contradictory and confusing because the user has already signed in.

### Root cause

`src/app/onboarding/page.tsx:163-169` rendered the CTA unconditionally. The page is a client component that never reads auth state. However it didn't need to: `/onboarding` is in the protected-page allowlist at `src/middleware.ts:36`, so an unauthenticated visitor is redirected to `/auth/login` before they can see this page. The CTA was therefore **dead code** — it could never legitimately render to a real user.

### Fix

Removed the `<p>` block entirely and simplified the surrounding flex container from `flex items-center justify-between gap-4` (which had positioned the message left and the submit button right) to `flex justify-end` so the submit button stays right-aligned.

### Files changed

- `src/app/onboarding/page.tsx` — removed dead CTA, adjusted container utility classes.

---

## Verification

- `npx tsc --noEmit` — clean.
- Manual review of both files confirms the existing aesthetic system (`bg-ink`, `text-canvas`, `veein-meta`, `rounded-full`) is unchanged.

## Sign-out everywhere — extracted shared component

After the initial fix, the user asked whether sign-out should appear on every page. Conclusion: yes, on every authenticated page (`/dashboard`, `/onboarding`, `/onboarding/step-2`), but **never** on the public wedding site (`/w/[slug]`) or the share-preview route (`/preview/[token]`) — those are guest-facing.

The four authed-page headers are structurally too different to merge into one `<AppHeader>` (landing has anchor nav; dashboard has Publish/Share Preview; onboarding pages have step counters). What's genuinely shared is the sign-out control itself, so that's what got extracted (see `DECISIONS.md` [2026-11] for the full trade-off):

**`src/components/auth/SignOutButton.tsx`** — a 10-line component that wraps `<form action={logout}><button>Sign out</button></form>` and accepts a `className`. It works in both server and client component contexts because it imports the existing `logout` server action and uses the canonical `<form action={…}>` pattern.

Then dropped into:

| Page | Placement |
|---|---|
| `src/app/page.tsx` | Replaced the two inline `<form>` blocks (header + footer) |
| `src/app/dashboard/page.tsx` | Left of the couple meta in the right-hand toolbar group |
| `src/app/onboarding/page.tsx` | Left of "Step 1 of 2" in the header |
| `src/app/onboarding/step-2/page.tsx` | Left of "Step 2 of 2 · Refine" in the header |

Styling is consistent: `veein-meta hover:text-ink transition-colors` everywhere, so it reads as a quiet meta-link rather than a primary action that competes with Publish / Open dashboard / step counter.

## Follow-ups (not in scope)

- A logged-in visitor who has not yet completed onboarding step 1 will land on `/dashboard` from the new "Continue to your dashboard" CTA. If onboarding completion gating is desired, that's a separate concern (see middleware or the dashboard page).
