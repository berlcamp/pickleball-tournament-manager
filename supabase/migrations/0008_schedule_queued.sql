-- Per-slot "queued" flag: staff can mark a scheduled match as queued/called to
-- the court before it's played. Orthogonal to the match score status; once a
-- score is entered the schedule UI hides the toggle and shows the status.
alter table pickleball.match_schedules
  add column if not exists queued boolean not null default false;
