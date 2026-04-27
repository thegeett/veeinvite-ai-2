# Stream C — Backend worklog

Per-phase narrative of Stream C's work: Supabase clients, auth, middleware, API routes, public `/w/[slug]`, shareable `/preview/[token]`, RSVP intake, photo upload, signed-URL serving.

**Owner:** Stream C Claude Code session (`stream-c-backend` branch)
**Ticket:** `doc/tickets/STREAM-C-backend.md`
**Format:** See `doc/worklog/README.md`

Append new entries to the bottom of this file. Do not reorder or edit prior entries — they're the historical record.

---

<!-- ENTRIES BELOW THIS LINE -->

## Phase 5 — Supabase schema + clients
**Completed:** 2026-04-23
**Files touched:** 3 new files under `src/lib/`

### What was built
The service-role, server, and browser Supabase clients are kept as Day-0 provided them — they already match the three access modes described in plan §23. Added two new layers on top: `src/lib/db/mappers.ts` converts raw Supabase rows (JSON columns untyped on the wire) into the canonical `CoupleData` / `EventData` / `RSVPData` / `SiteVersion` / `PreviewToken` shapes from `types.ts`, plus a `slugifyNames` helper. `src/lib/storage/html.ts` wraps the two private HTML buckets (`invitation-sites`, `preview-sites`) with `upload*`/`read*` helpers. `src/lib/storage/photos.ts` wraps the private `couple-photos` bucket, enforces size and MIME limits (5MB; jpg/png/webp), batch-generates signed URLs via `createSignedUrls`, and — critically — exposes `substitutePhotoMarkers(html)` which the route handlers in Phase 12 will call to swap `{{PHOTO:...}}` placeholders for 1-hour signed URLs.

### Why
- Mappers centralised, not per-route cast-scatter: the DB returns `jsonb` as `unknown`, and every route would otherwise re-cast. One layer means the "nullable FK to not-yet-generated theme" rule lives in one place.
- `substitutePhotoMarkers` is the core of DECISIONS [2026-01]. Put next to the bucket constants rather than in route handlers so the marker format stays paired with the bucket it signs against.

### Contracts emitted
- `src/lib/db/mappers.ts` — `rowToCouple`, `rowToEvent`, `rowToRsvp`, `rowToSiteVersion`, `rowToPreviewToken`, `slugifyNames`
- `src/lib/storage/html.ts` — `uploadSiteHtml`, `readSiteHtml`, `uploadPreviewHtml`, `readPreviewHtml`
- `src/lib/storage/photos.ts` — `uploadCouplePhoto`, `signPhotoUrls`, `substitutePhotoMarkers`, `deleteCouplePhoto`, plus `MAX_PHOTO_BYTES`, `ALLOWED_PHOTO_MIMES`, `MAX_PHOTOS_PER_COUPLE`

### Follow-ups
- Storage buckets must be created in the Supabase dashboard (SQL can't reliably create them) — operator task, documented in `supabase/migrations/001_init.sql`.

## Phase 7 — Auth + middleware
**Completed:** 2026-04-23
**Files touched:** 3 (`src/middleware.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/actions/index.ts`)

### What was built
Three server actions (`signup`, `login`, `logout`) in `src/app/auth/actions/index.ts` — Stream A's login/signup pages import these and wire them to form handlers. The Supabase auth callback handler at `src/app/auth/callback/route.ts` exchanges `?code=...` for a session and redirects to `?next=` or `/dashboard`. The middleware refreshes the session cookie on every matched request and, when the user is unauthenticated, redirects `/dashboard/**` + `/onboarding` to `/auth/login?next=...` and returns `401` on owner-only API prefixes.

### Why (non-obvious decisions)
- **`/api/rsvp` is deliberately not in `PROTECTED_API_PREFIXES`** — guest submissions happen without a session. Validation of `events_attending` ceremony IDs in the route handler (Phase 6) is what prevents injection; auth is not the right layer.
- **`/api/rsvp/export` is in the protected list** because it's the couple's owner-only bulk export.
- **Matcher is a negative regex over static assets rather than an allowlist** so session refresh runs on public pages too (landing, /w/[slug]) — otherwise a returning user's header state (logged-in vs logged-out) lags until the next protected hit.

### Contracts emitted
- `signup(email, password)`, `login(email, password)`, `logout()` — server actions importable from Stream A client-component wrappers.
- `GET /auth/callback?code=...&next=...` — Supabase auth redirect target.
- Middleware contract: unauthenticated `POST /api/generate|edit|structured|publish|photos|restore|preview-token|custom-section|rsvp/export` returns `{ error: "unauthorized" }` with 401.

### Follow-ups
- OAuth providers (Google) not wired yet — M2 feature. Callback already handles the code exchange when enabled.

## Phase 6 — API routes
**Completed:** 2026-04-23
**Files touched:** 10 routes + 2 helpers under `src/lib/db/`

### What was built
Every API route handler from the ticket. `/api/generate` upserts the couple, invokes `pipeline.generateSite()`, uploads HTML, writes an append-only `site_versions` row, and updates the couple's theme/hero/tokens. `/api/edit` routes instructions through `runClassifier()` into one of five branches — `content`, `design`, `hero`, `global`, `data` (redirected to `/api/structured`) — each of which updates DB + re-renders + writes a new version row. `/api/structured` handles direct data edits without calling AI. `/api/restore` re-renders with a frozen version's theme/hero/layout but **current** couple data (rule: names come from DB, never from the frozen version). `/api/publish` flips `is_published`. `/api/rsvp` validates ceremony IDs against the couple's confirmed events, gates unpublished sites, and clamps fields against the couple's `rsvp_config`. `/api/rsvp/export` returns a CSV. `/api/photos` enforces 5MB / 20-photo / jpg-png-webp limits; stores **storage paths only** in `couples.photo_urls` (never signed URLs — see DECISIONS). `/api/photos/sign` gives the authenticated owner a 10-minute signed URL for dashboard thumbnails. `/api/preview-token` renders the live site, swaps the RSVP section for a "Create yours" CTA (§32 Hook 3), uploads to the private `preview-sites` bucket, and records a 7-day expiry row. Two helpers under `src/lib/db/`: `auth.ts` (requireUser, requireCoupleOwner) and `rerender.ts` (load-couple → render → upload, reused by structured and restore).

### Why
- **Path sign endpoint uses `?path=` rather than a catch-all segment.** Next.js forbids `[...path]/sign` because a catch-all must be the last segment; `sign/[encoded]` would force URL-encoding of slashes. Query param is the cleanest of the three.
- **`/api/rsvp` uses admin client for INSERT** — RLS allows public insert but the ceremony-ID validation and rsvp_config clamping must run server-side before we trust the payload. Policy-level INSERT alone is not enough. See new DECISION.
- **Version rows are created AFTER a successful re-render**, not before. A failed render should not leave a ghost version pointing at stale storage.

### Contracts emitted
- `POST /api/generate` — `{ step: 1 | 2, couple_id?, answers }` → `{ couple_id, slug, site_url, version_number, preview_html }`
- `POST /api/edit` — `{ couple_id, instruction, content_picker_target?, element_picker_selectors? }` → `{ site_url, version_number, version_label, classification, preview_html }`
- `POST /api/structured` — `{ couple_id, couple?, rsvp_config?, events? }` → `{ site_url }`
- `POST /api/restore` — `{ couple_id, version_id }` → `{ site_url, version_id, version_number, version_label }`
- `POST /api/publish` — `{ couple_id }` → `{ published: true, site_url }`
- `POST /api/rsvp` — `{ slug, firstName, ... }` → `{ success: true }` (public)
- `POST /api/rsvp/export` — `{ couple_id }` → CSV body
- `POST /api/photos` — multipart `couple_id, files[]` → `{ photo_paths, results }`
- `GET /api/photos/sign?path=...` → `{ url }` (authed)
- `POST /api/preview-token` → `{ preview_url, token, expires_at }`
- Helpers: `requireUser`, `requireCoupleOwner`, `reRenderAndUpload` under `src/lib/db/`

### Follow-ups
- Real Call-2/Call-3 plumbing in `/api/edit` depends on Stream B's `runCall2`/`runCall3` returning non-stub output. Content-type edits currently write the instruction text straight into the placeholder — acceptable placeholder behaviour while Stream B wires the per-field prompt.
- Preview HTML swap is a regex `.replace()` on the RSVP `<section>`. Once Stream B adds a `previewMode` flag to `RenderInput`, swap to a proper render path (emit a `TYPES: need previewMode for preview-token` commit if not added by next sync).

## Phase 11 — RSVP backend
**Completed:** 2026-04-23

Shipped inline with Phase 6 (`/api/rsvp` and `/api/rsvp/export`). Key posture: insert uses admin client, SELECT is RLS-owner-only, unknown ceremony IDs are rejected with 400. See Phase 6 entry for details.

## Phase 12 — Public site `/w/[slug]` + preview `/preview/[token]`
**Completed:** 2026-04-23
**Files touched:** 2 route handlers

### What was built
`GET /w/[slug]` and `GET /preview/[token]` are Next.js route handlers (not page components) that return raw HTML. Both read HTML from their private bucket via the service-role client, run `substitutePhotoMarkers()` to swap every `{{PHOTO:path}}` for a freshly-signed 1-hour URL, and return with appropriate cache headers. `/w/[slug]` serves a "Coming soon" template when `is_published = false` or when storage has no file yet; `/preview/[token]` serves an expired page (HTTP 410) when the token has aged past 7 days, and its `Cache-Control` header is `private` to keep shared proxies out. Introduced the signed-URL-substitution serving pattern — already documented in `ARCHITECTURE.md` under "Public serving flow" with the substitution flow; this phase implements it.

### Why
- **`export const dynamic = "force-dynamic"`** — without it Next.js would try to prerender the route and fail on the admin-client call (env-dependent + auth required).
- **10-minute `Cache-Control` on `/w/[slug]`, 5-minute `private` on `/preview/[token]`.** Both are shorter than the 1-hour signed-URL lifetime, so we always re-sign before a URL expires.

### Contracts consumed
- `substitutePhotoMarkers(html, expiresIn)` — `src/lib/storage/photos.ts` (Phase 5)
- `readSiteHtml(slug)`, `readPreviewHtml(token)` — `src/lib/storage/html.ts` (Phase 5)

### Tests (manual)
- `npm run build` succeeds (see commit log).
- `npx tsc --noEmit` clean.
- Secrets grep: `SUPABASE_SERVICE_ROLE_KEY` appears only in `src/lib/supabase/admin.ts`. `ANTHROPIC_API_KEY` appears nowhere (Stream B will add it inside `src/lib/ai/generate.ts` — a server-only module).

---

## Polish — `/api/generate` step 1 skips the pipeline
**Completed:** 2026-04-26
**Branch:** `improve-cosmatic-issue`
**Files touched:** 3 (`src/app/api/generate/route.ts`, `src/app/onboarding/page.tsx`, `src/app/onboarding/step-2/page.tsx`)

### What was built
User reported that clicking *See my site* on `/onboarding` took ~2 minutes before transitioning to step 2. Tracing the route revealed that step 1 was running the full 3-call pipeline (`generateSite()` → Call 2 + Call 3 sequentially against Sonnet 4.5) — work that step 2 immediately regenerated once the user picked a style and culture. Step 1 now returns immediately after the `couples` row insert with `{ couple_id, slug }`. The full pipeline runs only on step 2, where the AI actually has a style card, cultural profile, vibe words, and story to use. See DECISIONS [2026-12].

Frontend touch-ups in the same change: step 1 button label "Generating your site…" → "Continuing…" (no longer accurate to advertise generation). Step 2 button label flips to "Generating your site…" during the pipeline call, gated by a new `submitting` state distinct from the existing `applying` state that briefly toggles after each preview pick.

### Why (non-obvious decisions only)
See DECISIONS [2026-12]. Two alternatives were rejected: running only Call 2 on step 1 (still throwaway work), and running the pipeline asynchronously with progress UI (out of scope for M1, recorded as future work).

### Contracts emitted
- `POST /api/generate` step 1 response shape unchanged: `{ couple_id: string, slug: string }`. Step 1 no longer returns `site_url`, `version_number`, or `preview_html` — the pipeline didn't run, so those fields don't exist. Step 1 callers (`src/app/onboarding/page.tsx`) only consume `couple_id` and `slug`; no client change required.

### Follow-ups
- [ ] Implement the pre-call expressive palette + parallel Call 2/Call 3 from `doc/precall_palette_architecture.md` to bring step 2 commit latency from ~20s down to ~13s. Severity: medium for M2.
- [ ] Consider firing the step 2 pipeline asynchronously when step 1 commits, with progress UI on step 2, so the dashboard appears instantly after the user clicks "Open dashboard". Severity: low — UX win, not correctness.

### Tests
- `npx tsc --noEmit` clean.
- Bug doc at `doc/bugs/2026-04-26-defer-generation-to-step-2.md`.

---

## Wizard journey — migration + login dispatch + DELETE endpoint + Step 1 upsert
**Completed:** 2026-04-26
**Branch:** `wizard-journey`
**Files touched:** `supabase/migrations/002_add_cultures_column.sql` (new), `src/lib/types.ts`, `src/lib/db/mappers.ts`, `src/lib/db/auth.ts`, `src/app/api/couple/route.ts`, `src/app/api/generate/route.ts`, `src/app/auth/actions/index.ts`, `src/middleware.ts`, plus tests.

### What was built
Backend support for the wizard journey (Stream A's polish entry "Wizard journey — four-step authoring flow"). Coordinated changes:

- **Migration `002_add_cultures_column.sql`** — adds `couples.cultures jsonb default '[]'::jsonb`. Required because the previous PR's `buildMergedCulturalProfile` made the forward path correct (configurator → engine) but only the merged `cultural_profile` was persisted; interfaith couples couldn't recover their secondary culture pick. This column stores the original `CultureSelection[]` array verbatim.
- **`getMostRecentCoupleForUser(userId)`** in `src/lib/db/auth.ts` — used by `login()` and the `/onboarding` dispatcher to route returning users to `/welcome` and new users to Step 1.
- **`DELETE /api/couple?id=…`** — owner-only handler. Best-effort storage cleanup (`invitation-sites/{slug}.html` + `couple-photos/{id}/*`), then row delete (FK cascades handle events / site_versions / rsvp_* / preview_tokens).
- **`/api/generate` step 1 upsert** — when a `couple_id` is provided in the request body and the user owns it, UPDATE that row. Otherwise INSERT a fresh row. Closes the duplicate-INSERT bug that earlier patches couldn't reach.
- **`/api/generate` step 2** — now persists `a.cultures` in the new column on UPDATE.
- **`login()` dispatch** — fetches user's couple after successful sign-in; redirect to `/welcome` if exists, `/onboarding` otherwise.
- **Middleware** — `/welcome` and `/onboarding/*` added to the protected-page list.

### Why (non-obvious decisions only)
See DECISIONS [2026-15]. Notable rejected alternative: "cache `couple_id` in a cookie at login to skip the DB lookup on the dispatcher" — overview shows live `Last saved …` so caching just relocates the query without saving work. The DB *is* the cache.

### Contracts emitted
- DB schema: `couples.cultures jsonb default '[]'::jsonb`. Operator must run `supabase db push` (or equivalent) before deploying.
- `getMostRecentCoupleForUser(userId): Promise<CoupleData | null>` from `@/lib/db/auth`.
- `DELETE /api/couple?id=…` returns `{ ok: true }` or `{ error: string }` with appropriate status.
- `POST /api/generate` step 1 now accepts optional `couple_id` to switch from INSERT to UPDATE.
- `CoupleData.cultures: CultureSelection[]` — required field. `rowToCouple` defaults to `[]` for missing/null columns.

### Follow-ups
- [ ] Migration `002_add_cultures_column.sql` must be applied in production. Severity: blocking deploy.
- [ ] Best-effort storage cleanup on Start over could leave orphans if a request fails mid-DELETE. Periodic janitor job is the right long-term answer once volume justifies. Severity: low.

### Tests
- `tests/mappers.test.ts` (new) — 3 cases for `cultures` round-trip: missing column → `[]`, populated array preserved, non-array values fall back to `[]` (defensive).
- `npm test` — 162/162 green. `npx tsc --noEmit` clean.
- Bug doc at `doc/bugs/2026-04-26-wizard-journey.md`.

