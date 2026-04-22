-- VeeInvite — initial schema.
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists couples (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade,
  slug             text unique not null,
  person1_name     text not null,
  person2_name     text not null,
  wedding_date     text not null,
  wedding_date_iso timestamptz not null,
  venue_name       text not null,
  venue_city       text not null,
  rsvp_deadline    date,
  style            text not null,
  vibe             text not null,
  story            text not null,
  cultural_context text,
  theme_json       jsonb,
  style_history    text[] default '{}',
  site_html_url    text,
  is_published     boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table if not exists events (
  id         uuid default gen_random_uuid() primary key,
  couple_id  uuid references couples(id) on delete cascade,
  name       text not null,
  event_date text not null,
  event_time text not null,
  venue      text not null,
  sort_order integer default 0
);

create table if not exists rsvps (
  id          uuid default gen_random_uuid() primary key,
  couple_id   uuid references couples(id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  email       text not null,
  attending   boolean not null,
  guest_count integer default 1,
  dietary     text,
  message     text,
  created_at  timestamptz default now()
);

create table if not exists site_versions (
  id         uuid default gen_random_uuid() primary key,
  couple_id  uuid references couples(id) on delete cascade,
  theme_json jsonb not null,
  label      text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table couples       enable row level security;
alter table events        enable row level security;
alter table rsvps         enable row level security;
alter table site_versions enable row level security;

-- Couples: only the owner can read/write their own rows.
drop policy if exists "couples_owner" on couples;
create policy "couples_owner" on couples
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Events: owner access via the couples join.
drop policy if exists "events_owner" on events;
create policy "events_owner" on events
  for all
  using (couple_id in (select id from couples where user_id = auth.uid()))
  with check (couple_id in (select id from couples where user_id = auth.uid()));

-- RSVPs: owner can read, anyone can insert (guests).
drop policy if exists "rsvps_owner_read" on rsvps;
create policy "rsvps_owner_read" on rsvps
  for select
  using (couple_id in (select id from couples where user_id = auth.uid()));

drop policy if exists "rsvps_public_insert" on rsvps;
create policy "rsvps_public_insert" on rsvps
  for insert
  with check (true);

-- Site versions: owner access via couples join.
drop policy if exists "versions_owner" on site_versions;
create policy "versions_owner" on site_versions
  for all
  using (couple_id in (select id from couples where user_id = auth.uid()))
  with check (couple_id in (select id from couples where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_couples_user_id on couples(user_id);
create index if not exists idx_events_couple_id on events(couple_id, sort_order);
create index if not exists idx_rsvps_couple_id on rsvps(couple_id, created_at desc);
create index if not exists idx_versions_couple_id on site_versions(couple_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger for couples
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists couples_set_updated_at on couples;
create trigger couples_set_updated_at
  before update on couples
  for each row execute procedure set_updated_at();
