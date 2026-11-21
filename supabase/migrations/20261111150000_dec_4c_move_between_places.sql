-- December step 4, piece (c): the move between linked places (docs/plans/dec-4-point-travel.md, row c; ruled
-- 2026-11-11, pt-f2 and pt-f3, docs/design/rulings/dec-point-travel-format-2026-11-11.md).
--   1. public.move_between_places: in ONE request the party (group 1; no split party in this cut) goes to a place
--      of the campaign and the clock moves on by the way's turns. It composes what exists and copies none of it:
--      private.move_group_to (Where now?'s body, 20261106140000_m8b_0_places_from_packs.sql), public.advance_clock
--      (Advance by…'s function, newest copy 20261102330000_m5b_g6_rest_flow.sql: lights burn down, the rest flow's
--      answers apply when sent, status timers end) and public.back_at_place (a place visited before starts with what
--      was shown at the end of its last visit; newest copy 20261102321000_m5b_g2b_back_at_latest.sql). Every row it
--      changes is logged under one request and one command (place.moveOn, Simple): one log line, one Undo. The GM
--      only (private.move_group_to and the clock's own rules refuse anyone else), during an expedition.
--   2. place_moves: the record of the move the log line reads: which visit it made, the way taken (the link's `by`
--      and `name`, as the GM picked them) and how many turns and seconds it took. The GM's alone, by row-level
--      security and in the log (no log audience function): a hidden link's way never reaches a player (pt-f3). The
--      function reads no route itself: the app sends what the GM picked. Nobody writes the table directly: only the
--      move makes a record (private.record_place_move) and only Undo marks one undone. The move's seconds must be
--      its turns at the campaign's turn length (Rules for this campaign, `time.turnMinutes`; 10 minutes without
--      one), so the line's "N turns" and the clock always agree.
--   3. Undo (the same Undo as any line): the new visit, the move's record and any shows brought back are marked
--      undone (undoable_makings), the visit left is current again, the clock goes back, and a light the move burnt
--      out comes back (undoable_deletions: the same named exception as Advance by…, hard rule 4; no new kind of
--      deletion).
--   4. A split party is refused (ruled by the lead, 2026-11-11): "Join the party up first: for now a move between
--      linked places takes the whole party."
--   5. public.party_moves: what the log's line needs on a device that can't read the move's record (ruled by the
--      lead, 2026-11-11: a player's line says the party moved, and an undone move says the party went back). For
--      each move of the reader's own group: its turns, and the name of the place arrived at and of the place left,
--      each ONLY when that place has been shown to the reader's group (a piece of it shown on one of the group's
--      visits, as What we know decides it; the players' name when the GM set one), else null. The GM gets every move
--      with the places' own names. The way taken is never in it.
-- What players get of the move's own rows is the clock's part and their own burnt-out lights and ended statuses;
-- nothing of the place, the visit or the way.
-- Adds one table with its rules, triggers and policies, four functions, and rows in logged_commands,
-- undoable_tables, undoable_makings and undoable_deletions. Replaces nothing. Drops, renames and deletes nothing; no
-- existing row is changed.

-- 1. The move's record ------------------------------------------------------------------------------------------------

create table public.place_moves (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid not null references public.expeditions (id) on delete cascade,
  group_number integer not null,
  -- The visit the move made (where the group arrived).
  group_place_id uuid not null references public.group_places (id) on delete cascade,
  -- The visit the group left (null: it was nowhere yet). An undone move's line says where the party is back at.
  from_group_place_id uuid references public.group_places (id) on delete set null,
  -- The way taken, as the link names it (07 `routes`, `travel`): its short id and its words. Null: a link with one
  -- amount and no named way.
  way_by text check (way_by is null or length(way_by) between 1 and 60),
  way_name text check (way_name is null or length(way_name) between 1 and 200),
  turns integer not null check (turns between 1 and 1000),
  seconds bigint not null check (seconds >= 1),
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index place_moves_campaign on public.place_moves (campaign_id, created_at desc);
create index place_moves_visit on public.place_moves (group_place_id);
create index place_moves_expedition on public.place_moves (expedition_id);

alter table public.place_moves enable row level security;
grant select, update on public.place_moves to authenticated;
grant select, insert, update, delete on public.place_moves to service_role;

-- The GM's alone: players never read a move's record (the way may be a hidden link's). No one inserts one directly
-- (no insert rule: the move's function makes it, below). The one change is Undo's mark, which runs as the GM, so the
-- GM has an update rule; the table's own rules (place_move_rules) refuse any change that isn't an undo.
create policy "place moves: the GM reads" on public.place_moves
  for select to authenticated using (private.is_gm(campaign_id));
create policy "place moves: only the GM's Undo marks one" on public.place_moves
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- A record names a visit of its own campaign, and takes the visit's expedition and group. A change: undo's mark
-- alone (refused outside an undo); an undone record stays as it is.
create function private.place_move_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  visit public.group_places;
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    select * into visit from public.group_places gp where gp.id = new.group_place_id;
    if visit.id is null or visit.campaign_id <> new.campaign_id then
      raise exception 'That place isn''t in this campaign.';
    end if;
    new.expedition_id := visit.expedition_id;
    new.group_number := visit.group_number;
    if new.from_group_place_id is not null and not exists (
      select 1 from public.group_places gp where gp.id = new.from_group_place_id and gp.campaign_id = new.campaign_id
    ) then
      raise exception 'That place isn''t in this campaign.';
    end if;
    new.way_by := nullif(trim(coalesce(new.way_by, '')), '');
    new.way_name := nullif(trim(coalesce(new.way_name, '')), '');
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That move was undone.';
  end if;
  if not reverting then
    raise exception 'That can''t be changed.';
  end if;
  new.campaign_id := old.campaign_id;
  new.expedition_id := old.expedition_id;
  new.group_number := old.group_number;
  new.group_place_id := old.group_place_id;
  new.from_group_place_id := old.from_group_place_id;
  new.way_by := old.way_by;
  new.way_name := old.way_name;
  new.turns := old.turns;
  new.seconds := old.seconds;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.place_move_rules() from public, anon, authenticated;

create trigger place_move_rules before insert or update on public.place_moves
  for each row execute function private.place_move_rules();
create trigger refuse_when_retired before insert or update or delete on public.place_moves
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.place_moves
  for each row execute function private.log_change();

-- 2. What the app calls ---------------------------------------------------------------------------------------------

-- The move's record, made for public.move_between_places (nobody inserts one directly: the table has no insert rule).
-- Runs with the owner's rights, so it checks for itself that the caller is the visit's campaign's GM.
create function private.record_place_move(visit_id uuid, from_visit_id uuid, by_id text, by_name text, turn_count integer, seconds_taken bigint)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  here public.group_places;
begin
  select * into here from public.group_places gp where gp.id = visit_id;
  if here.id is null or not private.is_gm(here.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  insert into public.place_moves (campaign_id, expedition_id, group_number, group_place_id, from_group_place_id, way_by, way_name, turns, seconds)
  values (here.campaign_id, here.expedition_id, here.group_number, here.id, from_visit_id, by_id, by_name, turn_count, seconds_taken);
end;
$$;
revoke execute on function private.record_place_move(uuid, uuid, text, text, integer, bigint) from public, anon;
grant execute on function private.record_place_move(uuid, uuid, text, text, integer, bigint) to authenticated, service_role;

-- Move on (place.moveOn): the party goes to `place` and the clock moves on `by_seconds` (the way's `turns`, in this
-- campaign's seconds, as Advance by… sends them: exactly its turns at the campaign's turn length), in one request. `way_by` and `way_name` are the way the GM picked
-- (for the log line); `rest` is Advance by…'s (the open rest flows' answers, or null). Refused from an old copy of
-- the clock (`seen_version`), and then nothing moves; a repeat of the same request gives back what the first made.
-- Returns {"visit": the new group_places row, "clock": the clock, "back_shown": how many pieces came back shown}.
-- Security invoker: the GM's rules, and those of the functions it calls.
create function public.move_between_places(campaign uuid, place uuid, turns integer, by_seconds bigint,
  way_by text default null, way_name text default null, seen_version integer default null, rest jsonb default null)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('group_places');
  visit public.group_places;
  was public.group_places;
  clock public.campaign_clocks;
  back_shown integer := 0;
  turn_minutes text;
  turn_seconds bigint;
begin
  if made is not null then
    select * into visit from public.group_places gp where gp.id = made;
    select * into clock from public.campaign_clocks c where c.campaign_id = campaign;
    select count(*) into back_shown from public.piece_shows s where s.group_place_id = made and s.shown and not s.undone;
    return jsonb_build_object('visit', to_jsonb(visit), 'clock', to_jsonb(clock), 'back_shown', back_shown);
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- No split party in this cut: someone in play is in a group other than the party's own.
  if exists (
    select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
    where m.campaign_id = campaign and m.group_number <> 1 and a.approval = 'approved' and a.status = 'active'
  ) then
    raise exception 'Join the party up first: for now a move between linked places takes the whole party.';
  end if;
  if turns is null or turns < 1 or turns > 1000 then
    raise exception 'A move takes a whole number of turns, from 1 to 1000.';
  end if;
  if by_seconds is null or by_seconds < 1 then
    raise exception 'Move the clock on by a whole amount above 0.';
  end if;
  -- The line says "N turns" and the clock moves by_seconds: they must be the same length of time. A turn is the
  -- campaign's (settings, time.turnMinutes; 10 minutes without one, as private.campaign_units reads it).
  select c.settings #>> '{time,turnMinutes}' into turn_minutes from public.campaigns c where c.id = campaign;
  turn_seconds := (case when turn_minutes ~ '^[0-9]{1,6}$' and turn_minutes::integer > 0 then turn_minutes::integer else 10 end) * 60;
  if by_seconds <> turns::bigint * turn_seconds then
    raise exception 'That time doesn''t match the turns: a turn is % minutes in this campaign.', turn_seconds / 60;
  end if;
  if length(trim(coalesce(way_by, ''))) > 60 then
    raise exception 'A way''s id is at most 60 characters.';
  end if;
  if length(trim(coalesce(way_name, ''))) > 200 then
    raise exception 'A way''s name is at most 200 characters.';
  end if;
  -- The place first (the GM, an expedition under way, a place of this campaign), then its record, then the clock
  -- with everything Advance by… does. Any refusal undoes the whole request.
  perform private.place_in_campaign(campaign, place);
  was := private.current_group_place(campaign, 1);
  visit := private.move_group_to(campaign, 1, place);
  perform private.record_place_move(visit.id, was.id, way_by, way_name, turns, by_seconds);
  clock := public.advance_clock(campaign, by_seconds, seen_version, rest);
  back_shown := public.back_at_place(visit.id);
  return jsonb_build_object('visit', to_jsonb(visit), 'clock', to_jsonb(clock), 'back_shown', back_shown);
end;
$$;
revoke execute on function public.move_between_places(uuid, uuid, integer, bigint, text, text, integer, jsonb) from public, anon;
grant execute on function public.move_between_places(uuid, uuid, integer, bigint, text, text, integer, jsonb) to authenticated, service_role;

-- 3. What the log's line reads on any device ---------------------------------------------------------------------------

-- A place's name as the reader may have it: the GM its own name; a player the players' name (else the name) once a
-- piece of the place has been shown to one of their groups on a visit that stands (What we know's rule,
-- public.known_places_campaign in 20261106140000_m8b_0_places_from_packs.sql); null otherwise.
create function private.place_name_for_me(campaign uuid, place uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when private.is_gm(campaign) then p.name
    when exists (
      select 1 from public.group_places gp
      join public.expeditions x on x.id = gp.expedition_id and not x.undone
      join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
      join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
      where gp.campaign_id = campaign and gp.place_id = p.id and not gp.undone and private.in_my_group(campaign, gp.group_number)
    ) then coalesce(nullif(p.players_name, ''), p.name)
  end
  from public.places p
  where p.id = place and p.campaign_id = campaign and not p.undone;
$$;
revoke execute on function private.place_name_for_me(uuid, uuid) from public, anon, authenticated;

-- The moves between places the reader may know of, newest first (at most 200): each by the id of its clock change in
-- the log (the part of the move's line every member receives), with its turns and the names of the place arrived at
-- and the place left as the reader may have them (private.place_name_for_me; null: not shown to them, or unnamed).
-- The GM: every move. A player: their own groups' moves. Never the way taken, a place's id or an unshown name.
create function public.party_moves(campaign uuid)
returns table (clock_event_id uuid, turns integer, to_name text, from_name text)
language sql stable security definer set search_path = '' as $$
  select clock.id, m.turns, private.place_name_for_me(campaign, gp.place_id), private.place_name_for_me(campaign, was.place_id)
  from public.place_moves m
  join public.group_places gp on gp.id = m.group_place_id
  left join public.group_places was on was.id = m.from_group_place_id
  join public.events made on made.target_id = m.id and made.target_table = 'place_moves' and made.before is null
    and made.request_id is not null and made.reverts_event_id is null
  join public.events clock on clock.request_id = made.request_id and clock.campaign_id = m.campaign_id
    and clock.target_table = 'campaign_clocks' and clock.type = 'place.moveOn' and clock.reverts_event_id is null
    and clock.actor_user_id is not distinct from made.actor_user_id
  where m.campaign_id = campaign
    and (private.is_gm(campaign) or private.in_my_group(campaign, m.group_number))
  order by m.created_at desc, m.id
  limit 200;
$$;
revoke execute on function public.party_moves(uuid) from public, anon;
grant execute on function public.party_moves(uuid) to authenticated, service_role;

-- 4. Undo and the logged command --------------------------------------------------------------------------------------

insert into public.undoable_tables (name) values ('place_moves');
-- The visit, the move's record, the shows brought back and a Push on's condition are made records: marked undone.
insert into public.undoable_makings (name) values ('place.moveOn');
-- A light the move burnt out leaves play as with any move of the clock: undoing the move brings its line back.
insert into public.undoable_deletions (name) values ('place.moveOn');

insert into public.logged_commands (name, level, gm_only) values ('place.moveOn', 'simple', true);
