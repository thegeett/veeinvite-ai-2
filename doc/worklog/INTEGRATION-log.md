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
