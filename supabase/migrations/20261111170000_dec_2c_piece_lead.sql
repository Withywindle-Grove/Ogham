-- December piece 2c: a place's aspects as pieces with a bold lead-in (docs/plans/dec-2-3-places-and-port.md, 2c;
-- docs/design/rulings/dec-pack-formats-2026-11-11.md, pf-3; scene-mockup-rulings-2026-11-11.md, mc-17).
--   1. place_pieces.lead: a short lead-in the players' words start with ("Sign", "Common room"), shown bold before the
--      body. Nullable: every existing piece keeps null, and + Piece by hand writes none (the ruling: the GM's + Piece
--      gains nothing for it). Made with the piece and never changed after (the piece rules' "everything else stays as
--      made" already covers a new column).
--   2. public.make_place_from_pack writes it from a piece's `lead` (the app's composer fills it from
--      `playerView.aspects[].lead`).
--   3. Players read it the way they read a piece's body: only once the piece is shown to their group, through
--      public.scene_pieces and public.known_places_campaign, which gain a `lead` column at the end. Their return
--      shapes change, so each is dropped and made again with the same body and the same grants.
-- Replaces public.make_place_from_pack (newest in 20261106150000_m8b_0_places_settlement.sql), public.scene_pieces and
-- public.known_places_campaign (newest in 20261106140000_m8b_0_places_from_packs.sql). Adds one nullable column;
-- drops and remakes two read functions. Drops, renames and deletes no data; no rows written or changed.

-- 1. The lead-in ------------------------------------------------------------------------------------------------------

alter table public.place_pieces
  add column lead text check (lead is null or length(trim(lead)) between 1 and 200);

comment on column public.place_pieces.lead is
  'A piece''s bold lead-in, players'' words (pf-3: a pack aspect''s lead); null for most pieces. Read by players only once the piece is shown.';

-- 2. Made from a pack -------------------------------------------------------------------------------------------------

-- As in 20261106150000_m8b_0_places_settlement.sql, plus: a piece's `lead` (trimmed; blank is none; at most 200).
create or replace function public.make_place_from_pack(campaign uuid, pack uuid, entry_id text, details jsonb default '{}'::jsonb,
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
    if piece ? 'lead' and jsonb_typeof(piece -> 'lead') not in ('string', 'null') then
      raise exception 'That place isn''t written right.';
    end if;
    if length(trim(coalesce(piece ->> 'lead', ''))) > 200 then
      raise exception 'A piece''s lead-in is at most 200 characters.';
    end if;
  end loop;
  if details ? 'settlement' and jsonb_typeof(details -> 'settlement') not in ('object', 'null') then
    raise exception 'That place isn''t written right.';
  end if;
  insert into public.places (campaign_id, name, pack_id, pack_entry_id, pack_type, pack_parent_id, pack_key, players_name, terrain_id, region_id, settlement)
  values (
    campaign, entry_name, pack, entry_id,
    nullif(details ->> 'pack_type', ''), nullif(details ->> 'pack_parent_id', ''), nullif(details ->> 'pack_key', ''),
    coalesce(details ->> 'players_name', ''), nullif(details ->> 'terrain_id', ''), nullif(details ->> 'region_id', ''),
    case when jsonb_typeof(details -> 'settlement') = 'object' then details -> 'settlement' else null end
  )
  returning * into place;
  insert into public.place_notes (id, campaign_id, traps, puzzles, encounters, treasure, doors)
  values (place.id, campaign, coalesce(notes ->> 'traps', ''), coalesce(notes ->> 'puzzles', ''), coalesce(notes ->> 'encounters', ''),
    coalesce(notes ->> 'treasure', ''), coalesce(notes ->> 'doors', ''));
  for piece in select * from jsonb_array_elements(pieces) loop
    insert into public.place_pieces (campaign_id, place_id, kind, body, position, gm_value, gm_trigger, gm_stat_line, lead)
    values (campaign, place.id, piece ->> 'kind', trim(piece ->> 'body'), at,
      coalesce(piece ->> 'gm_value', ''), coalesce(piece ->> 'gm_trigger', ''), coalesce(piece ->> 'gm_stat_line', ''),
      nullif(trim(coalesce(piece ->> 'lead', '')), ''));
    at := at + 1;
  end loop;
  return place;
end;
$$;

-- 3. What players read ------------------------------------------------------------------------------------------------

-- As in 20261106140000_m8b_0_places_from_packs.sql, plus the shown piece's lead-in (last column).
drop function public.scene_pieces(uuid);
create function public.scene_pieces(campaign uuid) returns table (group_number integer, place_name text, piece_id uuid, kind text, body text, lead text)
language sql stable security definer set search_path = '' as $$
  select gp.group_number, coalesce(nullif(p.players_name, ''), p.name), pc.id, pc.kind, pc.body, pc.lead
  from public.party_groups g
  cross join lateral private.current_group_place(g.campaign_id, g.number) gp
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
  order by gp.group_number, s.shown_at, s.id;
$$;
revoke execute on function public.scene_pieces(uuid) from public, anon;
grant execute on function public.scene_pieces(uuid) to authenticated, service_role;

-- As in 20261106140000_m8b_0_places_from_packs.sql, plus the shown piece's lead-in (last column).
drop function public.known_places_campaign(uuid);
create function public.known_places_campaign(campaign uuid)
returns table (expedition_id uuid, current boolean, expedition_started bigint, visit_id uuid, group_number integer, place_id uuid, place_name text, visited_at timestamptz, piece_id uuid, kind text, body text, lead text)
language sql stable security definer set search_path = '' as $$
  select x.id, x.ended_at is null, x.started_at, gp.id, gp.group_number, p.id, coalesce(nullif(p.players_name, ''), p.name), gp.created_at, pc.id, pc.kind, pc.body, pc.lead
  from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id and not x.undone
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where gp.campaign_id = campaign and not gp.undone and private.in_my_group(campaign, gp.group_number)
  order by (x.ended_at is null) desc, x.created_at desc, gp.created_at, gp.id, s.shown_at, s.id;
$$;
revoke execute on function public.known_places_campaign(uuid) from public, anon;
grant execute on function public.known_places_campaign(uuid) to authenticated, service_role;
