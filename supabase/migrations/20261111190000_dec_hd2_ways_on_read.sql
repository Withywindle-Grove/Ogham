-- A reveal belongs to its campaign (hd-2, Francis "A", design/rulings/m5b-morning-rulings-2026-11-11.md), and players
-- read the ways on (mc-28, design/rulings/scene-mockup-rulings-2026-11-11.md; December step 4, piece e). Plan:
-- docs/plans/dec-hd2-ways-on-read.md. Hard rule 5.
--   The trouble: a library entry has no campaign (one row serves every campaign its pack is attached to), so the read
--   rule on library_entries can only say "this person may read this row". private.item_readable said yes when ANY of
--   the reader's campaigns using the pack had opened the item (revealed it, put it on sale, listed it in a kit, named
--   it as a patron's garb): a player in campaigns A and B on one pack read in B what only A had opened.
--   A. public.campaign_library(campaign, packs): the entries of the campaign's packs as THIS reader may see them in
--      THAT campaign. The app's loader asks it, so what a device shows for a campaign follows that campaign alone.
--   B. private.item_readable (the direct read rule's question) is narrowed: an item is readable by a direct read only
--      when it is open in EVERY one of the reader's campaigns that attach the pack. The read policy on library_entries
--      and private.patch_open_to_me call it, so both narrow without being replaced.
--   C. public.campaign_exceptions: a player's exceptions for items follow this campaign only.
--   D. public.campaign_ways_on(campaign): for each group the reader is in, the routes leaving its current place. A
--      hidden route is never sent; the far end has no id and no name until a piece of that place has been shown to
--      the group (the rule public.known_places_campaign uses, so no name is sent that the reader can't already read)
--      and something of the place the group is at now has been shown too (mc-28b). Each way sent carries how it is travelled
--      and how long it takes (mc-28a, Francis "B", 2026-11-12): by, name, value and unit of each way of moving, and
--      nothing else of the route's `travel` (a barrier's note or its need for the GM's approval, should a pack carry
--      one, stays the GM's); behind the same gate as the far end's name. No type or note, and none of the pack's own
--      ids (they can read like names). The
--      `route` kind stays GM-only in private.player_facing: a direct read and the log give players no route.
-- Replaces: private.item_readable (newest in 20261111130000_dec_1a_patrons.sql, PR #636; its patron-garb reason is
-- kept) and public.campaign_exceptions (newest in 20261029090000_m4b_rulings_fixes.sql). Adds private.item_open_in,
-- private.items_open_in, private.patch_open_in, private.route_amount, private.route_ways, public.campaign_library and
-- public.campaign_ways_on.
-- Order: #636 (…130000) is applied before this one. So that a database without #636 can still be built from this
-- branch, private.item_in_patron_garb is stated here with `create or replace`, word for word as #636 has it; were
-- #636 applied after this file, its plain `create function` would fail on it, loudly, before undoing B.
-- Data: drops, renames and deletes nothing; writes no rows.

-- As in 20261111130000_dec_1a_patrons.sql (unchanged; see "Order" above).
create or replace function private.item_in_patron_garb(campaign uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.campaign_packs cp
    join public.library_entries p on p.pack_id = cp.pack_id and p.kind = 'patron'
    where cp.campaign_id = campaign
      and jsonb_path_exists(p.data, '$.holyGarb[*].itemIds[*] ? (@ == $id)', jsonb_build_object('id', item))
  );
$$;
revoke execute on function private.item_in_patron_garb(uuid, text) from public, anon;
grant execute on function private.item_in_patron_garb(uuid, text) to authenticated, service_role;

-- 1. Open in one campaign ----------------------------------------------------------------------------------------------

-- Whether this campaign has opened the item to its players: known to the party, for sale on the copy that wins in
-- the campaign, listed in a starting kit, or named as a patron's holy garb. The four reasons of
-- private.item_readable (20261111130000), for one campaign. Says nothing about who asks: only the functions below
-- call it, each after checking the reader.
create function private.item_open_in(campaign uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.known_items k where k.campaign_id = campaign and k.item_id = item)
    or private.item_for_sale_in(campaign, item)
    or private.item_in_kit(campaign, item)
    or private.item_in_patron_garb(campaign, item);
$$;
revoke execute on function private.item_open_in(uuid, text) from public, anon, authenticated;

-- private.patch_open_to_me (20261111110000) for one campaign: a patch naming items by id is open only when every
-- one of them is open in this campaign; and never when it changes a field an entry it may match keeps hidden.
create function private.patch_open_in(campaign uuid, patch_pack uuid, patch jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when patch -> 'match' ->> 'kind' = 'item'
      and exists (select 1 from unnest(private.patch_ids(patch)) i(id) where not private.item_open_in(campaign, i.id))
    then false
    else not private.patch_hides_target_field(patch_pack, patch)
  end;
$$;
revoke execute on function private.patch_open_in(uuid, uuid, jsonb) from public, anon, authenticated;

-- 2. The direct read rule (B) ------------------------------------------------------------------------------------------

-- As in 20261111130000_dec_1a_patrons.sql (known, for sale, in a kit, a patron's garb: now through
-- private.item_open_in), but the item must be open in EVERY campaign the reader belongs to that attaches the pack,
-- not in any one of them: the row has no campaign, so a reveal in one campaign alone must not open it to someone who
-- is also in another. What each campaign opened is read through public.campaign_library.
create or replace function private.item_readable(pack uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.campaign_packs cp
      where cp.pack_id = pack and private.is_member(cp.campaign_id)
    )
    and not exists (
      select 1 from public.campaign_packs cp
      where cp.pack_id = pack and private.is_member(cp.campaign_id)
        and not private.item_open_in(cp.campaign_id, item)
    );
$$;

-- 3. The exceptions (C) ------------------------------------------------------------------------------------------------

-- As in 20261029090000_m4b_rulings_fixes.sql, but a player's exception for an item is theirs only when the item is
-- open in THIS campaign.
create or replace function public.campaign_exceptions(campaign uuid) returns table (id uuid, overrides jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id,
    case
      when private.is_gm(campaign) then s.overrides
      else coalesce((
        select jsonb_object_agg(o.key, o.value)
        from jsonb_each(s.overrides) o
        cross join lateral (select split_part(o.key, ':', 1) as kind) k
        where private.player_facing(k.kind)
          and (k.kind <> 'item' or private.item_open_in(campaign, substring(o.key from char_length(k.kind) + 2)))
      ), '{}'::jsonb)
    end
  from public.campaign_pack_secrets s
  join public.campaign_packs cp on cp.id = s.id
  where s.campaign_id = campaign and private.is_member(campaign);
$$;

-- 4. The campaign's library, as this reader may see it there (A) -------------------------------------------------------

-- Every item id the campaign has opened to its players, worked out once for the whole campaign: the same four
-- reasons as private.item_open_in, as sets (so a page of a thousand items isn't a thousand questions). Keep the two
-- in step: known; for sale on the copy that wins in the campaign (private.item_for_sale_in's order: the GM's
-- exception, then homebrew, then priority, then the pack's id); listed in a starting kit (private.item_in_kit's two
-- paths); named as a patron's holy garb (private.item_in_patron_garb's path). Says nothing about who asks.
create function private.items_open_in(campaign uuid) returns setof text
language sql stable security definer set search_path = '' as $$
  select k.item_id from public.known_items k where k.campaign_id = campaign
  union
  select w.item
  from (
    select distinct on (e.pack_entry_id) e.pack_entry_id as item, private.for_sale(e.data) as on_sale
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    left join public.campaign_pack_secrets s on s.id = cp.id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'item'
    where cp.campaign_id = campaign
    order by e.pack_entry_id, coalesce(s.overrides ? ('item:' || e.pack_entry_id), false) desc, (p.kind = 'homebrew') desc,
      cp.priority desc, cp.pack_id::text
  ) w
  where w.on_sale
  union
  select v.id #>> '{}'
  from public.campaign_packs cp
  join public.library_entries k on k.pack_id = cp.pack_id and k.kind = 'startingKit'
  cross join lateral (
    select jsonb_path_query(k.data, '$.items[*].itemId') as id
    union all
    select jsonb_path_query(k.data, '$.rolls[*].rows[*].items[*].itemId')
  ) v
  where cp.campaign_id = campaign and jsonb_typeof(v.id) = 'string'
  union
  select v.id #>> '{}'
  from public.campaign_packs cp
  join public.library_entries p on p.pack_id = cp.pack_id and p.kind = 'patron'
  cross join lateral (select jsonb_path_query(p.data, '$.holyGarb[*].itemIds[*]') as id) v
  where cp.campaign_id = campaign and jsonb_typeof(v.id) = 'string';
$$;
revoke execute on function private.items_open_in(uuid) from public, anon, authenticated;

-- Every entry of the packs attached to the campaign (only those in `packs`, when given) that the reader may see in
-- this campaign: its readable part only (hidden fields stay in library_entry_secrets, the GM's). The GM of the
-- campaign: all of them. Another member: the read policy's player branches (20261111110000), with the item and patch
-- questions asked of this campaign alone. Nobody else: nothing.
--   Read a page at a time by key, not by offset: rows in id order, after `after_id` when given, at most `page_size`
--   (1 to 1000) of them; the caller asks again with the last id it got until a page comes back short.
--   Whether the reader is a member or the GM is asked once per call, and the campaign's open items are worked out
--   once per call (only for a player), not once per row.
create function public.campaign_library(campaign uuid, packs uuid[] default null, after_id uuid default null, page_size integer default 1000)
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
      -- fs-1: a table the pack opens to players.
      or (e.kind = 'table' and (e.data -> 'gmOnly') = 'false'::jsonb)
    )
  order by e.id
  limit least(greatest(coalesce(page_size, 1000), 1), 1000);
$$;
revoke execute on function public.campaign_library(uuid, uuid[], uuid, integer) from public, anon;
grant execute on function public.campaign_library(uuid, uuid[], uuid, integer) to authenticated, service_role;

-- 5. The ways on (D) ---------------------------------------------------------------------------------------------------

-- One amount of time as a route's `travel` gives it, `{ value, unit }`: a whole number, 0 or more, of one of the
-- clock's units (the app's ROUTE_UNITS, routes.ts; pack:check's list), the unit trimmed. Null for anything else.
create function private.route_amount(raw jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(raw) = 'object' and jsonb_typeof(raw -> 'unit') = 'string' and jsonb_typeof(raw -> 'value') = 'number' then
      case
        when btrim(raw ->> 'unit', E' \t\n\r') in ('round', 'turn', 'hour', 'day', 'week')
          and (raw ->> 'value')::numeric >= 0 and (raw ->> 'value')::numeric = trunc((raw ->> 'value')::numeric)
        then jsonb_build_object('value', trunc((raw ->> 'value')::numeric), 'unit', btrim(raw ->> 'unit', E' \t\n\r'))
      end
  end;
$$;
revoke execute on function private.route_amount(jsonb) from public, anon, authenticated;

-- A route's ways of moving as players may read them (mc-28a), exactly as the app's routeWays reads `travel`
-- (src/modules/library/routes.ts): one amount gives one way with no id or name; a list gives each way that has a
-- `by` and a good amount, in the pack's order (a way named twice keeps its first; its name is its `name`, else its
-- `by`); anything else gives none. Each way is built from by, name, value and unit ALONE: whatever else an entry of
-- `travel` carries never leaves here.
create function private.route_ways(travel jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case jsonb_typeof(travel)
    when 'array' then coalesce((
      select jsonb_agg(
        jsonb_build_object('by', k.way_id, 'name', k.way_name, 'value', k.amount -> 'value', 'unit', k.amount -> 'unit')
        order by k.pos)
      from (
        select distinct on (x.way_id) x.way_id, coalesce(nullif(x.way_name, ''), x.way_id) as way_name, x.amount, x.pos
        from (
          select
            case when jsonb_typeof(t.el -> 'by') = 'string' then btrim(t.el ->> 'by', E' \t\n\r') else '' end as way_id,
            case when jsonb_typeof(t.el -> 'name') = 'string' then btrim(t.el ->> 'name', E' \t\n\r') else '' end as way_name,
            private.route_amount(t.el) as amount,
            t.pos
          from jsonb_array_elements(travel) with ordinality t(el, pos)
        ) x
        where x.amount is not null and x.way_id <> ''
        order by x.way_id, x.pos
      ) k
    ), '[]'::jsonb)
    when 'object' then
      case when private.route_amount(travel) is null then '[]'::jsonb
        else jsonb_build_array(jsonb_build_object('by', '', 'name', '', 'value', private.route_amount(travel) -> 'value', 'unit', private.route_amount(travel) -> 'unit'))
      end
    else '[]'::jsonb
  end;
$$;
revoke execute on function private.route_ways(jsonb) from public, anon, authenticated;

-- For each group the reader is in (the GM: every group), the routes leaving the group's current place, when that
-- place was made from a pack still attached to the campaign: the routes of that pack that start there, and those
-- that end there unless one-way (pt-f3).
--   Never sent: a route unless its `hidden` is plainly false or absent (a pack that files `hidden` among its GM-only
--   fields has it read from there: the whole entry is read, and anything but false counts as hidden); a route that
--   ends here unless its `oneWay` is plainly false or absent; type, notes; anything of `travel` but each way's by,
--   name, value and unit; the pack's ids of the route and of either place.
--   ways: how the way is travelled and how long it takes (mc-28a; private.route_ways), an array, empty when the
--   route gives no time.
--   route_id is the library row's id (stable across pack updates while the route stays in the file).
--   to_place_id and to_name: the far end's place in this campaign and its players' name (as public.scene_pieces
--   names a place), only when a piece of it has been shown to this group on some visit, exactly as
--   public.known_places_campaign decides; else both null: "not yet explored".
--   And no far end is named until something of the place the group is standing in has been shown to it (mc-28b,
--   Francis "a", 2026-11-12), on this visit or an earlier one (mc-28c: what has been revealed stays known): the same
--   test as for the far end. Until then NO row is sent for that group (mc-28b: "until the GM shows a piece of the
--   place, its players see no ways to choose from"; ruled by the lead, 2026-11-12: a list of nameless ways would
--   still say how many there are, and a known far end would say where the group has come to before the GM does).
--   Coming back to a place it knows, the group has its ways at once.
create function public.campaign_ways_on(campaign uuid)
returns table (group_number integer, route_id uuid, to_place_id uuid, to_name text, ways jsonb)
language sql stable security definer set search_path = '' as $$
  select g.number, r.id, far.id, case when far.id is not null then coalesce(nullif(far.players_name, ''), far.name) end,
    private.route_ways(w.whole -> 'travel')
  from public.party_groups g
  cross join lateral private.current_group_place(g.campaign_id, g.number) gp
  join public.places here on here.id = gp.place_id and not here.undone and here.pack_entry_id is not null
  join public.campaign_packs cp on cp.campaign_id = g.campaign_id and cp.pack_id = here.pack_id
  join public.library_entries r on r.pack_id = here.pack_id and r.kind = 'route'
  left join public.library_entry_secrets rs on rs.id = r.id
  cross join lateral (select r.data || coalesce(rs.data, '{}'::jsonb) as whole) w
  -- The two ends, trimmed as the app reads them (routes.ts).
  cross join lateral (select btrim(coalesce(w.whole ->> 'from', '')) as from_entry, btrim(coalesce(w.whole ->> 'to', '')) as to_entry) ends
  cross join lateral (
    select case when ends.from_entry = here.pack_entry_id then ends.to_entry else ends.from_entry end as far_entry
  ) f
  -- Whether a piece of the place the group is at now has been shown to it, on any visit (mc-28b, mc-28c): the
  -- far end's own test below, asked of this place. Without it the group gets no row (the filter at the end).
  cross join lateral (
    select exists (
      select 1
      from public.group_places v
      join public.expeditions x on x.id = v.expedition_id and not x.undone
      join public.piece_shows s on s.group_place_id = v.id and s.shown and not s.undone
      join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
      where v.campaign_id = g.campaign_id and v.place_id = here.id and v.group_number = g.number and not v.undone
    ) as shown
  ) here_now
  left join public.places far on far.campaign_id = g.campaign_id and far.pack_id = here.pack_id
    and far.pack_entry_id = f.far_entry and not far.undone
    and exists (
      select 1
      from public.group_places v
      join public.expeditions x on x.id = v.expedition_id and not x.undone
      join public.piece_shows s on s.group_place_id = v.id and s.shown and not s.undone
      join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
      where v.campaign_id = g.campaign_id and v.place_id = far.id and v.group_number = g.number and not v.undone
    )
  where g.campaign_id = campaign
    and (private.is_gm(campaign) or private.in_my_group(campaign, g.number))
    -- mc-28b: no ways at all until something of this place has been shown to the group.
    and here_now.shown
    and coalesce(w.whole -> 'hidden', 'false'::jsonb) = 'false'::jsonb
    and (
      ends.from_entry = here.pack_entry_id
      or (ends.to_entry = here.pack_entry_id and coalesce(w.whole -> 'oneWay', 'false'::jsonb) = 'false'::jsonb)
    )
  order by g.number, r.id;
$$;
revoke execute on function public.campaign_ways_on(uuid) from public, anon;
grant execute on function public.campaign_ways_on(uuid) to authenticated, service_role;
