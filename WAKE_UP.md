# Morning checklist

Good morning. Here's the state of VeeInvite and what to run first.

## What got built
All 13 phase tickets (VI-001 to VI-013) are implemented and committed
locally in 14 commits, one per phase:

```
b8ba30a chore: ignore IDE folders
c105861 Phase 12 complete: end to end verification
80f062b Phase 11 complete: landing page
ac27924 Phase 10 complete: public wedding site
f9d210f Phase 9  complete: dashboard
1233529 Phase 8  complete: onboarding quiz
14dbd7a Phase 7  complete: authentication
402e34d Phase 6  complete: API routes
54c44c6 Phase 5  complete: database and Supabase
5a77474 Phase 4  complete: AI layer
4584b99 Phase 3  complete: renderer
2ae45f6 Phase 2  complete: JSON validator
1c265af Phase 1  complete: TypeScript types
27b0187 Phase 0  complete: setup, skeleton, and docs
```

The pipeline (validator + renderer) was verified end-to-end under
Node. See `scripts/verify-pipeline.mjs`.

## What couldn't be done in the sandbox
The build environment had no outbound network access, so:

1. **`npm install` never ran.** `node_modules/` doesn't exist yet.
2. **Supabase migration never ran.** SQL is in
   `supabase/migrations/001_init.sql` and has to be pasted into
   the Supabase SQL editor.
3. **Storage bucket not created.** Create a public bucket named
   `wedding-sites` in the Supabase dashboard.
4. **Commits not pushed.** The sandbox couldn't reach
   `github.com:22`. Push from your machine.
5. **No live end-to-end run.** The static pipeline tests pass, but
   the full signup → quiz → generate → dashboard → RSVP flow hasn't
   been exercised against real Claude + Supabase.

## Do these in order

```bash
# 1. Install
cd veeinvite-ai-2
npm install

# 2. Supabase:
#    In the Supabase dashboard for project cevoidbewtgryfksqhnl:
#     a. SQL editor → paste and run supabase/migrations/001_init.sql
#     b. Storage → create a public bucket named "wedding-sites"
#        (5MB file limit is fine)

# 3. Sanity-check the pipeline locally
npx tsx scripts/verify-pipeline.mjs   # expect "All pipeline checks passed."

# 4. Boot the dev server
npm run dev
# open http://localhost:3000

# 5. Push to GitHub
git push -u origin main
```

## First click-through

1. `/` — landing page. Click "Create yours free".
2. Signup with any email/password.
3. Complete the 6-step quiz with real values.
4. Loading screen cycles messages while Claude designs the site
   (~10-20s).
5. Land on `/dashboard`. The iframe should show your styled site with
   no `{{placeholder}}` tokens.
6. In the left panel:
   - Change a name under "Details" — preview updates instantly
     without a Claude call.
   - Chat "Make it more romantic with warm tones" under "Redesign with
     AI" — preview re-renders.
7. Copy the site URL from the top bar, open in a new tab. The full
   wedding site loads with no Next.js chrome.
8. Submit an RSVP as a guest. Come back to the dashboard, it appears
   in the RSVPs table. CSV export works.

## If something breaks

- **Claude call fails**: check `ANTHROPIC_API_KEY` in `.env.local`
  and that the model name `claude-sonnet-4-5` is still current; if
  not, update `src/lib/ai/generate.ts`.
- **Storage upload fails**: check that the bucket `wedding-sites`
  exists and is public.
- **RLS errors**: make sure you ran the full migration, including
  `rsvps_public_insert`.
- **401 on `/api/generate`**: middleware is doing its job; make sure
  you're signed in.
- **Placeholder tokens still visible**: regenerate, then check the
  validator console output for warnings.

## Key files to read

- `CLAUDE.md` — project context + rules.
- `CONTEXT.md` — 60-second tour.
- `docs/ARCHITECTURE.md` — the CSS JSON pipeline explained.
- `docs/DECISIONS.md` — why things are the way they are.
- `README.md` — setup guide.
- `docs/tickets/VI-001.md` through `VI-013.md` — per-phase tickets.

The app name everywhere is VeeInvite (not Aisle). The skeleton at
`skeleton/wedding-skeleton.html` must never be modified casually —
every generated site depends on it.
