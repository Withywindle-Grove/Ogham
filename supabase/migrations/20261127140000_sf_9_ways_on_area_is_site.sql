-- "Where to?": an Area is the pack's `site`, not its `area` (Scene feedback sf-9, the read's fix; hard rule 5).
-- 20261126230000_sf_9_ways_on_number_elsewhere.sql names the place a far place sits in, on a visit alone, when that
-- place's pack `type` is "area". In this app the pack's "area" is a Location (a spot of a place) and an Area is the
-- pack's "site" (p2p-1, 2026-11-18, design/rulings/scene-point-to-point-2026-11-18.md: "the pack's `type` values are
-- unchanged"; the app reads it so: src/modules/expedition/dungeonWayOut.ts, `typeOf(e) === 'site'`). So the read did
-- the opposite of its own rule (#122's ⚑ 1, "Send a visited Area's name"; the review of #122, finding 1):
--   * a Location with rooms in it (a shed, its cellar) had its players' name sent over its rooms' rows once the group
--     had stood in it, with nothing of it shown: a place's name before the place is explored;
--   * an Area's players' name was not sent on a visit, only once a piece of the Area itself had been shown.
-- That migration is applied (test and main), so this fixes forward.
--
-- The one change: in `far_area.nameable`, the container's `type` is compared with 'site' where it was 'area'. Nothing
-- else of the function differs from its newest definition: the rows sent, every other column, the tests for "known",
-- the hidden `parentId`, the names read, and the order are as they were. What a container that is no Area needs to be
-- named is unchanged too: the group has explored it (a piece of it shown).
--
-- Data: this replaces the function's body in place (`create or replace`; the arguments and the answer's columns are
-- the same, so nothing is dropped). It drops, renames or deletes nothing and writes no rows. The function's security
-- settings (stable, security definer, an empty search_path) are restated as they were; its grants (not public, not
-- anon; authenticated and service_role) stay on the function and are restated below.
-- builds on: public.campaign_ways_on from 20261126230000_sf_9_ways_on_number_elsewhere.sql (its newest definition).

-- For each group the reader is in (the GM: every group), the routes leaving the group's current place, when that
-- place was made from a pack still attached to the campaign: the routes of that pack that start there, and those
-- that end there unless one-way (pt-f3).
--   Never sent: a route unless its `hidden` is plainly false or absent (a pack that files `hidden` among its GM-only
--   fields has it read from there: the whole entry is read, and anything but false counts as hidden); a route that
--   ends here unless its `oneWay` is plainly false or absent; type, notes; anything of `travel` but each way's by,
--   name, value and unit; the pack's ids of the route, of either place and of any place they sit in; the name of a
--   place not yet explored; an Area's own name; the players' name of an Area the group does not know.
--   ways: how the way is travelled and how long it takes (mc-28a; private.route_ways), an array, empty when the
--   route gives no time.
--   route_id is the library row's id (stable across pack updates while the route stays in the file).
--   to_place_id and to_name: the far end's place in this campaign and its players' name (as public.scene_pieces
--   names a place), only when a piece of it has been shown to this group on some visit, exactly as
--   public.known_places_campaign decides; else both null: not yet explored.
--   to_number and elsewhere (sf-9, sf-19), four cases, the pack's own entry for the far place read here and never
--   sent as written:
--     (1) the far place explored (to_place_id given): its map number; elsewhere false.
--     (2) not explored, in a place the group knows: its map number where it has one, and no name, whether or not
--         that Area's map is shown; elsewhere false.
--     (3) not explored, in a place the group does not know: NO number (not sent, not only left off the screen), no
--         name, no Area's name; elsewhere true. The same when the pack has no entry for the far place.
--     (4) a hidden route: no row, as before.
--   The map number is the entry's `key` when it is text, trimmed, at most 200 characters, read from the part of the
--   entry every reader of the GM's Move on reads (a pack that files `key` among its GM-only fields sends none).
--   "In a place the group knows": the far place's own container is its `parentId`. The group knows it when one of
--   its visits (not undone, of an expedition not undone, at a place of this pack not undone) stood at that container
--   itself or at a place inside it, at any depth (private.place_chain). A far place with no container (the top of
--   the pack) counts as known only when the group has stood at a place that has none either: from inside an Area,
--   a way to a place in no Area leads out of the Areas the group knows.
--   A pack that files a place's `parentId` among its GM-only fields hides where that place sits (the review of #122,
--   finding 2): the read cannot say its Area is known, so the way to it is (3), no number and no Area's name, unless
--   the place is explored, when it keeps its place and name (as before sf-9) and still has no number. A visited place
--   that hides its own `parentId` does not count as a place with no container.
--   to_area_name (#122's ⚑ 1), under (1) and (2) only, never under (3): the players' name of the far place's
--   container, the same place whose visit makes the way known. It is the `players_name` of the campaign's place made
--   from that container when it has one (trimmed; only blanks is none), else the pack entry's `playerView.name` when
--   it is text (trimmed, at most 200 characters), read from the part of the entry every reader reads. Null when
--   neither is given (never the entry's own name, never its id), and null for a far place with no container. The
--   Area the group stands in is named by the same rule; the players' place card (public.place_card_for_players)
--   names it as before.
--   Which container is named (the review of #122, finding 1; ⚑ 1 is "a visited Area's name", an Area's only): one
--   that is an Area, its `type` plainly "site" in the part of the entry every reader reads (a pack that files `type`
--   among its GM-only fields has no Area here), on the visit that makes the way known; any other container (a place
--   with rooms) only when the group has itself explored it, a piece of it shown on some visit, the far end's own
--   test: a place's name is never sent before the place is explored.
--   And no far end is named until something of the place the group is standing in has been shown to it (mc-28b,
--   Francis "a", 2026-11-12), on this visit or an earlier one (mc-28c: what has been revealed stays known): the same
--   test as for the far end. Until then NO row is sent for that group (mc-28b: "until the GM shows a piece of the
--   place, its players see no ways to choose from"; ruled by the lead, 2026-11-12: a list of nameless ways would
--   still say how many there are, and a known far end would say where the group has come to before the GM does).
--   Coming back to a place it knows, the group has its ways at once.
create or replace function public.campaign_ways_on(campaign uuid)
returns table (group_number integer, route_id uuid, to_place_id uuid, to_name text, ways jsonb, to_number text, elsewhere boolean, to_area_name text)
language sql stable security definer set search_path = '' as $$
  select g.number, r.id, far.id, case when far.id is not null then coalesce(nullif(far.players_name, ''), far.name) end,
    private.route_ways(w.whole -> 'travel'),
    case when reach.known and not far_in.container_hidden then far_in.number end,
    not reach.known,
    -- The Area's players' name (#122's ⚑ 1): only for a way that does not lead elsewhere, only for an Area or a place
    -- the group has explored (far_area), and only a name given for players; never the Area's own name.
    case when reach.known and far_in.container <> '' and far_area.nameable then coalesce(
      (select nullif(btrim(a.players_name, E' \t\n\r'), '') from public.places a
       where a.campaign_id = g.campaign_id and a.pack_id = here.pack_id and a.pack_entry_id = far_in.container and not a.undone),
      (select case when jsonb_typeof(ae.data #> '{playerView,name}') = 'string'
         then nullif(left(btrim(ae.data #>> '{playerView,name}', E' \t\n\r'), 200), '') end
       from public.library_entries ae
       where ae.pack_id = here.pack_id and ae.kind = 'location' and ae.pack_entry_id = far_in.container)
    ) end
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
  -- The far place as the pack has it (sf-9): its map number and the place it sits in. Read here, never sent as
  -- written; one row at most (pack, kind and entry id are unique together).
  left join public.library_entries fe on fe.pack_id = here.pack_id and fe.kind = 'location' and fe.pack_entry_id = f.far_entry
  -- Its GM-only part, read for one thing only: whether the pack hides where the place sits (one row at most).
  left join public.library_entry_secrets fes on fes.id = fe.id
  cross join lateral (
    select
      case when jsonb_typeof(fe.data -> 'key') = 'string' then nullif(left(btrim(fe.data ->> 'key', E' \t\n\r'), 200), '') end as number,
      case when coalesce(fes.data ? 'parentId', false) then ''
        when jsonb_typeof(fe.data -> 'parentId') = 'string' then btrim(fe.data ->> 'parentId', E' \t\n\r') else '' end as container,
      coalesce(fes.data ? 'parentId', false) as container_hidden
  ) far_in
  -- Whether the group knows the far place or where it sits (sf-19): explored, or one of its visits stood at the far
  -- place's container or inside it; with no container, at a place that has none either.
  cross join lateral (
    select far.id is not null or (
      fe.id is not null
      and not far_in.container_hidden
      and exists (
        select 1
        from public.places q
        cross join lateral private.place_chain(q.pack_id, q.pack_entry_id) c
        cross join lateral (
          select case when jsonb_typeof((c.entry).data -> 'parentId') = 'string' then btrim((c.entry).data ->> 'parentId', E' \t\n\r') else '' end as container
        ) up
        where q.campaign_id = g.campaign_id and q.pack_id = here.pack_id and q.pack_entry_id is not null and not q.undone
          and exists (
            select 1
            from public.group_places v
            join public.expeditions x on x.id = v.expedition_id and not x.undone
            where v.campaign_id = g.campaign_id and v.place_id = q.id and v.group_number = g.number and not v.undone
          )
          and case
            when far_in.container = '' then c.depth = 0 and up.container = ''
              and not exists (select 1 from public.library_entry_secrets cs where cs.id = (c.entry).id and cs.data ? 'parentId')
            else far_in.container in ((c.entry).pack_entry_id, up.container)
          end
      )
    ) as known
  ) reach
  -- Whether the far place's container may be named to this group: it is an Area as the pack has it, or a place the
  -- group has itself explored (a piece of it shown on some visit: the far end's own test above).
  cross join lateral (
    select exists (
      select 1 from public.library_entries ae
      where ae.pack_id = here.pack_id and ae.kind = 'location' and ae.pack_entry_id = far_in.container
        and jsonb_typeof(ae.data -> 'type') = 'string' and btrim(ae.data ->> 'type', E' \t\n\r') = 'site'
    ) or exists (
      select 1
      from public.places a
      join public.group_places v on v.campaign_id = g.campaign_id and v.place_id = a.id and v.group_number = g.number and not v.undone
      join public.expeditions x on x.id = v.expedition_id and not x.undone
      join public.piece_shows s on s.group_place_id = v.id and s.shown and not s.undone
      join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
      where a.campaign_id = g.campaign_id and a.pack_id = here.pack_id and a.pack_entry_id = far_in.container and not a.undone
    ) as nameable
  ) far_area
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
