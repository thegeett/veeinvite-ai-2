# VeeInvite — Quick onboarding

VeeInvite is an AI-native wedding website builder.

## The 60-second tour
1. Couple signs up → quiz (6 steps) → we save to Postgres.
2. `/api/generate` sends the skeleton + couple data to Claude.
3. Claude returns a JSON object with styles, fonts, particles, and copy.
4. The validator strips anything unsafe.
5. The renderer merges that JSON into the skeleton and we upload the
   final HTML to Supabase Storage.
6. `/w/[slug]` fetches that HTML and serves it raw — no Next.js layout.
7. Guests RSVP on that page and the submission hits `/api/rsvp`.
8. Couples manage everything from `/dashboard` (direct edits don't
   call Claude; chat edits do).

## Stack
- Next.js 14 App Router, TypeScript strict
- Supabase (Postgres + Auth + Storage)
- Anthropic Claude (`claude-sonnet-4-5`)
- Tailwind for the app UI only. The wedding skeleton is plain CSS +
  Google Fonts + AI-supplied styles.

## Source of truth
`couples.theme_json` in Postgres. HTML is always regenerated from that.

## First-time setup
1. `npm install`
2. Run `supabase/migrations/001_init.sql` in the Supabase SQL editor.
3. Create a public Storage bucket called `wedding-sites`.
4. Copy `.env.example` to `.env.local` and fill in the values.
5. `npm run dev`

## What's built
Everything in the VI-001 through VI-012 tickets under `docs/tickets/`
is implemented. See `CLAUDE.md` for the status table.
