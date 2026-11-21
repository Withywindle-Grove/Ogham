-- At hand actions (ruling m5b-at-hand-actions-2026-11-08, ah-3; Design's ruling on #569's flag 1, 2026-11-09): a weapon's
-- chosen mode (Quiver, Pouch, Grip, Stance: one of its pack's `weapon.modes` ids) is a shared game fact, logged, not
-- kept on one device.
--   1. inventory_lines.mode_id: the chosen mode's id, or null when none is chosen (a spent stack clears it). Its
--      access follows the line's own: the existing row rules let whoever may use or equip the item change it, the
--      table's grants already cover a new column, and the line's log trigger records it like any other change.
--   2. item.setMode's logged_commands row: Simple, for everyone. An update, so the ordinary Undo reverses it; no undo
--      list needs it. The clear on a spent stack happens inside item.use's own request (already undoable).
-- Adds one nullable column and one row. Replaces no function. Drops, renames and deletes no data.

alter table public.inventory_lines add column mode_id text;
alter table public.inventory_lines add constraint inventory_lines_mode_id_length check (mode_id is null or char_length(mode_id) between 1 and 100);

insert into public.logged_commands (name, level, gm_only) values ('item.setMode', 'simple', false);
