-- Players get a place's players' name, never its own name (pn-1, Francis 2026-11-14: "Fix db yes"; hard rule 5; tr-1;
-- found by W21, supabase/tests/dec-3-town-hidden.test.ts). A place's own name (places.name) is the GM's; the name
-- players see once a piece is shown is places.players_name, falling back to the own name when it is empty, as
-- public.scene_pieces and public.known_places_campaign (20261113200000_players_never_get_link_ids.sql) already send it.
-- Two player reads still sent places.name:
--   1. public.scene_town: newest in 20261106150000_m8b_0_places_settlement.sql; its place_name column.
--   2. public.known_places: newest in 20261113200000_players_never_get_link_ids.sql; its place_name column.
-- What changes: in each, that one column becomes `coalesce(nullif(p.players_name, ''), p.name)`. Every other line is as
-- it was: the filters, the order, the arguments and the return types, so nothing that calls them changes; `create or
-- replace` keeps their grants. The GM's own reads (the places table, GM-only) are untouched.
-- Replaces two functions. Adds nothing else. Drops, renames and deletes no data; no row is written.

-- 1. The town's places for players ---------------------------------------------------------------------------------------

-- As in 20261106150000_m8b_0_places_settlement.sql, with the place's name for players.
create or replace function public.scene_town(campaign uuid)
returns table (group_number integer, place_name text, entry_key text, name text, kind text, open boolean)
language sql stable security definer set search_path = '' as $$
  select v.group_number, coalesce(nullif(p.players_name, ''), p.name), e.key, e.value ->> 'name', coalesce(e.value ->> 'kind', ''), (e.value ->> 'open')::boolean
  from public.party_groups g
  cross join lateral private.town_visit(g.campaign_id, g.number) v
  join public.places p on p.id = v.place_id and not p.undone and (p.safety is not null or p.settlement is not null)
  cross join lateral jsonb_each(p.town) e
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
    and (e.value ->> 'shown') = 'true'
    -- The place itself is shown to this group: a piece of it shown on the visit.
    and exists (
      select 1 from public.piece_shows s
      join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
      where s.group_place_id = v.id and s.shown and not s.undone
    )
  order by v.group_number, lower(e.value ->> 'name'), e.key;
$$;

-- 2. The places a group knows on this expedition ---------------------------------------------------------------------------

-- As in 20261113200000_players_never_get_link_ids.sql, with the place's name for players.
create or replace function public.known_places(campaign uuid)
returns table (visit_id uuid, group_number integer, place_id uuid, place_name text, visited_at timestamptz, piece_id uuid, kind text, body text)
language sql stable security definer set search_path = '' as $$
  select gp.id, gp.group_number, p.id, coalesce(nullif(p.players_name, ''), p.name), gp.created_at, pc.id, pc.kind, private.plain_link_text(pc.body)
  from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id and x.ended_at is null and not x.undone
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where gp.campaign_id = campaign and not gp.undone and private.in_my_group(campaign, gp.group_number)
  order by gp.created_at, gp.id, s.shown_at, s.id;
$$;
