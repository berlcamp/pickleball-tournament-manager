-- ============================================================================
-- 0006_raffle.sql — Electronic Raffle module
--
-- A self-contained raffle feature unrelated to tournaments. Model:
--   raffles             ← one raffle event (e.g. "Season Kickoff 2026")
--   raffle_departments  ← groups within a raffle that own entries
--   raffle_entries      ← one row per name (= one ticket)
--   raffle_winners      ← persisted draw outcomes; session_id groups winners
--                         of one operator session so the Draw page can
--                         exclude them on subsequent spins.
--
-- Run this in the Supabase SQL editor. The pickleball schema must already be
-- exposed (Project Settings → API → Exposed schemas).
-- ============================================================================

-- ---------- updated_at helper ----------------------------------------------
create or replace function pickleball.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Tables ----------------------------------------------------------
create table if not exists pickleball.raffles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_raffles_active_created
  on pickleball.raffles(is_active, created_at desc);

drop trigger if exists trg_raffles_updated on pickleball.raffles;
create trigger trg_raffles_updated before update on pickleball.raffles
  for each row execute function pickleball.set_updated_at();

create table if not exists pickleball.raffle_departments (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references pickleball.raffles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint raffle_departments_name_unique unique (raffle_id, name)
);

create index if not exists idx_raffle_departments_raffle
  on pickleball.raffle_departments(raffle_id);

drop trigger if exists trg_raffle_departments_updated on pickleball.raffle_departments;
create trigger trg_raffle_departments_updated before update on pickleball.raffle_departments
  for each row execute function pickleball.set_updated_at();

create table if not exists pickleball.raffle_entries (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references pickleball.raffles(id) on delete cascade,
  department_id uuid not null references pickleball.raffle_departments(id) on delete cascade,
  name text not null,
  designation text,
  created_at timestamptz not null default now()
);

create index if not exists idx_raffle_entries_raffle_dept
  on pickleball.raffle_entries(raffle_id, department_id);

create index if not exists idx_raffle_entries_department
  on pickleball.raffle_entries(department_id);

create table if not exists pickleball.raffle_winners (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references pickleball.raffles(id) on delete cascade,
  department_id uuid not null references pickleball.raffle_departments(id) on delete cascade,
  entry_id uuid not null references pickleball.raffle_entries(id) on delete cascade,
  entry_name text not null,
  entry_designation text,
  department_name text not null,
  prize_label text,
  session_id uuid not null,
  draw_index integer not null,
  drawn_by uuid references auth.users(id) on delete set null,
  drawn_at timestamptz not null default now()
);

create index if not exists idx_raffle_winners_raffle_drawn
  on pickleball.raffle_winners(raffle_id, drawn_at desc);

create index if not exists idx_raffle_winners_session
  on pickleball.raffle_winners(session_id);

create index if not exists idx_raffle_winners_entry
  on pickleball.raffle_winners(entry_id);

comment on table pickleball.raffles is
  'Top-level raffle event. Soft-delete via is_active.';
comment on table pickleball.raffle_departments is
  'Department/group within a raffle. Departments scope entries; the Draw page can filter to one department or pool across all.';
comment on table pickleball.raffle_entries is
  'One row per raffle ticket. Created via paste or CSV upload. raffle_id is denormalised from department for fast pool queries.';
comment on table pickleball.raffle_winners is
  'Persisted draws. entry_name/department_name are frozen at draw time so renames or deletions do not rewrite history. session_id groups winners drawn in one Draw-page session.';

-- ---------- RLS -------------------------------------------------------------
-- Raffles are a global module (not tied to a tournament). Anyone may read
-- (public select) and any signed-in user may manage and draw.
alter table pickleball.raffles enable row level security;
alter table pickleball.raffle_departments enable row level security;
alter table pickleball.raffle_entries enable row level security;
alter table pickleball.raffle_winners enable row level security;

drop policy if exists raffles_select on pickleball.raffles;
create policy raffles_select on pickleball.raffles for select using (true);
drop policy if exists raffles_write on pickleball.raffles;
create policy raffles_write on pickleball.raffles for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists raffle_departments_select on pickleball.raffle_departments;
create policy raffle_departments_select on pickleball.raffle_departments for select using (true);
drop policy if exists raffle_departments_write on pickleball.raffle_departments;
create policy raffle_departments_write on pickleball.raffle_departments for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists raffle_entries_select on pickleball.raffle_entries;
create policy raffle_entries_select on pickleball.raffle_entries for select using (true);
drop policy if exists raffle_entries_write on pickleball.raffle_entries;
create policy raffle_entries_write on pickleball.raffle_entries for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists raffle_winners_select on pickleball.raffle_winners;
create policy raffle_winners_select on pickleball.raffle_winners for select using (true);
drop policy if exists raffle_winners_write on pickleball.raffle_winners;
create policy raffle_winners_write on pickleball.raffle_winners for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
