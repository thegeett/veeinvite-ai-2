-- =============================================================================
-- VeeInvite — 001_init.sql
--
-- Initial schema covering plan §23 + additions from §24, §26, §29, §32, §33.
-- Apply this once to a fresh Supabase project. All subsequent changes go in
-- numbered migrations (002_*.sql, 003_*.sql, ...).
-- =============================================================================

-- Extensions --------------------------------------------------------------
create extension if not exists "pgcrypto";

-- =============================================================================
-- Tables
-- =============================================================================

-- Couples ---------------------------------------------------------------------
create table if not exists couples (
  id                 uuid default gen_random_uuid() primary key,
  user_id            uuid references auth.users(id) on delete cascade not null,
  slug               text unique not null,

  -- Core details
  person1_name       text not null,
  person2_name       text not null,
  wedding_date       text not null,           -- display form, "Saturday, 14 June 2025"
  wedding_date_iso   timestamptz not null,    -- canonical ISO
  venue_name         text not null,
  venue_city         text not null,
  rsvp_deadline      date,

  -- Quiz answers — nullable because §28 step 1 creates couple before step 2
  style              text,
  vibe               text,
  story              text,
  cultural_context   text,

  -- Two-axis system (§24)
  layout_id          text,                    -- "layout-1" .. "layout-4"
  cultural_profile   jsonb default '{}'::jsonb,

  -- AI outputs (§9)
  global_tokens      jsonb,
  theme_json         jsonb,
  hero_html          text,
  design_summary     text,

  -- Data-driven RSVP (§29)
  rsvp_config        jsonb default '{}'::jsonb,

  -- Content
  custom_sections    jsonb default '[]'::jsonb,
  photo_urls         jsonb default '[]'::jsonb,      -- (§16 VI-F017)

  -- Serving
  site_html_url      text,
  is_published       boolean default false,

  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists idx_couples_user_id on couples(user_id);
create index if not exists idx_couples_slug on couples(slug);

-- Events ----------------------------------------------------------------------
-- Dynamic ceremony list (§26) — no hardcoded 3-event cap.
-- Each row is one ceremony for the couple; `event_type` references the
-- ceremony id from cultural-content-library.json when culturally driven.
create table if not exists events (
  id           uuid default gen_random_uuid() primary key,
  couple_id    uuid references couples(id) on delete cascade not null,
  name         text not null,
  event_type   text,                            -- e.g. "mehendi", "nikah", "walima"
  event_date   text not null,
  event_time   text not null,
  venue        text not null,
  dress_code   text,                            -- per-event dress code (§26)
  sort_order   integer default 0
);

create index if not exists idx_events_couple_id on events(couple_id);

-- RSVPs (§29) -----------------------------------------------------------------
create table if not exists rsvps (
  id                uuid default gen_random_uuid() primary key,
  couple_id         uuid references couples(id) on delete cascade not null,
  first_name        text not null,
  last_name         text not null,
  email             text not null,
  attending         boolean not null,
  guest_count       integer default 1,
  children_count    integer default 0,               -- only if rsvp_config.childrenSeparate
  plus_one_name     text,                            -- only if rsvp_config.plusOneEnabled
  events_attending  text[] default array[]::text[],  -- array of ceremony ids
  meal_choice       text,
  dietary           text,
  song_request      text,
  message           text,
  created_at        timestamptz default now()
);

create index if not exists idx_rsvps_couple_id on rsvps(couple_id);

-- Site versions — append-only version history (§11) ---------------------------
create table if not exists site_versions (
  id              uuid default gen_random_uuid() primary key,
  couple_id       uuid references couples(id) on delete cascade not null,
  version_number  integer not null,
  layout_id       text,
  hero_html       text,
  global_tokens   jsonb,
  theme_json      jsonb not null,
  design_summary  text,
  instruction     text,
  label           text,
  created_at      timestamptz default now()
);

create index if not exists idx_site_versions_couple_id on site_versions(couple_id);

-- Preview tokens — shareable preview links (§32 Hook 3) -----------------------
create table if not exists preview_tokens (
  token       text primary key,
  couple_id   uuid references couples(id) on delete cascade not null,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

create index if not exists idx_preview_tokens_couple_id on preview_tokens(couple_id);

-- =============================================================================
-- Row-Level Security
-- =============================================================================

alter table couples        enable row level security;
alter table events         enable row level security;
alter table rsvps          enable row level security;
alter table site_versions  enable row level security;
alter table preview_tokens enable row level security;

-- Couples: only the owning user can read or mutate their row
drop policy if exists couples_owner on couples;
create policy couples_owner on couples
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Events: inherit ownership via couple_id
drop policy if exists events_owner on events;
create policy events_owner on events
  for all
  using (couple_id in (select id from couples where user_id = auth.uid()))
  with check (couple_id in (select id from couples where user_id = auth.uid()));

-- RSVPs: anyone may INSERT (guest submissions), only couple owner may SELECT
drop policy if exists rsvps_guest_insert on rsvps;
create policy rsvps_guest_insert on rsvps
  for insert
  with check (true);

drop policy if exists rsvps_owner_select on rsvps;
create policy rsvps_owner_select on rsvps
  for select
  using (couple_id in (select id from couples where user_id = auth.uid()));

-- Site versions: only couple owner
drop policy if exists site_versions_owner on site_versions;
create policy site_versions_owner on site_versions
  for all
  using (couple_id in (select id from couples where user_id = auth.uid()))
  with check (couple_id in (select id from couples where user_id = auth.uid()));

-- Preview tokens: public SELECT (anyone with the token can fetch), owner-only write
drop policy if exists preview_tokens_public_select on preview_tokens;
create policy preview_tokens_public_select on preview_tokens
  for select
  using (true);

drop policy if exists preview_tokens_owner_write on preview_tokens;
create policy preview_tokens_owner_write on preview_tokens
  for all
  using (couple_id in (select id from couples where user_id = auth.uid()))
  with check (couple_id in (select id from couples where user_id = auth.uid()));

-- =============================================================================
-- Trigger: bump updated_at on couples
-- =============================================================================

create or replace function set_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists couples_updated_at on couples;
create trigger couples_updated_at
  before update on couples
  for each row execute function set_updated_at();

-- =============================================================================
-- Storage buckets — ALL PRIVATE (no public read)
-- =============================================================================
-- Create via Supabase dashboard or CLI — SQL cannot reliably create buckets
-- across all Supabase versions.
--
-- All three buckets are PRIVATE. Nothing is publicly listable or fetchable
-- directly from Supabase CDN. Access is mediated in three ways:
--
--   sites      PRIVATE. Served by /w/[slug] route handler, which reads the
--              HTML via the service-role client, substitutes photo placeholder
--              markers with freshly-signed 1-hour URLs, and returns to browser.
--              Access gated on couples.is_published.
--
--   previews   PRIVATE. Served by /preview/[token] route handler, which
--              validates the token against preview_tokens (expiry + revocation)
--              and follows the same signed-URL substitution flow as sites.
--
--   photos     PRIVATE. Couple photo uploads. NEVER publicly accessible.
--              Accessed only via signed URLs (≤1 hour expiry) generated by
--              the /w/[slug] and /preview/[token] route handlers at serve time.
--              This protects photo reputation — an expired or leaked URL stops
--              working within an hour, preventing scraping and redistribution.
--
-- Upload paths:
--   sites/{slug}.html
--   previews/{token}.html
--   photos/{couple_id}/{uuid}.{ext}
--
-- The renderer (Stream B) must NEVER embed raw Supabase URLs in generated
-- HTML. It embeds placeholder markers: <img src="{{PHOTO:couple_id/file.jpg}}">
-- The serve-time route handlers replace these markers with signed URLs.
