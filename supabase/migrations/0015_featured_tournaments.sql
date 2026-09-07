-- ============================================================================
-- 0015 — Featured tournaments
--
-- The marketing page shows a marquee of tournaments. Which ones appear is a
-- curated decision made by the super admin on /dashboard/admin, not something
-- derived from size or status, so it needs a flag of its own.
--
-- Run this in the Supabase SQL editor. Until it is applied the homepage
-- marquee simply renders nothing and the admin toggle reports an error.
-- ============================================================================

alter table pickleball.tournaments
  add column if not exists featured boolean not null default false;

-- Only a handful of rows are ever true; a partial index keeps the homepage
-- lookup off a sequential scan as the table grows.
create index if not exists idx_tournaments_featured
  on pickleball.tournaments(featured)
  where featured;

-- No policy change needed: `tournaments_select` is already `using (true)` so
-- the flag is publicly readable, and it is only ever written by the super
-- admin through the service-role client (see `src/actions/admin.ts`).
