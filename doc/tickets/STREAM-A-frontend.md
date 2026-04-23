# STREAM-A: Frontend — Layouts, Onboarding, Dashboard, Landing

**Parallel stream. Worktree: `../veeinvite-frontend`. Branch: `stream-a-frontend`.**

---

## Summary

Everything the couple or guest sees with a browser. Four HTML skeletons, landing page, auth pages, two-step onboarding quiz, dashboard (preview + chat edit + structured editor + version history + RSVP dashboard). No API routes, no database code, no validator/renderer logic.

**Every React component in this stream must be built via the `frontend-design` skill.** Invoke it before writing each component. This is a standing instruction — see `CLAUDE.md`.

---

## Scope (plan §§ references)

| Phase | What | Plan § |
|-------|------|--------|
| 1 | 4 layout skeletons + meta.json | §6, §7, §8 |
| 8 | Fast 2-step onboarding (quiz) | §28 |
| 9 | Dashboard core — preview + chat + editor | §12, §30 |
| 10 | Version history UI ("Your designs") | §11 |
| 11 | RSVP dashboard UI | §16 VI-F013 |
| 13 | Landing page | §16 VI-F016 |
| — | Cultural profile configurator UI | §26 VI-F011 |
| — | Photo gallery upload UI | §16 VI-F017 |

---

## Prerequisites

Day 0 merged to `main`. You should see:

- `src/lib/types.ts` with every type you need to import
- `src/lib/cultural-content-library.json` at its final location
- `CLAUDE.md` at repo root
- API route stubs at `src/app/api/**` returning 501 (you will call these; they'll return mock data until Stream C fills them in)

---

## File Ownership

### OWNS — write freely

- `layouts/layout-1-modern/skeleton.html`, `meta.json`
- `layouts/layout-2-romantic/skeleton.html`, `meta.json`
- `layouts/layout-3-grand/skeleton.html`, `meta.json`   *(renamed from "south-asian" — plan §6)*
- `layouts/layout-4-editorial/skeleton.html`, `meta.json`
- `src/app/page.tsx` (landing)
- `src/app/layout.tsx` (root layout — only top-level Providers, no global styling beyond Tailwind reset)
- `src/app/auth/login/page.tsx` (UI only — Stream C wires server actions)
- `src/app/auth/signup/page.tsx` (UI only)
- `src/app/onboarding/page.tsx` and subroutes
- `src/app/dashboard/**/*.tsx`
- `src/components/**/*`
- `src/app/globals.css`
- `tailwind.config.ts`
- `src/lib/fixtures/*.ts` — mock data for dev while Stream C's APIs are stubs
- `public/**` — static assets

### READS — do not edit

- `src/lib/types.ts` (Stream B owns; propose changes via PR comment)
- `src/lib/cultural-content-library.json` (Stream B owns)

### NEVER TOUCHES

- `src/app/api/**` — Stream C
- `src/app/w/[slug]/*` — Stream C
- `src/app/preview/[token]/*` — Stream C (the shareable preview is a server-rendered route, not a React page)
- `src/lib/validator/**`, `src/lib/renderer/**`, `src/lib/ai/**`, `src/lib/cultural/**`, `src/lib/rsvp/config.ts` — Stream B
- `src/lib/supabase/**`, `src/middleware.ts`, `supabase/**` — Stream C

---

## Work Breakdown

### Phase 1 — Layout library (§7, §8)

For each of 4 layouts:

1. Build `skeleton.html` strictly per §7:
   - Shared HTML structure (nav, sections, footer, scripts)
   - Shared CSS baseline (allowed/forbidden CSS, scroll reveal, mobile breakpoints)
   - Shared JS (scroll reveal, FAQ accordion, RSVP submit UI, nav smooth scroll)
   - **Nav anchor IDs frozen:** `#story #events #rsvp #gallery #faq` (architecture rule 13)
   - **Dynamic events:** use `{{EVENTS_CARDS}}` single placeholder (§26). Do NOT hardcode EVENT_1 through EVENT_3 slots.
   - **RSVP form:** use `{{RSVP_FORM}}` single placeholder (§29). The renderer injects the data-driven form. Do NOT hardcode the RSVP fields in skeletons.
   - Bilingual-ready per §33: include `[dir="rtl"]` CSS overrides, `{{PERSON1_NAME_BILINGUAL}}` etc. (resolve to empty in v1 — Stream B handles)
   - Layout-specific structural CSS per §7 (story / events / rsvp / gallery treatments)

2. Build `meta.json` per §6 — strip culture-specific tags from Layout 3 (now "Grand Celebration"). Tags are structural only: `grand, celebratory, ornate, luxury, multi-event, rich, dramatic`.

3. Run the §8 skeleton review checklist before marking the layout done. Every box must tick.

**Invoke `frontend-design` skill once per layout before you start the section-specific CSS work.**

### Phase 13 — Landing page

`src/app/page.tsx`. Distinctive design — avoid generic AI aesthetic. Hero, value prop, showcase of the 4 layouts + cultural variety, signup CTA.

Invoke `frontend-design` skill for the full page.

### Phase 8 — Fast onboarding (§28)

Two-step flow at `/onboarding`:

**Step 1** (≤30s):
- Couple names (person1 + person2)
- Wedding date (date picker)
- Venue name + city
- Submit → call `POST /api/generate` → navigate to dashboard with preview

**Preview between steps 1 and 2:**
- Show the generated site in an iframe on the right
- Progress indicator UI per §28 ("Your site is coming together ▓▓▓▓░ 70%")

**Step 2** (alongside preview):
- Style card picker (7 cards per §27 tags table)
- Vibe words input (3 words — free text, mapped to tags via Stream B dictionary)
- Cultural configurator per §26:
  - Culture multi-select
  - Sub-region select (conditional on culture)
  - Content items checklist (pre-selected per library defaults)
  - Ceremonies checklist (pre-selected + "also available" from algorithm)
  - Interfaith conflict UI (when multiple cultures selected — surfaces conflicts, never silent-resolves)
- Story textarea
- Each answer triggers `POST /api/edit` and regenerates the relevant part

Invoke `frontend-design` skill for the quiz shell, the style-card picker, and the cultural configurator (three separate invocations — each is a distinctive surface).

### Phase 9 — Dashboard core

`src/app/dashboard/page.tsx`. Three-pane layout:

1. **SitePreview** (center) — iframe to `/w/[slug]` with mobile/desktop toggle (375px vs full). Content picker per §30 — click listener in iframe posts selected element key to parent.

2. **EditPanel** (right or bottom) — chat input, suggested prompts as chips (§12), content-picker context chip (§30), send → `POST /api/edit`.

3. **StructuredEditor** (tab in right pane) — direct edit of names, date, venue, events, rsvp_config. Every change → `POST /api/structured`. No AI involvement.

Invoke `frontend-design` skill for the dashboard shell, the preview/toggle bar, and the edit panel (three invocations).

### Phase 10 — Version history UI ("Your designs")

Panel in dashboard. List of versions (thumbnail or label + date + instruction). "Switch to this design" button per row (never "Restore"). § 11 UX language.

Invoke `frontend-design` skill.

### Phase 11 — RSVP dashboard UI

Panel or tab showing submitted RSVPs. Filter by event (for multi-event cultures). CSV export button (calls Stream C's export endpoint). Table with columns: name, email, attending, guest count, events attending, dietary, message.

Invoke `frontend-design` skill.

### Photo upload UI (VI-F017, §16)

In the dashboard. Upload → `POST /api/photos`. On success, the generated site's gallery placeholders get replaced. No image cropping in M1 — just direct upload + thumbnail preview.

---

## Development Pattern — Mock First, Wire Later

Until Stream C's API routes return real data, every API call in this stream reads from `src/lib/fixtures/*.ts` in dev mode. Ship the fixtures as typed objects matching `types.ts`. When Stream C merges their real routes, replace fixture imports with `fetch()` calls. **Commit the fetch calls; do NOT commit fixture imports in feature code.** Fixtures belong only in tests/stories.

Example:

```ts
// Good — dev-only gate
const data = process.env.NODE_ENV === "development" && USE_FIXTURES
  ? fixtures.coupleData
  : await fetch("/api/couple").then(r => r.json())

// Bad — hardcoded fixtures in feature code
const data = fixtures.coupleData
```

---

## Coordination

- **Commit per phase.** Merge to `main` after each phase so Streams B and C see your skeletons.
- If you need a type that's missing from `types.ts`, don't add it yourself — drop a note in the commit message (`NEEDS TYPE: GuestListEntry`) and Stream B adds it.
- **Do not touch `src/lib/types.ts`.** Read-only for this stream.
- Integration day (Day 4) — you pair with Stream C to replace fixtures with real API calls.

## Documentation — required at end of every phase

1. **Worklog** — append a new entry to `doc/worklog/STREAM-A-log.md` at the end of every phase. Template and format rules in `doc/worklog/README.md`. Under 300 words per entry. Skip empty sections.
2. **DECISIONS.md** — if you made a non-obvious product/design decision (e.g. "onboarding reveals step 2 progressively rather than as a separate page because..."), add an entry to `doc/DECISIONS.md`.
3. **ARCHITECTURE.md** — if your phase introduced a new system-level pattern (e.g. the content-picker postMessage contract between iframe and parent dashboard), add or update a section in `doc/ARCHITECTURE.md`.

A phase is not "done" until its worklog entry is written and committed. This is part of the definition of done.

---

## Acceptance Criteria

- [ ] All 4 skeletons pass the §8 review checklist (browser-verified at 390px + desktop)
- [ ] `layouts/*/meta.json` has no culture-specific tags on Layout 3
- [ ] Landing page renders and reaches 90+ Lighthouse score
- [ ] Onboarding step 1 completes in ≤30 seconds on your machine
- [ ] Cultural configurator loads the library, shows sub-regions, pre-selects correctly for `hindu_indian/tamil` test case
- [ ] Dashboard preview pane shows the generated site in an iframe with working mobile/desktop toggle
- [ ] Chat edit sends to `/api/edit` and preview reloads
- [ ] Version history shows labels + dates + "Switch to this design"
- [ ] RSVP dashboard shows mock submissions with CSV export
- [ ] Every component was scaffolded via the `frontend-design` skill
- [ ] `npm run build` succeeds
- [ ] No imports from `src/lib/validator`, `renderer`, `ai`, `supabase` (verify with grep)

---

## Definition of Done

A freshly-built site can be generated from onboarding → dashboard → preview on your laptop, using Stream C's real APIs after their merge. Every user-facing surface feels distinctive and polished — not generic AI UI.

---

## First prompt for the Stream A session

> Read `doc/VEEINVITE_PRODUCT_PLAN.md` (skim for context, deep-read §§5–8, 11, 26, 28, 29, 30, 33), `CLAUDE.md`, `doc/worklog/README.md`, and `doc/tickets/STREAM-A-frontend.md`. Execute the ticket end to end, starting with Phase 1 (layout library). Use the `frontend-design` skill for every component and distinctive UI surface. After each phase, append a worklog entry to `doc/worklog/STREAM-A-log.md` before moving on — a phase isn't done until the worklog is written. Log any non-obvious decisions in `doc/DECISIONS.md` and update `doc/ARCHITECTURE.md` if you introduce a new cross-cutting pattern. Commit after each phase. Do not touch any file outside your ownership list. If you need a type that's not in `types.ts`, flag it in a commit message and mock around it — don't edit types.ts.
