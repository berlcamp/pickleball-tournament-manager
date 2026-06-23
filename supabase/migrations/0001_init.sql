-- ============================================================================
-- PicklePro — Tournament Management System schema
-- All objects live in a dedicated "pickleball" schema.
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
--
-- IMPORTANT: After running this, expose the schema to the API:
--   Dashboard → Project Settings → API → "Exposed schemas" → add `pickleball`.
-- ============================================================================

-- ---------- Schema ----------------------------------------------------------
create schema if not exists pickleball;

grant usage on schema pickleball to anon, authenticated, service_role;

-- Future objects created in this script inherit these grants (RLS still applies).
alter default privileges in schema pickleball
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema pickleball
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema pickleball
  grant all on routines to anon, authenticated, service_role;

-- ---------- Enums -----------------------------------------------------------
do $$ begin
  create type pickleball.role as enum ('owner','admin','scorekeeper','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pickleball.tournament_status as enum ('draft','group_stage','final_stage','completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pickleball.final_bracket_type as enum ('crossover','standard_seed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pickleball.match_status as enum ('pending','in_progress','completed');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------------------------------------------------------
create table if not exists pickleball.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists pickleball.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  location text,
  start_date date,
  banner text,
  status pickleball.tournament_status not null default 'draft',
  final_bracket_type pickleball.final_bracket_type not null default 'crossover',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists pickleball.tournament_members (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role pickleball.role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table if not exists pickleball.tournament_invites (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  email text not null,
  role pickleball.role not null default 'viewer',
  status text not null default 'pending',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tournament_id, email)
);

create table if not exists pickleball.participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  name text not null,
  seed int,
  created_at timestamptz not null default now()
);

create table if not exists pickleball.groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists pickleball.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references pickleball.groups(id) on delete cascade,
  participant_id uuid not null references pickleball.participants(id) on delete cascade,
  seed_in_group int not null default 0,
  unique (group_id, participant_id)
);

create table if not exists pickleball.group_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  group_id uuid not null references pickleball.groups(id) on delete cascade,
  participant1_id uuid references pickleball.participants(id) on delete set null,
  participant2_id uuid references pickleball.participants(id) on delete set null,
  round int not null default 1,
  status pickleball.match_status not null default 'pending',
  winner_id uuid references pickleball.participants(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists pickleball.group_match_scores (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references pickleball.group_matches(id) on delete cascade,
  set_number int not null default 1,
  participant1_score int not null default 0,
  participant2_score int not null default 0,
  unique (match_id, set_number)
);

create table if not exists pickleball.standings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  group_id uuid not null references pickleball.groups(id) on delete cascade,
  participant_id uuid not null references pickleball.participants(id) on delete cascade,
  rank int not null default 0,
  status text not null default 'none',
  matches_won int not null default 0,
  matches_lost int not null default 0,
  matches_tied int not null default 0,
  tie_break int not null default 0,
  set_wins int not null default 0,
  set_ties int not null default 0,
  points int not null default 0,
  point_diff int not null default 0,
  history jsonb not null default '[]'::jsonb,
  unique (group_id, participant_id)
);

create table if not exists pickleball.final_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  round int not null,
  slot int not null,
  label text,
  participant1_id uuid references pickleball.participants(id) on delete set null,
  participant2_id uuid references pickleball.participants(id) on delete set null,
  source1 text,
  source2 text,
  status pickleball.match_status not null default 'pending',
  winner_id uuid references pickleball.participants(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tournament_id, round, slot)
);

create table if not exists pickleball.match_scores (
  id uuid primary key default gen_random_uuid(),
  final_match_id uuid not null references pickleball.final_matches(id) on delete cascade,
  set_number int not null default 1,
  participant1_score int not null default 0,
  participant2_score int not null default 0,
  unique (final_match_id, set_number)
);

create table if not exists pickleball.placements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  placement text not null,
  participant_id uuid references pickleball.participants(id) on delete set null,
  unique (tournament_id, placement)
);

create table if not exists pickleball.courts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  name text not null,
  position int not null default 0
);

create table if not exists pickleball.match_schedules (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  match_type text not null,
  match_id uuid not null,
  court_id uuid references pickleball.courts(id) on delete set null,
  scheduled_time text,
  status pickleball.match_status not null default 'pending',
  unique (match_type, match_id)
);

create table if not exists pickleball.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_tournament on pickleball.tournament_members(tournament_id);
create index if not exists idx_participants_tournament on pickleball.participants(tournament_id);
create index if not exists idx_group_matches_tournament on pickleball.group_matches(tournament_id);
create index if not exists idx_standings_tournament on pickleball.standings(tournament_id);
create index if not exists idx_final_matches_tournament on pickleball.final_matches(tournament_id);
create index if not exists idx_schedules_tournament on pickleball.match_schedules(tournament_id);

-- ---------- Helper functions (SECURITY DEFINER avoids RLS recursion) --------
create or replace function pickleball.role_rank(r pickleball.role) returns int
language sql immutable as $$
  select case r
    when 'viewer' then 0
    when 'scorekeeper' then 1
    when 'admin' then 2
    when 'owner' then 3
  end;
$$;

create or replace function pickleball.is_tournament_member(tid uuid) returns boolean
language sql security definer stable set search_path = pickleball as $$
  select exists(
    select 1 from pickleball.tournament_members m
    where m.tournament_id = tid and m.user_id = auth.uid()
  );
$$;

create or replace function pickleball.has_min_role(tid uuid, min pickleball.role) returns boolean
language sql security definer stable set search_path = pickleball as $$
  select exists(
    select 1 from pickleball.tournament_members m
    where m.tournament_id = tid
      and m.user_id = auth.uid()
      and pickleball.role_rank(m.role) >= pickleball.role_rank(min)
  );
$$;

-- ---------- Triggers --------------------------------------------------------
create or replace function pickleball.handle_new_user() returns trigger
language plpgsql security definer set search_path = pickleball as $$
begin
  insert into pickleball.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(pickleball.profiles.full_name, excluded.full_name),
        avatar_url = coalesce(excluded.avatar_url, pickleball.profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function pickleball.handle_new_user();

create or replace function pickleball.handle_new_tournament() returns trigger
language plpgsql security definer set search_path = pickleball as $$
begin
  insert into pickleball.tournament_members (tournament_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (tournament_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_tournament_created on pickleball.tournaments;
create trigger on_tournament_created
  after insert on pickleball.tournaments
  for each row execute function pickleball.handle_new_tournament();

-- When an invited user signs up, auto-accept matching invites by email.
create or replace function pickleball.accept_invites_for_user() returns trigger
language plpgsql security definer set search_path = pickleball as $$
begin
  insert into pickleball.tournament_members (tournament_id, user_id, role)
  select i.tournament_id, new.id, i.role
  from pickleball.tournament_invites i
  where lower(i.email) = lower(coalesce(new.email, ''))
    and i.status = 'pending'
  on conflict (tournament_id, user_id) do nothing;

  update pickleball.tournament_invites
    set status = 'accepted'
    where lower(email) = lower(coalesce(new.email, '')) and status = 'pending';
  return new;
end;
$$;

drop trigger if exists on_profile_accept_invites on pickleball.profiles;
create trigger on_profile_accept_invites
  after insert on pickleball.profiles
  for each row execute function pickleball.accept_invites_for_user();

-- ---------- Row Level Security ---------------------------------------------
alter table pickleball.profiles enable row level security;
alter table pickleball.tournaments enable row level security;
alter table pickleball.tournament_members enable row level security;
alter table pickleball.tournament_invites enable row level security;
alter table pickleball.participants enable row level security;
alter table pickleball.groups enable row level security;
alter table pickleball.group_members enable row level security;
alter table pickleball.group_matches enable row level security;
alter table pickleball.group_match_scores enable row level security;
alter table pickleball.standings enable row level security;
alter table pickleball.final_matches enable row level security;
alter table pickleball.match_scores enable row level security;
alter table pickleball.placements enable row level security;
alter table pickleball.courts enable row level security;
alter table pickleball.match_schedules enable row level security;
alter table pickleball.audit_logs enable row level security;

-- profiles: readable by any authenticated user; editable by self.
drop policy if exists profiles_select on pickleball.profiles;
create policy profiles_select on pickleball.profiles for select
  using (auth.uid() is not null);
drop policy if exists profiles_upsert on pickleball.profiles;
create policy profiles_upsert on pickleball.profiles for insert
  with check (id = auth.uid());
drop policy if exists profiles_update on pickleball.profiles;
create policy profiles_update on pickleball.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- tournaments: public read; create by self; manage by admins/owner.
drop policy if exists tournaments_select on pickleball.tournaments;
create policy tournaments_select on pickleball.tournaments for select using (true);
drop policy if exists tournaments_insert on pickleball.tournaments;
create policy tournaments_insert on pickleball.tournaments for insert
  with check (created_by = auth.uid());
drop policy if exists tournaments_update on pickleball.tournaments;
create policy tournaments_update on pickleball.tournaments for update
  using (pickleball.has_min_role(id, 'admin'));
drop policy if exists tournaments_delete on pickleball.tournaments;
create policy tournaments_delete on pickleball.tournaments for delete
  using (pickleball.has_min_role(id, 'owner'));

-- members
drop policy if exists members_select on pickleball.tournament_members;
create policy members_select on pickleball.tournament_members for select
  using (pickleball.is_tournament_member(tournament_id) or user_id = auth.uid());
drop policy if exists members_write on pickleball.tournament_members;
create policy members_write on pickleball.tournament_members for all
  using (pickleball.has_min_role(tournament_id, 'admin'))
  with check (pickleball.has_min_role(tournament_id, 'admin'));

-- invites
drop policy if exists invites_select on pickleball.tournament_invites;
create policy invites_select on pickleball.tournament_invites for select
  using (pickleball.is_tournament_member(tournament_id));
drop policy if exists invites_write on pickleball.tournament_invites;
create policy invites_write on pickleball.tournament_invites for all
  using (pickleball.has_min_role(tournament_id, 'admin'))
  with check (pickleball.has_min_role(tournament_id, 'admin'));

-- Generic helper: public read + admin write for structural tables.
drop policy if exists participants_select on pickleball.participants;
create policy participants_select on pickleball.participants for select using (true);
drop policy if exists participants_write on pickleball.participants;
create policy participants_write on pickleball.participants for all
  using (pickleball.has_min_role(tournament_id, 'admin'))
  with check (pickleball.has_min_role(tournament_id, 'admin'));

drop policy if exists groups_select on pickleball.groups;
create policy groups_select on pickleball.groups for select using (true);
drop policy if exists groups_write on pickleball.groups;
create policy groups_write on pickleball.groups for all
  using (pickleball.has_min_role(tournament_id, 'admin'))
  with check (pickleball.has_min_role(tournament_id, 'admin'));

drop policy if exists group_members_select on pickleball.group_members;
create policy group_members_select on pickleball.group_members for select using (true);
drop policy if exists group_members_write on pickleball.group_members;
create policy group_members_write on pickleball.group_members for all
  using (pickleball.has_min_role(
    (select g.tournament_id from pickleball.groups g where g.id = group_id), 'admin'))
  with check (pickleball.has_min_role(
    (select g.tournament_id from pickleball.groups g where g.id = group_id), 'admin'));

drop policy if exists courts_select on pickleball.courts;
create policy courts_select on pickleball.courts for select using (true);
drop policy if exists courts_write on pickleball.courts;
create policy courts_write on pickleball.courts for all
  using (pickleball.has_min_role(tournament_id, 'admin'))
  with check (pickleball.has_min_role(tournament_id, 'admin'));

drop policy if exists schedules_select on pickleball.match_schedules;
create policy schedules_select on pickleball.match_schedules for select using (true);
drop policy if exists schedules_write on pickleball.match_schedules;
create policy schedules_write on pickleball.match_schedules for all
  using (pickleball.has_min_role(tournament_id, 'admin'))
  with check (pickleball.has_min_role(tournament_id, 'admin'));

-- group_matches: public read; structure by admin, status/winner by scorekeeper.
drop policy if exists group_matches_select on pickleball.group_matches;
create policy group_matches_select on pickleball.group_matches for select using (true);
drop policy if exists group_matches_insert on pickleball.group_matches;
create policy group_matches_insert on pickleball.group_matches for insert
  with check (pickleball.has_min_role(tournament_id, 'admin'));
drop policy if exists group_matches_update on pickleball.group_matches;
create policy group_matches_update on pickleball.group_matches for update
  using (pickleball.has_min_role(tournament_id, 'scorekeeper'));
drop policy if exists group_matches_delete on pickleball.group_matches;
create policy group_matches_delete on pickleball.group_matches for delete
  using (pickleball.has_min_role(tournament_id, 'admin'));

drop policy if exists group_scores_select on pickleball.group_match_scores;
create policy group_scores_select on pickleball.group_match_scores for select using (true);
drop policy if exists group_scores_write on pickleball.group_match_scores;
create policy group_scores_write on pickleball.group_match_scores for all
  using (pickleball.has_min_role(
    (select m.tournament_id from pickleball.group_matches m where m.id = match_id), 'scorekeeper'))
  with check (pickleball.has_min_role(
    (select m.tournament_id from pickleball.group_matches m where m.id = match_id), 'scorekeeper'));

-- standings: public read; scorekeeper write (recomputed on score submit).
drop policy if exists standings_select on pickleball.standings;
create policy standings_select on pickleball.standings for select using (true);
drop policy if exists standings_write on pickleball.standings;
create policy standings_write on pickleball.standings for all
  using (pickleball.has_min_role(tournament_id, 'scorekeeper'))
  with check (pickleball.has_min_role(tournament_id, 'scorekeeper'));

-- final_matches
drop policy if exists final_matches_select on pickleball.final_matches;
create policy final_matches_select on pickleball.final_matches for select using (true);
drop policy if exists final_matches_insert on pickleball.final_matches;
create policy final_matches_insert on pickleball.final_matches for insert
  with check (pickleball.has_min_role(tournament_id, 'admin'));
drop policy if exists final_matches_update on pickleball.final_matches;
create policy final_matches_update on pickleball.final_matches for update
  using (pickleball.has_min_role(tournament_id, 'scorekeeper'));
drop policy if exists final_matches_delete on pickleball.final_matches;
create policy final_matches_delete on pickleball.final_matches for delete
  using (pickleball.has_min_role(tournament_id, 'admin'));

drop policy if exists match_scores_select on pickleball.match_scores;
create policy match_scores_select on pickleball.match_scores for select using (true);
drop policy if exists match_scores_write on pickleball.match_scores;
create policy match_scores_write on pickleball.match_scores for all
  using (pickleball.has_min_role(
    (select fm.tournament_id from pickleball.final_matches fm where fm.id = final_match_id), 'scorekeeper'))
  with check (pickleball.has_min_role(
    (select fm.tournament_id from pickleball.final_matches fm where fm.id = final_match_id), 'scorekeeper'));

drop policy if exists placements_select on pickleball.placements;
create policy placements_select on pickleball.placements for select using (true);
drop policy if exists placements_write on pickleball.placements;
create policy placements_write on pickleball.placements for all
  using (pickleball.has_min_role(tournament_id, 'scorekeeper'))
  with check (pickleball.has_min_role(tournament_id, 'scorekeeper'));

-- audit logs: members read, members write.
drop policy if exists audit_select on pickleball.audit_logs;
create policy audit_select on pickleball.audit_logs for select
  using (pickleball.is_tournament_member(tournament_id));
drop policy if exists audit_insert on pickleball.audit_logs;
create policy audit_insert on pickleball.audit_logs for insert
  with check (pickleball.is_tournament_member(tournament_id));

-- ---------- Grants on existing objects --------------------------------------
grant all on all tables in schema pickleball to anon, authenticated, service_role;
grant all on all sequences in schema pickleball to anon, authenticated, service_role;
grant all on all routines in schema pickleball to anon, authenticated, service_role;

-- ---------- Realtime --------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'standings','group_matches','final_matches','match_schedules'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table pickleball.%I', t);
    exception
      when duplicate_object then null; -- already in publication
      when undefined_object then null; -- publication missing (non-Supabase env)
    end;
  end loop;
end $$;
