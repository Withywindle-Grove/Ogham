-- M5b step 6b, Safe and Hostile places and the arrival card (docs/plans/m5b-6-settlements.md "Step 6b"; ruled
-- 2026-10-30, ST2, as replaced 2026-11-02 by dt-9, design/rulings/m7-downtime-2026-11-02.md; 05 Settlements).
--   1. A place may be marked Safe or Hostile by the GM (ST2: a property of the place; it also covers a safe place
--      inside a dungeon). Unmarked (null) is an ordinary place: arriving there raises nothing. The column sits on
--      public.places, which only the GM reads ("places: the GM reads", 20261102100000), so players never learn it
--      (hard rule 5; dt-9: players see nothing). The existing log_change trigger on places logs the change, so Undo
--      puts the old value back.
--   2. The command's log row (place.setSafety, Verbose, the GM's), as place.edit.
-- The arrival card itself is the GM's device reading where the groups are (group_places) and this column: no new
-- function. Adds one column and one logged_commands row. Drops no data; no rows are removed, renamed or changed.

alter table public.places
  add column safety text check (safety is null or safety in ('safe', 'hostile'));

comment on column public.places.safety is
  'Safe or Hostile (ST2, dt-9): arriving at a safe place puts the arrival card on the GM''s console; null: neither.';

insert into public.logged_commands (name, level, gm_only) values
  ('place.setSafety', 'verbose', true);
