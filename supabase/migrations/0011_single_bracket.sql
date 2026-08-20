-- Collapse the two finals bracket styles into one.
--
-- Every category now runs the same two-stage format: round-robin groups, then
-- a single-elimination final stage seeded from one overall cross-group
-- ranking of the qualifiers. There is nothing left to choose, so the column
-- and its enum are dropped rather than left behind as a field the application
-- no longer reads.
--
-- Already-generated `final_matches` rows are untouched: the bracket style only
-- ever mattered at generation time.

alter table pickleball.categories
  drop column if exists final_bracket_type;

drop type if exists pickleball.final_bracket_type;
