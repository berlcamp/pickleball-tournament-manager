-- ============================================================================
-- PicklePro — Club name and address on registrations
--
-- Organizers need to know which club a team represents and where it is based,
-- alongside the contact number they already collect. Both are required of new
-- public submissions (enforced in `validators/registration.ts` and
-- `submitRegistration`), but the columns are nullable so registrations taken
-- before this migration stay valid and readable.
--
-- Run AFTER 0013_fix_backfilled_category_dates.sql in the Supabase SQL editor.
-- The `pickleball` schema must stay exposed (Settings → API).
-- ============================================================================

alter table pickleball.registrations
  add column if not exists club_name text;

alter table pickleball.registrations
  add column if not exists club_address text;
