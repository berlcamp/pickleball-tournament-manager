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

-- Backfill: the scheduler's stored date first, else the tournament's start date.
update pickleball.categories c
  set event_date = nullif(c.settings ->> 'event_date', '')::date
  where c.event_date is null
    and c.settings ? 'event_date'
    and nullif(c.settings ->> 'event_date', '') is not null;

update pickleball.categories c
  set event_date = t.start_date
  from pickleball.tournaments t
  where t.id = c.tournament_id
    and c.event_date is null
    and t.start_date is not null;

-- The column now owns the date; drop the duplicate out of the settings blob.
update pickleball.categories
  set settings = settings - 'event_date'
  where settings ? 'event_date';
