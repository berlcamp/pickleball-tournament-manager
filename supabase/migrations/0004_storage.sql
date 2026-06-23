-- ============================================================================
-- PicklePro — Storage bucket for tournament banner images
--
-- The tournament settings form uploads banner images from the browser (anon
-- key + the signed-in user's session) into the `pickleball-tournament` bucket
-- and stores the resulting public URL on `tournaments.banner`.
--
-- Run this in the Supabase SQL editor. Storage objects live in the `storage`
-- schema (not `pickleball`), so no schema exposure is needed here.
-- ============================================================================

-- ---------- public bucket ---------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pickleball-tournament', 'pickleball-tournament', true)
on conflict (id) do update set public = true;

-- ---------- policies on storage.objects -------------------------------------
-- Public read so portal/monitor pages can render banners without auth.
drop policy if exists "pickleball banners public read" on storage.objects;
create policy "pickleball banners public read"
  on storage.objects for select
  using (bucket_id = 'pickleball-tournament');

-- Authenticated users may upload, replace, and remove banner files.
drop policy if exists "pickleball banners auth insert" on storage.objects;
create policy "pickleball banners auth insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pickleball-tournament');

drop policy if exists "pickleball banners auth update" on storage.objects;
create policy "pickleball banners auth update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'pickleball-tournament')
  with check (bucket_id = 'pickleball-tournament');

drop policy if exists "pickleball banners auth delete" on storage.objects;
create policy "pickleball banners auth delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pickleball-tournament');
