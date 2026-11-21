-- Set AC (ruled 2026-10-29, the second batch): the AC typed by hand is kept per character, so it works without a
-- campaign AC field. It lives beside the character's other play state in character_play (one row per character),
-- under that table's rules: the owner or the GM sets and clears it, for an approved character; it's read like the
-- character; changes are logged and undoable like the rest of the row. Null means the worked-out AC shows.
-- Setting and clearing go in the simple log as character.setAc.
-- Add-only: one nullable column with a range check, and one logged command. Drops no data.

alter table public.character_play
  add column ac_override integer check (ac_override between -999 and 999);

insert into public.logged_commands (name, level, gm_only) values ('character.setAc', 'simple', false);
