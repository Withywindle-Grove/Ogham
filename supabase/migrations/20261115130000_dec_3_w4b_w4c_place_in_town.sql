-- December step 3, rows W4b and W4c (docs/plans/dec-3-the-whole-town.md; brief
-- docs/plans/briefs/dec-3-w4b-w4c-place-in-town-brief.md at 52f7bb2f; Francis's tr-1 and ge-1, 2026-11-14,
-- docs/design/rulings/dec-pack-town-players-2026-11-14.md). Data and logic only: no screen.
--   W4c (ge-1): the GM may show a piece of a place IN a town (a place one level under the town) while the group is in
--   the town, not in that place; every other check of place.showPiece stays.
--   W4b (tr-1): a player in that town reads exactly what was shown of it, while the group is there.
-- The shows live in a store of their own (public.town_piece_shows), never in public.piece_shows: every existing reader
-- of piece_shows relies on its rows being pieces of their visit's own place, and keeps doing so.
--
-- What it adds (all new; add-only):
--   1. private.town_part_of(place, visit): is this place one level under the town this visit is in? (test 1)
--   2. public.town_piece_shows (the store) and public.town_piece_resets (a group number's reset marker), GM-only.
--   3. private.town_shown_now(row): the one "shown now" test (live, shown, and later than its group number's last reset).
--   4. private.town_piece_show_rules (the store's rules trigger; locks its visit; dates every show by the database).
--   5. private.town_piece_reset (a trigger on party_group_members: a marker when a group number empties or is filled
--      from empty; returns at once while its campaign is being deleted).
--   6. public.show_town_place_piece (town.showPiece / town.hidePiece), the GM's.
--   7. Ticks: private.tick_town_piece_show (on the store) and private.tick_town_piece (on place_pieces).
--   8. Reads: private.town_parts_for and private.town_pictures_for (the reader's rows), public.scene_town_pieces,
--      public.scene_town_pictures (players), public.town_parts_shown (the GM's eyes).
--   9. Replaces ONE function: private.place_picture_shown_to_me (newest in
--      20261103201000_m5b_1b_picture_shown_on_its_own.sql:106): its branch unchanged, plus one for a place in town's
--      shown picture (tr-1, "picture").
--  10. logged_commands rows town.showPiece and town.hidePiece; undoable table town_piece_shows; undoable making
--      town.showPiece.
-- Nothing else changes: piece_shows, piece_show_rules, show_place_piece, follow_into_group, shown_pieces, log_change,
-- the Undo functions and every existing reader are untouched. Drops, renames and deletes nothing.

-- 1. Test 1: one level under the visit's town ---------------------------------------------------------------------------

-- True only when: the visit is live (not undone) and its place is a town by scene_town's own test (safety or
-- settlement set); the place is in the same campaign and the same pack, not undone, and its stored parent
-- (pack_parent_id, a pack entry id) is the town's own pack entry id; and the town's list (places.town) has the place's
-- entry, keyed `place:<pack entry id>` (T-b, tn-3). Never by name. Two levels under, a place made by hand (no pack
-- link) or another town's place: false.
create function private.town_part_of(place uuid, visit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_places v
    join public.places t on t.id = v.place_id and t.campaign_id = v.campaign_id and not t.undone
      and (t.safety is not null or t.settlement is not null)
    join public.places p on p.id = town_part_of.place and p.campaign_id = v.campaign_id and not p.undone
      and p.pack_id = t.pack_id and p.pack_parent_id = t.pack_entry_id
      and t.town ? ('place:' || p.pack_entry_id)
    where v.id = town_part_of.visit and not v.undone
  );
$$;
revoke execute on function private.town_part_of(uuid, uuid) from public, anon;
-- The GM's command (security invoker, as show_place_piece) calls it; the private schema isn't exposed to the API.
grant execute on function private.town_part_of(uuid, uuid) to authenticated, service_role;

-- 2. The store and its reset marker ---------------------------------------------------------------------------------------

-- Which pieces of places in town a group's visit to the town shows (as piece_shows, for a different place).
create table public.town_piece_shows (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The group's visit to the TOWN.
  group_place_id uuid not null references public.group_places (id) on delete cascade,
  -- A piece of a place one level under that town.
  piece_id uuid not null references public.place_pieces (id) on delete cascade,
  -- The visit's group (copied from the visit).
  group_number integer not null,
  shown boolean not null default true,
  -- The database's time (clock_timestamp, after the visit's lock), never the writer's.
  shown_at timestamptz not null default clock_timestamp(),
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index town_piece_shows_one on public.town_piece_shows (group_place_id, piece_id) where not undone;
create index town_piece_shows_piece on public.town_piece_shows (piece_id);
create index town_piece_shows_campaign on public.town_piece_shows (campaign_id, group_number);

-- "This group number's place-in-town shows were reset at T": written by the database when a group number empties or
-- is filled from empty. Derived state, not an action: no log line, no Undo.
create table public.town_piece_resets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  group_number integer not null,
  reset_at timestamptz not null default clock_timestamp()
);
create index town_piece_resets_group on public.town_piece_resets (campaign_id, group_number, reset_at desc);

alter table public.town_piece_shows enable row level security;
alter table public.town_piece_resets enable row level security;
grant select, insert, update on public.town_piece_shows to authenticated;
grant select, insert, update, delete on public.town_piece_shows to service_role;
grant select on public.town_piece_resets to authenticated;
grant select, insert, update, delete on public.town_piece_resets to service_role;

-- The campaign's GM alone (Undo runs as the caller and needs select, insert and update); no player, no delete.
create policy "town piece shows: the GM reads" on public.town_piece_shows
  for select to authenticated using (private.is_gm(campaign_id));
create policy "town piece shows: the GM keeps them" on public.town_piece_shows
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "town piece shows: the GM keeps them, again" on public.town_piece_shows
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));
-- The markers: the GM reads them; only the database writes them.
create policy "town piece resets: the GM reads" on public.town_piece_resets
  for select to authenticated using (private.is_gm(campaign_id));

-- 3. "Shown now" -----------------------------------------------------------------------------------------------------------

-- The one test every reader and the command use: the row is live, shown, and shown later than the latest reset of
-- its campaign and group number (a reset at the same instant counts as after it), whichever visit the row is on.
create function private.town_shown_now(one public.town_piece_shows) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(one.shown and not one.undone, false)
    and one.shown_at > coalesce(
      (select max(r.reset_at) from public.town_piece_resets r
       where r.campaign_id = one.campaign_id and r.group_number = one.group_number),
      '-infinity'::timestamptz);
$$;
revoke execute on function private.town_shown_now(public.town_piece_shows) from public, anon;
-- The GM's eyes (public.town_parts_shown, security invoker) call it; the private schema isn't exposed to the API.
grant execute on function private.town_shown_now(public.town_piece_shows) to authenticated, service_role;

-- 4. The store's rules ------------------------------------------------------------------------------------------------------

-- Whoever writes (the GM's command, a GM's direct write, Undo): a live piece of a place one level under the visit's town,
-- in the visit's campaign, for the visit's group. A change: only shown, its time and undone. Showing (an insert shown,
-- shown turning on, or any change of the time outside Undo) needs the visit live and the group's current place (an
-- expedition under way), and is dated by the database after the visit's row lock is held, so a show and a reset can't
-- cross. Undo may only put the time back, never forward.
create function private.town_piece_show_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  visit public.group_places;
  this_piece public.place_pieces;
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  showing boolean;
begin
  if tg_op = 'UPDATE' then
    if old.undone then
      raise exception 'That was undone.';
    end if;
    if (to_jsonb(new) - 'shown' - 'shown_at' - 'undone' - 'updated_at') is distinct from (to_jsonb(old) - 'shown' - 'shown_at' - 'undone' - 'updated_at') then
      raise exception 'That can''t be changed.';
    end if;
    if reverting and new.shown_at > old.shown_at then
      raise exception 'That can''t be changed.';
    end if;
    showing := not new.undone and (
      (new.shown and not old.shown)
      or (new.shown_at is distinct from old.shown_at and not reverting));
  else
    showing := new.shown;
  end if;
  -- The visit, locked until this write is done (a reset of its group number waits for it, and it for a reset).
  select * into visit from public.group_places gp where gp.id = new.group_place_id for update;
  if visit.id is null or visit.campaign_id is distinct from new.campaign_id then
    raise exception 'That place isn''t in this campaign.';
  end if;
  if tg_op = 'INSERT' or showing then
    select * into this_piece from public.place_pieces pc where pc.id = new.piece_id and not pc.undone;
    if this_piece.id is null or this_piece.campaign_id is distinct from new.campaign_id then
      raise exception 'That piece isn''t in this place any more.';
    end if;
    if not private.town_part_of(this_piece.place_id, visit.id) then
      raise exception 'That piece isn''t of a place in this town.';
    end if;
  end if;
  if showing and (visit.undone or visit.moved_on
      or (private.current_group_place(visit.campaign_id, visit.group_number)).id is distinct from visit.id) then
    raise exception 'That group has moved on from there.';
  end if;
  if tg_op = 'INSERT' then
    new.group_number := visit.group_number;
    new.undone := false;
    new.created_by := (select auth.uid());
    new.shown_at := clock_timestamp();
    return new;
  end if;
  if showing and not reverting then
    new.shown_at := clock_timestamp();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.town_piece_show_rules() from public, anon, authenticated;

create trigger town_piece_show_rules before insert or update on public.town_piece_shows
  for each row execute function private.town_piece_show_rules();
create trigger refuse_when_retired before insert or update or delete on public.town_piece_shows
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.town_piece_shows
  for each row execute function private.log_change();

insert into public.undoable_tables (name) values ('town_piece_shows');

-- 5. A group number emptied, or filled from empty: its shows are reset ------------------------------------------------------

-- On the membership change follow_into_group listens to (a member's group number), and on a member row added or
-- removed. With follow_into_group's own emptiness test (no other approved, active member in that number), a number
-- left empty, or newly filled by the first one in, gets a marker: whatever was shown to that number before is no
-- longer "shown now", on any of its visits. The number's visits are locked first, and the marker dated after the lock.
-- While the campaign itself is being deleted (its rows going with it), it does nothing, as private.log_change.
create function private.town_piece_reset() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  campaign uuid := coalesce(new.campaign_id, old.campaign_id);
  mover uuid := coalesce(new.actor_id, old.actor_id);
  numbers integer[];
  group_no integer;
begin
  if campaign is null or not exists (select 1 from public.campaigns c where c.id = campaign) then
    return null;
  end if;
  if tg_op = 'INSERT' then
    numbers := array[new.group_number];
  elsif tg_op = 'DELETE' then
    numbers := array[old.group_number];
  elsif new.group_number is distinct from old.group_number then
    numbers := array[old.group_number, new.group_number];
  else
    return null;
  end if;
  foreach group_no in array numbers loop
    if not exists (
      select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
      where m.campaign_id = campaign and m.group_number = group_no and m.actor_id <> mover
        and a.approval = 'approved' and a.status = 'active'
    ) then
      perform 1 from public.group_places gp where gp.campaign_id = campaign and gp.group_number = group_no order by gp.id for update;
      insert into public.town_piece_resets (campaign_id, group_number, reset_at) values (campaign, group_no, clock_timestamp());
      perform private.tick_group(campaign, group_no);
    end if;
  end loop;
  return null;
end;
$$;
revoke execute on function private.town_piece_reset() from public, anon, authenticated;

create trigger town_piece_reset after insert or delete or update of group_number on public.party_group_members
  for each row execute function private.town_piece_reset();

-- 6. The GM's eye (town.showPiece, town.hidePiece) ------------------------------------------------------------------------------

-- As public.show_place_piece (20261102100000_m5b_g2_place_pieces.sql:204), with the one change ge-1 allows: the piece
-- is of a place one level under the visit's town (test 1), not of the town itself. Every other check stays: the GM;
-- the visit live and the group's current place (an expedition under way); the piece live; a repeat changes nothing;
-- hiding a piece never shown returns null; a repeated request is answered once. A row shown before its group number's
-- last reset counts as not shown: showing it again dates it now. Security invoker: the GM's rules.
create function public.show_town_place_piece(visit uuid, piece uuid, show_it boolean) returns public.town_piece_shows
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('town_piece_shows');
  here public.group_places;
  this_piece public.place_pieces;
  row_now public.town_piece_shows;
  want boolean := coalesce(show_it, false);
begin
  if made is not null then
    select * into row_now from public.town_piece_shows s where s.id = made;
    return row_now;
  end if;
  select * into here from public.group_places gp where gp.id = visit;
  if here.id is null or not private.is_gm(here.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- Locked until done, as the reset trigger locks a group number's visits; read again once locked.
  select * into here from public.group_places gp where gp.id = here.id for update;
  if here.undone or here.moved_on or (private.current_group_place(here.campaign_id, here.group_number)).id is distinct from here.id then
    raise exception 'That group has moved on from there.';
  end if;
  select * into this_piece from public.place_pieces pc where pc.id = piece and not pc.undone;
  if this_piece.id is null or this_piece.campaign_id is distinct from here.campaign_id
    or not private.town_part_of(this_piece.place_id, here.id) then
    raise exception 'That piece isn''t in a place in this town any more.';
  end if;
  select * into row_now from public.town_piece_shows s where s.group_place_id = visit and s.piece_id = piece and not s.undone;
  if row_now.id is null then
    if not want then
      return null;
    end if;
    insert into public.town_piece_shows (campaign_id, group_place_id, piece_id, group_number, shown)
    values (here.campaign_id, visit, piece, here.group_number, true)
    returning * into row_now;
  elsif want and not private.town_shown_now(row_now) then
    -- Shown again (or shown before a reset): the rules trigger dates it now.
    update public.town_piece_shows s set shown = true, shown_at = clock_timestamp()
    where s.id = row_now.id
    returning * into row_now;
  elsif not want and private.town_shown_now(row_now) then
    update public.town_piece_shows s set shown = false where s.id = row_now.id
    returning * into row_now;
  end if;
  return row_now;
end;
$$;
revoke execute on function public.show_town_place_piece(uuid, uuid, boolean) from public, anon;
grant execute on function public.show_town_place_piece(uuid, uuid, boolean) to authenticated, service_role;

insert into public.logged_commands (name, level, gm_only) values
  ('town.showPiece', 'verbose', true),
  ('town.hidePiece', 'verbose', true);
insert into public.undoable_makings (name) values ('town.showPiece');

-- 7. Ticks (a number only, read by the GM and the group's players) -----------------------------------------------------------

-- A show of a piece of a place in town shown, hidden, re-dated or undone: its group's players see something else.
create function private.tick_town_piece_show() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.shown)
    or (tg_op = 'UPDATE' and (old.shown is distinct from new.shown or old.shown_at is distinct from new.shown_at
      or old.undone is distinct from new.undone)) then
    perform private.tick_group(new.campaign_id, new.group_number);
  end if;
  return null;
end;
$$;
revoke execute on function private.tick_town_piece_show() from public, anon, authenticated;
create trigger tick_town_piece_show after insert or update on public.town_piece_shows
  for each row execute function private.tick_town_piece_show();

-- A piece of a place in town undone or changed: every group it's shown to in the store (private.tick_piece, untouched,
-- finds groups through piece_shows only).
create function private.tick_town_piece() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  group_no integer;
begin
  if old.undone is distinct from new.undone or old.body is distinct from new.body or old.lead is distinct from new.lead
    or old.kind is distinct from new.kind or old.asset_id is distinct from new.asset_id then
    for group_no in
      select distinct s.group_number from public.town_piece_shows s where s.piece_id = new.id and s.shown and not s.undone
    loop
      perform private.tick_group(new.campaign_id, group_no);
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.tick_town_piece() from public, anon, authenticated;
create trigger tick_town_piece after update on public.place_pieces
  for each row execute function private.tick_town_piece();

-- 8. What a player reads (tr-1) ---------------------------------------------------------------------------------------------

-- The signed-in reader's shown pieces of places in town, all six tests: (1) the reader is in the group of the one visit
-- private.town_visit gives (the town's own list's test; between expeditions too, until moved on or undone); (2) the
-- piece's place is one level under that visit's town (private.town_part_of); (3) the piece is live and "shown now" on
-- that visit (private.town_shown_now); (4) the place's entry in the town is shown now; (5) not a person (until W8,
-- pp-1); (6) the town itself is shown on the visit (private.visit_shown, scene_town's own condition). Raw body and lead
-- (the public reads strip link marks). Not callable by clients.
create function private.town_parts_for(campaign uuid)
returns table (group_number integer, entry_key text, place_name text, piece_id uuid, kind text, body text, lead text, asset_id uuid, shown_at timestamptz, show_id uuid)
language sql stable security definer set search_path = '' as $$
  select v.group_number, 'place:' || p.pack_entry_id, coalesce(nullif(p.players_name, ''), p.name), pc.id, pc.kind, pc.body, pc.lead, pc.asset_id, s.shown_at, s.id
  from public.party_groups g
  cross join lateral private.town_visit(g.campaign_id, g.number) v
  join public.places t on t.id = v.place_id
  join public.town_piece_shows s on s.group_place_id = v.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone and pc.kind <> 'person'
  join public.places p on p.id = pc.place_id
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
    and private.town_part_of(p.id, v.id)
    and private.town_shown_now(s)
    and (t.town -> ('place:' || p.pack_entry_id) ->> 'shown') = 'true'
    and private.visit_shown(v.id);
$$;
revoke execute on function private.town_parts_for(uuid) from public, anon, authenticated;

-- For each place in town that passes, its one shown picture (the newest shown). Not callable by clients.
create function private.town_pictures_for(campaign uuid)
returns table (group_number integer, entry_key text, asset_id uuid)
language sql stable security definer set search_path = '' as $$
  select distinct on (t.group_number, t.entry_key) t.group_number, t.entry_key, t.asset_id
  from private.town_parts_for(campaign) t
  where t.kind = 'picture' and t.asset_id is not null
  order by t.group_number, t.entry_key, t.shown_at desc, t.show_id desc;
$$;
revoke execute on function private.town_pictures_for(uuid) from public, anon, authenticated;

-- A player's shown pieces of places in town: exactly scene_pieces' columns, plus the entry's key as scene_town sends it.
create function public.scene_town_pieces(campaign uuid)
returns table (group_number integer, place_name text, piece_id uuid, kind text, body text, lead text, entry_key text)
language sql stable security definer set search_path = '' as $$
  select t.group_number, t.place_name, t.piece_id, t.kind, private.plain_link_text(t.body), private.plain_link_text(t.lead), t.entry_key
  from private.town_parts_for(campaign) t
  order by t.group_number, t.shown_at, t.show_id;
$$;
revoke execute on function public.scene_town_pieces(uuid) from public, anon;
grant execute on function public.scene_town_pieces(uuid) to authenticated, service_role;

-- A player's shown pictures of places in town: one per place, beside (never instead of) the town's own scene_pictures.
create function public.scene_town_pictures(campaign uuid)
returns table (group_number integer, entry_key text, asset_id uuid)
language sql stable security definer set search_path = '' as $$
  select t.group_number, t.entry_key, t.asset_id from private.town_pictures_for(campaign) t
  order by t.group_number, t.entry_key;
$$;
revoke execute on function public.scene_town_pictures(uuid) from public, anon;
grant execute on function public.scene_town_pictures(uuid) to authenticated, service_role;

-- The GM's eyes: the pieces "shown now" on a visit. Security invoker: row-level security gives anyone but the GM nothing.
create function public.town_parts_shown(visit uuid) returns table (piece_id uuid)
language sql stable security invoker set search_path = '' as $$
  select s.piece_id from public.town_piece_shows s
  where s.group_place_id = visit and private.town_shown_now(s)
  order by s.shown_at, s.id;
$$;
revoke execute on function public.town_parts_shown(uuid) from public, anon;
grant execute on function public.town_parts_shown(uuid) to authenticated, service_role;

-- 9. The stored picture -------------------------------------------------------------------------------------------------------

-- As in 20261103201000_m5b_1b_picture_shown_on_its_own.sql:106 (its branch unchanged), plus: the asset is the picture
-- private.town_pictures_for gives the reader (a place in town's one shown picture, under every test), and no other.
create or replace function private.place_picture_shown_to_me(asset uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.place_pieces pc
    join public.party_groups g on g.campaign_id = pc.campaign_id
    cross join lateral private.current_group_place(g.campaign_id, g.number) gp
    join public.piece_shows s on s.group_place_id = gp.id and s.piece_id = pc.id and s.shown and not s.undone
    where pc.asset_id = asset and pc.kind = 'picture' and not pc.undone and gp.place_id = pc.place_id
      and private.in_my_group(pc.campaign_id, g.number)
  )
  or exists (
    select 1
    from (select distinct pc.campaign_id from public.place_pieces pc
          where pc.asset_id = asset and pc.kind = 'picture' and not pc.undone) c
    cross join lateral private.town_pictures_for(c.campaign_id) t
    where t.asset_id = asset
  );
$$;
