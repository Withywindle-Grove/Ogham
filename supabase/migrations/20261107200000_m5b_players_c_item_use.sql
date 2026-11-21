-- The players' screens, slice C (plan m5b-players-screens-standard; Design on #552, 2026-11-07): "use one up" from At
-- hand (Fire, Drink, Eat, Use) is its own command, item.use, so the log says what happened ("Wren drank a Moss draught,
-- 1 left") instead of "dropped". The app counts the line down by one, or deletes it when it's the last one, as Drop
-- does; the log keeps the deleted line's copy and Undo puts it back (CLAUDE.md hard rule 4: items used up).
--   1. Its logged_commands row: item.use, Simple, for everyone (the person who uses it, and the GM).
--   2. Its undoable_deletions row, so private.undo_body (newest in 20261101121000_m5_review_split_undo.sql) puts the
--      last one back, as it does for inventory.remove.
-- Adds two rows. Replaces no function. Drops, renames and deletes no data.

insert into public.logged_commands (name, level, gm_only) values ('item.use', 'simple', false);

insert into public.undoable_deletions (name) values ('item.use');
