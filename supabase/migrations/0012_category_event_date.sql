-- ============================================================================
-- PicklePro — Per-category event date
--
-- Categories run on their own day(s): a tournament's Men's Doubles may be
-- played on Saturday and its Mixed Doubles on Sunday. The date moves from a
-- single tournament-level `start_date` to a first-class column on each
-- category, so it can be edited, scheduled against and published per category.
--
-- The schedule generator previously stashed this date in `categories.settings`
-- as `event_date`; that value is lifted into the new column and removed from
-- the JSON so there is exactly one source of truth.
--
-- Run AFTER 0011_single_bracket.sql in the Supabase SQL editor. The
-- `pickleball` schema must stay exposed (Settings → API).
-- ============================================================================

alter table pickleball.categories
  add column if not exists event_date date;

-- Backfill from the scheduler's stored date — the only per-category date that
-- already existed. The tournament's `start_date` is deliberately NOT copied
-- down: one date stamped onto every category publishes a day each of them was
-- never scheduled for. Categories with no date read as "not decided yet".
update pickleball.categories c
  set event_date = nullif(c.settings ->> 'event_date', '')::date
  where c.event_date is null
    and c.settings ? 'event_date'
    and nullif(c.settings ->> 'event_date', '') is not null;

-- The column now owns the date; drop the duplicate out of the settings blob.
update pickleball.categories
  set settings = settings - 'event_date'
  where settings ? 'event_date';
