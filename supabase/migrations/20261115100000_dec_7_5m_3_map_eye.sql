-- December dec-7 piece 5m-3, the map's eye (docs/plans/dec-7-5-place-page-and-map.md; mc-44a; set 1's frame 3), built
-- with the whole Scene's S13 (docs/plans/dec-9-the-whole-scene.md). The GM shares the campaign's copy of a map with the
-- players, or takes it back: `place.shareMap` sets the copy's own visibility, `all` or `gm` (src/modules/expedition/
-- placeMap.ts), under the rules as they stand:
--   * the GM already updates assets ("assets: GM or own portrait updates", 20261019120000_m1_core_tables.sql);
--   * an asset shown to `all` is already read, row and file, by every member of the campaign ("assets: read by
--     visibility", and the bucket's rule on the same visibility);
--   * the change is logged by the assets table's log trigger, and Undo may put an assets row back
--     (public.undoable_tables).
-- So the one thing missing is the command's name in the log's list. The Builder's yes, 2026-11-14 (technical, within
-- the db-session rules).
--
-- Adds one logged_commands row. No policy, read rule, function, column or table changes. Drops, renames and deletes
-- nothing.

insert into public.logged_commands (name, level, gm_only) values
  ('place.shareMap', 'verbose', true);
