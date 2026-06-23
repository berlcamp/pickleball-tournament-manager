-- ============================================================================
-- PicklePro — add an optional label to scheduled matches.
-- Used by knockout placeholder slots (e.g. "Semifinal 1", "Final") that are
-- reserved in the schedule before the real bracket matches exist.
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
-- ============================================================================

alter table pickleball.match_schedules
  add column if not exists label text;
