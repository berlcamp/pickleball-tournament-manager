-- ============================================================================
-- PicklePro — T-shirt price per category
--
-- Registrants can add a shirt for each player at a price the organizer sets
-- alongside the fee. It used to be a fixed ₱400 in code; the default keeps
-- existing categories at that price until the organizer changes it.
--
-- Run AFTER 0016_blind_pairing_format.sql in the Supabase SQL editor.
-- The `pickleball` schema must stay exposed (Settings → API).
-- ============================================================================

alter table pickleball.categories
  add column if not exists shirt_price numeric(10, 2) not null default 400;
