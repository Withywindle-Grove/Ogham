-- M5b step 0c, follow-up to slice 4 (design/rulings/m5b-0c-first-spells-table-2026-11-02.md, fs-1; docs/03 permission
-- matrix "Read a pack table the pack marks gmOnly: false"; docs/07 GM-only sections, Who sees what).
--   A pack table may say `"gmOnly": false`. Every member of a campaign using the pack then reads it (a class's
--   starting-spell table, rolled at the table and tapped on the First spells step). Every other table stays the GM's,
--   as before: tables aren't a player-facing kind, and only this one flag opens one.
--   The flag stays in the entry's readable part: private.hidden_keys / split_hidden_fields only act on a `gmOnly`
--   that is a list of field names, so a boolean is left where it is and the rule can read it.
-- Replaces one policy (from 20261028100000_m4b_known_items.sql). Drops, renames and deletes no data; no rows written.

drop policy "library entries: owner or campaigns using the pack read" on public.library_entries;
create policy "library entries: owner or campaigns using the pack read" on public.library_entries
  for select to authenticated
  using (
    exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
    or private.pack_in_my_campaign(pack_id, true)
    or (private.pack_in_my_campaign(pack_id) and private.player_facing(kind)
        and (kind <> 'item' or private.item_readable(pack_id, pack_entry_id)))
    -- fs-1: a table the pack opens to players.
    or (private.pack_in_my_campaign(pack_id) and kind = 'table' and (data -> 'gmOnly') = 'false'::jsonb)
  );
