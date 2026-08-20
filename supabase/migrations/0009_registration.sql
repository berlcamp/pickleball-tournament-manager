-- ============================================================================
-- PicklePro — Public team registration
--
-- Adds a self-service registration flow to the public tournament portal:
--   * per-category registration settings (format, fee, what to collect)
--   * tournament-level payment (GCash) details
--   * `registrations` + `registration_players` holding submitted entries
--   * a private storage bucket for ID photos and payment receipts
--
-- Approving a registration creates the matching `participants` row, so an
-- approved team flows straight into seeding/groups.
--
-- Run AFTER 0008_schedule_queued.sql in the Supabase SQL editor. The
-- `pickleball` schema must stay exposed (Settings → API).
--
-- NOTE: this module reads and writes exclusively through the service-role
-- client (registrant PII never gets an anon RLS read policy), so
-- SUPABASE_SERVICE_ROLE_KEY must be set for registration to work.
-- ============================================================================

-- ---------- enums -----------------------------------------------------------
do $$ begin
  create type pickleball.category_format as enum ('singles', 'doubles');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pickleball.registration_status as enum
    ('pending', 'approved', 'disqualified', 'cancelled');
exception when duplicate_object then null; end $$;

-- Money state, tracked independently of the admin's approval decision so that
-- "approved but still unpaid" is representable.
do $$ begin
  create type pickleball.payment_status as enum
    ('unpaid', 'submitted', 'verified', 'refunded');
exception when duplicate_object then null; end $$;

-- ---------- tournament-level payment details --------------------------------
-- One GCash account per tournament; the fee itself is per category.
alter table pickleball.tournaments
  add column if not exists payment_name text,
  add column if not exists payment_number text,
  add column if not exists payment_qr text,
  add column if not exists payment_instructions text;

-- ---------- per-category registration settings ------------------------------
alter table pickleball.categories
  add column if not exists format pickleball.category_format not null default 'doubles',
  add column if not exists registration_open boolean not null default false,
  add column if not exists registration_deadline timestamptz,
  add column if not exists max_teams int,
  add column if not exists registration_fee numeric(10, 2) not null default 0,
  -- true  → proof of payment is required to submit the form
  -- false → team may pay later from its reference link
  add column if not exists require_payment_upfront boolean not null default false,
  add column if not exists collect_shirt_sizes boolean not null default false,
  add column if not exists require_player_id boolean not null default false;

do $$ begin
  alter table pickleball.categories
    add constraint categories_max_teams_positive check (max_teams is null or max_teams > 0);
exception when duplicate_table then null; when duplicate_object then null; end $$;

-- ---------- registrations ---------------------------------------------------
create table if not exists pickleball.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  category_id uuid not null references pickleball.categories(id) on delete cascade,
  -- Human-quotable AND unguessable: PKL-XXXX-XXXX over a 32-symbol alphabet.
  -- Doubles as the status-page URL, so it must not be enumerable.
  reference_code text not null unique,
  team_name text not null,
  contact_number text not null,
  contact_email text,
  status pickleball.registration_status not null default 'pending',
  payment_status pickleball.payment_status not null default 'unpaid',
  -- Fee snapshot: the category fee may change after this team registered.
  fee_amount numeric(10, 2) not null default 0,
  payment_reference text,
  payment_proof_path text,
  payment_submitted_at timestamptz,
  admin_note text,
  -- Set when the registration is approved; cleared if it is later reversed.
  participant_id uuid references pickleball.participants(id) on delete set null,
  submitted_ip text,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_registrations_tournament on pickleball.registrations(tournament_id);
create index if not exists idx_registrations_category   on pickleball.registrations(category_id);
create index if not exists idx_registrations_status     on pickleball.registrations(category_id, status);
create index if not exists idx_registrations_code       on pickleball.registrations(reference_code);
-- Supports the per-IP submission rate limit.
create index if not exists idx_registrations_ip_recent  on pickleball.registrations(submitted_ip, created_at);

-- ---------- registration players --------------------------------------------
-- One row per player: singles has position 1, doubles has positions 1 and 2.
-- Shirt size and ID photo are per player because that is how shirts get
-- ordered and how IDs get checked.
create table if not exists pickleball.registration_players (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references pickleball.registrations(id) on delete cascade,
  position int not null,
  full_name text not null,
  shirt_size text,
  id_photo_path text,
  created_at timestamptz not null default now(),
  unique (registration_id, position)
);

create index if not exists idx_registration_players_registration
  on pickleball.registration_players(registration_id);

-- ---------- updated_at trigger ----------------------------------------------
create or replace function pickleball.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists registrations_touch_updated_at on pickleball.registrations;
create trigger registrations_touch_updated_at
  before update on pickleball.registrations
  for each row execute function pickleball.touch_updated_at();

-- ---------- RLS --------------------------------------------------------------
-- Deliberately NO public/anon policy: these rows carry phone numbers, ID
-- photos and receipts. Public registration submits and the status lookup both
-- run server-side through the service-role client, which bypasses RLS.
alter table pickleball.registrations enable row level security;
alter table pickleball.registration_players enable row level security;

drop policy if exists registrations_read on pickleball.registrations;
create policy registrations_read on pickleball.registrations for select
  using (pickleball.has_min_role(tournament_id, 'viewer'));

drop policy if exists registrations_write on pickleball.registrations;
create policy registrations_write on pickleball.registrations for all
  using (pickleball.has_min_role(tournament_id, 'admin'))
  with check (pickleball.has_min_role(tournament_id, 'admin'));

drop policy if exists registration_players_read on pickleball.registration_players;
create policy registration_players_read on pickleball.registration_players for select
  using (exists (
    select 1 from pickleball.registrations r
    where r.id = registration_id
      and pickleball.has_min_role(r.tournament_id, 'viewer')
  ));

drop policy if exists registration_players_write on pickleball.registration_players;
create policy registration_players_write on pickleball.registration_players for all
  using (exists (
    select 1 from pickleball.registrations r
    where r.id = registration_id
      and pickleball.has_min_role(r.tournament_id, 'admin')
  ))
  with check (exists (
    select 1 from pickleball.registrations r
    where r.id = registration_id
      and pickleball.has_min_role(r.tournament_id, 'admin')
  ));

-- ---------- Private storage bucket -------------------------------------------
-- Government IDs and GCash receipts must never sit at a guessable public URL,
-- so this bucket is private. Reads happen through short-lived signed URLs
-- minted server-side (service role bypasses the policies below).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pickleball-registrations',
  'pickleball-registrations',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated policies are created for this bucket on purpose.

-- ---------- Grants ------------------------------------------------------------
grant all on all tables in schema pickleball to anon, authenticated, service_role;

-- ---------- Realtime ----------------------------------------------------------
-- Deliberately NOT published to `supabase_realtime`. Nothing subscribes to
-- registrations, and these rows carry contact numbers and ID references, so
-- there is no reason to put them on a broadcast channel.
