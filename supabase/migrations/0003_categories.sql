-- ============================================================================
-- PicklePro — Multi-category (sub-tournament) support
--
-- A tournament now hosts one or more "categories" (sub-tournaments). Each
-- category is a full, independent competition: its own teams, groups, group
-- stage, standings, finals, and placements, plus its own status and finals
-- bracket type. Courts and the generated schedule remain tournament-level
-- (shared venue, one combined conflict-free timeline).
--
-- Run this AFTER 0001_init.sql and 0002_schedule_label.sql in the Supabase SQL
-- editor. The `pickleball` schema must stay exposed (Settings → API).
-- ============================================================================

-- ---------- categories table -----------------------------------------------
create table if not exists pickleball.categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references pickleball.tournaments(id) on delete cascade,
  name text not null,
  position int not null default 0,
  status pickleball.tournament_status not null default 'draft',
  final_bracket_type pickleball.final_bracket_type not null default 'crossover',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_tournament on pickleball.categories(tournament_id);

-- ---------- add category_id to competition tables (nullable first) ----------
alter table pickleball.participants    add column if not exists category_id uuid references pickleball.categories(id) on delete cascade;
alter table pickleball.groups          add column if not exists category_id uuid references pickleball.categories(id) on delete cascade;
alter table pickleball.group_matches   add column if not exists category_id uuid references pickleball.categories(id) on delete cascade;
alter table pickleball.standings       add column if not exists category_id uuid references pickleball.categories(id) on delete cascade;
alter table pickleball.final_matches   add column if not exists category_id uuid references pickleball.categories(id) on delete cascade;
alter table pickleball.placements      add column if not exists category_id uuid references pickleball.categories(id) on delete cascade;
alter table pickleball.match_schedules add column if not exists category_id uuid references pickleball.categories(id) on delete cascade;

create index if not exists idx_participants_category    on pickleball.participants(category_id);
create index if not exists idx_groups_category          on pickleball.groups(category_id);
create index if not exists idx_group_matches_category   on pickleball.group_matches(category_id);
create index if not exists idx_standings_category       on pickleball.standings(category_id);
create index if not exists idx_final_matches_category   on pickleball.final_matches(category_id);
create index if not exists idx_placements_category      on pickleball.placements(category_id);
create index if not exists idx_match_schedules_category on pickleball.match_schedules(category_id);

-- ---------- Backfill: one "Open" category per existing tournament -----------
-- Only runs while tournaments still carry status/final_bracket_type (i.e. on a
-- pre-migration database). New databases have no rows to backfill.
do $$
declare
  has_status boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'pickleball' and table_name = 'tournaments'
      and column_name = 'status'
  ) into has_status;

  if has_status then
    -- Create the default category, copying per-category fields off the tournament.
    insert into pickleball.categories (tournament_id, name, position, status, final_bracket_type, settings)
    select
      t.id,
      'Open',
      0,
      t.status,
      t.final_bracket_type,
      jsonb_strip_nulls(jsonb_build_object('random_tiebreak', t.settings->'random_tiebreak'))
    from pickleball.tournaments t
    where not exists (
      select 1 from pickleball.categories c where c.tournament_id = t.id
    );

    -- Stamp existing child rows with their tournament's default category.
    update pickleball.participants p
      set category_id = c.id
      from pickleball.categories c
      where c.tournament_id = p.tournament_id and p.category_id is null;
    update pickleball.groups g
      set category_id = c.id
      from pickleball.categories c
      where c.tournament_id = g.tournament_id and g.category_id is null;
    update pickleball.group_matches gm
      set category_id = c.id
      from pickleball.categories c
      where c.tournament_id = gm.tournament_id and gm.category_id is null;
    update pickleball.standings s
      set category_id = c.id
      from pickleball.categories c
      where c.tournament_id = s.tournament_id and s.category_id is null;
    update pickleball.final_matches fm
      set category_id = c.id
      from pickleball.categories c
      where c.tournament_id = fm.tournament_id and fm.category_id is null;
    update pickleball.placements pl
      set category_id = c.id
      from pickleball.categories c
      where c.tournament_id = pl.tournament_id and pl.category_id is null;
    update pickleball.match_schedules ms
      set category_id = c.id
      from pickleball.categories c
      where c.tournament_id = ms.tournament_id and ms.category_id is null;
  end if;
end $$;

-- ---------- Tighten constraints once data is backfilled --------------------
-- These tables must always belong to a category going forward.
alter table pickleball.participants  alter column category_id set not null;
alter table pickleball.groups        alter column category_id set not null;
alter table pickleball.group_matches alter column category_id set not null;
alter table pickleball.standings     alter column category_id set not null;
alter table pickleball.final_matches alter column category_id set not null;
-- placements + match_schedules stay nullable (knockout placeholder rows).

-- ---------- Category-scoped unique constraints ------------------------------
alter table pickleball.final_matches drop constraint if exists final_matches_tournament_id_round_slot_key;
do $$ begin
  alter table pickleball.final_matches
    add constraint final_matches_category_round_slot_key unique (category_id, round, slot);
exception when duplicate_table then null; when duplicate_object then null; end $$;

alter table pickleball.placements drop constraint if exists placements_tournament_id_placement_key;
do $$ begin
  alter table pickleball.placements
    add constraint placements_category_placement_key unique (category_id, placement);
exception when duplicate_table then null; when duplicate_object then null; end $$;

-- ---------- Drop per-category columns from tournaments ----------------------
alter table pickleball.tournaments drop column if exists status;
alter table pickleball.tournaments drop column if exists final_bracket_type;

-- ---------- RLS for categories ---------------------------------------------
-- Membership/roles remain tournament-wide, so authorization keys off
-- tournament_id exactly like the other structural tables.
alter table pickleball.categories enable row level security;

drop policy if exists categories_select on pickleball.categories;
create policy categories_select on pickleball.categories for select using (true);
drop policy if exists categories_write on pickleball.categories;
create policy categories_write on pickleball.categories for all
  using (pickleball.has_min_role(tournament_id, 'admin'))
  with check (pickleball.has_min_role(tournament_id, 'admin'));

-- ---------- Grants ----------------------------------------------------------
grant all on all tables in schema pickleball to anon, authenticated, service_role;

-- ---------- Realtime --------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table pickleball.categories;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
