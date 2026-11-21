-- One more kind of library entry, the GM's (December step 4, piece a; docs/plans/dec-4-point-travel.md; ruled
-- pt-f1 and pt-f3 in docs/design/rulings/dec-point-travel-format-2026-11-11.md):
--   route   one link between an adventure's places (07 Adventure packs §3): from, to, hidden, oneWay and travel (one
--           amount, or a list of ways of moving, each { by, name, value, unit }).
-- Not player-facing: private.player_facing is not touched, so the read rule on library_entries (which asks it) keeps
-- routes from players, and import_pack's "what changed" line counts them as the GM's.
-- Replaces one check constraint (newest in 20261104150000_m5b_patches_kind.sql), adding one kind. Drops, renames and
-- deletes no data; no rows written.
-- 'patron' comes from 20261111130000_dec_1a_patrons.sql (PR #636), which replaces the same check from the same list:
-- it is kept here so whichever of the two runs second drops neither kind (harmless if that one isn't applied yet).
-- Order agreed with the Builder (2026-11-11): #636 merges and is pushed to main before this one.

alter table public.library_entries drop constraint library_entries_kind_check;
alter table public.library_entries add constraint library_entries_kind_check check (kind in (
  'fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table',
  'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook', 'traitList',
  'gmReferencePanel', 'location', 'patch', 'patron', 'route'
));
