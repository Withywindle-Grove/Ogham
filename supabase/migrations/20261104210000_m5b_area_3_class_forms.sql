-- Area 3 build order 10, class forms (eq-8, ruled 2026-11-04, docs/design/rulings/m5b-pack-review-area-3-2026-11-04.md;
-- docs/plans/m5b-review-area-3.md order 10). A class may have forms (07 `classes[].forms`, each with its own weapon
-- and armour limits); the character has a current form, switched from the sheet (logged, Undo), and the equip check
-- reads that form's limits. The current form lives beside the character's other play state in character_play (one
-- row per character), under that table's rules: the owner or the GM switches it, for an approved character; it's
-- read like the character (members read approved characters' rows; a draft's row is its owner's alone; outsiders
-- read nothing); changes are logged and undoable like the rest of the row. Null means the first form the class lists.
-- form_name is a copy of the form's name at the time of the switch, so the log line can name it.
-- The switch goes in the simple log as character.setForm (the gear the form can't use comes off in the same request).
-- Add-only: two nullable text columns with length checks, and one logged command. Replaces no function. Drops,
-- renames and deletes nothing.

alter table public.character_play
  add column form_id text check (char_length(form_id) between 1 and 80),
  add column form_name text check (char_length(form_name) between 1 and 120);

comment on column public.character_play.form_id is 'The class form the character is in (07 classes[].forms, eq-8); null = the first form the class lists.';
comment on column public.character_play.form_name is 'The form''s name when it was switched to, for the log line.';

insert into public.logged_commands (name, level, gm_only) values ('character.setForm', 'simple', false);
