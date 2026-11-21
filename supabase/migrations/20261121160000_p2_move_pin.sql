-- Row P2 of docs/plans/test-feedback-2026-11-19.md (euf-4, `docs/design/rulings/dec-player-end-user-feedback-2026-11-19.md`):
-- a player moves a pinned ability or trait in their own order (hold to move, Move up, Move down; page 28, pg28-7).
-- A move is its own command, `character.movePin`, so that it goes in the detailed log only, as every rearrangement does
-- (docs/09-decisions-log.md, 2026-10-23; the driver's ruling on #23, 2026-11-21). The log trigger takes an event's level
-- from this table by the command's name, so the command needs its row here.
-- What it writes is unchanged and not touched here: the order of `character_play.pins`, an update of the one row, by the
-- owner of an approved character or the GM, under the row's existing rules (the pins column's check holds as before).
-- Add-only: one row. Drops, renames and deletes nothing.

insert into public.logged_commands (name, level, gm_only) values
  ('character.movePin', 'verbose', false);
