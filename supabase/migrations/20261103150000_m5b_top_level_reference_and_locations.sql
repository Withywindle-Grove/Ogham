-- Two more kinds of library entry, both the GM's (ruled A by Francis, 2026-11-03; docs/plans/m5b-g5-gm-reference.md,
-- Departures 9; docs/07 G-55 and G-58):
--   gmReferencePanel  one panel of a pack's top-level `gmReference` (07: it may sit at the pack's top level as well as
--                     on a rules set); the GM reference screen merges them with the rules sets' panels.
--   location          a drop-in place in a rules or overlay pack (07 `locations`, G-58), kept until the prep space
--                     reads it.
-- Neither is player-facing: private.player_facing is not touched, so the read rule on library_entries (which asks it)
-- keeps both from players, and import_pack's "what changed" line counts them as the GM's.
-- Replaces one check constraint (newest in 20261101170000_m5b_trait_lists.sql), adding two kinds. Drops, renames and
-- deletes no data; no rows written.

alter table public.library_entries drop constraint library_entries_kind_check;
alter table public.library_entries add constraint library_entries_kind_check check (kind in (
  'fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table',
  'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook', 'traitList',
  'gmReferencePanel', 'location'
));
