# Architecture

**Living document.** Describes how the pieces fit together. Updated when a new pattern is introduced or an existing pattern changes.

For the full product spec, see `doc/VEEINVITE_PRODUCT_PLAN.md` — this file does not restate it. This file describes the *implementation* architecture as it grows.

**When to update:** at the end of any phase that introduces a new system-level pattern. The corresponding worklog entry should link to the section added here (e.g. "Introduced photo-marker pattern — see ARCHITECTURE.md §Photos").

---

## Module map

```
src/
├── app/
│   ├── page.tsx                         Stream A — landing
│   ├── layout.tsx                       Stream A — root layout
│   ├── auth/{login,signup}/page.tsx     Stream A — UI | Stream C — server actions
│   ├── onboarding/page.tsx              Stream A
│   ├── dashboard/**                     Stream A
│   ├── api/**/route.ts                  Stream C
│   ├── w/[slug]/route.ts                Stream C — public wedding site (raw HTML)
│   └── preview/[token]/route.ts         Stream C — shareable preview (raw HTML)
│
├── lib/
│   ├── types.ts                         Stream B — canonical type contract
│   ├── cultural-content-library.json    Stream B — cultural data (static)
│   ├── validator/                       Stream B — never throws, safe defaults
│   ├── renderer/                        Stream B — skeleton + tokens → HTML
│   ├── layoutSelector.ts                Stream B — style card wins, culture suggests
│   ├── ai/{prompt,generate,classifier}.ts  Stream B — Anthropic SDK wrappers
│   ├── cultural/                        Stream B — ceremony algorithms, injection
│   ├── rsvp/config.ts                   Stream B — data-driven RSVP form builder
│   ├── pipeline.ts                      Stream B — orchestrator (quiz → HTML)
│   ├── supabase/{client,server,admin}.ts  Stream C — anon / server / service-role
│   ├── db/mappers.ts                    Stream C — DB row ↔ typed object
│   └── storage/*.ts                     Stream C — upload helpers
│
├── components/**                        Stream A
└── middleware.ts                        Stream C

layouts/
├── layout-1-modern/{skeleton.html,meta.json}    Stream A
├── layout-2-romantic/...
├── layout-3-grand/...   (named "Grand Celebration" — culture-agnostic)
└── layout-4-editorial/...

supabase/migrations/*.sql                Stream C — schema + RLS
```

## Data flow at generation time

Plan §4 defines the pipeline. Implementation map:

```
Quiz answers (client)
  ↓  POST /api/generate (Stream C)
Stream C loads/creates couple row
  ↓
Stream C calls pipeline.generateSite() (Stream B)
  ↓
Stream B:
  1. buildCulturalProfile() from quiz answers
  2. selectLayout() — style card wins, else culture suggests, else layout-1
  3. runCall2() — full-site design with globalTokens + coherence
  4. validateAll() — strip forbidden CSS, apply content defaults
  5. runCall3() — hero with globalTokens as hard constraints
  6. render() — skeleton + CSS + content + cultural injection; injectStructured LAST
  7. return bundle
  ↓
Stream C persists:
  - upsert couples row (theme_json, hero_html, layout_id, global_tokens, design_summary)
  - insert site_versions row (append-only)
  - upload HTML to invitation-sites/{slug}.html (private bucket)
  ↓
Return site_url + slug to client
```

## Public serving flow

```
Guest visits /w/[slug]
  ↓
Stream C route handler:
  1. Look up couple by slug, check is_published
  2. Read HTML from private invitation-sites/{slug}.html via admin client
  3. Scan HTML for {{PHOTO:...}} placeholder markers
  4. Batch createSignedUrls() against couple-photos bucket, 1-hour expiry
  5. Substitute markers with signed URLs
  6. Return HTML with Cache-Control: public, max-age=600
```

Same flow for `/preview/[token]` with token validation step at the front.

## Cross-cutting patterns

### Photos — placeholder markers + signed URLs at serve time

See DECISIONS [2026-01].

- Renderer emits `{{PHOTO:couple_id/filename.ext}}` — never raw Supabase URLs.
- Route handlers substitute with freshly-signed 1-hour URLs on each request (cached 10 min at the HTML layer).
- Photo bucket is private; signed URLs are the only access path.

### Cultural profile — two-axis system (plan §24)

Layout (structure) and culture (content) are independent axes. Any layout can hold any cultural profile. Layout selection logic (plan §25): style card wins > culture suggests > default.

Cultural content flows via `section` field on each content item (plan §26). The renderer's `injectCulturalContent()` routes items to their placement target:

- `hero_eyebrow`, `hero_names_area`, `hero_date_area`, `hero_cta_area` → hero injection
- `faq` → appended as FAQ item
- `footer` → appended to footer
- `custom_section` → new full section before footer
- `events` → handled by ceremony loop, not content items

### Validator — never throws (plan architecture rule 8)

All AI output flows through the validator. Invalid values become safe defaults. The site always renders, even with completely broken AI output.

### injectStructured — runs LAST (plan architecture rule 4)

Real names/dates/venues from the DB always overwrite AI-generated copy. Any section of the renderer that touches names/dates must run before `injectStructured()` — because `injectStructured()` is the last line of defence.

### Secrets hygiene (plan architecture rule 10)

`ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only. Never appear in `src/components/`, never in `src/app/**/*.tsx` client components, never imported where a Next.js build would include them in the client bundle. Enforced in Stream C acceptance criteria by grep check.

---

## Patterns introduced later

### Auth + session middleware (Phase 7)

`src/middleware.ts` runs on everything except static assets. On every matched request it refreshes the Supabase session cookie via `@supabase/ssr`'s `createServerClient` (request/response cookie adapter), so logged-in state stays coherent across public pages too. When the user is unauthenticated, it redirects `/dashboard/**` and `/onboarding` to `/auth/login?next=<path>` and returns `401` JSON on the owner-only API prefixes:

```
/api/generate   /api/edit        /api/structured   /api/publish
/api/photos     /api/restore     /api/preview-token
/api/custom-section   /api/rsvp/export
```

`/api/rsvp` is deliberately NOT protected — guest submissions must succeed without a session. Validation inside the handler (see DECISIONS [2026-03]) is what makes the public endpoint safe. `/auth/callback` handles Supabase's code-for-session exchange.

### Chat-edit routing (Phase 6)

`POST /api/edit` asks Stream B's `runClassifier()` for an `EditType`, then branches:

- `data` → 400 with a redirect hint to `/api/structured` (keep AI calls out of pure-data edits)
- `content` → mutate a single placeholder in `theme.content`, re-render
- `design` → `runCall2()` → full theme refresh, hero preserved, re-render
- `hero` → `runCall3()` → new hero with existing `globalTokens` as constraints, re-render
- `global` → Call 2 + Call 3 → full redesign, re-render
- `new_section` → 501 (M2)

Every branch that changes the design ends with: DB update → re-render via `reRenderAndUpload()` → append-only `site_versions` row. If the render fails, no version row is written, so history never points at missing storage.

### Restore: frozen theme + live data (§11)

`POST /api/restore` copies the old version row's `layout_id`, `theme_json`, `hero_html`, `global_tokens`, `design_summary` into `couples`, then re-renders using the current `couples`/`events` data. A restored site never shows old names or old venues — those always come from the live DB. A new `site_versions` row is appended with label `Restored from v{N}`; the old row is never mutated.

### Preview token lifecycle (§32 Hook 3)

`POST /api/preview-token` renders the couple's current site, post-processes to swap the RSVP section for a "Create yours" CTA, uploads to the private `preview-sites/{token}.html`, and records a row in `preview_tokens` with a 7-day expiry. `GET /preview/[token]` looks up the row, fails closed on missing or expired, reads the HTML from the private bucket, runs the same `{{PHOTO:...}}` → signed-URL substitution as `/w/[slug]`, and returns with `Cache-Control: private, max-age=300`. See DECISIONS [2026-04] for why tokens are DB rows, not JWTs.

### Photo access (full pattern)

1. Upload (owner-only) → `POST /api/photos` → `couple-photos/{coupleId}/{uuid}.ext`
2. DB stores paths only (`couples.photo_urls: text[]`), never signed URLs.
3. Public site render emits `{{PHOTO:path}}` markers.
4. Public site serve (`/w/[slug]`, `/preview/[token]`) batch-signs on each request via `createSignedUrls()`, 1-hour expiry, and substitutes markers.
5. Dashboard thumbnail preview → `GET /api/photos/sign?path=...` → 10-minute signed URL.

See DECISIONS [2026-01] and [2026-05].
