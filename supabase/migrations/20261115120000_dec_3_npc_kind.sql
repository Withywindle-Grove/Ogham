-- One more kind of library entry, the GM's (dec-3, town row W8; the lead's go of 2026-11-15):
--   npc   one of an adventure pack's people (its `npcs`): name, role, place, the GM's leads and lines, as the pack
--         wrote them. Kept as data for the town's people (W8); no screen shows them yet.
-- Not player-facing: private.player_facing (newest 20261111130000_dec_1a_patrons.sql:33-36) is not touched, so the read
-- rule on library_entries and public.campaign_library (both newest in 20261115002000_dec_12e_rumours_gm_only.sql) keep
-- every npc entry from players, and import_pack's "what changed" line counts them as the GM's. No read rule changes.
-- Replaces one check constraint (newest in 20261114200000_dec_7_5m_1_map_kind.sql:6-10), adding one kind and keeping
-- every existing one. Drops, renames and deletes no data; no rows written.

alter table public.library_entries drop constraint library_entries_kind_check;
alter table public.library_entries add constraint library_entries_kind_check check (kind in (
  'fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table',
  'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook', 'traitList',
  'gmReferencePanel', 'location', 'patch', 'patron', 'route', 'adventureHook', 'map', 'npc'
));
