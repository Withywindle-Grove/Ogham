-- One more kind of library entry, the GM's (dec-7 piece 5m-1; docs/plans/dec-7-5-place-page-and-map.md; 07 Adventure
-- packs §9, ruling 9):
--   map   one of an adventure pack's maps (its `images` of type `map`): the file's name, its title, its alt words, the
--         places it belongs to (locationIds) and its page. The picture file never comes with the pack: the GM adds it
--         from their device, as the campaign's own map asset (piece 5m-2).
-- Not player-facing: private.player_facing is not touched, so the read rule on library_entries (which asks it) keeps
-- every map entry from players, and import_pack's "what changed" line counts them as the GM's. No read rule changes.
-- Replaces one check constraint (newest in 20261113210000_dec_12b_calls_to_adventure.sql), adding one kind. Drops,
-- renames and deletes no data; no rows written.

alter table public.library_entries drop constraint library_entries_kind_check;
alter table public.library_entries add constraint library_entries_kind_check check (kind in (
  'fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table',
  'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook', 'traitList',
  'gmReferencePanel', 'location', 'patch', 'patron', 'route', 'adventureHook', 'map'
));
