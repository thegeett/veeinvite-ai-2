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

<!-- NEW ENTRIES BELOW THIS LINE -->
