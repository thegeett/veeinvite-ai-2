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

