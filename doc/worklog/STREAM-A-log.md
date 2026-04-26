# Stream A — Frontend worklog

Per-phase narrative of Stream A's work: layouts, landing, onboarding, dashboard, version history, RSVP dashboard.

**Owner:** Stream A Claude Code session (`stream-a-frontend` branch)
**Ticket:** `doc/tickets/STREAM-A-frontend.md`
**Format:** See `doc/worklog/README.md`

Append new entries to the bottom of this file. Do not reorder or edit prior entries — they're the historical record.

---

<!-- ENTRIES BELOW THIS LINE -->

## Phase 1 — Layout library (4 skeletons + meta.json)
**Completed:** 2026-04-23
**Files touched:** 8 (4 × `skeleton.html` + 4 × `meta.json`) + 2 DECISIONS entries + this log

### What was built
Four HTML layout skeletons under `layouts/layout-{1-modern,2-romantic,3-grand,4-editorial}/`, each a self-contained structural template with nav, story/events/rsvp/gallery/faq/footer sections, scroll reveal, FAQ accordion, RSVP submit-success toggle, nav smooth-scroll, and a post-wedding countdown safety guard (plan §31 fix 1). Structural CSS only — no colors, fonts, shadows, backgrounds, letter-spacing, or font sizing. Call 2 supplies all those via `theme_json`. Each layout has its own `meta.json` with the tags/antiTags/bestFor spec from plan §6; Layout 3 is "Grand Celebration" with structural tags only (grand, celebratory, ornate, luxury, multi-event, rich, dramatic) — no culture-specific tags, per the plan's rename from "South Asian."

### Why (non-obvious decisions only)
- **Slug hidden input is an orphan compliance marker.** Plan §8 requires `<input type="hidden" name="slug" value="{{SLUG}}">` to be greppable in the skeleton, but §7 says `{{RSVP_FORM}}` expands to a complete form (tag included). Nesting forms is invalid HTML. Resolved by placing the hidden input as a sibling of the placeholder and pushing the functional slug input into `buildRSVPForm()`. See DECISIONS [2026-03].
- **Bilingual tokens wrapped in `.bilingual-secondary` with `:empty { display: none }`.** Lets v1 accommodate §33 with zero visible effect and M2 activation without touching any skeleton. See DECISIONS [2026-04].
- **FAQ button reset dropped `background: transparent` and `border: 0`** — those were forbidden by §7. Call 2 styles `.faq-question` directly, so browser defaults are overridden at render time.
- **Skeleton-level countdown guard checks `.hero-countdown`.** Plan §31 fix 1 belongs logically in the hero (generated separately by Call 3), but the skeleton runs its own late-firing check so post-wedding hides happen even if the hero JS malfunctions or an older hero HTML is served.

### Contracts emitted
- `{{RSVP_FORM}}` expansion must begin with `<form id="rsvp-form" class="rsvp-form" method="post" action="/api/rsvp">`. The skeleton JS binds to that id.
- `buildRSVPForm()` output must include a hidden slug input inside the form (the skeleton's orphan marker submits nothing).
- Bilingual placeholders (`{{PERSON1_NAME_BILINGUAL}}`, `{{PERSON2_NAME_BILINGUAL}}`, `{{WEDDING_DATE_BILINGUAL}}`, `{{VENUE_NAME_BILINGUAL}}`) must resolve to empty strings in v1 — not be left as literal `{{...}}` tokens.
- Hero's countdown element must use class `.hero-countdown` so the skeleton's post-wedding guard can hide it.
- `{{EVENTS_CARDS}}` is a single placeholder — renderer loops `culturalProfile.ceremonies` and emits one `<div class="event-card">` per ceremony (max 6; L3 grid supports up to 6 auto-fit, L4 is fixed 2-col).
- Nav anchor IDs frozen: `#story #events #rsvp #gallery #faq`. Hero must not add its own nav link.

### Follow-ups
- [ ] Manual browser pass at 390px and desktop — verified programmatically (tag balance, JS syntax, placeholder presence, forbidden-CSS absence, layout-specific structural rules). Visual mobile pass is queued for the Stream B/C integration checkpoint when the renderer can assemble a real site. Severity: low — skeletons are structural and follow the §7 spec exactly.
- [ ] Once Stream B's renderer lands, run one end-to-end render per skeleton and re-confirm the §8 checklist visually.

### Tests
- `grep` scan confirms every placeholder token is present in every skeleton.
- `grep` scan confirms forbidden CSS is absent (only `font-family: inherit` remains — the plan's explicit form-field exception).
- `node --check` confirms inline JS parses cleanly.
- `python3 -m http.server` + `curl` confirms each skeleton serves HTTP 200 and is well-formed (balanced html/head/body/nav/footer/section/script tags).

---

## Phase 13 — Landing page + app design system
**Completed:** 2026-04-23
**Files touched:** 5 (`src/app/{page,layout}.tsx`, `globals.css`, `tailwind.config.ts`, `src/components/landing/LayoutMini.tsx`) + 1 ARCHITECTURE entry + this log

### What was built
A distinctive editorial-quarterly landing page at `src/app/page.tsx`. Masthead strip, oversized newspaper-style hero with a word-by-word staggered reveal and one italic blush-coloured accent word, an "Issue No. 01" editorial corner card, a three-column value-prop strip, a four-tile layouts showcase where each tile contains a CSS-only schematic miniature of its skeleton, a typographic culture cloud covering 20 cultures/sub-regions at varied weights, a dark-ink final CTA, and an editorial footer. Custom fonts (Fraunces / DM Sans / JetBrains Mono) wired via `next/font/google` in `layout.tsx`; Tailwind theme extended with the canvas/ink/blush/gold palette and `veein-meta` utility class.

### Why (non-obvious decisions only)
- **Editorial quarterly, not wedding-blog pastel.** Weddings are the most generic-AI-aesthetic category on the internet. Committing to an unmistakable editorial voice (Fraunces + mono meta labels + warm stone canvas + single terracotta accent) is the anti-slop bet. See ARCHITECTURE §App UI design system.
- **CSS-only layout miniatures instead of screenshots or iframes.** Iframe loading on a landing page is a first-paint liability; screenshots would couple marketing content to generation output and require a build pipeline. Each miniature is a parameterised abstraction of the skeleton's structural rhythm — cheap, distinctive, and remains correct even as Call 2 changes palettes downstream.
- **Design system introduced here, used everywhere after.** Onboarding/dashboard/auth will all inherit this font stack and colour tokens. Documented once in ARCHITECTURE so later phases don't rebuild it ad-hoc.

### Contracts emitted
- `src/app/layout.tsx` loads three Google fonts as CSS variables — every Stream A surface can `font-serif`, `font-sans`, `font-mono` via Tailwind.
- `veein-meta` utility class in `globals.css` for monospace uppercase eyebrow labels.
- Color tokens `canvas`, `paper`, `ink`, `blush`, `gold`, `stone`, `line` on Tailwind — onboarding/dashboard should use these instead of inventing new ones.
- `@/components/landing/LayoutMini` component accepts `flavor="modern"|"romantic"|"grand"|"editorial"` and renders a CSS-only schematic of that layout. Reusable for any later "browse layouts" UI (e.g. layout switcher in the dashboard — M2 feature).

### Follow-ups
- [ ] Lighthouse score verification (90+ is an acceptance criterion) — needs a live deployed URL or a headless-browser pass; `next build` is clean and first-load is 96 kB. Severity: low — expected to pass given the lean JSX + Next font optimisation.
- [ ] `See an example` secondary CTA currently anchors to `#layouts`; should link to a real example site at `/w/demo-couple` once Stream C has a demo fixture (M1). Severity: low.
- [ ] Growth-mechanics footer attribution (§32 Hook 1) is out of scope for Phase 13 — lives on the *generated* site, not the landing. Noted for Stream B.

### Tests
- `npm run typecheck` clean.
- `npm run build` clean, 13/13 static pages generated, landing page at 8.83 kB / 96.1 kB first load.
- `curl http://localhost:3000/` returns 86 KB HTML with correct title, 4 layout miniatures present, both CTAs rendered, all 20 culture labels in the cloud, fonts registered via Next.js variable CSS classes.

---

## Phase 8 — Onboarding (two-step quiz + cultural configurator) & auth shell
**Completed:** 2026-04-23
**Files touched:** 9 (`src/app/onboarding/{page,step-2/page}.tsx`, `src/app/auth/{login,signup}/page.tsx`, `src/components/onboarding/{CulturalConfigurator,StyleCardPicker,CompletionIndicator}.tsx`, `src/components/auth/AuthForm.tsx`, `src/lib/fixtures/{api,cultural}.ts`) + worklog

### What was built
A working two-step onboarding flow. Step 1 (`/onboarding`) collects couple names, wedding date, venue, and city on a single focused screen with inline validation and a progress bar. On submit it hits `/api/generate` (or the fixture stand-in) and navigates to step 2 with the couple id + names in the URL. Step 2 (`/onboarding/step-2`) shows a two-pane layout: controls on the left (style card picker with the 4 layout miniatures reused as swatches, 3-word vibe field, cultural configurator, story textarea) and a live preview + completion indicator on the right. Each control fires `POST /api/edit` on change. Cultural configurator supports multi-culture selection, per-culture sub-region dropdowns, content-item toggling, ceremony toggling with "Also available" rows when a sub-region filters the default list, a universal-content appendix, and an interfaith conflict banner when two cultures contribute to the same hero slot. Auth login and signup pages share an `AuthForm` client component (server actions land with Stream C) inside an editorial split layout.

### Why (non-obvious decisions only)
- **Fixture-parity cultural algorithm.** Stream B's `src/lib/cultural/library.ts` still returns empty arrays. To let the configurator actually render a correct Tamil pre-selection (ticket acceptance criterion), Stream A implements `getCeremoniesForCouple` / `buildCulturalProfile` / `findConflicts` under `src/lib/fixtures/cultural.ts`, mirroring the §26 algorithm. When Stream B's loader lands, feature code switches its import path — no component changes needed. Documented at the top of the fixture file.
- **Step 2 preview is a schematic, not an iframe.** `/preview/[token]` is still a Stream C stub; embedding it now would either show a 501 or require fixture HTML delivery. Instead the preview pane reuses `LayoutMini` at large size keyed to the selected style card. It updates visibly on every edit — good enough for the "your site is coming together" UX without faking a full render.
- **Cultural configurator is a local state machine over `CultureSelection[]`, not a form.** Conflicts are recomputed via `useMemo` on every change so a second-culture selection surfaces the conflict banner immediately. No server round-trip for conflict detection.
- **Every onboarding input triggers `/api/edit` on `onChange`/`onBlur`, not a save button.** Plan §28 promises the site refines continuously during step 2 — no explicit "Save" to learn.

### Contracts emitted
- `src/lib/fixtures/api.ts` — `generateSite`, `editSite`, `loadCouple`, `loadVersions`, `loadRSVPs`. Exported under `USE_FIXTURES`. Feature code gates on `process.env.NODE_ENV === "development" && USE_FIXTURES` so switching to real endpoints is a one-line change.
- `src/lib/fixtures/cultural.ts` — `listCultures`, `getCulture`, `getCeremoniesForCouple`, `buildCulturalProfile`, `findConflicts`. Drop-in replaceable by Stream B's `src/lib/cultural/library.ts` once it lands.
- `CultureSelection` type (in `CulturalConfigurator.tsx`) — `{ cultureId, subRegion?, confirmedContentItemIds, confirmedCeremonyIds }`. The shape the configurator emits upstream; dashboard will reuse it in the "edit cultural profile" flow.
- `/onboarding/step-2` reads couple + name + date + venue + city from query params written by step 1 — keeps the preview column populated without a server fetch before the real couple record exists.

### Follow-ups
- [ ] Swap `src/lib/fixtures/cultural.ts` imports for `src/lib/cultural/library.ts` imports when Stream B fills in the real loader. Severity: low — same function signatures.
- [ ] Swap fixture API calls in onboarding pages for real `fetch("/api/*")` calls when Stream C's routes return 200. Severity: low.
- [ ] Embed `/preview/[token]` as an iframe in step 2 when Stream C's preview route is wired. Severity: medium — it's the one place the schematic is a demo, not the product.
- [ ] Interfaith conflict detection currently only flags `hero_eyebrow` + `hero_names_area` duplicates; expand to `hero_date_area`, `hero_cta_area`, `footer` per §26 when the full algorithm is battle-tested.

### Tests
- `npm run typecheck` clean.
- `npm run build` clean, 17/17 static pages generated; onboarding step-2 is 20.9 kB / 117 kB first load.
- `curl` smoke test confirms step 1, step 2, login, and signup pages render with expected copy (step 2 resolves URL params for Priya & Arjun fixture, shows "Modern Minimalist" style-card, "Hindu — Indian" culture chip, and the "Your traditions / visual mood / story" sections).

---

## Phase 9, 10, 11 + Photo upload — Dashboard core & all right-pane tabs
**Completed:** 2026-04-23
**Files touched:** 7 (`src/app/dashboard/page.tsx`, `src/components/dashboard/{SitePreview,EditPanel,StructuredEditor,VersionHistory,RSVPDashboard,PhotoUpload}.tsx`) + worklog

### What was built
The full dashboard at `/dashboard?couple=…`. A two-column layout: preview on the left (iframe to `/w/[slug]` with mobile/desktop toggle, refresh button, content-picker chip, and a schematic fallback when Stream C's route is still a stub), a tabbed right pane with five tabs:
1. **Edit** — chat input + 6 suggested prompt chips + picked-context chip + edit history list. Fires `/api/edit` with the instruction (and picker key when selected).
2. **Details** — structured editor for names / dates / venue / RSVP deadline / story. Blur-to-save; each field posts `/api/structured`. No AI.
3. **Your designs** — version history list with accent + background thumbnails, the couple-friendly label ("Design from 14 April"), the original instruction as a quote, and a "Switch to this design" button per row (plan §11 UX language — never "Restore").
4. **RSVPs** — stats (total / attending / declined / head count), filter chips (all / attending / declined / per-ceremony when multi-event), a 7-column table (guest / email / attending / count / events / dietary / message), and a CSV export button. In fixture mode the CSV is downloaded client-side; production mode redirects to Stream C's export endpoint.
5. **Photos** — drag-and-drop + file-picker upload, grid of thumbnails. POSTs multipart to `/api/photos` when Stream C is live; in dev mode uses `URL.createObjectURL` so the UI completes without a backend.

Top bar: couple name + date, "Share preview" link to `/preview/[token]`, and a "Publish" button. Fields populate from the fixture `loadCouple()` on mount.

### Why (non-obvious decisions only)
- **One tabbed right pane, not three separate pages.** Plan §9 shows "three-pane" wording, but "Details / Versions / RSVPs / Photos" are all contextual to one couple and need the preview visible alongside each. A single dashboard with tabs keeps the preview anchored; splitting to routes would force re-fetches every tab change.
- **Content-picker is a `window.message` listener, not a prop callback.** The iframe at `/w/[slug]` can't pass callbacks across origins. The skeleton JS (generated by Stream B) posts `{ type: "veein:content-pick", key, label }` and the `SitePreview` component listens on `window`. Contract documented in `SitePreview.tsx` for Stream B to honor.
- **Fallback schematic in the preview pane is intentional.** Without it, the dashboard looks broken on first load while Stream C's `/w/[slug]` is still a stub. With it, the reviewer sees a recognisable miniature of the couple's layout — same `LayoutMini` from the landing page.
- **Client-side CSV export in dev mode.** The ticket has "CSV export button (calls Stream C's export endpoint)." In production we hit the endpoint; in dev/fixture mode we build the CSV from `loadRSVPs` locally so nobody needs to spin up Stream C just to demo the export button.

### Contracts emitted
- **Content-picker postMessage contract.** Skeleton (Stream B's renderer output) must post `{ type: "veein:content-pick", key: "STORY_QUOTE", label: "Story quote" }` on element click when `?edit=1` is present in the URL. `SitePreview` forwards these to the dashboard's `picked` state.
- **`/api/versions?coupleId=…` endpoint** (GET) — Stream C should implement. Returns `SiteVersion[]` newest first.
- **`/api/restore` POST `{ coupleId, versionId }`** — already stubbed; dashboard calls it on "Switch to this design".
- **`/api/rsvp/export?coupleId=…&filter=…` GET** — CSV download URL Stream C should implement. Fallback client-side export still works if this 404s.
- **`/api/photos` POST multipart `{ file, coupleId }`** — existing stub; dashboard posts one file at a time and expects `{ url: string }` back per call.
- **Couple fetch via `/api/couple?id=…`** — dashboard expects this as the read-path. Not currently in the API stub list; Stream C should add, or we swap for a `/api/generate?read=1` convention.

### Follow-ups
- [ ] Replace `loadCouple()` fixture call with real `GET /api/couple?id=…` once Stream C ships the endpoint. Severity: low.
- [ ] Wire the Publish button into Stripe + `is_published=true` flow (plan §15). Severity: medium — required for M2.
- [ ] Share-preview link currently uses `placeholder-token`; needs a real preview-token flow once Stream C exposes `POST /api/preview-token`.
- [ ] Dashboard is currently static-generated (`○`). Once it depends on real auth/session, it'll flip to dynamic — non-breaking.

### Tests
- `npm run typecheck` clean.
- `npm run build` clean, 18/18 pages. Dashboard: 6.36 kB / 104 kB first load.
- `curl http://localhost:3000/dashboard` returns 200 with all five tab labels, share + publish buttons. The couple name populates client-side after the fixture `loadCouple` resolves (not visible in initial SSR — expected).

---

## Polish — Auth-aware UI on every authed page
**Completed:** 2026-04-26
**Branch:** `improve-cosmatic-issue`
**Files touched:** 5 (`src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/onboarding/step-2/page.tsx`, `src/components/auth/SignOutButton.tsx`)

### What was built
Two reported bugs resolved together:
1. The landing page (`/`) was a synchronous server component that ignored auth state — signed-in users saw the same "Sign in / Start yours" chrome as visitors, with no way to sign out anywhere in the app. Converted to async, reads `createClient().auth.getUser()`, and gates four surfaces (masthead, hero CTA, final CTA, footer) on `isAuthed`. Logged-in users now see "Sign out" + "Dashboard" / "Continue to your dashboard" CTAs.
2. The onboarding page rendered a "Prefer to sign in first?" CTA unconditionally. Since `/onboarding` is in the protected-page allowlist at `src/middleware.ts:36`, the visitor is always authenticated by the time this page renders — the CTA was dead code. Removed the paragraph; tightened the surrounding flex container.

Sign-out also added to dashboard, onboarding step 1, and onboarding step 2 via a new `<SignOutButton>` component (see DECISIONS [2026-11]). Sign-out is deliberately absent from `/w/[slug]` and `/preview/[token]` since those are guest-facing.

### Why (non-obvious decisions only)
See DECISIONS [2026-11] — chose to extract a small `<SignOutButton>` atom rather than a full `<AppHeader>` because the four headers' right-side content is too divergent to share without slot-prop sprawl.

### Contracts emitted
- `<SignOutButton>` from `@/components/auth/SignOutButton` — accepts `className`, wraps the existing `logout` server action. Usable from server or client component contexts.

### Follow-ups
- [ ] If we add a settings page that mirrors dashboard chrome, revisit and extract `<AppHeader>` then. Severity: low.
- [ ] A logged-in visitor with no completed onboarding will be sent to `/dashboard` from the new "Continue to your dashboard" CTA. Onboarding-completion gating is a separate concern.

### Tests
- `npx tsc --noEmit` clean.
- Bug doc at `doc/bugs/2026-04-26-auth-aware-landing-and-onboarding.md`.

---

## Polish — Onboarding overview + step 2 prefill (returning users)
**Completed:** 2026-04-26
**Branch:** `improve-cosmatic-issue`
**Files touched:** 5 frontend files (`src/app/onboarding/page.tsx`, `src/app/onboarding/step-2/page.tsx`, `src/components/onboarding/OnboardingStep1Form.tsx`, `src/components/onboarding/OnboardingStep2Form.tsx`, `src/components/onboarding/InvitationOverview.tsx`).

### What was built
The onboarding flow no longer loses returning users' state. Three changes:

1. **`/onboarding` is now a server dispatcher.** Authenticated user with an existing couple → shows a new editorial "ticket-stub" `InvitationOverview` card with Continue editing / Start over. New user → shows the step-1 form (extracted from the old page into `OnboardingStep1Form`). The dispatcher is what `login()` now redirects to, so returning users land on their invitation overview instead of a blank form.

2. **`InvitationOverview` (frontend-design skill).** Single-card layout matching the existing editorial system — paper background, `bg-ink` primary pill for *Continue editing*, quiet stone-tone link for *Start over*. The Start over flow opens a confirm dialog (`DELETE /api/couple` then `router.refresh()`) with explicit destructive copy ("There's no undo") and an outlined-blush confirm button. No click-outside-to-cancel, since destruction.

3. **Step 2 prefills from DB.** `/onboarding/step-2/page.tsx` is now a server component that fetches the couple by `?couple=…`, verifies ownership, and hands the row to `OnboardingStep2Form` as a prop. The client form initialises `style`, `vibe`, `story`, and `cultures` from the row — back-button navigation from the dashboard now restores everything, including interfaith secondary cultures (using the new `cultures jsonb` column landed in this same change). Submitting still UPDATEs the existing row; no duplicate invitations.

### Why (non-obvious decisions only)
See DECISIONS [2026-14]. Three rejected alternatives are recorded there; the most material one is "cache couple_id in a cookie to skip the DB lookup" — rejected because the overview shows live `Last saved …` data and would need invalidation on every dashboard edit.

### Contracts emitted
- `<InvitationOverview couple={CoupleData} />` — client component; consumes `DELETE /api/couple?id=…` on Start over.
- `<OnboardingStep1Form />` — client component, extracted from the old page.tsx with no behaviour change.
- `<OnboardingStep2Form couple={CoupleData} />` — client component, requires a couple prop. Replaces the old client component that read URL params.

### Follow-ups
- [ ] The dashboard's missing-param redirect is still client-side (`useEffect → router.push`). Server-side redirect would skip a render flicker. Severity: low.
- [ ] `InvitationOverview` displays cultures as title-cased ids (`hindu_indian` → `Hindu Indian`). A fancier display name would require importing the cultural library JSON — not worth the bundle weight today.

### Tests
- Manual: sign in as returning user → overview → Continue editing → dashboard. Browser-back on dashboard → overview. Browser-back on step 2 → prefilled form. Start over → confirm → fresh step 1.
- Bug doc at `doc/bugs/2026-04-26-onboarding-resume-and-overview.md`.
