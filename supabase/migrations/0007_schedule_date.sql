-- Add an explicit calendar date to scheduled matches. Each category schedules
-- its matches within a single day; scheduled_time holds the "HH:MM" slot and
-- scheduled_date holds the day those slots fall on.
alter table pickleball.match_schedules
  add column if not exists scheduled_date date;
