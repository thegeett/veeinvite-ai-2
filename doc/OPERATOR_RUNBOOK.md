# Operator Runbook

The playbook you (the human) follow while three Claude Code sessions build VeeInvite in parallel. Your job is **orchestration and quality control — not writing code.**

This runbook is ~30 minutes of work per day. Follow it and the build ships cleanly.

---

## Your four responsibilities

1. **Kick off / resume** the three Claude Code sessions
2. **Merge** daily — stream branches → main, then back out to worktrees
3. **Sanity check** — build, types, secrets, docs, ownership
4. **Unblock** — answer session questions, resolve cross-stream conflicts

Everything else (writing code, picking tools, solving bugs) belongs to the three sessions. **Don't do their work. Don't micromanage.** If you find yourself writing code, you've stepped into the wrong lane.

---

## Daily routine — five phases

### Phase 1 — Morning kickoff (5 min)

Take a snapshot of where things are:

```bash
cd /Users/geetthaker/Geet/project/veeinvite-ai-2
git log --oneline -5           # what landed in main yesterday
git log --all --oneline -15    # what's on every branch
git worktree list              # verify three worktrees still exist
```

For each of the three worktrees, either:

- **New session** (first time only): open terminal → `cd` to worktree → `claude` → paste first prompt from the ticket
- **Resume session** (every other day): open terminal → `cd` to worktree → `claude --resume` → type "continue the next phase"

Sessions remember their tickets. You don't re-paste prompts.

### Phase 2 — During the day (ambient — ~0 min)

Sessions run in their windows. You don't watch them.

**Check in briefly** every few hours for:
- A session prompt asking you a question (shows in the window)
- A session that's just completed a phase (shows up as a new commit)
- Long silence (session may be waiting for input)

**Do not:**
- Read every line of output
- Interrupt unless actually blocked
- Ask "are you done yet"
- Jump in to write code yourself

### Phase 3 — End-of-day merge (15 min)

Do this once per day. Handle streams one at a time — don't parallelise merges.

#### For each stream (frontend, engine, backend):

**Step 3.1 — Verify the stream's state**

```bash
cd ../veeinvite-frontend          # or ...-engine / ...-backend
git log --oneline main..HEAD
git status
```

Checklist:
- [ ] At least one new commit since yesterday
- [ ] Working tree is clean (no uncommitted changes)
- [ ] Latest commit is a phase-complete commit (not mid-phase WIP)

**If the session is mid-phase, skip this stream today.** Don't merge half-finished work. Leave the branch alone, move to the next stream.

**Step 3.2 — Verify worklog entry landed with the phase**

```bash
git log --oneline -5 -- doc/worklog/
```

The most recent phase-complete commit from this stream should have updated the worklog. If it didn't:

> Reply to the session: "Your last phase commit did not include a worklog entry. Per CLAUDE.md, the phase isn't done until the worklog is written. Please append an entry to `doc/worklog/STREAM-X-log.md` following the template in `doc/worklog/README.md`, then commit."

Wait for that commit. Don't merge yet.

**Step 3.3 — Verify file ownership wasn't violated**

```bash
git diff main..HEAD --name-only
```

Cross-reference with the stream's ticket ownership section:

| Stream | Expected paths |
|--------|----------------|
| A (frontend) | `layouts/`, `src/app/page.tsx`, `src/app/auth/`, `src/app/onboarding/`, `src/app/dashboard/`, `src/components/`, `src/app/globals.css`, `tailwind.config.ts`, `src/lib/fixtures/`, `public/`, `doc/worklog/STREAM-A-log.md`, `doc/DECISIONS.md`, `doc/ARCHITECTURE.md` |
| B (engine) | `src/lib/validator/`, `src/lib/renderer/`, `src/lib/ai/`, `src/lib/cultural/`, `src/lib/rsvp/config.ts`, `src/lib/layoutSelector.ts`, `src/lib/pipeline.ts`, `src/lib/tags/`, `src/lib/types.ts`, `tests/`, `doc/worklog/STREAM-B-log.md`, `doc/DECISIONS.md`, `doc/ARCHITECTURE.md` |
| C (backend) | `src/app/api/`, `src/app/w/[slug]/`, `src/app/preview/[token]/`, `src/app/auth/callback/`, `src/lib/supabase/`, `src/lib/db/`, `src/lib/storage/`, `src/middleware.ts`, `supabase/`, `doc/worklog/STREAM-C-log.md`, `doc/DECISIONS.md`, `doc/ARCHITECTURE.md` |

**If a stream edited a file outside its zone:**

- `types.ts` edited by Stream B → OK, B owns it
- `types.ts` edited by A or C → **block and revert** (see troubleshooting)
- A React component edited by B or C → **block and revert**
- A DB migration edited by A or B → **block and revert**

**Step 3.4 — Rebase the stream on main**

```bash
git rebase main
```

If clean, continue. If conflicts, stop and resolve (see troubleshooting).

**Step 3.5 — Merge into main**

```bash
cd ../veeinvite-ai-2
git merge stream-a-frontend --ff-only    # or stream-b-engine / stream-c-backend
```

Fast-forward should succeed after a clean rebase. If `--ff-only` fails, the stream had local commits that weren't rebased — redo Step 3.4.

**Repeat Steps 3.1–3.5 for each stream.**

**Step 3.6 — Rebase the other worktrees from main**

After all merges land, push the changes back out:

```bash
cd ../veeinvite-frontend && git rebase main
cd ../veeinvite-engine   && git rebase main
cd ../veeinvite-backend  && git rebase main
```

Each stream can now see what the others landed.

### Phase 4 — Sanity checks (10 min)

Run all of these from the **main** worktree:

```bash
cd /Users/geetthaker/Geet/project/veeinvite-ai-2
```

**4.1 — Build check:**
```bash
npm run build 2>&1 | tail -20
```
Expected: `✓ Generating static pages (N/N)`. No TypeScript errors.

**4.2 — Type check:**
```bash
npx tsc --noEmit
```
Expected: no output (success) or "compiled successfully".

**4.3 — Secrets leak check:**
```bash
grep -rn "SUPABASE_SERVICE_ROLE_KEY\|ANTHROPIC_API_KEY" \
  src/components \
  src/app/*.tsx \
  src/app/**/*.tsx 2>/dev/null
```
Expected: **zero matches**. If any match appears outside `route.ts` files or server-only modules, escalate (see red flags).

**4.4 — Raw photo URL leak check (once Stream B renderer lands):**
```bash
grep -rn "supabase\\.co/storage/v1" src/lib/renderer/ 2>/dev/null
```
Expected: **zero matches**. Renderer must emit `{{PHOTO:...}}` markers only.

**4.5 — Tests (once Stream B tests land):**
```bash
npm test 2>&1 | tail -10
```
Expected: all green.

**4.6 — Worklog cadence check:**
```bash
for s in A B C; do
  echo "=== STREAM-$s ==="
  grep -c "^## Phase" "doc/worklog/STREAM-$s-log.md" 2>/dev/null || echo 0
done
```
Expected: entry count roughly matches phase commits per stream (within ±1).

If any of these fail, see troubleshooting before proceeding.

### Phase 5 — Integration log + planning (5 min)

Append an entry to `doc/worklog/INTEGRATION-log.md`:

```markdown
## 2026-04-24 — daily merge

**Merged to main:**
- Stream A: Phase 1 complete (abc1234) — Layouts 1–2
- Stream B: Phase 2 complete (def5678) — validator with tests
- Stream C: (mid-phase, skipped today)

**Worklog entries landed:** A, B. C pending.

**Sanity checks:** build ✓  types ✓  secrets ✓

**Seams noted for integration day:**
- Stream A uses camelCase `styleCard`, Stream B types use `StyleCard` enum — looks aligned
- Stream C's rsvp route needs Stream B's profile validator to check events_attending — not yet landed

**Tomorrow:**
- A: Layouts 3–4
- B: Layout selector + AI prompts
- C: finish Phase 5, start Phase 6
```

Commit it:

```bash
git add doc/worklog/INTEGRATION-log.md
git commit -m "Integration log: 2026-04-24 daily merge"
```

This is your 35-minute workday done.

---

## Troubleshooting

### Merge fails with "not a fast-forward"

The stream branched from an older main or has commits that aren't rebased.

```bash
cd ../veeinvite-STREAM
git log --oneline main..HEAD    # commits on stream not in main
git log --oneline HEAD..main    # commits on main not in stream
git rebase main          # redo the rebase
```

If rebase has conflicts, resolve them the same way a human would — look at both sides, decide what the right code is, `git add`, `git rebase --continue`. If a conflict is non-obvious, open a Claude Code session in the worktree and have it resolve.

### A stream edited files outside its ownership

Revert those specific files without throwing away the rest of their work:

```bash
cd ../veeinvite-STREAM
git checkout main -- path/to/forbidden/file
git commit -m "Revert: reverting cross-boundary edit to path/to/forbidden/file"
```

Then reply to the session:

> I reverted your edit to `path/to/forbidden/file` — that file is owned by Stream X per your ticket. If you need changes to it, flag them in a commit message with the appropriate tag (e.g. `TYPES: need X for Y`) and proceed with your own zone.

### Stream A or C added to `types.ts`

Block immediately. `types.ts` is Stream B's property.

```bash
cd ../veeinvite-STREAM
git checkout main -- src/lib/types.ts
git commit -m "Revert: types.ts is Stream B's"
```

Reply to the session:

> `src/lib/types.ts` is owned by Stream B only. If you need a new type, add `NEEDS TYPE: TypeName — reason` to your commit message, mock the shape in your own code, and continue. Stream B will add the real type later.

### Secrets leaked into a client component

Non-negotiable. Block the merge.

```bash
grep -rn "SUPABASE_SERVICE_ROLE_KEY\|ANTHROPIC_API_KEY" src/components src/app/**/*.tsx
```

Show the output to the session:

> Architecture rule 10: server-only keys must never appear in client-reachable code. The grep above found matches. Move the key-using logic into a server component, route handler, or server action. Verify with the same grep, then recommit.

Only merge once grep is clean.

### A phase is marked "done" but no worklog entry

Block the merge.

> Your commit completes Phase N but did not update `doc/worklog/STREAM-X-log.md`. Per CLAUDE.md, a phase isn't done until the worklog is written. Append an entry using the template in `doc/worklog/README.md` and commit before this phase is considered complete.

### A session is stuck / idle for hours

Check the last message — are they waiting for you to answer a question? If yes, answer it. If no, resume with "continue please" or "what are you waiting for?"

If truly stuck (same error N times), resume with:

> You've retried this approach several times without progress. Step back — what assumption might be wrong? Describe the problem in one paragraph and what you'd try next, before coding anything.

### Tests fail in main

Do **not** auto-fix. The stream that owns the failing test should fix it.

- If `src/lib/validator/*.test.ts` fails → Stream B's problem
- If a cross-boundary test fails → coordinate between streams
- Never silently `git revert` a test failure without understanding why

### One stream is way ahead or behind

Ahead is usually fine. Behind matters only if integration day depends on it.

If Stream C is two phases behind with integration day tomorrow:

> You are behind the other streams and integration day is close. Focus on the minimum routes needed for the end-to-end journey: signup → `/api/generate` → `/w/[slug]`. Skip polish phases (photo upload, restore, CSV export) — they can land post-integration.

---

## Red flags — stop and escalate immediately

These mean something is off. Don't let them accumulate:

| Red flag | Why it matters | Action |
|----------|----------------|--------|
| Stream A or C edited `types.ts` | Breaks shared contract ownership | Revert, instruct |
| Secrets in client bundle | Architecture rule 10 violation | Revert, instruct |
| AI-facing CSS property in renderer (`display`, `position`, etc.) | Architecture rule 12 violation | Revert, instruct |
| `injectStructured` not last in renderer | Architecture rule 4 violation | Revert, instruct |
| Raw Supabase URL in rendered HTML | DECISIONS [2026-01] violation, photo privacy | Revert, instruct |
| Phase marked done with no worklog entry | Documentation policy violation | Block merge, instruct |
| Ownership boundary crossed | Parallelism breaks | Revert, instruct |
| Same error 5+ times in a session | Session is stuck in a loop | Intervene with "step back and describe" |

---

## Integration day routine (Day 4–5)

Different from daily merges. One dedicated Claude Code session wires everything together.

### Step A — Verify prerequisites

Integration can start when each stream has landed at least:

- **Stream A:** Phase 1 (layouts), Phase 8 (onboarding), Phase 9 (dashboard core)
- **Stream B:** Phase 2 (validator + renderer), Phase 3 (layout selector), Phase 4 (all 3 prompts), `pipeline.generateSite` real
- **Stream C:** Phase 5 (Supabase), Phase 6 (API routes — at minimum `/api/generate`, `/api/rsvp`, `/api/structured`), Phase 7 (auth), Phase 12 (`/w/[slug]`)

If any are missing, wait another day rather than starting integration half-ready.

### Step B — Spin up the integration session

Open a Claude Code session in the **main** worktree (not a stream worktree — integration works across all domains):

```bash
cd /Users/geetthaker/Geet/project/veeinvite-ai-2
claude
```

First prompt:

> Read `doc/VEEINVITE_PRODUCT_PLAN.md`, `CLAUDE.md`, all three worklogs in `doc/worklog/`, and `doc/DECISIONS.md` and `doc/ARCHITECTURE.md`. Streams A/B/C have merged to main. Your job is integration — wire the three streams together so the user journey works end to end. Specifically: (1) Replace any remaining fixtures in Stream A with real API calls to Stream C's routes. (2) Verify Stream C's routes actually call Stream B's real `pipeline.generateSite()` and `render()` — not stubs. (3) Run the smoke test: a real user signs up → completes onboarding step 1 → sees a preview at `/w/[slug]` with real couple names → completes step 2 → preview regenerates with their cultural profile. Fix every seam at integration boundaries (type mismatches, field-name drift, missing awaits, wrong function signatures). Do not add new features. Document every fix in `doc/worklog/INTEGRATION-log.md`. When the smoke test passes end to end, commit with tag `m1-smoke-test-passed`.

### Step C — Run the smoke test manually

Once the session thinks it's done:

1. Start `npm run dev` in the main worktree
2. Go to `http://localhost:3000`
3. Click sign up → create a test account
4. Complete onboarding step 1 with test names + date + venue
5. Wait for preview
6. Visit `/w/{the-slug}` directly
7. Verify: names are correct, RSVP form is there, no `{{PHOTO:...}}` leaking, no `{{TOKEN}}` leaking, CSS is applied
8. Complete step 2 with a style card + cultural profile
9. Preview regenerates
10. Submit a test RSVP as a guest
11. Dashboard shows the RSVP

Every step that breaks = something the integration session needs to fix. Don't move on until the previous step works.

### Step D — Document

Integration session writes a long-form entry in `INTEGRATION-log.md` covering every seam fixed and every DECISIONS entry added. This entry will be the most-referenced document in the repo long-term — people will read it to understand how the streams ended up talking.

### Step E — Tag and close out

```bash
git tag m1-smoke-test-passed
```

M1 is done when: the smoke test passes in one sitting without manual intervention, all three streams' worklogs are up to date, INTEGRATION-log has a comprehensive integration entry, and DECISIONS has captured any non-obvious fixes.

---

## Commands cheat sheet

Bookmark this section. These are the 10 commands you'll use most.

### Check state
```bash
git log --oneline -5                    # main
git log --all --oneline -15             # everywhere
git worktree list                       # verify worktrees
```

### Per-stream pre-merge check
```bash
cd ../veeinvite-frontend   # or -engine / -backend
git log --oneline main..HEAD     # what this stream did
git diff main..HEAD --name-only  # files touched
```

### Merge one stream
```bash
cd ../veeinvite-STREAM && git rebase main
cd ../veeinvite-ai-2     && git merge stream-X --ff-only
```

### Rebase all worktrees after merging
```bash
cd ../veeinvite-frontend && git rebase main
cd ../veeinvite-engine   && git rebase main
cd ../veeinvite-backend  && git rebase main
```

### Sanity check suite (run from main)
```bash
npm run build && \
  npx tsc --noEmit && \
  grep -rn "SUPABASE_SERVICE_ROLE_KEY\|ANTHROPIC_API_KEY" src/components src/app 2>/dev/null; echo "done"
```

### Revert a single file to main's version
```bash
git checkout main -- path/to/file
git commit -m "Revert: cross-boundary edit reverted"
```

### Emergency: abort a broken rebase
```bash
git rebase --abort
```

### See which stream last touched a file
```bash
git log -1 --format="%h %an %s" -- path/to/file
```

---

## Time budget

| Phase | Time |
|-------|------|
| Morning kickoff | 5 min |
| Ambient monitoring | ~0 (check a few times) |
| End-of-day merge | 15 min |
| Sanity checks | 10 min |
| Integration log | 5 min |
| **Daily total** | **~35 min** |
| Plus if interventions | +15–20 min |
| Integration day (once) | 2–4 hours |

Over a ~7-day build you spend ~4 hours operating + a half-day on integration. The three sessions do everything else.

---

## Signs the build is healthy

- All three streams commit every day
- Worklog entries land with each phase commit
- `DECISIONS.md` gets new entries when non-obvious choices happen
- Sanity checks stay green
- Ownership-boundary interventions are <1 per day
- No red flags fire

## Signs the build is drifting

- A stream goes a full day with no commits
- Worklog entries stop appearing
- `NEEDS TYPE:` tags pile up in commits unanswered by Stream B
- Sanity checks fail and you don't know why
- Two or more red flags in the same day
- Secrets leak has happened more than once

**If drifting, stop and investigate** instead of continuing to merge. A drifting build that you keep merging accumulates tech debt faster than the streams produce features.

---

## The mindset

You are a **build manager**, not a developer.

Your job is to keep three engineering streams in sync, quality-gate their output, and unblock them when they need cross-stream coordination. You **do not** fix their code, pick their tools, or write the features.

When you're tempted to write code yourself, ask: would a build manager at a real company do this? Usually no — they'd send it back to the responsible engineer. Do the same.

The three Claude Code sessions are competent engineers following self-contained tickets. Trust their work until evidence says otherwise. Verify via sanity checks and documentation cadence, not by reading every line.

This is how you ship in one week what would otherwise take three.
