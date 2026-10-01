-- ============================================================================
-- PicklePro — Blind pairing categories
--
-- A third registration format next to singles and doubles: players sign up
-- alone, and the organizer draws partners for them from the Teams tab
-- (Blind pairing). Each registration carries exactly one player.
--
-- Run AFTER 0015_featured_tournaments.sql in the Supabase SQL editor.
-- The `pickleball` schema must stay exposed (Settings → API).
-- ============================================================================

alter type pickleball.category_format add value if not exists 'blind_pairing';
