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
