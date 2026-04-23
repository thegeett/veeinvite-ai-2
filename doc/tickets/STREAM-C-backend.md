# STREAM-C: Backend — Database, Auth, API Routes, Public Site, Preview, RSVP

**Parallel stream. Worktree: `../veeinvite-backend`. Branch: `stream-c-backend`.**

---

## Summary

Everything that touches I/O: Supabase schema + client wiring, auth + middleware, all API route handlers, the public `/w/[slug]` route, the shareable `/preview/[token]` route, RSVP intake, and photo uploads.

Stream C is the glue that takes the couple's input from Stream A's UI, runs it through Stream B's engine, and persists + serves the result.

---

## Scope (plan §§ references)

| Phase | What | Plan § |
|-------|------|--------|
| 5 | Supabase schema + clients | §23 |
| 6 | All API routes | §4 pipeline, §12, §15, §26, §29 |
| 7 | Auth + middleware | §23 VI-F015 |
| 11 | RSVP backend | §14, §16 |
| 12 | Public site route | §4, architecture rule 8 |
| — | Shareable preview route | §32 Hook 3 |
| — | Photo upload API | §16 VI-F017 |

---

## Prerequisites

Day 0 merged. You should see:

- `src/lib/types.ts` — canonical types
- `supabase/migrations/001_init.sql` — committed by Day 0; you apply it
- Stubs for every API route returning 501
- Stream B is publishing engine modules — import them as they become real

Environment you need:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, never exposed to client
- `ANTHROPIC_API_KEY` — server-only
- `NEXT_PUBLIC_APP_URL`

---

## File Ownership

### OWNS — write freely

- `supabase/migrations/*.sql`
- `src/lib/supabase/client.ts` — browser client (anon key)
- `src/lib/supabase/server.ts` — server client, server-component safe, supports cookies
- `src/lib/supabase/admin.ts` — service-role client for bypassing RLS where needed
- `src/lib/db/mappers.ts` — DB row ↔ type conversion helpers
- `src/lib/storage/html.ts` — upload generated HTML to Supabase Storage
- `src/lib/storage/photos.ts` — photo upload helper
- `src/middleware.ts`
- `src/app/api/**/route.ts` — all API handlers
- `src/app/w/[slug]/route.ts`
- `src/app/preview/[token]/route.ts`
- `src/app/auth/callback/route.ts`

### READS — must not edit

- `src/lib/types.ts` (Stream B)
- `src/lib/validator/**`, `renderer/**`, `ai/**`, `cultural/**`, `rsvp/config.ts`, `pipeline.ts` (Stream B)
- `layouts/**` (Stream A — you load these via renderer, not directly)

### NEVER TOUCHES

- `src/app/**/*.tsx` pages and React components — Stream A
- `src/components/**` — Stream A
- `src/lib/validator/**`, `src/lib/renderer/**`, `src/lib/ai/**` — Stream B
- `src/lib/cultural/library.ts`, `src/lib/rsvp/config.ts` — Stream B

---

## Work Breakdown

### Phase 5 — Supabase schema + clients (§23)

Apply Day 0's `001_init.sql` to the Supabase project. Verify all columns, including post-§24/26/29/33 additions:

- `couples.cultural_profile JSONB`, `couples.rsvp_config JSONB`
- `events.event_type TEXT`, `events.dress_code TEXT`
- `rsvps` expanded columns per §29
- `site_versions.global_tokens JSONB`

**RLS policies** — each table must have explicit policies:

```sql
-- couples: only owner reads/writes their row
CREATE POLICY couples_owner ON couples
  FOR ALL USING (auth.uid() = user_id);

-- events: inherit via couple ownership
CREATE POLICY events_owner ON events
  FOR ALL USING (
    couple_id IN (SELECT id FROM couples WHERE user_id = auth.uid())
  );

-- rsvps: anyone can INSERT (guest submissions), only couple reads
CREATE POLICY rsvps_insert ON rsvps FOR INSERT WITH CHECK (true);
CREATE POLICY rsvps_select ON rsvps FOR SELECT USING (
  couple_id IN (SELECT id FROM couples WHERE user_id = auth.uid())
);

-- site_versions: only couple owner
CREATE POLICY versions_owner ON site_versions
  FOR ALL USING (
    couple_id IN (SELECT id FROM couples WHERE user_id = auth.uid())
  );
```

**Storage buckets:**

- `sites` — generated HTML files, public-read
- `photos` — couple-uploaded photos, public-read, authenticated-write via signed upload URLs
- `previews` — shareable preview HTML files, public-read, 7-day expiry

**Clients:**

- `src/lib/supabase/client.ts` — `createBrowserClient` with anon key
- `src/lib/supabase/server.ts` — `createServerClient` from `@supabase/ssr`, reads cookies, for RSCs and route handlers
- `src/lib/supabase/admin.ts` — service role, for operations that bypass RLS (e.g. storage uploads, RSVP insertion from guest routes)

### Phase 7 — Auth + middleware

**Server actions** (imported by Stream A's auth pages):

- `signup(email, password)` — creates auth user, redirects to `/onboarding`
- `login(email, password)` — redirects to `/dashboard`
- `logout()` — redirects to `/`

**Auth callback:**

- `src/app/auth/callback/route.ts` — handles Supabase auth magic link / oauth callbacks

**Middleware** (`src/middleware.ts`):

Protect:
- `/dashboard/**` — requires auth
- `/onboarding` — requires auth
- `/api/generate`, `/api/edit`, `/api/structured`, `/api/publish`, `/api/photos`, `/api/restore`, `/api/preview-token` — require auth (owner-only)

Public:
- `/`, `/auth/**`
- `/w/[slug]`, `/preview/[token]`
- `/api/rsvp` — guest submissions (but validate couple_id + slug)

### Phase 6 — API routes

Implement each route as a Next.js route handler. Return JSON for API routes, raw HTML for `/w/[slug]` and `/preview/[token]`.

#### `POST /api/generate` — step 1 or step 2 quiz submission

Input: `QuizStep1Answers | QuizStep2Answers` (+ optional existing couple_id)

Flow:
1. Insert / update `couples` row with names, date, venue, cultural_profile, rsvp_config, events
2. Call `pipeline.generateSite(...)` — Stream B's orchestrator
3. Insert new `site_versions` row (append-only)
4. Upload HTML to Storage bucket `sites/{slug}.html`
5. Update `couples.site_html_url`, `theme_json`, `hero_html`, `layout_id`, `global_tokens`, `design_summary`
6. Return `{ slug, site_url, preview_html }`

#### `POST /api/edit` — chat edit

Input: `{ couple_id, instruction, content_picker_target?, element_picker_selectors? }` (§30)

Flow:
1. Classify instruction via `runClassifier()` (Stream B)
2. Route per classification:
   - `data` → call `/api/structured` internally
   - `content` → targeted content rewrite, update `theme_json.content`, re-inject, save, create version row
   - `design` → run Call 2, update tokens + theme, re-render, save
   - `hero` → run Call 3, update hero_html, re-render, save
   - `global` → run Calls 2 + 3, re-render, save
   - `new_section` → return 501 in M1 (M2 feature)
3. Return updated `{ site_url, preview_html, version_label }`

Always: update Supabase AND rewrite the HTML file. Never update only one (§30 rule).

#### `POST /api/structured` — direct data edit, no AI

Input: partial couple data / events / rsvp_config

Flow:
1. Update `couples` / `events` in DB
2. Re-render HTML (no AI call — just renderer with new data)
3. Overwrite HTML in Storage
4. Return `{ site_url }`

#### `POST /api/rsvp` — guest submission

Input: `{ slug, firstName, lastName, email, attending, guestCount, childrenCount?, plusOneName?, eventsAttending?, mealChoice?, dietary?, songRequest?, message? }`

Flow:
1. Look up `couple_id` from slug
2. Validate `eventsAttending` IDs against the couple's confirmed ceremonies (no injection of fake ceremony IDs)
3. Insert into `rsvps`
4. M2: trigger Resend email notification (stub in M1)
5. Return `{ success: true }`

Use admin client — RLS allows any INSERT but that's fine because the shape is validated.

#### `POST /api/rsvp/export` — CSV export for couple

Owner-only. Queries `rsvps` for couple, returns CSV.

#### `POST /api/restore` — switch to a previous version (§11)

Input: `{ couple_id, version_id }`

Flow:
1. Load version_N's layout_id, hero_html, theme_json, global_tokens
2. Call renderer with **current** couple DB data (not the old data — names/dates always from DB)
3. Save new HTML to Storage
4. Create new `site_versions` row labeled "Restored from v{N}"
5. Return updated site URL

#### `POST /api/publish`

Input: `{ couple_id }`

Flow:
- M1: just set `is_published = true` (beta free, per §15)
- M2: Stripe payment check first, then set published

#### `POST /api/photos` — photo upload (VI-F017)

Input: multipart form with image files + `couple_id`

Flow:
1. Authenticate — only couple owner
2. Validate file types (jpg, png, webp), max size (5 MB per image, 20 images total)
3. Upload to Storage bucket `photos/{couple_id}/{uuid}.{ext}`
4. Update `couples.photo_urls` JSONB array (new column — add to schema if missing)
5. Trigger a re-render so gallery shows real photos
6. Return `{ photo_urls }`

#### `POST /api/custom-section` — M2 stub

Return 501 in M1.

#### `POST /api/preview-token` — generate shareable preview (§32 Hook 3)

Input: `{ couple_id }`

Flow:
1. Generate UUID token
2. Render current site HTML with:
   - RSVP form **replaced** by "Create yours" CTA linking to `/signup?source=guest_preview&site={slug}`
   - "Powered by VeeInvite" footer made more prominent
3. Save to Storage bucket `previews/{token}.html`
4. Insert row in new `preview_tokens` table (add to schema — `token TEXT PRIMARY KEY, couple_id UUID, expires_at TIMESTAMPTZ`)
5. Return `{ preview_url: /preview/{token}, expires_at }`

### Phase 12 — Public site `/w/[slug]/route.ts`

**Route Handler, not a page component** (architecture rule 8). Returns raw HTML.

Flow:
1. Look up couple by slug
2. If `is_published = false` → return "Coming soon" HTML template
3. Else → read from Storage or rebuild from DB state, return HTML with `Content-Type: text/html`

No Next.js layout wrapping. No React. Standalone HTML document.

### Shareable preview `/preview/[token]/route.ts`

Same Route Handler pattern. Flow:
1. Look up token → couple_id + expires_at
2. If expired → return expired-token page
3. Else → read preview HTML from Storage, return with `Content-Type: text/html`

### Storage helpers

`src/lib/storage/html.ts`:

```ts
uploadSiteHtml(slug: string, html: string): Promise<string>  // returns public URL
uploadPreviewHtml(token: string, html: string, expiresAt: Date): Promise<string>
```

Both use admin client (service role) because RLS restricts storage writes.

---

## Coordination

- **Wait for Stream B's `pipeline.generateSite`** before wiring `/api/generate` fully. Until then, your route returns mock HTML.
- **Wait for Stream A's skeleton files** before running end-to-end tests.
- **Never expose service role key or Anthropic key** to the browser (architecture rule 10). Verify with `grep -r "SUPABASE_SERVICE_ROLE_KEY\|ANTHROPIC_API_KEY" src/app src/components` — there should be zero matches outside `route.ts` files and server-only modules.
- Commit daily, merge to main so Stream A can replace fixtures with real API calls.

---

## Acceptance Criteria

- [ ] Migration applies cleanly to fresh Supabase
- [ ] RLS blocks non-owning user from reading another couple's data (tested)
- [ ] Middleware redirects unauthenticated `/dashboard` to `/auth/login`
- [ ] `POST /api/generate` with valid step-1 input produces a row in `couples`, a row in `site_versions`, a file in Storage, and returns a usable slug
- [ ] `GET /w/[slug]` returns raw HTML (verified by curl — content-type is `text/html`, body starts with `<!DOCTYPE`)
- [ ] `POST /api/rsvp` from an unauthenticated client succeeds for a valid slug, fails for an invalid ceremony ID in `events_attending`
- [ ] `POST /api/restore` creates a new version row and never mutates the old one (append-only)
- [ ] `POST /api/preview-token` returns a `/preview/[token]` URL whose HTML has RSVP form replaced with signup CTA
- [ ] Photo upload rejects >5MB files and non-image MIMEs
- [ ] `grep -r "ANTHROPIC_API_KEY" src/components src/app/**/*.tsx` → zero matches
- [ ] `grep -r "SUPABASE_SERVICE_ROLE_KEY" src/components src/app/**/*.tsx` → zero matches
- [ ] `npm run build` succeeds
- [ ] Integration smoke test passes: signup → onboarding → /api/generate → /w/[slug] returns HTML containing couple names

---

## Definition of Done

Stream A's dashboard can call every API route and get the correct response. A fresh couple can complete signup → onboarding → receive a working `/w/[slug]` that a guest can RSVP to. No secrets leak to the browser. RLS holds under hostile testing.

---

## First prompt for the Stream C session

> Read `doc/VEEINVITE_PRODUCT_PLAN.md` (deep-read §§4, 9, 11, 14, 15, 21, 23, 26, 29, 30, 32), `CLAUDE.md`, and `doc/tickets/STREAM-C-backend.md`. Execute the ticket end to end, starting with Phase 5 (Supabase migration + clients). Import engine functions from Stream B — they may be stubs returning mock data initially, that's fine. Never expose service role or Anthropic keys to the browser. Commit per phase. Do not touch files outside your ownership list.
