-- One more kind of library entry, the GM's (dec-3, town row W9; the lead's ruling sh-1, 2026-11-15):
--   shop   one of an adventure pack's shops (its `shops`): name, locationId, services, stock (each line's item, price and
--          availability), as the pack wrote them. Kept as data for the GM's stock table (W9); no screen shows them yet.
-- Not player-facing: private.player_facing (newest 20261111130000_dec_1a_patrons.sql:33-36) is not touched, so the read
-- rule on library_entries and public.campaign_library (both newest in 20261115002000_dec_12e_rumours_gm_only.sql) keep
-- every shop entry from players, and import_pack's "what changed" line counts them as the GM's. No read rule changes.
-- Replaces one check constraint (newest in 20261115120000_dec_3_npc_kind.sql:10-15), adding one kind and keeping every
-- existing one, 'npc' included. Drops, renames and deletes no data; no rows written.

alter table public.library_entries drop constraint library_entries_kind_check;
alter table public.library_entries add constraint library_entries_kind_check check (kind in (
  'fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table',
  'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook', 'traitList',
  'gmReferencePanel', 'location', 'patch', 'patron', 'route', 'adventureHook', 'map', 'npc', 'shop'
));
