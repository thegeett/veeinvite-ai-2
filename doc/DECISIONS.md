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

## [2026-03] RSVP INSERT uses admin client; validation runs server-side
**Date:** 2026-04-23
**Stream:** C
**Status:** Accepted

### Context
Guest RSVP submissions are public — no session. The RLS policy on `rsvps` allows any anonymous INSERT, but that alone is not enough: a guest could post an arbitrary `events_attending` array containing ceremony IDs the couple never confirmed, inflate `guest_count` past the couple's `rsvp_config.guestCountMax`, or submit for unpublished couples.

### Decision
`POST /api/rsvp` uses the service-role client for INSERT and performs four server-side checks before writing:
1. Couple exists by slug, and `is_published = true`.
2. Each `events_attending` ID matches an event row (by id or event_type) actually belonging to this couple.
3. Numeric fields are clamped against the couple's `rsvp_config` (guestCountMax, childrenMax).
4. Gated fields (plus_one_name, meal_choice, dietary, song_request, message) are null-masked when the corresponding `*Enabled` flag is false.

### Consequences
- The client cannot forge ceremony attendance, inflate headcounts, or attach fields the couple disabled.
- The shape of the RSVP row is constrained by `rsvp_config` at server time, so enabling/disabling a field in the dashboard takes effect on the next submission with no cache invalidation needed.
- Future anti-spam layers (rate limit, CAPTCHA, hCaptcha) plug into the same handler, not into RLS.

### Alternatives considered
- **Rely on RLS policy alone (public INSERT).** RLS cannot express "events_attending must be a subset of this couple's events" — that's a cross-row predicate. Rejected.
- **Use the anon client with a Postgres trigger enforcing the predicates.** Would work, but shifts policy into Postgres where Stream C has less visibility. Rejected to keep business rules in TypeScript.

---

## [2026-04] Preview tokens are DB rows, not JWTs
**Date:** 2026-04-23
**Stream:** C
**Status:** Accepted

### Context
Shareable preview links (§32 Hook 3) need an expiry and, ideally, a revocation path if a couple later regrets a share. A stateless JWT would be attractive (nothing to clean up), but revocation would require a blocklist.

### Decision
Preview tokens are rows in a dedicated `preview_tokens` table with `(token text pk, couple_id uuid, expires_at timestamptz)`. The `/preview/[token]` route handler looks up the row; a missing row or `expires_at < now()` serves the expired page. Revocation is a DELETE.

### Consequences
- Revocation is trivial (row delete), which matters for "this preview is being passed around more than I expected".
- We gain observability: the row's `created_at` tells us when a preview was minted, useful for abuse investigation.
- Cleanup is a periodic `DELETE FROM preview_tokens WHERE expires_at < now()` — operator task; not urgent because expired rows fail closed.

### Alternatives considered
- **Signed JWT with exp claim.** Stateless, but no revocation without a blocklist — and if we build a blocklist, we may as well have a stateful table. Rejected.
- **Store only in storage metadata on `preview-sites/{token}.html`.** Harder to query, harder to list active previews, no good cleanup primitive. Rejected.

---

## [2026-05] `/api/photos` returns storage paths, never signed URLs
**Date:** 2026-04-23
**Stream:** C
**Status:** Accepted

### Context
The photo upload endpoint needs to tell the client what it just stored. An obvious answer is to return a signed URL the dashboard can immediately display. But signed URLs expire — storing them in `couples.photo_urls` or passing them through the session would age badly.

### Decision
`POST /api/photos` returns `{ photo_paths: string[] }` — the raw storage paths (e.g. `<coupleId>/<uuid>.jpg`). The dashboard fetches a short-lived signed URL per thumbnail via `GET /api/photos/sign?path=...` (10-minute expiry, owner-only). `couples.photo_urls` stores paths, not URLs. The public site serves via the `{{PHOTO:path}}` marker substitution in `/w/[slug]`.

### Consequences
- Every access to a photo goes through a signing hop — no durable URL is ever persisted or leakable.
- DB migrations never need to rewrite photo URLs when we change bucket names or signing policy.
- Cost: an extra round-trip per thumbnail in the dashboard. Acceptable — dashboards are low-traffic, and thumbnails are small.

### Alternatives considered
- **Return a 7-day signed URL from `/api/photos` and cache in the dashboard.** Leaks for 7 days if the session cookie is stolen or the URL is passed around. Rejected (same logic as DECISION [2026-01]).
- **Public bucket but obscured paths.** Already rejected in DECISION [2026-01].
