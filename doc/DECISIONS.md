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

<!-- NEW ENTRIES BELOW THIS LINE -->

## [2026-03] Skeleton `{{RSVP_FORM}}` expansion owns the `<form>` tag; slug compliance marker is orphan
**Date:** 2026-04-23
**Stream:** A
**Status:** Accepted

### Context
Plan §7 requires the skeleton to contain `<input type="hidden" name="slug" value="{{SLUG}}">` (per the §8 review checklist) AND says `{{RSVP_FORM}}` expands to the "complete form HTML built from rsvp_config + events + content" — i.e. including the `<form>` tag. Those two instructions conflict: if the skeleton wraps the placeholder in its own `<form>` and the renderer injects another, the result is nested forms (invalid). If the skeleton puts the slug input inside the placeholder region, `{{SLUG}}` isn't literally in the skeleton source for the review checklist.

### Decision
The skeleton places `<input type="hidden" name="slug" value="{{SLUG}}">` as a sibling of the `{{RSVP_FORM}}` placeholder, outside any form — it is a compliance marker only, verified by grep. Stream B's `buildRSVPForm()` expansion MUST begin with `<form id="rsvp-form" class="rsvp-form" method="post" action="/api/rsvp">` and include its own `<input type="hidden" name="slug" value="...">` inside the form body. The skeleton's inline JS binds to `document.getElementById('rsvp-form')`.

### Consequences
- Stream B owns the complete form element (tag, method, action, all fields including the slug).
- The skeleton's orphan slug input submits nothing — it is documentation, not data.
- Cross-stream contract: the form id `rsvp-form` is fixed. Renderer must use it so the skeleton's submit handler attaches.
- `{{RSVP_SUCCESS_TITLE/MESSAGE}}` live in a sibling `<div id="rsvp-success">` that the skeleton JS shows on submit. The form and success div are siblings, not nested.

### Alternatives considered
- **Have the skeleton own a `<form>` wrapper, renderer injects fields only** — cleaner semantics, but the plan explicitly says `{{RSVP_FORM}}` is "complete form HTML". Rejected to preserve the plan-as-written.
- **Omit the orphan slug marker and fail the §8 checklist line** — would violate the definition of done. Rejected.
- **Put the slug marker inside a `<template>` tag** — valid HTML, but semantics suggest "this will be activated later", which is wrong. Rejected.

---

## [2026-05] Content-picker uses `window.postMessage`, not cross-origin callbacks
**Date:** 2026-04-23
**Stream:** A
**Status:** Accepted

### Context
Plan §30 describes a content picker where clicking on text in the preview iframe adds that element's placeholder key (e.g. `STORY_QUOTE`) as chat context. The preview iframe is `/w/[slug]` — a self-contained page the renderer produces, potentially served from a different origin in M2. React callbacks cannot cross iframe origin boundaries.

### Decision
When the dashboard renders the preview iframe with `?edit=1` in the URL, Stream B's skeleton JS opts into edit mode: on any click of a text-bearing element, it calls `window.parent.postMessage({ type: "veein:content-pick", key, label }, "*")`. The dashboard's `SitePreview` component listens on `window` for `message` events and forwards matching payloads up to dashboard state. Origin can be tightened in production but is wildcarded in dev.

### Consequences
- Stream B must add the picker listener to skeleton JS when `?edit=1` is in the URL. That listener is bounded — no listener when guests view the published site.
- The `key` vocabulary is shared: placeholder tokens (`STORY_QUOTE`, `STORY_HEADING`, …) and CSS selectors (`.hero-names`, `.event-card`). The dashboard's element-label map lives in `SitePreview.tsx` and must mirror §30's `ELEMENT_LABELS`.
- Element-picker (phase 2) can reuse the same `postMessage` channel with a different payload `type`.

### Alternatives considered
- **Same-origin imperative access via `iframe.contentWindow`** — fails once preview moves to a separate domain (M2+), and requires same-origin restrictions to hold throughout development. Rejected.
- **Shared `BroadcastChannel`** — works across same-origin tabs but not across iframes reliably. Rejected.

---

## [2026-04] Bilingual placeholders resolve to empty strings in v1 (§33 accommodation, not activation)
**Date:** 2026-04-23
**Stream:** A
**Status:** Accepted

### Context
Plan §33 specifies that v1 must *accommodate* bilingual rendering without *activating* it. Skeletons include `{{PERSON1_NAME_BILINGUAL}}`, `{{PERSON2_NAME_BILINGUAL}}`, `{{WEDDING_DATE_BILINGUAL}}`, `{{VENUE_NAME_BILINGUAL}}` in the footer. If these tokens remain as literal `{{...}}` in rendered HTML, guests see broken placeholders.

### Decision
Skeletons wrap bilingual output in spans with class `bilingual-secondary`. A `.bilingual-secondary:empty { display: none; }` CSS rule hides them when empty. Stream B's renderer MUST substitute bilingual placeholder tokens with empty strings in v1 — not leave them as literal `{{...}}`. When M2 activates bilingual, the renderer substitutes real values and the spans become visible automatically with no skeleton change.

### Consequences
- Zero visible effect in v1 (spans are empty → display:none).
- M2 activation requires only: `CulturalProfile.bilingualFields` populated + renderer substitutes the tokens. No skeleton edit.
- Stream B contract: all four bilingual tokens must be in the renderer's substitution map, defaulting to empty string.

### Alternatives considered
- **Omit bilingual placeholders in v1, add them when M2 lands** — would require touching all four skeletons in M2, violating Rule 2 ("never modify skeleton files after Phase 1"). Rejected.
- **Use a feature flag to conditionally include bilingual markup** — complicates the renderer contract for no gain. The empty-span approach is already conditional visually. Rejected.

