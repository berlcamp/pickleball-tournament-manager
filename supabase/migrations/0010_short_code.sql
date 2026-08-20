-- ============================================================================
-- PicklePro — Memorable short links
--
-- Adds `tournaments.short_code`: a 5-character code (or a custom one the
-- organizer picks) that serves the public portal straight off the domain root,
-- e.g. sortbrite.com/ab3kd — short enough to print on a poster or say out loud.
--
-- The long `slug` is kept and still resolves, so existing links and printed QR
-- codes do not break; `/tournament/<slug>` now redirects to the short form.
--
-- Run AFTER 0009_registration.sql in the Supabase SQL editor.
-- ============================================================================

alter table pickleball.tournaments
  add column if not exists short_code text;

-- ---------- generator -------------------------------------------------------
-- Lowercase alphanumerics minus the characters people misread or mistype
-- (0/o, 1/l/i). 31^5 ≈ 28.6 million codes.
create or replace function pickleball.generate_short_code(len int default 5)
returns text language plpgsql as $$
declare
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  result text := '';
  i int;
begin
  for i in 1..len loop
    result := result || substr(
      alphabet,
      1 + floor(random() * length(alphabet))::int,
      1
    );
  end loop;
  return result;
end $$;

-- ---------- backfill --------------------------------------------------------
do $$
declare
  t record;
  candidate text;
begin
  for t in select id from pickleball.tournaments where short_code is null loop
    loop
      candidate := pickleball.generate_short_code(5);
      exit when not exists (
        select 1 from pickleball.tournaments where short_code = candidate
      );
    end loop;
    update pickleball.tournaments set short_code = candidate where id = t.id;
  end loop;
end $$;

-- ---------- constraints -----------------------------------------------------
alter table pickleball.tournaments
  alter column short_code set not null;

create unique index if not exists idx_tournaments_short_code
  on pickleball.tournaments(short_code);

-- Lowercase, alphanumeric or internal hyphens, 3–32 characters. The app also
-- refuses codes that would collide with a top-level route (dashboard, login,
-- r, qr, …) — see `RESERVED_CODES` in src/lib/short-code.ts.
do $$ begin
  alter table pickleball.tournaments
    add constraint tournaments_short_code_format check (
      short_code ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
      and char_length(short_code) between 3 and 32
    );
exception when duplicate_table then null; when duplicate_object then null; end $$;

grant all on all tables in schema pickleball to anon, authenticated, service_role;
