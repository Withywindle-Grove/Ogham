-- A rumours table is the GM's alone, whatever its pack says (dec-12 E follow-up; rm-3, Francis's yes of 2026-11-14:
-- "Rumours tables are never readable by players, even if a pack marks one open. Players only ever get a rumour's words
-- when you give it."). A rumours table is exactly what private.is_rumours_table (20261114220000_dec_12e_rumours.sql)
-- says: the use `world.rumours` (`uses` as a list or one string, or the older `use`), or the older `"kind": "rumours"`.
-- WHAT CHANGES (who may read what): the two player reads that let a table the pack opens (`"gmOnly": false`, fs-1)
-- through each gain one clause, `and not private.is_rumours_table(...)`, on that table line only:
--   1. public.campaign_library, from its newest definition, 20261111190000_dec_hd2_ways_on_read.sql (line 165);
--   2. the read policy "library entries: owner or campaigns using the pack read" on public.library_entries, from its
--      newest definition, 20261111110000_fix_hidden_data_cache_and_patches.sql (line 140).
-- Nothing else in either changes: the GM's reads (is_gm, pack_in_my_campaign(pack_id, true)) and the pack owner's are
-- as they were; any table that isn't a rumours table, open or the GM's, reads as before; a given rumour's words still
-- reach its hearer through hook_sends, whose read rule is untouched. No write rule changes; no data is changed,
-- dropped or renamed.
-- Searched first (main and the db-session folder): every function and policy that reads library_entries at its newest
-- definition. The other definer paths that read `kind = 'table'` (private.campaign_table, private.campaign_has_table)
-- are not changed here; the weather path through private.campaign_table is named in
-- docs/status/2026-11-14-dec-12-e-followup.md as known and not yet closed.

-- 1. The campaign's library, as a member reads it.
create or replace function public.campaign_library(campaign uuid, packs uuid[] default null, after_id uuid default null, page_size integer default 1000)
returns table (id uuid, pack_id uuid, kind text, pack_entry_id text, name text, data jsonb)
language sql stable security definer set search_path = '' as $$
  with open_items as materialized (
    select o.item
    from private.items_open_in(campaign) o(item)
    where (select private.is_member(campaign)) and not (select private.is_gm(campaign))
  )
  select e.id, e.pack_id, e.kind, e.pack_entry_id, e.name, e.data
  from public.campaign_packs cp
  join public.library_entries e on e.pack_id = cp.pack_id
  where cp.campaign_id = campaign
    and (select private.is_member(campaign))
    and (packs is null or cp.pack_id = any (packs))
    and (after_id is null or e.id > after_id)
    and (
      (select private.is_gm(campaign))
      or (private.player_facing_entry(e.kind, e.data)
        and case e.kind
          when 'item' then e.pack_entry_id in (select o.item from open_items o)
          when 'patch' then private.patch_open_in(campaign, e.pack_id, e.data)
          else true
        end)
      -- fs-1: a table the pack opens to players, never a rumours table (rm-3).
      or (e.kind = 'table' and (e.data -> 'gmOnly') = 'false'::jsonb and not private.is_rumours_table(e.data))
    )
  order by e.id
  limit least(greatest(coalesce(page_size, 1000), 1), 1000);
$$;
revoke execute on function public.campaign_library(uuid, uuid[], uuid, integer) from public, anon;
grant execute on function public.campaign_library(uuid, uuid[], uuid, integer) to authenticated, service_role;

-- 2. The read rule on library entries.
drop policy "library entries: owner or campaigns using the pack read" on public.library_entries;
create policy "library entries: owner or campaigns using the pack read" on public.library_entries
  for select to authenticated
  using (
    exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
    or private.pack_in_my_campaign(pack_id, true)
    or (private.pack_in_my_campaign(pack_id) and private.player_facing_entry(kind, data)
        and case kind
          when 'item' then private.item_readable(pack_id, pack_entry_id)
          when 'patch' then private.patch_open_to_me(pack_id, data)
          else true
        end)
    -- fs-1: a table the pack opens to players, never a rumours table (rm-3).
    or (private.pack_in_my_campaign(pack_id) and kind = 'table' and (data -> 'gmOnly') = 'false'::jsonb and not private.is_rumours_table(data))
  );
