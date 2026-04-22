# Decisions

## Decision: CSS JSON pipeline instead of HTML generation
Date: 2026-04-21
Status: Accepted

Context: We need the AI to produce distinctive-looking wedding sites,
but we also need deterministic layout and guaranteed working RSVP.
Having the AI produce whole HTML files makes both of those hard.

Decision: A single pre-built HTML skeleton. The AI returns a JSON
object describing visual tokens and copy. A renderer injects the
JSON into the skeleton.

Consequences: Layout is always correct. The RSVP form is always
present with the right fields. The AI's creativity is concentrated
on visual identity and copy, which is what differentiates sites.

Alternatives considered: Ask the AI for full HTML (rejected — too
easy to break), ask the AI to pick from pre-made templates
(rejected — not distinctive enough).

## Decision: theme_json is the source of truth
Date: 2026-04-21
Status: Accepted

Context: We have two representations of a site: the JSON Claude
produced, and the HTML file on Storage. Which is canonical?

Decision: `theme_json` in Postgres. The HTML is derived. If we ever
change the skeleton or the renderer, we can rebuild every site.

Consequences: Structured edits don't need to call Claude — we just
re-render. We can replay generations. The HTML file is effectively
a cache.

## Decision: injectStructured runs last
Date: 2026-04-21
Status: Accepted

Context: The AI might hallucinate names, venues, or dates in the
copy. We need a guarantee that real data always wins.

Decision: In `buildSite()`, `injectContent()` runs first (AI copy),
then `injectStructured()` runs last (DB data). The two sets of
placeholders are disjoint so there's no conflict, but running
structured last is the safety guarantee.

## Decision: Validator never throws
Date: 2026-04-21
Status: Accepted

Context: Claude's JSON output can have typos, missing keys,
unapproved fonts, layout-breaking CSS, or flat-out malformed input.

Decision: Every validator function wraps its logic in try/catch and
returns a sensible default for every field. `validateAll(null)`
returns a valid ValidationResult.

Consequences: The generation pipeline can't crash from AI output
alone. Warnings are logged to the console in development.

## Decision: /w/[slug] is a route handler, not a page
Date: 2026-04-21
Status: Accepted

Context: The wedding site HTML is self-contained. Wrapping it in a
Next.js page injects React runtime and the app layout.

Decision: Use `route.ts` and return the HTML directly as a
Response with `Content-Type: text/html`.

Consequences: Zero bytes of app shell on guest pages. Fast,
standalone, works on any browser.

## Decision: Single shared skeleton, never modified post-Phase 0
Date: 2026-04-21
Status: Accepted

Context: If the skeleton changes, every rebuilt site changes. That
might be intentional, but we want changes to be loud and deliberate.

Decision: Treat the skeleton as a versioned artifact. Never edit it
casually. If it must change, treat it as a dedicated ticket.

## Decision: ADMIN_MIGRATION_SECRET kept even though not used yet
Date: 2026-04-21
Status: Accepted

Context: The prompt supplied an `ADMIN_MIGRATION_SECRET` env var.

Decision: Include it in `.env.local` and `.env.example`. If/when an
admin migration endpoint is added, it will gate on this.

## Decision: Build environment did not have npm or Supabase access
Date: 2026-04-21
Status: Accepted

Context: The sandbox used for initial build could reach neither
`registry.npmjs.org` nor `cevoidbewtgryfksqhnl.supabase.co`.

Decision: Write all code, static-check it, and leave `npm install`,
the SQL migration, the Storage-bucket creation, and live end-to-end
testing to the developer's first run.

Consequences: The developer has a small first-run checklist in
`README.md` / `CLAUDE.md` / `CONTEXT.md`.
