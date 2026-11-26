-- The players' map (plan docs/plans/dec-9-the-players-scene.md, row P5, piece 8 of dec-7; rulings mc-37, mc-44,
-- mc-44a, dp-1, dp-3, mc-39b; mockups set 1 `01-08`, `01-08c`, `01-08d`, approved 2026-11-12; page 18 PL1 and PL5b,
-- approved 2026-11-14, ap-10). Francis's yes, 2026-11-22 ("1a"): one add-only read for players, keyed on the last place
-- shown to each group, so the map's frame doesn't go at each move. Add-only.
--   1. private.pack_place_map(pack, entry_id): the pack's map for a place of that pack: the first map entry (by entry
--      id, as the GM's read sorts them; mp-1) that names the place itself, else the nearest place it sits in (S13: a
--      Location no map names shows the map of the place it is in; src/modules/expedition/placeMap.ts, resolvePlaceMap).
--   2. public.map_for_players(campaign): for each of the reader's groups, the campaign's copy of the map of the last
--      place shown to that group on the expedition under way (mc-39b's rule, as public.encounter_check_for_players), and
--      only while that copy is shown to the players (its eye open: visibility 'all'): the copy's asset id and its name
--      (the map's title, as place.addMap named it). The copy is the one tied to that place (places.map_asset_id), else
--      the one another place of the campaign holds for the same pack map (one copy per campaign, 5m-2). Nothing before
--      a place is shown to the group, nothing while the eye is closed, nothing of a place shown only to another group,
--      nothing to someone outside the campaign.
--      It sends nothing a player can't already read: an asset at visibility 'all' is read, row and file, by every member
--      ("assets: read by visibility", 20261103200000_m5b_1b_place_picture.sql). It sends no place id, no pack or map
--      entry, no place name, no position (a map's pins are R2, 07 §9).
--   3. A map's eye opened or closed ticks the signal of every group of its campaign (private.tick_group), so players'
--      screens read again at once. The signal carries no word of what changed. Every group, not only those whose last
--      shown place has this map: working out which would repeat the read above in a trigger, and a needless tick costs
--      one quiet re-read and tells a player nothing (ticks already come with each piece the GM shows). Accepted for that.
-- builds on (calls, replaces nothing): private.in_my_group from 20261031180000_m5_places_review.sql; private.visit_shown
-- and private.place_chain from 20261113120000_dec_7_3_place_check_and_rules.sql; private.tick_group from
-- 20261102100000_m5b_g2_place_pieces.sql (each its newest definition).
-- Adds three functions and one trigger. Replaces no function, policy or table. Drops, renames and deletes nothing, and
-- writes no existing row.

-- 1. A pack place's map -----------------------------------------------------------------------------------------------

create function private.pack_place_map(pack uuid, entry_id text) returns text
language sql stable security definer set search_path = '' as $$
  select m.pack_entry_id
  from private.place_chain(pack, entry_id) c
  join public.library_entries m on m.pack_id = pack and m.kind = 'map'
    and jsonb_typeof(m.data -> 'locationIds') = 'array'
    and (m.data -> 'locationIds') ? (c.entry).pack_entry_id
  order by c.depth, m.pack_entry_id
  limit 1;
$$;
revoke execute on function private.pack_place_map(uuid, text) from public, anon, authenticated;

-- 2. What players read: the shared map of the last place shown ---------------------------------------------------------

create function public.map_for_players(campaign uuid)
returns table (group_number integer, asset_id uuid, title text)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select g.number from public.party_groups g
    where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
  ),
  -- Each group's last place shown to it, in the expedition under way (mc-39b).
  last_shown as (
    select distinct on (gp.group_number) gp.group_number, p.id as place_id, p.pack_id, p.pack_entry_id, p.map_asset_id
    from public.group_places gp
    join mine on mine.number = gp.group_number
    join public.expeditions x on x.id = gp.expedition_id and x.ended_at is null and not x.undone
    join public.places p on p.id = gp.place_id and not p.undone
    where gp.campaign_id = campaign and not gp.undone and private.visit_shown(gp.id)
    order by gp.group_number, gp.created_at desc, gp.id desc
  ),
  -- Its copy: the one tied to it, else the copy another place of the campaign holds for the same pack map.
  held as (
    select l.group_number, coalesce(
      l.map_asset_id,
      (select q.map_asset_id from public.places q
       where l.pack_id is not null and q.campaign_id = campaign and not q.undone and q.id <> l.place_id
         and q.map_asset_id is not null and q.pack_id = l.pack_id and q.pack_entry_id is not null
         and private.pack_place_map(q.pack_id, q.pack_entry_id) = private.pack_place_map(l.pack_id, l.pack_entry_id)
       order by q.created_at, q.id
       limit 1)
    ) as asset_id
    from last_shown l
  )
  select c.group_number, a.id, a.name
  from held c
  join public.assets a on a.id = c.asset_id and a.campaign_id = campaign and a.kind = 'map' and a.visibility = 'all'
  order by c.group_number;
$$;
revoke execute on function public.map_for_players(uuid) from public, anon;
grant execute on function public.map_for_players(uuid) to authenticated, service_role;

-- 3. The eye opened or closed: every group of the campaign reads again ----------------------------------------------

create function private.tick_map_shown() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'map' and old.visibility is distinct from new.visibility then
    perform private.tick_group(new.campaign_id, g.number) from public.party_groups g where g.campaign_id = new.campaign_id;
  end if;
  return null;
end;
$$;
revoke execute on function private.tick_map_shown() from public, anon, authenticated;
create trigger tick_map_shown after update of visibility on public.assets
  for each row execute function private.tick_map_shown();
