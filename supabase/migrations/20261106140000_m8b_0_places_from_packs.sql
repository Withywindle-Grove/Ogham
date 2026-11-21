-- M8b slice 0, pull request 1: places from packs, store and link (docs/plans/m8b-0-places-from-packs.md, "Build
-- order" 1 and "The builder's review, folded in"; ruled 2026-11-06, ⚑ 1, 3, 4, 5, 7, 8, 10; ⚑ 11 applied as asked).
--   1. The link. A place made from a pack's location (07 §2 `locations`) remembers which: the GM's pack (packs.id)
--      and the entry's own id in the pack (library_entries.pack_entry_id), never the library row (a pack update
--      deletes entries no longer in the file). One such place per link while it isn't undone (⚑ 10): two places from
--      a pack may share a name; places typed by name keep one per name. With it: the pack's type, parent and map
--      key (for telling same names apart), the terrain (pre-fills Move…), the players' name (⚑ 3, C: the pack's
--      `playerView.name` when it has one, else blank meaning "the pack's name"; the GM may change it) and the region
--      whose encounter tables are offered first (⚑ 7: the rules set's regional table the location's encounter check
--      names; read in the next pull request). All on public.places, which only the GM reads (20261102100000).
--   2. One request, one log line, one Undo: public.make_place_from_pack writes the place, its notes and its pieces
--      (all unshown: nothing reaches players until the eye) in one call, with the made-by-request pattern; a second
--      call for the same link gives back the place it made (coming back finds the same place). The app composes the
--      pieces and the notes from the entry (07 "Pieces for Show players"; placeFromPack.ts), the database checks the
--      link (an attached pack's location), the GM, and every limit. Undo marks the place, its notes and its pieces
--      undone (undoable_makings; place_notes is in undoable_tables already): no deletion.
--   3. Start expedition and Where now? by place id (public.start_expedition_at, public.set_group_place_at), so a
--      place picked from a pack is the one meant even when another shares its name; the name-taking functions keep
--      their shape and share the body. A typed name finds a typed place first, else the one pack place of that name,
--      else makes a typed place (private.place_named). Move… already takes an id: arriving (travel_move paid at
--      once, or pay_owed later) now goes to that id, not to the name.
--   4. Players' name: public.scene_pieces and public.known_places_campaign give the players' name when the GM set
--      one, else the place's name (⚑ 3, C). What players read is otherwise unchanged.
-- Replaces: private.place_rules and private.place_named (newest in 20261031170000_m5_places_messages.sql),
-- public.start_expedition(uuid, text, text) (20261031170000), public.set_group_place(uuid, integer, text)
-- (20261031170000), private.pay_owed and public.travel_move (20261103110000_m5b_1_travel.sql), public.scene_pieces
-- (20261102100000_m5b_g2_place_pieces.sql), public.known_places_campaign (20261103141000). Replaces one unique
-- index on places (places_one_per_name: now typed places only; no data touched). Adds seven columns, three private
-- functions, three public functions, one index, one logged_commands row and one undoable_makings row. Drops,
-- renames and deletes no data; no rows are removed or changed.

-- 1. The link and the pack's facts on a place -------------------------------------------------------------------------

alter table public.places
  add column pack_id uuid,
  add column pack_entry_id text check (pack_entry_id is null or pack_entry_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add column pack_type text check (pack_type is null or pack_type in ('region', 'site', 'area', 'floor', 'room', 'building')),
  add column pack_parent_id text check (pack_parent_id is null or length(pack_parent_id) between 1 and 200),
  add column pack_key text check (pack_key is null or length(pack_key) between 1 and 200),
  add column players_name text not null default '' check (length(players_name) <= 200),
  add column region_id text check (region_id is null or length(region_id) between 1 and 200),
  add constraint places_pack_link check ((pack_id is null) = (pack_entry_id is null));

comment on column public.places.pack_id is
  'The GM''s pack this place was made from (packs.id; no foreign key: the place outlives the pack); null: typed.';
comment on column public.places.pack_entry_id is
  'The location''s own id in that pack (library_entries.pack_entry_id), kept across pack updates; with pack_id, the link.';
comment on column public.places.players_name is
  'What players see as the place''s name once a piece is shown (⚑ 3, C): blank means the place''s name.';
comment on column public.places.region_id is
  'The rules set''s region whose encounter tables are offered first after a hit here (⚑ 7); null: none known.';

-- Typed places keep one per name; places from a pack are told apart by their link (⚑ 10).
drop index public.places_one_per_name;
create unique index places_one_per_name on public.places (campaign_id, lower(name)) where not undone and pack_entry_id is null;
create unique index places_one_per_pack_entry on public.places (campaign_id, pack_id, pack_entry_id) where not undone;

-- As in 20261031170000_m5_places_messages.sql, plus: the link and the pack's facts can't change after the place is
-- made (the link is the place's identity); the players' name and the region may.
create or replace function private.place_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.name := trim(new.name);
    new.players_name := trim(coalesce(new.players_name, ''));
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That place was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.name is distinct from old.name or new.created_by is distinct from old.created_by
    or new.pack_id is distinct from old.pack_id or new.pack_entry_id is distinct from old.pack_entry_id
    or new.pack_type is distinct from old.pack_type or new.pack_parent_id is distinct from old.pack_parent_id
    or new.pack_key is distinct from old.pack_key then
    raise exception 'That can''t be changed.';
  end if;
  new.players_name := trim(coalesce(new.players_name, ''));
  new.updated_at := now();
  return new;
end;
$$;

-- As in 20261031170000_m5_places_messages.sql, plus: a typed name finds a typed place first; failing that, the one
-- place from a pack with that name (two or more: none, so the typed place is its own); then makes a typed place.
create or replace function private.place_named(campaign uuid, place_name text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  found uuid;
begin
  if place_name is null or length(trim(place_name)) = 0 then
    return null;
  end if;
  if length(trim(place_name)) > 200 then
    raise exception 'A place''s name is at most 200 characters.';
  end if;
  select p.id into found from public.places p
  where p.campaign_id = campaign and lower(p.name) = lower(trim(place_name)) and not p.undone and p.pack_entry_id is null;
  if found is null then
    select min(p.id::text)::uuid into found from public.places p
    where p.campaign_id = campaign and lower(p.name) = lower(trim(place_name)) and not p.undone and p.pack_entry_id is not null
    having count(*) = 1;
  end if;
  if found is null then
    insert into public.places (campaign_id, name) values (campaign, trim(place_name)) returning id into found;
    insert into public.place_notes (id, campaign_id) values (found, campaign);
  end if;
  return found;
end;
$$;

-- 2. A place from a pack's location -----------------------------------------------------------------------------------

-- Pick a place from a pack (place.fromPack): the campaign's place for that location, made (with its notes and its
-- pieces, all unshown) if there isn't one; the one made before otherwise. The GM, for a location of a pack attached
-- to the campaign. `details`: players_name, terrain_id, pack_type, pack_parent_id, pack_key, region_id; `notes`: the
-- five headings; `pieces`: [{ kind, body, gm_value, gm_trigger, gm_stat_line }] in the pack's order. The name is the
-- entry's own. A repeat in the same request gives back what it made. Security invoker: the GM's rules.
create function public.make_place_from_pack(campaign uuid, pack uuid, entry_id text, details jsonb default '{}'::jsonb,
  notes jsonb default '{}'::jsonb, pieces jsonb default '[]'::jsonb) returns public.places
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('places');
  place public.places;
  entry_name text;
  piece jsonb;
  at integer := 0;
  heading text;
begin
  if made is not null then
    select * into place from public.places p where p.id = made;
    return place;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  details := coalesce(details, '{}'::jsonb);
  notes := coalesce(notes, '{}'::jsonb);
  pieces := coalesce(pieces, '[]'::jsonb);
  if entry_id is null or entry_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'That place isn''t in an attached pack.';
  end if;
  if not exists (select 1 from public.campaign_packs cp where cp.campaign_id = campaign and cp.pack_id = pack) then
    raise exception 'That place isn''t in an attached pack.';
  end if;
  select e.name into entry_name from public.library_entries e where e.pack_id = pack and e.kind = 'location' and e.pack_entry_id = entry_id;
  if entry_name is null then
    raise exception 'That place isn''t in an attached pack.';
  end if;
  select * into place from public.places p where p.campaign_id = campaign and p.pack_id = pack and p.pack_entry_id = entry_id and not p.undone;
  if place.id is not null then
    return place;
  end if;
  if jsonb_typeof(details) <> 'object' or jsonb_typeof(notes) <> 'object'
    or jsonb_typeof(pieces) <> 'array' then
    raise exception 'That place isn''t written right.';
  end if;
  if jsonb_array_length(pieces) > 200 then
    raise exception 'A place has at most 200 pieces.';
  end if;
  for heading in select unnest(array['traps', 'puzzles', 'encounters', 'treasure', 'doors']) loop
    if notes ? heading and jsonb_typeof(notes -> heading) <> 'string' then
      raise exception 'That place isn''t written right.';
    end if;
    if length(coalesce(notes ->> heading, '')) > 4000 then
      raise exception 'A note is at most 4000 characters.';
    end if;
  end loop;
  for piece in select * from jsonb_array_elements(pieces) loop
    if jsonb_typeof(piece) <> 'object' or coalesce(piece ->> 'kind', '') not in ('description', 'exit', 'person', 'clue', 'treasure', 'hazard', 'other') then
      raise exception 'Pick what kind of piece it is.';
    end if;
    if length(trim(coalesce(piece ->> 'body', ''))) = 0 then
      raise exception 'Write what players will see.';
    end if;
    if length(trim(piece ->> 'body')) > 4000 then
      raise exception 'A piece is at most 4000 characters.';
    end if;
    if length(coalesce(piece ->> 'gm_value', '')) > 1000 or length(coalesce(piece ->> 'gm_trigger', '')) > 1000 or length(coalesce(piece ->> 'gm_stat_line', '')) > 1000 then
      raise exception 'A piece''s GM note is at most 1000 characters.';
    end if;
  end loop;
  insert into public.places (campaign_id, name, pack_id, pack_entry_id, pack_type, pack_parent_id, pack_key, players_name, terrain_id, region_id)
  values (
    campaign, entry_name, pack, entry_id,
    nullif(details ->> 'pack_type', ''), nullif(details ->> 'pack_parent_id', ''), nullif(details ->> 'pack_key', ''),
    coalesce(details ->> 'players_name', ''), nullif(details ->> 'terrain_id', ''), nullif(details ->> 'region_id', '')
  )
  returning * into place;
  insert into public.place_notes (id, campaign_id, traps, puzzles, encounters, treasure, doors)
  values (place.id, campaign, coalesce(notes ->> 'traps', ''), coalesce(notes ->> 'puzzles', ''), coalesce(notes ->> 'encounters', ''),
    coalesce(notes ->> 'treasure', ''), coalesce(notes ->> 'doors', ''));
  for piece in select * from jsonb_array_elements(pieces) loop
    insert into public.place_pieces (campaign_id, place_id, kind, body, position, gm_value, gm_trigger, gm_stat_line)
    values (campaign, place.id, piece ->> 'kind', trim(piece ->> 'body'), at,
      coalesce(piece ->> 'gm_value', ''), coalesce(piece ->> 'gm_trigger', ''), coalesce(piece ->> 'gm_stat_line', ''));
    at := at + 1;
  end loop;
  return place;
end;
$$;
revoke execute on function public.make_place_from_pack(uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.make_place_from_pack(uuid, uuid, text, jsonb, jsonb, jsonb) to authenticated, service_role;

-- 3. Start and Where now? by place id --------------------------------------------------------------------------------

-- The place's id when it is this campaign's and not undone; raises otherwise.
create function private.place_in_campaign(campaign uuid, place uuid) returns uuid
language plpgsql stable security invoker set search_path = '' as $$
begin
  if place is null or not exists (select 1 from public.places p where p.id = place and p.campaign_id = campaign and not p.undone) then
    raise exception 'That place isn''t in this campaign.';
  end if;
  return place;
end;
$$;
revoke execute on function private.place_in_campaign(uuid, uuid) from public, anon;
grant execute on function private.place_in_campaign(uuid, uuid) to authenticated, service_role;

-- The body of Start expedition (as in 20261031170000_m5_places_messages.sql): the expedition, where it started (the
-- GM's record, by name) and every group put at the place (hidden until shown), in one request. `place` is the place
-- already known (by id); `place_name` a typed name (made if new). Security invoker: the GM's rules.
create function private.begin_expedition(campaign uuid, mode_id text, place_name text, place uuid) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('expeditions');
  expedition public.expeditions;
  there uuid := place;
  there_name text;
begin
  if made is not null then
    select * into expedition from public.expeditions x where x.id = made;
    return expedition;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if exists (select 1 from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone) then
    raise exception 'An expedition is already under way. End it first.';
  end if;
  if place is not null then
    select p.name into there_name from public.places p where p.id = private.place_in_campaign(campaign, place);
  elsif place_name is not null and length(trim(place_name)) > 200 then
    raise exception 'A place''s name is at most 200 characters.';
  elsif place_name is not null and length(trim(place_name)) > 0 then
    there_name := trim(place_name);
  end if;
  insert into public.expeditions (campaign_id, mode) values (campaign, trim(mode_id)) returning * into expedition;
  if there_name is not null then
    insert into public.expedition_places (campaign_id, expedition_id, name, mode)
    values (campaign, expedition.id, there_name, expedition.mode);
    if there is null then
      there := private.place_named(campaign, there_name);
    end if;
    insert into public.group_places (campaign_id, expedition_id, group_number, place_id)
    select campaign, expedition.id, g.n, there
    from (
      select distinct m.group_number as n from public.party_group_members m
      where m.campaign_id = campaign
      union select 1
    ) g
    where exists (select 1 from public.party_groups pg where pg.campaign_id = campaign and pg.number = g.n);
  end if;
  update public.campaigns c set mode = 'adventure' where c.id = campaign and c.mode <> 'adventure';
  return expedition;
end;
$$;
revoke execute on function private.begin_expedition(uuid, text, text, uuid) from public, anon;
grant execute on function private.begin_expedition(uuid, text, text, uuid) to authenticated, service_role;

-- As in 20261031170000_m5_places_messages.sql, now through private.begin_expedition.
create or replace function public.start_expedition(campaign uuid, mode_id text, place_name text default null) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
begin
  return private.begin_expedition(campaign, mode_id, place_name, null);
end;
$$;

-- Start expedition at a place picked by id (expedition.start with a place id): as above, the place being the one
-- meant even when another shares its name.
create function public.start_expedition_at(campaign uuid, mode_id text, place uuid) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
begin
  if place is null then
    raise exception 'That place isn''t in this campaign.';
  end if;
  return private.begin_expedition(campaign, mode_id, null, place);
end;
$$;
revoke execute on function public.start_expedition_at(uuid, text, uuid) from public, anon;
grant execute on function public.start_expedition_at(uuid, text, uuid) to authenticated, service_role;

-- The body of Where now? (as in 20261031170000_m5_places_messages.sql): the group's current visit moves on and a new
-- one starts at `place` (null: somewhere unnamed), hidden until shown. The GM; during an expedition.
create function private.move_group_to(campaign uuid, group_no integer, place uuid) returns public.group_places
language plpgsql security invoker set search_path = '' as $$
declare
  row_now public.group_places;
  trip uuid;
begin
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select x.id into trip from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone;
  if trip is null then
    raise exception 'Start an expedition first.';
  end if;
  if not exists (select 1 from public.party_groups g where g.campaign_id = campaign and g.number = group_no) then
    raise exception 'That group isn''t there any more.';
  end if;
  row_now := private.current_group_place(campaign, group_no);
  if row_now.id is not null then
    update public.group_places gp set moved_on = true where gp.id = row_now.id;
  end if;
  insert into public.group_places (campaign_id, expedition_id, group_number, place_id)
  values (campaign, trip, group_no, place) returning * into row_now;
  return row_now;
end;
$$;
revoke execute on function private.move_group_to(uuid, integer, uuid) from public, anon;
grant execute on function private.move_group_to(uuid, integer, uuid) to authenticated, service_role;

-- As in 20261031170000_m5_places_messages.sql, now through private.move_group_to. A repeat changes nothing.
create or replace function public.set_group_place(campaign uuid, group_no integer, place_name text) returns public.group_places
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('group_places');
  row_now public.group_places;
begin
  if made is not null then
    select * into row_now from public.group_places gp where gp.id = made;
    return row_now;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return private.move_group_to(campaign, group_no, private.place_named(campaign, place_name));
end;
$$;

-- Where now? by place id (place.set with a place id): the group goes to that place. The GM; during an expedition.
create function public.set_group_place_at(campaign uuid, group_no integer, place uuid) returns public.group_places
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('group_places');
  row_now public.group_places;
begin
  if made is not null then
    select * into row_now from public.group_places gp where gp.id = made;
    return row_now;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return private.move_group_to(campaign, group_no, private.place_in_campaign(campaign, place));
end;
$$;
revoke execute on function public.set_group_place_at(uuid, integer, uuid) from public, anon;
grant execute on function public.set_group_place_at(uuid, integer, uuid) to authenticated, service_role;

-- 4. Arriving by Move… goes to the place picked ---------------------------------------------------------------------

-- As private.group_goes_to (20261103110000_m5b_1_travel.sql), for a place known by id: a group already there stays.
create function private.group_goes_to_id(campaign uuid, group_no integer, place uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  trip uuid;
  row_now public.group_places;
begin
  select x.id into trip from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone;
  if trip is null then
    return;
  end if;
  row_now := private.current_group_place(campaign, group_no);
  if row_now.id is not null and row_now.place_id is not distinct from place then
    return;
  end if;
  if row_now.id is not null then
    update public.group_places gp set moved_on = true where gp.id = row_now.id;
  end if;
  insert into public.group_places (campaign_id, expedition_id, group_number, place_id) values (campaign, trip, group_no, place);
end;
$$;
revoke execute on function private.group_goes_to_id(uuid, integer, uuid) from public, anon, authenticated;

-- As in 20261103110000_m5b_1_travel.sql, plus: a pending place known by id is arrived at by id.
create or replace function private.pay_owed(row_now public.travel_groups, points integer) returns public.travel_groups
language plpgsql security definer set search_path = '' as $$
declare
  paid integer := least(coalesce(row_now.pending_owed, 0), greatest(points, 0));
  left_owed integer := coalesce(row_now.pending_owed, 0) - paid;
  paid_row public.travel_groups;
begin
  if row_now.pending_owed is null then
    return row_now;
  end if;
  if left_owed > 0 then
    update public.travel_groups t set spent = t.spent + paid, pending_owed = left_owed where t.id = row_now.id returning * into paid_row;
    return paid_row;
  end if;
  update public.travel_groups t
  set spent = t.spent + paid, terrain_id = t.pending_terrain_id, route_id = t.pending_route_id,
      pending_place_name = null, pending_place_id = null, pending_terrain_id = null, pending_route_id = null, pending_owed = null
  where t.id = row_now.id returning * into paid_row;
  if row_now.pending_place_id is not null then
    perform private.group_goes_to_id(row_now.campaign_id, row_now.group_number, row_now.pending_place_id);
  else
    perform private.group_goes_to(row_now.campaign_id, row_now.group_number, row_now.pending_place_name);
  end if;
  return paid_row;
end;
$$;

-- As in 20261103110000_m5b_1_travel.sql, plus: a move paid at once arrives at the place by id when one was given.
create or replace function public.travel_move(campaign uuid, group_no integer, cost integer, terrain_id text default null, route_id text default null,
  place_name text default null, place_id uuid default null, seen_version integer default null)
returns public.travel_groups
language plpgsql security invoker set search_path = '' as $$
declare
  done uuid[] := private.request_targets('travel_groups');
  row_now public.travel_groups;
  name_now text := nullif(trim(coalesce(place_name, '')), '');
  pay integer;
  owed integer;
begin
  if cardinality(done) > 0 then
    select * into row_now from public.travel_groups t where t.id = done[1];
    return row_now;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if cost is null or cost < 0 or cost > 100000 then
    raise exception 'A whole cost, 0 or more, is needed.';
  end if;
  if place_id is not null then
    select p.name into name_now from public.places p where p.id = place_id and p.campaign_id = campaign and not p.undone;
    if name_now is null then
      raise exception 'That place isn''t in this campaign.';
    end if;
  end if;
  row_now := private.travel_row(campaign, group_no);
  pay := least(greatest(row_now.total - row_now.spent, 0), cost);
  owed := cost - pay;
  if owed > 0 then
    update public.travel_groups t
    set spent = t.spent + pay, version = coalesce(seen_version, t.version),
        pending_place_name = name_now, pending_place_id = place_id, pending_terrain_id = travel_move.terrain_id, pending_route_id = travel_move.route_id, pending_owed = owed
    where t.id = row_now.id returning * into row_now;
    return row_now;
  end if;
  update public.travel_groups t
  set spent = t.spent + pay, version = coalesce(seen_version, t.version),
      terrain_id = travel_move.terrain_id, route_id = travel_move.route_id,
      pending_place_name = null, pending_place_id = null, pending_terrain_id = null, pending_route_id = null, pending_owed = null
  where t.id = row_now.id returning * into row_now;
  if place_id is not null then
    perform private.group_goes_to_id(campaign, group_no, place_id);
  else
    perform private.group_goes_to(campaign, group_no, name_now);
  end if;
  return row_now;
end;
$$;

-- 5. The players' name ------------------------------------------------------------------------------------------------

-- As in 20261102100000_m5b_g2_place_pieces.sql, the name being the players' name when the GM set one (⚑ 3, C).
create or replace function public.scene_pieces(campaign uuid) returns table (group_number integer, place_name text, piece_id uuid, kind text, body text)
language sql stable security definer set search_path = '' as $$
  select gp.group_number, coalesce(nullif(p.players_name, ''), p.name), pc.id, pc.kind, pc.body
  from public.party_groups g
  cross join lateral private.current_group_place(g.campaign_id, g.number) gp
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
  order by gp.group_number, s.shown_at, s.id;
$$;

-- As in 20261103141000_m5b_3_known_places_campaign.sql, the name being the players' name when the GM set one.
create or replace function public.known_places_campaign(campaign uuid)
returns table (expedition_id uuid, current boolean, expedition_started bigint, visit_id uuid, group_number integer, place_id uuid, place_name text, visited_at timestamptz, piece_id uuid, kind text, body text)
language sql stable security definer set search_path = '' as $$
  select x.id, x.ended_at is null, x.started_at, gp.id, gp.group_number, p.id, coalesce(nullif(p.players_name, ''), p.name), gp.created_at, pc.id, pc.kind, pc.body
  from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id and not x.undone
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where gp.campaign_id = campaign and not gp.undone and private.in_my_group(campaign, gp.group_number)
  order by (x.ended_at is null) desc, x.created_at desc, gp.created_at, gp.id, s.shown_at, s.id;
$$;

-- 6. The log --------------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('place.fromPack', 'simple', true);
-- The place, its notes and its pieces are marked undone by Undo (places, place_notes and place_pieces are in
-- undoable_tables already).
insert into public.undoable_makings (name) values ('place.fromPack');
