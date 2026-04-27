-- 003_add_vibe_tags.sql
--
-- PALETTE-01 — Vibe tag picker UI + DB columns.
--
-- Replaces the old free-text `vibe` input (still present, deprecated, dropped
-- in a later cleanup) with a structured tag array. Adds an `expressive_palette`
-- JSONB column for the 4 tokens the pre-call (PALETTE-03) will produce.
--
-- Dev environment — no backfill of existing rows. New rows default to empty
-- vibe_tags and null expressive_palette. See plan §34 / VIBE_TAG_PICKER_SPEC.

alter table couples
  add column if not exists vibe_tags text[] default '{}';

alter table couples
  add column if not exists expressive_palette jsonb;
