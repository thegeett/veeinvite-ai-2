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
