# STREAM-0: Day Zero — Foundational Contracts

**Sequential. Single Claude Code session. Must complete and merge to `main` before Streams A / B / C can start.**

---

## Summary

Day 0 establishes the shared contracts that let three parallel streams work without stepping on each other. After Day 0 merges, the three streams read from the same `types.ts`, `cultural-content-library.json`, and `schema.sql` — so they never block on "what does a `CulturalProfile` look like?"

Everything in Day 0 is a commit to `main`. Streams A, B, C branch from that commit.

---

## Prerequisites

- Empty (or current) repo at `/Users/geetthaker/Geet/project/veeinvite-ai-2/`
- Supabase project created + service role key available
- Anthropic API key available
- `doc/VEEINVITE_PRODUCT_PLAN.md` present (this is the canonical spec)
- `doc/cultural-content-library.json` present

---

## Work Required

### 1. Verify / initialise the Next.js 14 app

- `package.json` with Next.js 14 App Router, TypeScript strict, Tailwind, Supabase JS client, Anthropic SDK
- `tsconfig.json` with strict mode
- `next.config.mjs`
- `tailwind.config.ts` — for dashboard styling only (generated sites don't use Tailwind)
- `.env.local.example` listing all env vars from plan §23
- `.gitignore` including `.env.local`, `.next`, `node_modules`

### 2. Write `src/lib/types.ts` — canonical type contract

This is the single most important deliverable of Day 0. Every type the three streams consume is defined here. Sources:

- `GlobalTokens`, `ThemeJSON`, `ParticleConfig`, `ContentMap`, `StylesMap`, `ValidationResult` — from plan §9, §10
- `Layout`, `LayoutMeta` — from plan §6
- `CulturalProfile`, `ContentItemDefinition`, `FieldDefinition`, `CeremonyDefinition`, `SectionType`, `SubRegionCeremonies`, `DisplayCeremony`, `CultureDefinition` — from plan §26
- `RSVPConfig` — from plan §29
- `QuizStep1Answers`, `QuizStep2Answers`, `StyleCard` — from plan §25, §28
- `CoupleData`, `EventData`, `RSVPData`, `SiteVersion` — from plan §23 schema
- `AIEditClassification` — from plan §12, §30

**Rule:** No engine/renderer logic in this file. Types only. Streams B and C read it; Stream A uses it for prop types.

### 3. Move `cultural-content-library.json` to its final location

```bash
mv doc/cultural-content-library.json src/lib/cultural-content-library.json
```

Add `import library from "./cultural-content-library.json"` export helper in `src/lib/cultural/library-loader.ts` (stub — Stream B fills in algorithms).

### 4. Write `supabase/migrations/001_init.sql`

Full schema per plan §23 **plus** the new columns from §24, §26, §29, §33:

- `couples.cultural_profile JSONB DEFAULT '{}'`
- `couples.rsvp_config JSONB DEFAULT '{}'`
- `events.event_type TEXT` (the ceremony ID from the cultural library)
- `events.dress_code TEXT`
- `rsvps` full expanded columns per §29 (events_attending, children_count, plus_one_name, meal_choice, song_request)
- `site_versions.global_tokens JSONB`

Include RLS policies:

- `couples` — user can read/write only their own row
- `events` — inherits from couples
- `rsvps` — anyone can INSERT (guest submissions), only couple owner can SELECT
- `site_versions` — only couple owner can SELECT

### 5. Write `CLAUDE.md` at repo root

This file is loaded automatically by every Claude Code session in this repo. It must contain:

- One-sentence description of VeeInvite
- Pointer: "Read `doc/VEEINVITE_PRODUCT_PLAN.md` before writing any code"
- The architecture rules from plan §21 (copy-paste the 15 rules verbatim)
- The stream ownership table (who owns what directory)
- The "frontend-design skill for all UI work" rule
- Pointer to the cultural library and how to read it
- Pointer to `doc/tickets/STREAM-{A,B,C}-*.md`

Keep it under 150 lines. This is context-window-priced on every session start.

### 6. Write empty stub files so imports resolve

Each stream needs the others' exports to exist (even as stubs) for TypeScript to compile during parallel work:

```
src/lib/validator/index.ts       — exports validateAll() returning empty ValidationResult
src/lib/renderer/index.ts        — exports render() returning empty string
src/lib/layoutSelector.ts        — exports selectLayout() returning "layout-1"
src/lib/ai/prompt.ts             — exports buildCall2Prompt etc. returning ""
src/lib/ai/generate.ts           — exports generate*() returning mock objects
src/lib/cultural/library.ts      — exports getCeremoniesForCouple() returning []
src/lib/rsvp/config.ts           — exports buildRSVPForm() returning ""
src/lib/supabase/client.ts       — exports createClient (real Supabase JS client)
src/lib/supabase/server.ts       — exports createClient (real server client)
src/middleware.ts                — passes everything through (Stream C replaces)
src/app/api/generate/route.ts    — returns 501 Not Implemented
src/app/api/edit/route.ts        — returns 501
src/app/api/structured/route.ts  — returns 501
src/app/api/rsvp/route.ts        — returns 501
src/app/api/restore/route.ts     — returns 501
src/app/api/publish/route.ts     — returns 501
src/app/api/custom-section/route.ts — returns 501
src/app/api/photos/route.ts      — returns 501
src/app/api/preview-token/route.ts — returns 501
src/app/w/[slug]/route.ts        — returns "Coming soon"
src/app/preview/[token]/route.ts — returns "Coming soon"
```

Every stub is typed correctly per `types.ts` so Streams A/B/C compile from day one.

### 7. Verify `npm run dev` starts without errors

Stubs must compile. Homepage can be a placeholder — Stream A replaces it.

### 8. Commit to `main`

```bash
git add -A
git commit -m "Day 0: contracts, schema, stubs, ticket docs"
```

(No `git push` — this project is local-only for now. If a remote is added later, push at that point.)

### 9. Create the three worktrees and branches

```bash
cd /Users/geetthaker/Geet/project/veeinvite-ai-2
git worktree add ../veeinvite-frontend -b stream-a-frontend
git worktree add ../veeinvite-engine   -b stream-b-engine
git worktree add ../veeinvite-backend  -b stream-c-backend
```

---

## Acceptance Criteria

- [ ] `npm run dev` starts with no TypeScript errors
- [ ] `npm run build` succeeds
- [ ] `src/lib/types.ts` exports every type the three streams consume
- [ ] Supabase migration applies cleanly to a fresh database
- [ ] RLS policies tested with a non-owning user → 403
- [ ] `CLAUDE.md` exists at repo root and is under 150 lines
- [ ] All three worktrees created
- [ ] `doc/tickets/STREAM-{A,B,C}-*.md` exist (already generated — just verify)

---

## Definition of Done

Three worktrees exist on disk, each with a branch pointing to the Day-0 commit. Opening `claude` in any of them gives that session a codebase that compiles. The three streams can now start in parallel.

---

## First prompt for the Day-0 session

> Read `doc/VEEINVITE_PRODUCT_PLAN.md` in full, then execute `doc/tickets/STREAM-0-day-zero.md` end to end. This is the foundational contracts commit — everything you build is consumed by three parallel streams after this merges. Be complete: if types.ts is missing anything the streams need, they will block. Commit once at the end with message "Day 0: contracts, schema, stubs, ticket docs".
