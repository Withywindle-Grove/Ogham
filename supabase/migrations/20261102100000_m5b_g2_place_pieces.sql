-- M5b step g2: the place card as pieces (docs/plans/m5b-g2-place-pieces.md; ruled 2026-11-01, M5 gate B1; docs/05
-- "The room's GM layer", "Places for players"; docs/07 §2 "Pieces for Show players"; docs/03, hidden means hidden).
--   1. place_pieces: a place's pieces (description, exit, person, clue, treasure, hazard, other), each one line of
--      what players may be shown, in the GM's order. The GM-only facts that come with some pieces (a treasure's value,
--      a hazard's trigger, a person's stat line; typed by hand nowhere in M5b, read from adventures in M8b) are columns
--      of the same row, and the whole table is the GM's alone.
--   2. piece_shows: per group visit (a group_places row), which pieces that group's players see, and when each was
--      shown (players see them in the order shown). Show / Hide flip `shown`; Hide all hides every one in one request
--      (one log line). The GM's alone.
--   3. Players read what they're shown through public.scene_pieces only: for each of their groups, the current place's
--      name and its shown pieces (kind and text), in the order shown, and nothing else (no value, trigger, stat line,
--      unshown piece, or another group's place). places is now the GM's alone too (its description column is no
--      longer what players see: an existing description is copied into a description piece below, and kept as it was).
--   4. A group's signal (group_place_signals) ticks when what its players see changes: a piece shown or hidden, a
--      shown piece undone, a visit with shown pieces moved on from or undone. A split carries the shown pieces along
--      (the group someone joins while it's empty starts where they were, as it was).
-- Replaces private.follow_into_group (newest copy: 20261031170000_m5_places_messages.sql) and
-- private.tick_group_place_signal (newest copy: 20261031180000_m5_places_review.sql). Drops one access rule on places
-- (replaced at once by a GM-only one). Adds tables, rules, policies, functions and logged-command rows. Copies each
-- place's non-empty description into a description piece, and each currently shown visit's description into a shown
-- piece (so players keep seeing what they saw). No rows or columns are removed or renamed.

-- 1. Pieces --------------------------------------------------------------------------------------------------------

create table public.place_pieces (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  kind text not null check (kind in ('description', 'exit', 'person', 'clue', 'treasure', 'hazard', 'other')),
  -- What players see once it's shown (one line in M5b; a description copied from M5 may be longer).
  body text not null check (length(trim(body)) between 1 and 4000),
  position integer not null default 0,
  -- The GM's alone, never shown (07 §2): a treasure's value, a hazard's trigger and effect, a person's stat line.
  gm_value text not null default '' check (length(gm_value) <= 1000),
  gm_trigger text not null default '' check (length(gm_trigger) <= 1000),
  gm_stat_line text not null default '' check (length(gm_stat_line) <= 1000),
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index place_pieces_place on public.place_pieces (place_id, position) where not undone;
create index place_pieces_campaign on public.place_pieces (campaign_id);

create table public.piece_shows (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The group's visit to the place: a move on starts a new visit with nothing shown.
  group_place_id uuid not null references public.group_places (id) on delete cascade,
  piece_id uuid not null references public.place_pieces (id) on delete cascade,
  -- The visit's group (kept from the visit; for the group's signal).
  group_number integer not null,
  shown boolean not null default true,
  shown_at timestamptz not null default now(),
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index piece_shows_one on public.piece_shows (group_place_id, piece_id) where not undone;
create index piece_shows_piece on public.piece_shows (piece_id);
create index piece_shows_campaign on public.piece_shows (campaign_id);

alter table public.place_pieces enable row level security;
alter table public.piece_shows enable row level security;
grant select, insert, update on public.place_pieces, public.piece_shows to authenticated;
grant select, insert, update, delete on public.place_pieces, public.piece_shows to service_role;

create policy "place pieces: the GM reads" on public.place_pieces
  for select to authenticated using (private.is_gm(campaign_id));
create policy "place pieces: the GM keeps them" on public.place_pieces
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "place pieces: the GM keeps them, again" on public.place_pieces
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

create policy "piece shows: the GM reads" on public.piece_shows
  for select to authenticated using (private.is_gm(campaign_id));
create policy "piece shows: the GM keeps them" on public.piece_shows
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "piece shows: the GM keeps them, again" on public.piece_shows
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- A place is the GM's alone now: players get its name only with a shown piece, through public.scene_pieces.
drop policy "places: the GM, and players while it's shown to their group" on public.places;
create policy "places: the GM reads" on public.places
  for select to authenticated using (private.is_gm(campaign_id));

-- A piece: trimmed, in its place's campaign, made by whoever adds it. A change: only undo's mark.
create function private.place_piece_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.places p where p.id = new.place_id and p.campaign_id = new.campaign_id) then
      raise exception 'That place isn''t in this campaign.';
    end if;
    new.body := trim(new.body);
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That piece was undone.';
  end if;
  if (to_jsonb(new) - 'undone' - 'updated_at') is distinct from (to_jsonb(old) - 'undone' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.place_piece_rules() from public, anon, authenticated;

-- A show: a piece of the visit's place, in the visit's campaign, for the visit's group. A change: shown (and when),
-- or undo's mark.
create function private.piece_show_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  visit public.group_places;
begin
  if tg_op = 'INSERT' then
    select * into visit from public.group_places gp where gp.id = new.group_place_id;
    if visit.id is null or visit.campaign_id is distinct from new.campaign_id then
      raise exception 'That place isn''t in this campaign.';
    end if;
    if not exists (select 1 from public.place_pieces pc where pc.id = new.piece_id and pc.place_id is not distinct from visit.place_id) then
      raise exception 'That piece isn''t in this place.';
    end if;
    new.group_number := visit.group_number;
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That was undone.';
  end if;
  if (to_jsonb(new) - 'shown' - 'shown_at' - 'undone' - 'updated_at') is distinct from (to_jsonb(old) - 'shown' - 'shown_at' - 'undone' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.piece_show_rules() from public, anon, authenticated;

create trigger place_piece_rules before insert or update on public.place_pieces
  for each row execute function private.place_piece_rules();
create trigger refuse_when_retired before insert or update or delete on public.place_pieces
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.place_pieces
  for each row execute function private.log_change();

create trigger piece_show_rules before insert or update on public.piece_shows
  for each row execute function private.piece_show_rules();
create trigger refuse_when_retired before insert or update or delete on public.piece_shows
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.piece_shows
  for each row execute function private.log_change();

insert into public.undoable_tables (name) values ('place_pieces'), ('piece_shows');

-- 2. The GM's commands ---------------------------------------------------------------------------------------------

-- + Piece (place.addPiece): one line players may be shown, at the end of the place's pieces. The GM. A repeat changes
-- nothing. Security invoker: the GM's rules (a player can't read the place, so it's refused).
create function public.add_place_piece(place uuid, kind text, body text) returns public.place_pieces
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('place_pieces');
  piece public.place_pieces;
  campaign uuid;
begin
  if made is not null then
    select * into piece from public.place_pieces pc where pc.id = made;
    return piece;
  end if;
  select p.campaign_id into campaign from public.places p where p.id = add_place_piece.place and not p.undone;
  if campaign is null or not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if kind is null or kind not in ('description', 'exit', 'person', 'clue', 'treasure', 'hazard', 'other') then
    raise exception 'Pick what kind of piece it is.';
  end if;
  if body is null or length(trim(body)) = 0 then
    raise exception 'Write what players will see.';
  end if;
  if length(trim(body)) > 4000 then
    raise exception 'A piece is at most 4000 characters.';
  end if;
  insert into public.place_pieces (campaign_id, place_id, kind, body, position)
  values (
    campaign, add_place_piece.place, add_place_piece.kind, trim(add_place_piece.body),
    coalesce((select max(pc.position) + 1 from public.place_pieces pc where pc.place_id = add_place_piece.place), 0)
  )
  returning * into piece;
  return piece;
end;
$$;
revoke execute on function public.add_place_piece(uuid, text, text) from public, anon;
grant execute on function public.add_place_piece(uuid, text, text) to authenticated, service_role;

-- Show players / Hide from players, one piece (place.showPiece, place.hidePiece): for the group's current visit only.
-- Showing again puts it last in the players' order. The GM. A repeat changes nothing (hiding a piece never shown
-- returns null).
create function public.show_place_piece(visit uuid, piece uuid, show_it boolean) returns public.piece_shows
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('piece_shows');
  here public.group_places;
  this_piece public.place_pieces;
  row_now public.piece_shows;
begin
  if made is not null then
    select * into row_now from public.piece_shows s where s.id = made;
    return row_now;
  end if;
  select * into here from public.group_places gp where gp.id = visit;
  if here.id is null or not private.is_gm(here.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if here.undone or here.moved_on or (private.current_group_place(here.campaign_id, here.group_number)).id is distinct from here.id then
    raise exception 'That group has moved on from there.';
  end if;
  select * into this_piece from public.place_pieces pc where pc.id = piece and not pc.undone;
  if this_piece.id is null or this_piece.place_id is distinct from here.place_id then
    raise exception 'That piece isn''t in this place any more.';
  end if;
  select * into row_now from public.piece_shows s where s.group_place_id = visit and s.piece_id = piece and not s.undone;
  if row_now.id is null then
    if not coalesce(show_it, false) then
      return null;
    end if;
    insert into public.piece_shows (campaign_id, group_place_id, piece_id, group_number, shown)
    values (here.campaign_id, visit, piece, here.group_number, true)
    returning * into row_now;
  elsif row_now.shown is distinct from coalesce(show_it, false) then
    update public.piece_shows s
    set shown = coalesce(show_it, false), shown_at = case when show_it then now() else s.shown_at end
    where s.id = row_now.id
    returning * into row_now;
  end if;
  return row_now;
end;
$$;
revoke execute on function public.show_place_piece(uuid, uuid, boolean) from public, anon;
grant execute on function public.show_place_piece(uuid, uuid, boolean) to authenticated, service_role;

-- Hide all (place.hideAll): every shown piece of the group's visit, in one request (one log line; Undo shows exactly
-- those again, in their order). The GM. Returns how many it hid (0: nothing was shown).
create function public.hide_all_pieces(visit uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  here public.group_places;
  hidden integer;
begin
  select * into here from public.group_places gp where gp.id = visit;
  if here.id is null or not private.is_gm(here.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  update public.piece_shows s set shown = false where s.group_place_id = visit and s.shown and not s.undone;
  get diagnostics hidden = row_count;
  return hidden;
end;
$$;
revoke execute on function public.hide_all_pieces(uuid) from public, anon;
grant execute on function public.hide_all_pieces(uuid) to authenticated, service_role;

-- 3. What players read ---------------------------------------------------------------------------------------------

-- For each of the reader's groups: its current place's name and the pieces shown to it on this visit (kind and text),
-- in the order shown. Nothing about a place with no shown piece, and nothing else about any place. Security definer:
-- it reads the GM's tables, and returns only these columns.
create function public.scene_pieces(campaign uuid) returns table (group_number integer, place_name text, piece_id uuid, kind text, body text)
language sql stable security definer set search_path = '' as $$
  select gp.group_number, p.name, pc.id, pc.kind, pc.body
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

-- 4. Signals and splits --------------------------------------------------------------------------------------------

-- The pieces shown on a visit, sorted (to compare two visits).
create function private.shown_pieces(visit uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(s.piece_id order by s.piece_id), '{}') from public.piece_shows s
  where s.group_place_id = visit and s.shown and not s.undone;
$$;
revoke execute on function private.shown_pieces(uuid) from public, anon, authenticated;

create function private.tick_group(campaign uuid, group_no integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.group_place_signals (campaign_id, group_number, tick) values (campaign, group_no, 1)
  on conflict (campaign_id, group_number) do update set tick = public.group_place_signals.tick + 1, updated_at = now();
$$;
revoke execute on function private.tick_group(uuid, integer) from public, anon, authenticated;

-- As in 20261031180000_m5_places_review.sql, plus: a visit with shown pieces moved on from or undone ticks too.
create or replace function private.tick_group_place_signal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.shown)
    or (tg_op = 'UPDATE' and (
      old.shown is distinct from new.shown
      or ((old.shown or cardinality(private.shown_pieces(old.id)) > 0)
        and (old.moved_on is distinct from new.moved_on or old.undone is distinct from new.undone)))) then
    perform private.tick_group(new.campaign_id, new.group_number);
  end if;
  return null;
end;
$$;

-- A piece shown, hidden, or a shown one undone: its group's players see something else.
create function private.tick_piece_show() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.shown)
    or (tg_op = 'UPDATE' and (old.shown is distinct from new.shown or (old.shown and old.undone is distinct from new.undone))) then
    perform private.tick_group(new.campaign_id, new.group_number);
  end if;
  return null;
end;
$$;
revoke execute on function private.tick_piece_show() from public, anon, authenticated;
create trigger tick_piece_show after insert or update on public.piece_shows
  for each row execute function private.tick_piece_show();

-- A shown piece undone (Undo of + Piece): every group it's shown to.
create function private.tick_piece() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  group_no integer;
begin
  if old.undone is distinct from new.undone or old.body is distinct from new.body then
    for group_no in
      select distinct s.group_number from public.piece_shows s where s.piece_id = new.id and s.shown and not s.undone
    loop
      perform private.tick_group(new.campaign_id, group_no);
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.tick_piece() from public, anon, authenticated;
create trigger tick_piece after update on public.place_pieces
  for each row execute function private.tick_piece();

-- As in 20261031170000_m5_places_messages.sql, plus: the new visit carries the shown pieces along (in their order),
-- and a group already at that place with the same pieces shown stays as it is.
create or replace function private.follow_into_group() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  was public.group_places;
  there public.group_places;
  trip uuid;
  visit uuid;
begin
  if new.group_number = old.group_number or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return null;
  end if;
  if exists (
    select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
    where m.campaign_id = new.campaign_id and m.group_number = new.group_number and m.actor_id <> new.actor_id
      and a.approval = 'approved' and a.status = 'active'
  ) then
    return null;
  end if;
  select x.id into trip from public.expeditions x where x.campaign_id = new.campaign_id and x.ended_at is null and not x.undone;
  if trip is null then
    return null;
  end if;
  was := private.current_group_place(new.campaign_id, old.group_number);
  there := private.current_group_place(new.campaign_id, new.group_number);
  if (there.id is null and was.id is null)
    or (there.id is not null and there.place_id is not distinct from was.place_id and there.shown = coalesce(was.shown, false)
      and private.shown_pieces(there.id) = private.shown_pieces(was.id)) then
    return null;
  end if;
  if there.id is not null then
    update public.group_places gp set moved_on = true where gp.id = there.id;
  end if;
  insert into public.group_places (campaign_id, expedition_id, group_number, place_id, shown)
  values (new.campaign_id, trip, new.group_number, was.place_id, coalesce(was.shown, false))
  returning id into visit;
  if was.id is not null then
    insert into public.piece_shows (campaign_id, group_place_id, piece_id, group_number, shown, shown_at)
    select new.campaign_id, visit, s.piece_id, new.group_number, true, s.shown_at
    from public.piece_shows s
    join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
    where s.group_place_id = was.id and s.shown and not s.undone
    order by s.shown_at, s.id;
  end if;
  return null;
end;
$$;

-- 5. What players saw stays what they see ------------------------------------------------------------------------

-- Each place's description (M5 step 11) becomes its first piece, and a visit shown now shows it (not logged: nothing
-- happened in play; the new tables' triggers are paused for these inserts). Inserts only; places.description stays.
alter table public.place_pieces disable trigger user;
alter table public.piece_shows disable trigger user;
insert into public.place_pieces (campaign_id, place_id, kind, body, position)
select p.campaign_id, p.id, 'description', trim(p.description), 0
from public.places p
where length(trim(p.description)) > 0;
insert into public.piece_shows (campaign_id, group_place_id, piece_id, group_number, shown, shown_at)
select gp.campaign_id, gp.id, pc.id, gp.group_number, true, gp.updated_at
from public.group_places gp
join public.place_pieces pc on pc.place_id = gp.place_id and pc.kind = 'description'
where gp.shown and not gp.undone and not gp.moved_on;
alter table public.place_pieces enable trigger user;
alter table public.piece_shows enable trigger user;

-- 6. Logged-command rows and undo ----------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('place.addPiece', 'verbose', true),
  ('place.showPiece', 'verbose', true),
  ('place.hidePiece', 'verbose', true),
  ('place.hideAll', 'verbose', true);
-- Records these make are marked undone by Undo: a piece; a piece's first Show on a visit.
insert into public.undoable_makings (name) values ('place.addPiece'), ('place.showPiece');
