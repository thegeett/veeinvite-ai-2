# Decisions log

Non-obvious decisions that shape the codebase. Not every commit — only decisions that:

- Affect multiple streams / files, or
- Involve a genuine trade-off between viable alternatives, or
- Future-you would regret without context six months from now.

**Written by:** any stream, at the moment a decision is made (not in retrospect).
**Format:** one entry per decision, appended chronologically. Never delete or rewrite — if a decision is reversed, add a new entry referencing the old one as superseded.

## Entry template

```markdown
## [YYYY-NN] Short title
**Date:** YYYY-MM-DD
**Stream:** A / B / C / integration / operator
**Status:** Accepted | Superseded by [YYYY-NN]

### Context
What problem or question triggered the decision. One paragraph.

### Decision
What was chosen. State it directly.

### Consequences
What this means going forward. What's now easier, what's now constrained.

### Alternatives considered
Two or three options that were rejected, with one sentence each on why.
```

The numbered ID format `[YYYY-NN]` lets other docs reference decisions unambiguously, e.g. `see DECISIONS [2026-03]`.

---

## [2026-01] Photo bucket is private; signed URLs substituted at serve time
**Date:** 2026-04-23
**Stream:** operator
**Status:** Accepted

### Context
Initial Day-0 migration comment described storage buckets as public-read. Wedding photos are personal data — public buckets enable scraping and redistribution, which is a reputation harm for couples and a liability for the product.

### Decision
All three storage buckets (`invitation-sites`, `preview-sites`, `couple-photos`) are private. The renderer emits `{{PHOTO:couple_id/file.jpg}}` placeholder markers instead of raw Supabase URLs. The `/w/[slug]` and `/preview/[token]` route handlers fetch HTML via the service-role client, scan for photo markers, batch-generate 1-hour signed URLs via `createSignedUrls()`, substitute, and return HTML with a 10-minute cache header.

### Consequences
- A leaked or screenshot photo URL stops working within an hour.
- HTML can't be served directly from the Supabase CDN — all traffic flows through our Next.js route handler.
- Gated serving unlocks future features: gallery-behind-RSVP, post-wedding privacy mode, hotlink prevention.
- Stream B's renderer must never emit raw Supabase URLs — only markers. Verified by acceptance criterion: grep output contains no `supabase.co/storage` strings.
- Stream C must batch the signing calls per request (createSignedUrls accepts an array) to avoid N round-trips on pages with many photos.

### Alternatives considered
- **Public bucket** — simplest and fastest, but enables photo scraping. Rejected.
- **Public bucket with random UUID paths (obscurity)** — URLs leak via browser history, referrer headers, screenshots, CDN logs. Obscurity is not security. Rejected.
- **Private bucket with long-lived (30-day) signed URLs embedded at render time** — signed URLs would need periodic regeneration via cron. Adds complexity without security win over 1-hour regenerate-at-serve. Rejected.

---

## [2026-02] Storage bucket names are domain-specific
**Date:** 2026-04-23
**Stream:** operator
**Status:** Accepted

### Context
Initial bucket names (`sites`, `previews`, `photos`) were generic and could belong to any app. Reduced grep-ability and clarity for engineers new to the codebase.

### Decision
Renamed to `invitation-sites`, `preview-sites`, `couple-photos`. The `-sites` suffix on the first two signals they store rendered HTML with different access rules; `couple-photos` makes the personal-data nature explicit.

### Consequences
- Reading `supabase.storage.from("couple-photos")` in code tells a new engineer exactly what's being touched.
- Parallel structure between the two HTML buckets makes them discoverable as a pair.
- No source code was impacted (Stream C hadn't implemented storage helpers yet).

### Alternatives considered
- **No app prefix** (e.g. `veeinvite-photos`) — buckets are scoped per Supabase project, so prefix adds noise without preventing collision. Rejected.
- **`rendered-invitations` / `preview-renders`** — emphasises build-artifact nature but "rendered" is technical for a naming convention future readers care about. Rejected in favour of more direct naming.

---

## [2026-03] Renderer splits content placeholders from structured placeholders
**Date:** 2026-04-23
**Stream:** B
**Status:** Accepted

### Context
AI Call 2's `theme_json.content` and injectStructured both target `{{TOKEN}}` tokens in the skeleton. If an AI drift puts `PERSON1_NAME: "Raj"` into the content map (it shouldn't — that's not in the §9 schema), the content-substitution pass would consume `{{PERSON1_NAME}}` before `injectStructured` runs, and the DB-backed "Meera" would never appear. Architecture rule 7 says injectStructured must always overwrite — we need a mechanism, not a hope.

### Decision
Renderer maintains a `STRUCTURED_KEYS` set (PERSON1/2_NAME, WEDDING_DATE*, VENUE_*, MONOGRAM, SLUG, COUNTDOWN_TARGET, plus `_BILINGUAL` variants). The content-substitution pass skips every key in this set, even if the AI included one. Structured keys are owned exclusively by `injectStructured()`.

### Consequences
- Even when AI behaves badly, the final rendered HTML carries DB-backed names, dates, and venues — guaranteed.
- Adding a new structured token (e.g. `CEREMONY_MUHURAT`) needs two changes: the placeholder gets added to the skeleton, and the key gets listed in `STRUCTURED_KEYS`. Missing the second leaves the placeholder unresolved.
- The content pass runs after hero prepend + RSVP + cultural injection, so fragments produced by those stages can still carry `{{TAGLINE}}`, `{{RSVP_SUBMIT_LABEL}}`, etc. and have them resolved.

### Alternatives considered
- **Run `injectStructured` twice** — once before content pass (to pin structured values) and once after (in case later steps re-introduce placeholders). Doubles work and hides the invariant; rejected.
- **Strip structured keys from the validated content map inside the validator** — tempting, but the validator has no business knowing about skeleton placeholder semantics. Keeping it inside the renderer keeps the invariant local and inspectable.
- **Prefix structured placeholders to avoid collision** (e.g. `{{STRUCT:PERSON1_NAME}}`) — requires changing every skeleton and hero that Stream A + the AI already produce. Too invasive for the value delivered.

---

## [2026-04] Pipeline accepts the full CoupleData, not just a coupleId
**Date:** 2026-04-23
**Stream:** B
**Status:** Accepted

### Context
The Day-0 `GenerateSiteInput` type was `{ quizAnswers, existingCoupleId? }`. That forced `generateSite` to fetch the couple row mid-pipeline, which contradicts the rule that engine code does no I/O (the engine must be importable by any caller — route handlers, CLI scripts, a future batch re-renderer).

### Decision
Widened `GenerateSiteInput` to `{ quizAnswers, couple: CoupleData, events?, themeOverride?, heroOverride? }`. Stream C fetches/upserts the couple row before calling. The engine receives the row and returns the bundle. Testing `generateSite` with `themeOverride` + `heroOverride` avoids real Anthropic calls.

### Consequences
- The engine is now pure: no Supabase import anywhere in `src/lib/`, no network I/O during rendering.
- Restore flows (Stream C's `/api/restore`) can pass `themeOverride` + `heroOverride` from a historical `site_versions` row and get a fresh render with current couple data — no extra AI spend.
- Stream C must `upsert` the couple and pull events before calling `generateSite`. This was implicit in the old shape; now it's explicit in the type.

### Alternatives considered
- **Keep `existingCoupleId` and inject a couple-loader** — would have worked but bled Supabase types into the engine. Rejected.
- **Split `generateSite` into `renderSite` + `generateAndRender`** — cleaner in principle but Stream C always wants the combined call. Rejected as speculative.

---

<!-- NEW ENTRIES BELOW THIS LINE -->

## [2026-05] Skeleton `{{RSVP_FORM}}` expansion owns the `<form>` tag; slug compliance marker is orphan
**Date:** 2026-04-23
**Stream:** A
**Status:** Accepted
**Note:** Originally numbered [2026-03] by Stream A; renumbered on merge to avoid collision with Stream B's [2026-03].

### Context
Plan §7 requires the skeleton to contain `<input type="hidden" name="slug" value="{{SLUG}}">` (per the §8 review checklist) AND says `{{RSVP_FORM}}` expands to the "complete form HTML built from rsvp_config + events + content" — i.e. including the `<form>` tag. Those two instructions conflict: if the skeleton wraps the placeholder in its own `<form>` and the renderer injects another, the result is nested forms (invalid). If the skeleton puts the slug input inside the placeholder region, `{{SLUG}}` isn't literally in the skeleton source for the review checklist.

### Decision
The skeleton places `<input type="hidden" name="slug" value="{{SLUG}}">` as a sibling of the `{{RSVP_FORM}}` placeholder, outside any form — it is a compliance marker only, verified by grep. Stream B's `buildRSVPForm()` expansion MUST begin with `<form id="rsvp-form" class="rsvp-form" method="post" action="/api/rsvp">` and include its own `<input type="hidden" name="slug" value="...">` inside the form body. The skeleton's inline JS binds to `document.getElementById('rsvp-form')`.

### Consequences
- Stream B owns the complete form element (tag, method, action, all fields including the slug).
- The skeleton's orphan slug input submits nothing — it is documentation, not data.
- Cross-stream contract: the form id `rsvp-form` is fixed. Renderer must use it so the skeleton's submit handler attaches.
- `{{RSVP_SUCCESS_TITLE/MESSAGE}}` live in a sibling `<div id="rsvp-success">` that the skeleton JS shows on submit. The form and success div are siblings, not nested.

### Alternatives considered
- **Have the skeleton own a `<form>` wrapper, renderer injects fields only** — cleaner semantics, but the plan explicitly says `{{RSVP_FORM}}` is "complete form HTML". Rejected to preserve the plan-as-written.
- **Omit the orphan slug marker and fail the §8 checklist line** — would violate the definition of done. Rejected.
- **Put the slug marker inside a `<template>` tag** — valid HTML, but semantics suggest "this will be activated later", which is wrong. Rejected.

---

## [2026-06] Content-picker uses `window.postMessage`, not cross-origin callbacks
**Date:** 2026-04-23
**Stream:** A
**Status:** Accepted
**Note:** Originally numbered [2026-05] by Stream A; renumbered on merge.

### Context
Plan §30 describes a content picker where clicking on text in the preview iframe adds that element's placeholder key (e.g. `STORY_QUOTE`) as chat context. The preview iframe is `/w/[slug]` — a self-contained page the renderer produces, potentially served from a different origin in M2. React callbacks cannot cross iframe origin boundaries.

### Decision
When the dashboard renders the preview iframe with `?edit=1` in the URL, Stream B's skeleton JS opts into edit mode: on any click of a text-bearing element, it calls `window.parent.postMessage({ type: "veein:content-pick", key, label }, "*")`. The dashboard's `SitePreview` component listens on `window` for `message` events and forwards matching payloads up to dashboard state. Origin can be tightened in production but is wildcarded in dev.

### Consequences
- Stream B must add the picker listener to skeleton JS when `?edit=1` is in the URL. That listener is bounded — no listener when guests view the published site.
- The `key` vocabulary is shared: placeholder tokens (`STORY_QUOTE`, `STORY_HEADING`, …) and CSS selectors (`.hero-names`, `.event-card`). The dashboard's element-label map lives in `SitePreview.tsx` and must mirror §30's `ELEMENT_LABELS`.
- Element-picker (phase 2) can reuse the same `postMessage` channel with a different payload `type`.

### Alternatives considered
- **Same-origin imperative access via `iframe.contentWindow`** — fails once preview moves to a separate domain (M2+), and requires same-origin restrictions to hold throughout development. Rejected.
- **Shared `BroadcastChannel`** — works across same-origin tabs but not across iframes reliably. Rejected.

---

## [2026-07] Bilingual placeholders resolve to empty strings in v1 (§33 accommodation, not activation)
**Date:** 2026-04-23
**Stream:** A
**Status:** Accepted
**Note:** Originally numbered [2026-04] by Stream A; renumbered on merge to avoid collision with Stream B's [2026-04].

### Context
Plan §33 specifies that v1 must *accommodate* bilingual rendering without *activating* it. Skeletons include `{{PERSON1_NAME_BILINGUAL}}`, `{{PERSON2_NAME_BILINGUAL}}`, `{{WEDDING_DATE_BILINGUAL}}`, `{{VENUE_NAME_BILINGUAL}}` in the footer. If these tokens remain as literal `{{...}}` in rendered HTML, guests see broken placeholders.

### Decision
Skeletons wrap bilingual output in spans with class `bilingual-secondary`. A `.bilingual-secondary:empty { display: none; }` CSS rule hides them when empty. Stream B's renderer MUST substitute bilingual placeholder tokens with empty strings in v1 — not leave them as literal `{{...}}`. When M2 activates bilingual, the renderer substitutes real values and the spans become visible automatically with no skeleton change.

### Consequences
- Zero visible effect in v1 (spans are empty → display:none).
- M2 activation requires only: `CulturalProfile.bilingualFields` populated + renderer substitutes the tokens. No skeleton edit.
- Stream B contract: all four bilingual tokens must be in the renderer's substitution map, defaulting to empty string.

### Alternatives considered
- **Omit bilingual placeholders in v1, add them when M2 lands** — would require touching all four skeletons in M2, violating Rule 2 ("never modify skeleton files after Phase 1"). Rejected.
- **Use a feature flag to conditionally include bilingual markup** — complicates the renderer contract for no gain. The empty-span approach is already conditional visually. Rejected.

## [2026-08] RSVP INSERT uses admin client; validation runs server-side
**Date:** 2026-04-23
**Stream:** C
**Status:** Accepted
**Note:** Originally numbered [2026-03] by Stream C; renumbered on merge.

### Context
Guest RSVP submissions are public — no session. The RLS policy on `rsvps` allows any anonymous INSERT, but that alone is not enough: a guest could post an arbitrary `events_attending` array containing ceremony IDs the couple never confirmed, inflate `guest_count` past the couple's `rsvp_config.guestCountMax`, or submit for unpublished couples.

### Decision
`POST /api/rsvp` uses the service-role client for INSERT and performs four server-side checks before writing:
1. Couple exists by slug, and `is_published = true`.
2. Each `events_attending` ID matches an event row (by id or event_type) actually belonging to this couple.
3. Numeric fields are clamped against the couple's `rsvp_config` (guestCountMax, childrenMax).
4. Gated fields (plus_one_name, meal_choice, dietary, song_request, message) are null-masked when the corresponding `*Enabled` flag is false.

### Consequences
- The client cannot forge ceremony attendance, inflate headcounts, or attach fields the couple disabled.
- The shape of the RSVP row is constrained by `rsvp_config` at server time, so enabling/disabling a field in the dashboard takes effect on the next submission with no cache invalidation needed.
- Future anti-spam layers (rate limit, CAPTCHA, hCaptcha) plug into the same handler, not into RLS.

### Alternatives considered
- **Rely on RLS policy alone (public INSERT).** RLS cannot express "events_attending must be a subset of this couple's events" — that's a cross-row predicate. Rejected.
- **Use the anon client with a Postgres trigger enforcing the predicates.** Would work, but shifts policy into Postgres where Stream C has less visibility. Rejected to keep business rules in TypeScript.

---

## [2026-09] Preview tokens are DB rows, not JWTs
**Date:** 2026-04-23
**Stream:** C
**Status:** Accepted
**Note:** Originally numbered [2026-04] by Stream C; renumbered on merge.

### Context
Shareable preview links (§32 Hook 3) need an expiry and, ideally, a revocation path if a couple later regrets a share. A stateless JWT would be attractive (nothing to clean up), but revocation would require a blocklist.

### Decision
Preview tokens are rows in a dedicated `preview_tokens` table with `(token text pk, couple_id uuid, expires_at timestamptz)`. The `/preview/[token]` route handler looks up the row; a missing row or `expires_at < now()` serves the expired page. Revocation is a DELETE.

### Consequences
- Revocation is trivial (row delete), which matters for "this preview is being passed around more than I expected".
- We gain observability: the row's `created_at` tells us when a preview was minted, useful for abuse investigation.
- Cleanup is a periodic `DELETE FROM preview_tokens WHERE expires_at < now()` — operator task; not urgent because expired rows fail closed.

### Alternatives considered
- **Signed JWT with exp claim.** Stateless, but no revocation without a blocklist — and if we build a blocklist, we may as well have a stateful table. Rejected.
- **Store only in storage metadata on `preview-sites/{token}.html`.** Harder to query, harder to list active previews, no good cleanup primitive. Rejected.

---

## [2026-10] `/api/photos` returns storage paths, never signed URLs
**Date:** 2026-04-23
**Stream:** C
**Status:** Accepted
**Note:** Originally numbered [2026-05] by Stream C; renumbered on merge.

### Context
The photo upload endpoint needs to tell the client what it just stored. An obvious answer is to return a signed URL the dashboard can immediately display. But signed URLs expire — storing them in `couples.photo_urls` or passing them through the session would age badly.

### Decision
`POST /api/photos` returns `{ photo_paths: string[] }` — the raw storage paths (e.g. `<coupleId>/<uuid>.jpg`). The dashboard fetches a short-lived signed URL per thumbnail via `GET /api/photos/sign?path=...` (10-minute expiry, owner-only). `couples.photo_urls` stores paths, not URLs. The public site serves via the `{{PHOTO:path}}` marker substitution in `/w/[slug]`.

### Consequences
- Every access to a photo goes through a signing hop — no durable URL is ever persisted or leakable.
- DB migrations never need to rewrite photo URLs when we change bucket names or signing policy.
- Cost: an extra round-trip per thumbnail in the dashboard. Acceptable — dashboards are low-traffic, and thumbnails are small.

### Alternatives considered
- **Return a 7-day signed URL from `/api/photos` and cache in the dashboard.** Leaks for 7 days if the session cookie is stolen or the URL is passed around. Rejected (same logic as DECISION [2026-01]).
- **Public bucket but obscured paths.** Already rejected in DECISION [2026-01].

---

## [2026-11] Sign-out is a shared atom, not a shared `<AppHeader>`
**Date:** 2026-04-26
**Stream:** A
**Status:** Accepted

### Context
Bug fix for the landing page (logged-in users saw signed-out chrome) and the onboarding page (a stale "Prefer to sign in first" CTA) raised the natural follow-up: should every authenticated page have a sign-out control, and if so, where should the shared logic live? The four authed surfaces — landing `/`, dashboard, onboarding step 1, onboarding step 2 — each have substantially different headers (anchor nav, Publish/Share Preview, step counters), so a single `<AppHeader>` would have needed several slot props and grown its API surface every time a page added a header element.

### Decision
Extract the genuinely shared concern only: `src/components/auth/SignOutButton.tsx` — a small component that wraps `<form action={logout}>` around the existing `logout` server action and accepts a `className`. Each page composes its own header and drops `<SignOutButton>` in where it fits. The four pages independently keep their structural diversity. Sign-out is deliberately omitted from `/w/[slug]` and `/preview/[token]` (guest-facing).

### Consequences
- One source of truth for sign-out behavior. Future changes (confirmation modal, telemetry, redirect target) live in one file.
- Each page's header remains its own composition — no slot-prop sprawl, no risk of one page's needs leaking into another's.
- Sign-out style is page-controlled via `className`. Today every page passes `veein-meta hover:text-ink transition-colors`; if we ever want a primary-pill sign-out somewhere we don't need a component variant — just a different className.
- If a future page needs the *whole* header replicated (e.g. a settings page that mirrors the dashboard chrome), we'll extract `<AppHeader>` then. Premature abstraction avoided.

### Alternatives considered
- **Full `<AppHeader>` with `leftSlot` / `rightSlot` / `centerSlot` props.** Would have collapsed four headers into one component, but each page's right-side content is so different that the slot props become a thin wrapper around what each page already renders inline. Rejected — abstraction without compression.
- **Inline `<form action={logout}>` in every page.** Five copies of the same JSX. Rejected — the auth concern is genuinely shared.
- **Custom hook returning a sign-out handler instead of a component.** Each caller would still write the form/button JSX. The component encapsulates more, with no flexibility loss. Rejected.

---

## [2026-12] Onboarding step 1 does not run the AI pipeline
**Date:** 2026-04-26
**Stream:** C
**Status:** Accepted

### Context
The original `/api/generate` route ran the full 3-call pipeline on both step 1 and step 2 of onboarding. Step 1 has only names / date / venue — no style card, no cultural profile, no story — so the pipeline ran with defaults, producing a site that step 2 regenerated as soon as the user picked a style and culture. User-reported latency on step 1 was ~2 minutes (Sonnet 4.5 tail latency × two sequential calls), all spent on output that step 2 immediately discarded. The §28 "2-minute promise" framing implied step 1 should be fast; in practice it was the slow gate.

### Decision
Step 1 of `/api/generate` returns immediately after the `couples` row insert with `{ couple_id, slug }`. No layout selection, no Call 2, no Call 3, no HTML upload, no `site_versions` row, no couple-row update. The full pipeline runs only on step 2, when the user actually has style / culture / story / vibe answers to feed it. Onboarding button labels updated to match: step 1 says "Continuing…" while in flight; step 2 says "Generating your site…" while the pipeline runs.

### Consequences
- Step 1 → step 2 transition is now ~500 ms (DB insert + redirect), down from 20s–2min.
- Total time from "names entered" to "dashboard" drops from ≥ 40s (two pipeline runs) to ~20s (one pipeline run).
- The wow-moment of "see your site after step 1" is gone. Step 2's right-pane preview is the existing `<LayoutMini>` schematic — unchanged. The actual generated site appears on the dashboard.
- The `site_versions` history starts at v1 = "Step 2 commit" rather than v1 = "Step 1 default + v2 = Step 2 regen". Cleaner, no throwaway version row.
- Step 2's button now shows the long wait that always existed but was masked by step 1's preview hop. This makes the latency more visible — and worth optimising via the locked M2 design (pre-call expressive palette + parallel Call 2/Call 3, ~13s).

### Alternatives considered
- **Run only Call 2 on step 1, defer Call 3 to step 2.** Halves step 1 latency to ~10s but still does throwaway work — step 2 regenerates everything once a style is picked. Rejected.
- **Run pipeline asynchronously after step 1; show progress on step 2.** Best UX (instant transition, site warming up while user fills step 2) but requires a job queue, polling, and partial-render UI. Out of scope for M1; recorded as a follow-up.
- **Keep step 1 pipeline behaviour, harden against tail latency.** Would address the 2-minute report but not the throwaway-work problem. Rejected — the architectural waste is the bigger issue.
- **Pre-call expressive palette + parallel Call 2/Call 3 (planned M2).** Independent optimisation that benefits step 2 once it's the only place the pipeline runs. Complementary to this decision, not a substitute.
