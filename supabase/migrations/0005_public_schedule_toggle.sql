-- ============================================================================
-- PicklePro — toggle to show/hide the match schedule on the public portal.
-- When off, the public schedule page shows an "unavailable" message instead
-- of the schedule table.
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
-- ============================================================================

alter table pickleball.tournaments
  add column if not exists show_public_schedule boolean not null default true;
