-- 002_add_cultures_column.sql
--
-- Stores the original CultureSelection[] array submitted by the couple in
-- onboarding step 2. We already store the merged `cultural_profile` (the
-- output of buildMergedCulturalProfile), but that flattens contributions
-- from multiple cultures and can't be reversed for editing — interfaith
-- couples returning to step 2 lose their secondary culture pick. This
-- column persists the inputs so the configurator state is fully
-- round-trippable. See DECISIONS [2026-14].

alter table couples
  add column if not exists cultures jsonb default '[]'::jsonb;
