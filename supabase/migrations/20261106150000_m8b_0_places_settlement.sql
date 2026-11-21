-- M8b slice 0, pull request 2: the town screen on a place picked from a pack that marks it a settlement (docs/plans/
-- m8b-0-places-from-packs.md, delivery 5 "No gate on towns" and the builder's review; 07 G-157 `settlement`).
--   1. places.settlement: the pack's mark ({ size, population? }), written by make_place_from_pack from the location
--      (the app's composer gives it in `details`), never changed after (the link's facts); null: not a settlement.
--   2. "Is a settlement" now means: marked by its pack, or (older places, M5b 6b) marked Safe or Hostile by the GM.
--      public.scene_town (players' town places) and private.request_rules (a lodging from the town's list) key off
--      either, so every town made before keeps working.
-- Replaces private.place_rules and public.make_place_from_pack (newest in 20261106140000_m8b_0_places_from_packs.sql),
-- public.scene_town (20261104231000_m5b_6c_town_shown.sql) and private.request_rules
-- (20261104190000_m5b_6e_town_requests.sql). Adds one column and a check. Drops, renames and deletes no data; no rows
-- written or changed.

alter table public.places
  add column settlement jsonb check (settlement is null or (jsonb_typeof(settlement) = 'object' and length(settlement::text) <= 2000));

comment on column public.places.settlement is
  'The pack marks the place a settlement (07 G-157): { size, population? }; the town screen shows here. Null: not one.';

-- As in 20261106140000_m8b_0_places_from_packs.sql, plus: the settlement mark can't change after the place is made.
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
    or new.pack_key is distinct from old.pack_key or new.settlement is distinct from old.settlement then
    raise exception 'That can''t be changed.';
  end if;
  new.players_name := trim(coalesce(new.players_name, ''));
  new.updated_at := now();
  return new;
end;
$$;

-- As in 20261106140000_m8b_0_places_from_packs.sql, plus: the settlement mark from `details`.
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
    insert into public.place_pieces (campaign_id, place_id, kind, body, position, gm_value, gm_trigger, gm_stat_line)
    values (campaign, place.id, piece ->> 'kind', trim(piece ->> 'body'), at,
      coalesce(piece ->> 'gm_value', ''), coalesce(piece ->> 'gm_trigger', ''), coalesce(piece ->> 'gm_stat_line', ''));
    at := at + 1;
  end loop;
  return place;
end;
$$;


-- As in 20261104231000_m5b_6c_town_shown.sql, for a place its pack marks a settlement as well as one marked Safe or Hostile.
create or replace function public.scene_town(campaign uuid)
returns table (group_number integer, place_name text, entry_key text, name text, kind text, open boolean)
language sql stable security definer set search_path = '' as $$
  select v.group_number, p.name, e.key, e.value ->> 'name', coalesce(e.value ->> 'kind', ''), (e.value ->> 'open')::boolean
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

-- As in 20261104190000_m5b_6e_town_requests.sql, the lodging's town being one its pack marks a settlement as well.
create or replace function private.request_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  as_gm boolean := private.is_gm(new.campaign_id);
  owner uuid;
  state text;
  offered jsonb;
begin
  if tg_op = 'INSERT' then
    new.text := trim(coalesce(new.text, ''));
    new.cost_text := trim(coalesce(new.cost_text, ''));
    new.status := 'waiting';
    new.answer := null;
    new.answered_by := null;
    new.answered_at := null;
    new.undone := false;
    new.created_by := (select auth.uid());
    -- 6e (a): the two-turn kinds' answers (05 Requests).
    new.reply := null;
    new.replied_at := null;
    if new.kind = 'buy' then
      new.answer_kind := 'hitMissChoice';
    elsif new.kind = 'sell' then
      new.answer_kind := 'offer';
    end if;
    if new.expedition_id is not null and not exists (select 1 from public.expeditions x where x.id = new.expedition_id and x.campaign_id = new.campaign_id) then
      raise exception 'That expedition isn''t in this campaign.';
    end if;
    if new.actor_id is not null then
      select a.owner_user_id, a.approval || '/' || a.status into owner, state
      from public.actors a where a.id = new.actor_id and a.campaign_id = new.campaign_id and a.owner_type = 'user';
      if owner is null then
        raise exception 'That character isn''t in this campaign.';
      end if;
      if new.direction = 'playerAsks' and owner <> new.requester_id then
        raise exception 'You don''t have permission to do that.' using errcode = '42501';
      end if;
      if new.direction = 'playerAsks' and state <> 'approved/active' then
        raise exception 'Only a character in play can ask.';
      end if;
      if new.direction = 'gmAsks' and new.requester_id is distinct from owner then
        raise exception 'That character''s player is who the GM asks.';
      end if;
    elsif new.direction = 'playerAsks' then
      raise exception 'Pick which character asks.';
    end if;
    -- 6e (b): a lodging from the town's list needs no GM (dt-11, st-3), but only one the GM shows, open, where the
    -- asker's group is.
    if new.kind = 'lodging' and new.direction = 'playerAsks' and coalesce(new.prompt ->> 'listed', '') = 'true' then
      select p.town -> (new.prompt ->> 'key') into offered
      from private.town_visit(new.campaign_id, coalesce(new.group_number, 1)) v
      join public.places p on p.id = v.place_id and not p.undone and (p.safety is not null or p.settlement is not null);
      if offered is null or left(coalesce(new.prompt ->> 'key', ''), 8) <> 'lodging:'
        or (offered ->> 'shown') is distinct from 'true' or (offered ->> 'open') is distinct from 'true' then
        raise exception 'That lodging isn''t offered here.';
      end if;
      new.status := 'answered';
      new.answer := jsonb_build_object('kind', 'stay', 'listed', true);
      new.answered_at := now();
    end if;
    return new;
  end if;
  if old.undone and not reverting then
    raise exception 'That request was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.group_number is distinct from old.group_number or new.requester_id is distinct from old.requester_id
    or new.actor_id is distinct from old.actor_id or new.kind is distinct from old.kind or new.direction is distinct from old.direction
    or new.text is distinct from old.text or new.prompt is distinct from old.prompt or new.answer_kind is distinct from old.answer_kind
    or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  if reverting then
    return new;
  end if;
  if new.undone <> old.undone then
    raise exception 'That can''t be changed.';
  end if;
  -- 6e (c): the reply to a priced answer: the requester's alone, once; nothing else changes with it.
  if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
    if old.requester_id is distinct from (select auth.uid()) or old.direction <> 'playerAsks' then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    if old.status <> 'answered' or old.answer_kind not in ('hitMissChoice', 'offer')
      or length(trim(coalesce(old.answer ->> 'price', ''))) = 0 then
      raise exception 'There''s nothing to answer yet.';
    end if;
    if old.reply is not null then
      raise exception 'You''ve answered it already.';
    end if;
    if new.reply is null or new.status is distinct from old.status or new.answer is distinct from old.answer
      or new.cost_text is distinct from old.cost_text or new.entry is distinct from old.entry
      or new.answered_by is distinct from old.answered_by or new.answered_at is distinct from old.answered_at then
      raise exception 'That can''t be changed.';
    end if;
    new.replied_at := now();
    return new;
  end if;
  if old.status <> 'waiting' then
    raise exception 'That request was already %.', old.status;
  end if;
  if as_gm and new.status = 'answered' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    new.answered_by := (select auth.uid());
    new.answered_at := now();
    new.cost_text := trim(coalesce(new.cost_text, ''));
    return new;
  end if;
  if new.cost_text is distinct from old.cost_text or new.answer is distinct from old.answer
    or new.answered_by is distinct from old.answered_by or new.answered_at is distinct from old.answered_at then
    raise exception 'Only the GM answers.';
  end if;
  -- The GM takes back what the GM asked (an escape roll), while it waits.
  if as_gm and new.status = 'withdrawn' and old.direction = 'gmAsks' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    return new;
  end if;
  -- C7: the GM enters the roll for a player without a device, on what the GM asked, while it waits.
  if as_gm and new.status = 'waiting' and old.direction = 'gmAsks' then
    return new;
  end if;
  -- From here: the requester's own changes (Cancel, Enter roll); the GM has no part in them.
  if as_gm then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if new.status = 'withdrawn' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    if old.direction <> 'playerAsks' then
      raise exception 'Only the GM takes back what the GM asked.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status = 'waiting' then
    return new;
  end if;
  raise exception 'That can''t be changed.';
end;
$$;

