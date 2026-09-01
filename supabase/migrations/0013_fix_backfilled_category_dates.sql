-- ============================================================================
-- PicklePro — Undo the tournament-date backfill onto categories
--
-- The first cut of 0012 copied `tournaments.start_date` onto every category
-- that had no date of its own. The result: the public portal announced the same
-- day for every category, including ones playing on another day entirely.
-- 0012 no longer does that; this repairs databases that already ran it.
--
-- Each category is put back on a date it can actually justify:
--   1. its own schedule, when it has one — the earliest day it plays;
--   2. otherwise nothing, if the date it carries is just the tournament's
--      start date. It reads as "not decided yet" until the organiser sets it
--      in Settings → Categories or generates a schedule.
-- A date that matches neither is left alone: it was set deliberately.
--
-- Run AFTER 0012_category_event_date.sql in the Supabase SQL editor. It is a
-- one-time correction — re-running it would clear a date an organiser has
-- since chosen that happens to equal the tournament's start date.
-- ============================================================================

-- 1. Categories with a schedule: the first day they actually play.
update pickleball.categories c
  set event_date = s.first_day
  from (
    select category_id, min(scheduled_date) as first_day
    from pickleball.match_schedules
    where match_type = 'group' and scheduled_date is not null
    group by category_id
  ) s
  where s.category_id = c.id
    and c.event_date is distinct from s.first_day;

-- 2. Everything else still carrying the tournament's start date: clear it.
update pickleball.categories c
  set event_date = null
  from pickleball.tournaments t
  where t.id = c.tournament_id
    and c.event_date = t.start_date
    and not exists (
      select 1 from pickleball.match_schedules m
      where m.category_id = c.id
        and m.match_type = 'group'
        and m.scheduled_date is not null
    );
