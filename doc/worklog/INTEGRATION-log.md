# Integration log

Cross-stream integration events: daily merges, conflict resolutions, end-to-end test runs, seam fixes.

Written by the operator during daily merges and by whoever owns the integration session (usually Day 4–5 end-to-end wire-up).

Format is more freeform than stream logs — chronological, grouped by date.

---

## Template

```markdown
## YYYY-MM-DD — [merge / integration test / e2e run]

**What happened:**
Brief description.

**Conflicts / seams resolved:**
- types.ts addition from Stream B merged, unblocks Stream A's mock removal
- Stream C's /api/generate now returns real HTML, Stream A swapped fixture
- ...

**End-to-end state at end of session:**
What works, what doesn't.

**Next:**
What's unblocked for the next session.
```

---

<!-- ENTRIES BELOW THIS LINE -->

## 2026-04-23 — first full merge of Streams A, B, C

**Merged (in order):**
- Stream A (stream-a-frontend) — fast-forward, 4 phases: layouts, landing, onboarding, dashboard.
- Stream B (stream-b-engine) — non-ff merge. Conflicts in DECISIONS.md (duplicate [2026-03/04]) and ARCHITECTURE.md (both streams added to "Patterns introduced later"). Resolved: kept both sets of additions; renumbered Stream A's entries to [2026-05/06/07].
- Stream C (stream-c-backend) — non-ff merge. Same file conflicts. Resolved: kept Stream C's auth/chat-edit/restore/preview/photo-access sections in ARCHITECTURE.md; renumbered Stream C's DECISIONS entries to [2026-08/09/10]. Updated in-text DECISIONS refs (2026-03 → 2026-08, 2026-04 → 2026-09, etc.).

**Integration seam fixed:**
- `/api/generate/route.ts` was calling `generateSite({ quizAnswers, existingCoupleId })`, but Stream B's DECISION [2026-04] changed the engine input to `{ quizAnswers, couple: CoupleData, events? }`. Fix: fetch the couple and events before calling generateSite, pass them in. One-line import addition (`rowToEvent`).

**Sanity checks:** all green
- `npx tsc --noEmit`: clean
- `npm run build`: 13 routes generated, no errors
- `npm run test` (vitest): 8/8 files, 87/87 tests pass
- Secrets grep: no matches in src/components or src/app outside route handlers/server-only modules
- Raw Supabase URL grep in renderer: clean

**All 10 DECISIONS are uniquely numbered:**
[2026-01] Photo bucket private (operator)
[2026-02] Bucket names (operator)
[2026-03] Renderer STRUCTURED_KEYS split (B)
[2026-04] Pipeline accepts CoupleData (B)
[2026-05] {{RSVP_FORM}} owns form tag (A)
[2026-06] Content-picker postMessage (A)
[2026-07] Bilingual empty strings in v1 (A)
[2026-08] RSVP admin client INSERT (C)
[2026-09] Preview tokens as DB rows (C)
[2026-10] /api/photos returns paths (C)

**State at end of session:** main is ready for end-to-end smoke testing. Supabase buckets exist (operator confirmed). Migration applied. The three stream branches are now behind main (2 commits: Stream B merge, Stream C merge, seam fix) — can be deleted or kept for reference.

**Next:** operator runs `npm run dev`, signs up as a test couple, completes onboarding, verifies /w/[slug] returns styled HTML with couple names.

## 2026-04-23 — real integration day (catching what first-merge missed)

First pass merged the branches but did not actually integrate them. The
user's smoke test revealed Stream A was still entirely in fixture mode
on main. This pass is the real integration.

**Bugs found by runtime inspection + systematic grep:**

1. `AuthForm.tsx` — Stream A stub with a fake 450ms timer and a hardcoded
   "check your email" notice. Login form had no password field. Never
   called the server actions. (Already fixed in f442517.)
2. Dashboard defaulted `coupleId` to `"fixture-couple-00000000"` when URL
   param missing — would look up a non-existent couple row on every real
   user's first visit.
3. Dashboard "Share preview" link was hardcoded to `/preview/placeholder-token`.
4. Dashboard "Publish" button called `alert("Stream C wires this...")`
   instead of `/api/publish`.
5. Onboarding step 1 sent `{ quizAnswers }` to `/api/generate` but the
   route expects `{ step, answers }`. Read `coupleId` from response but
   the route returns `couple_id`.
6. Onboarding step 2 had no "finalise" call — cultural profile, ceremonies,
   style card never reached the DB.
7. `StructuredEditor` sent `{ coupleId, field, value }` — the `/api/structured`
   route expects `{ couple_id, couple: {...}, rsvp_config?, events? }`.
   Completely different shape.
8. `EditPanel` sent `{ coupleId, instruction, contentPickerTarget }` —
   route expects snake_case.
9. `VersionHistory` called `/api/versions` — Stream C never built the GET
   endpoint. Also used `{ coupleId, versionId }` for restore (expects snake_case).
10. `RSVPDashboard` called `GET /api/rsvp?coupleId=...` — Stream C only had
    POST on that route. No owner list endpoint.
11. `PhotoUpload` used `URL.createObjectURL` in dev mode always (regardless
    of USE_FIXTURES). Real path sent `{ file, coupleId }`, route expects
    `{ couple_id, files[] }`. Read `{ url }` from response but endpoint
    returns `{ photo_paths, results }` per DECISIONS [2026-10].
12. `/api/edit` passed `skeletonHtml: ""` to `runCall2` — Call 2's prompt
    embeds the skeleton so the AI knows which selectors to style. Empty
    = blind AI output.
13. All `USE_FIXTURES`-gated call sites defaulted to fixtures in dev.

**Fixes landed:**

- Added `GET /api/couple?id=<id>` (missing endpoint used by dashboard).
- Added `GET /api/versions?coupleId=<id>` (missing endpoint used by
  VersionHistory).
- Added `GET /api/rsvp?coupleId=<id>` as a second handler on the same
  path (POST remains public for guest submissions; GET is owner-only).
- Fixed every snake_case / camelCase shape mismatch between the 5 affected
  components and the 6 affected route handlers.
- Onboarding step 1 now sends `{ step: 1, answers }` and reads `couple_id`.
- Onboarding step 2 now commits cultural profile + ceremonies on finish
  via `{ step: 2, couple_id, answers }` to `/api/generate`.
- Dashboard no longer falls back to fake couple ID; redirects to onboarding
  if no couple param.
- Dashboard publish button calls `/api/publish`; share-preview button
  calls `/api/preview-token` and copies the URL to clipboard.
- PhotoUpload posts multipart with `files[]`, stores paths, resolves each
  via `/api/photos/sign` for thumbnail display.
- `/api/edit` loads skeleton HTML before Call 2.
- `USE_FIXTURES` flipped to `false` as a safety net for any gate I missed.
- Middleware now protects `/api/couple` and `/api/versions`.

**Sanity after fixes:**
- `npx tsc --noEmit` — clean
- `npm run build` — 15 routes generated (added 2 new ones), no errors
- `npm test` (vitest) — 87/87 pass
- Runtime probe: landing 200, signup 200, login 200, dashboard 307 (auth
  redirect), onboarding 307 (auth redirect), /w/[slug] 404 for nonexistent
  couple, /preview/[token] 404 for nonexistent token, all protected APIs
  return 401 unauthed, guest POST /api/rsvp returns 404 for invalid slug.
- Dev server boots clean; no compile errors or runtime exceptions in the
  first page-load cycle.

**Now ready for the real end-to-end smoke test** by the operator: signup,
onboarding step 1, preview, step 2, dashboard, /w/[slug] published view.

**Lesson:** "fast-forward merge + tests pass" is not integration. Next
integration day runs the app and hits real route/component boundaries
instead of relying on the merge being clean.
