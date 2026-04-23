# Worklogs

One worklog per stream. Each stream appends an entry at the end of every phase.

## When to write a worklog entry

**After finishing a phase** (not after every commit — that's what git log is for). A phase is a row in the ticket's work breakdown (e.g. Stream B's "Phase 2 — Renderer", Stream A's "Phase 1 — Layout library").

If a phase takes multiple commits, write ONE worklog entry when the phase is done, summarising the whole phase.

## Format — copy-paste this template

```markdown
## Phase N — [Phase name]
**Completed:** YYYY-MM-DD
**Commits:** abc1234, def5678 (range)
**Files touched:** N files

### What was built
One paragraph. The deliverable in human terms — not a file list.

### Why (non-obvious decisions only)
Only things a future reader could not derive from the code. Example:
"Used auto-fit grid for events instead of fixed 3-column because cultural
profile can return 2–6 ceremonies. 3-column would break for 2 events
(awkward spacing) and 6 events (overflow)."

Skip this section if the phase had no interesting decisions.

### How (for complex phases only)
The algorithm or pattern, in plain English. Only for phases with
non-trivial logic (renderer pipeline, cultural ceremony algorithm, etc).

Skip if the phase was straightforward.

### Contracts emitted
What other streams can now consume:
- `fn(x)` exported from `src/lib/...`
- `POST /api/...` endpoint accepting `{ ... }`
- `{{TOKEN}}` placeholder in skeletons
- DB column `foo.bar` added

### Follow-ups
- [ ] TODO X — reason
- [ ] Known issue Y — severity low/med/high
- [ ] M2 extension point Z

### Tests
- `tests/foo.test.ts` — verifies X, Y, Z
```

## Quality bar

- **Write it the same day you finish the phase** — not a week later when you've forgotten why.
- **Under 300 words per entry.** If you need more, you're probably explaining code that should have clearer naming or a decision that should go in DECISIONS.md.
- **Skip empty sections.** If a phase had no non-obvious decisions, omit the Why section. Don't pad.
- **No TODO-dump.** Follow-ups are real work items or known risks — not wishlist.

## What does NOT go in a worklog

- Line-by-line code narration (read the diff)
- Commit-message content (already in git log)
- Planning for future work (that's for DECISIONS.md or a TODO)
- Retrospective feelings / self-review

## What goes in DECISIONS.md instead

If a decision affects multiple streams, or the trade-off is load-bearing for the architecture, it belongs in `doc/DECISIONS.md` — not just a worklog entry. Worklogs are per-stream narrative. Decisions are cross-cutting.

## What goes in ARCHITECTURE.md instead

If a phase introduced a new system-level pattern (e.g. "all photos now flow through `{{PHOTO:...}}` markers"), add or update the relevant section of `doc/ARCHITECTURE.md`. The worklog entry then references it ("Introduced photo-marker pattern — see ARCHITECTURE.md §Photos").
