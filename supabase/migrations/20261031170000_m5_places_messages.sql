-- M5 step 11: places and the room, and Send (docs/05 "Split the party", "Places for players", "The room's GM layer",
-- "Send in M5"; docs/03; ruled 2026-10-30 DG9, DG11, DG14 and 2026-10-31 B1, and Francis's ruling of 2026-10-31: a
-- shown place is visible to its group's players only).
--   1. places: the rooms and places the GM has named, one per name in a campaign (the same name is the same place, so
--      its description and notes come back with it). The GM's alone, except while shown (below). place_notes: the
--      GM's notes on a place under five headings (traps, puzzles, encounters, treasure, doors; R1 text, DG13), in a
--      table only the GM reads, so notes never reach a player's device even while the place is shown.
--   2. group_places: where each group is during an expedition. A group's current place is its newest row that isn't
--      undone or moved on from, in the expedition under way. Start expedition's Where? puts every group there; Where
--      now? (place.set) moves one group; Show players / Hide (place.show, place.hide) flip `shown`. A group that
--      someone joins while nobody else is in it (a split) starts where that person was. Players read their own
--      groups' rows (which say only which place and whether it's shown), and a place itself only while it's shown to
--      one of their groups now. The rows' log lines are the GM's (no log_audience function: hidden means hidden);
--      players' screens follow the rows themselves (Realtime, which applies the same rules).
--   3. Join up: players may join two groups up only when both are in the same place (both with none counts as the
--      same: nothing says they're apart). private.groups_together (a stub in 20261030230000_m5_party_groups.sql) now
--      says so; public.groups_meeting tells a player's device which groups share a place, without saying where.
--   4. gm_messages and message_recipients: Send (D26): text or a check result, to everyone or chosen characters,
--      kept (Keep in Handouts), burnt (Burn after reading) or neither. Only recipients read a message; a burnt one
--      stops being readable once its recipient closes it, and its lines are the GM's alone (the GM's log keeps the
--      text). A kept or plain one's line reaches each recipient.
-- Replaces public.start_expedition (newest copy in 20261031150000_m5_start_clock.sql) and private.groups_together
-- (20261030230000_m5_party_groups.sql). Adds tables, their rules, triggers, policies and functions, a trigger on
-- party_group_members, and logged-command rows. Drops nothing; no rows are removed. expedition_places (step 10) stays
-- as it is, the record of where each expedition started (recent places and "Started at …"); an expedition under way
-- with a start place gets that place as its groups' current place.

-- 1. Places and their notes ----------------------------------------------------------------------------------------

create table public.places (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  -- What players notice, once shown (DG9).
  description text not null default '' check (length(description) <= 4000),
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index places_one_per_name on public.places (campaign_id, lower(name)) where not undone;

create table public.place_notes (
  id uuid primary key references public.places (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  traps text not null default '' check (length(traps) <= 4000),
  puzzles text not null default '' check (length(puzzles) <= 4000),
  encounters text not null default '' check (length(encounters) <= 4000),
  treasure text not null default '' check (length(treasure) <= 4000),
  doors text not null default '' check (length(doors) <= 4000),
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index place_notes_campaign on public.place_notes (campaign_id);

-- 2. Where each group is --------------------------------------------------------------------------------------------

create table public.group_places (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid not null references public.expeditions (id) on delete cascade,
  group_number integer not null,
  -- Null: the group is somewhere the GM hasn't named.
  place_id uuid references public.places (id) on delete cascade,
  shown boolean not null default false,
  -- The group went on from here (a newer row is its place now).
  moved_on boolean not null default false,
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, group_number) references public.party_groups (campaign_id, number) on delete cascade
);
create index group_places_current on public.group_places (expedition_id, group_number) where not undone and not moved_on;
create index group_places_campaign on public.group_places (campaign_id);
create index group_places_place on public.group_places (place_id);

-- A group's current place row in the expedition under way (null: none).
create function private.current_group_place(campaign uuid, group_no integer) returns public.group_places
language sql stable security definer set search_path = '' as $$
  select gp.* from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id
  where gp.campaign_id = campaign and gp.group_number = group_no and not gp.undone and not gp.moved_on
    and x.ended_at is null and not x.undone
  order by gp.created_at desc, gp.id desc
  limit 1;
$$;
revoke execute on function private.current_group_place(uuid, integer) from public, anon, authenticated;

-- Is this group one of the reader's (a character or hireling of theirs is in it)?
create function private.in_my_group(campaign uuid, group_no integer) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member(campaign) and exists (
    select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
    where m.campaign_id = campaign and m.group_number = group_no
      and a.owner_type = 'user' and a.owner_user_id = (select auth.uid())
  );
$$;
revoke execute on function private.in_my_group(uuid, integer) from public, anon, authenticated;

-- Is this place shown now to one of the reader's groups (it is that group's current place, and shown)?
create function private.place_shown_to_me(place uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_places gp join public.expeditions x on x.id = gp.expedition_id
    where gp.place_id = place and gp.shown and not gp.undone and not gp.moved_on
      and x.ended_at is null and not x.undone
      and private.in_my_group(gp.campaign_id, gp.group_number)
      and (private.current_group_place(gp.campaign_id, gp.group_number)).id = gp.id
  );
$$;
revoke execute on function private.place_shown_to_me(uuid) from public, anon, authenticated;

alter table public.places enable row level security;
alter table public.place_notes enable row level security;
alter table public.group_places enable row level security;
grant select, insert, update on public.places, public.place_notes, public.group_places to authenticated;
grant select, insert, update, delete on public.places, public.place_notes, public.group_places to service_role;

create policy "places: the GM, and players while it's shown to their group" on public.places
  for select to authenticated using (private.is_gm(campaign_id) or private.place_shown_to_me(id));
create policy "places: the GM keeps them" on public.places
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "places: the GM keeps them, again" on public.places
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

create policy "place notes: the GM reads" on public.place_notes
  for select to authenticated using (private.is_gm(campaign_id));
create policy "place notes: the GM keeps them" on public.place_notes
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "place notes: the GM keeps them, again" on public.place_notes
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

create policy "group places: the GM, and players for their own groups" on public.group_places
  for select to authenticated using (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number));
create policy "group places: the GM keeps them" on public.group_places
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "group places: the GM keeps them, again" on public.group_places
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- A place: trimmed, made by whoever names it. A change: its description (and undo's mark); the name stays (the name
-- is the place).
create function private.place_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.name := trim(new.name);
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That place was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.name is distinct from old.name or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.place_rules() from public, anon, authenticated;

create function private.place_note_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.places p where p.id = new.id and p.campaign_id = new.campaign_id) then
    raise exception 'That place isn''t in this campaign.';
  end if;
  if tg_op = 'UPDATE' then
    if old.undone then
      raise exception 'That place was undone.';
    end if;
    if new.campaign_id is distinct from old.campaign_id then
      raise exception 'That can''t be changed.';
    end if;
  else
    new.undone := false;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.place_note_rules() from public, anon, authenticated;

-- Where a group is: the place and expedition are this campaign's. A change: shown, moved on, or undo's mark; an undone
-- row stays as it is.
create function private.group_place_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.expeditions x where x.id = new.expedition_id and x.campaign_id = new.campaign_id) then
      raise exception 'That expedition isn''t in this campaign.';
    end if;
    if new.place_id is not null and not exists (select 1 from public.places p where p.id = new.place_id and p.campaign_id = new.campaign_id) then
      raise exception 'That place isn''t in this campaign.';
    end if;
    new.undone := false;
    new.moved_on := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That place was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.group_number is distinct from old.group_number or new.place_id is distinct from old.place_id
    or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.group_place_rules() from public, anon, authenticated;

create trigger check_copy_version before insert or update on public.places
  for each row execute function private.check_copy_version();
create trigger place_rules before insert or update on public.places
  for each row execute function private.place_rules();
create trigger refuse_when_retired before insert or update or delete on public.places
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.places
  for each row execute function private.log_change();

create trigger check_copy_version before insert or update on public.place_notes
  for each row execute function private.check_copy_version();
create trigger place_note_rules before insert or update on public.place_notes
  for each row execute function private.place_note_rules();
create trigger refuse_when_retired before insert or update or delete on public.place_notes
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.place_notes
  for each row execute function private.log_change();

create trigger group_place_rules before insert or update on public.group_places
  for each row execute function private.group_place_rules();
create trigger refuse_when_retired before insert or update or delete on public.group_places
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.group_places
  for each row execute function private.log_change();

insert into public.undoable_tables (name) values ('places'), ('place_notes'), ('group_places');

-- The place of that name in the campaign, made (with its notes) if there isn't one. Security invoker: the GM's rules.
create function private.place_named(campaign uuid, place_name text) returns uuid
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
  select p.id into found from public.places p where p.campaign_id = campaign and lower(p.name) = lower(trim(place_name)) and not p.undone;
  if found is null then
    insert into public.places (campaign_id, name) values (campaign, trim(place_name)) returning id into found;
    insert into public.place_notes (id, campaign_id) values (found, campaign);
  end if;
  return found;
end;
$$;
revoke execute on function private.place_named(uuid, text) from public, anon;
grant execute on function private.place_named(uuid, text) to authenticated, service_role;

-- Where now? (place.set): the group goes to the place of that name (blank: somewhere unnamed), hidden from players
-- until the GM shows it. The GM; during an expedition. A repeat changes nothing.
create function public.set_group_place(campaign uuid, group_no integer, place_name text) returns public.group_places
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('group_places');
  row_now public.group_places;
  trip uuid;
  place uuid;
begin
  if made is not null then
    select * into row_now from public.group_places gp where gp.id = made;
    return row_now;
  end if;
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
  place := private.place_named(campaign, place_name);
  row_now := private.current_group_place(campaign, group_no);
  if row_now.id is not null then
    update public.group_places gp set moved_on = true where gp.id = row_now.id;
  end if;
  insert into public.group_places (campaign_id, expedition_id, group_number, place_id)
  values (campaign, trip, group_no, place) returning * into row_now;
  return row_now;
end;
$$;
revoke execute on function public.set_group_place(uuid, integer, text) from public, anon;
grant execute on function public.set_group_place(uuid, integer, text) to authenticated, service_role;

-- A group someone joins while nobody else is in it (a split) starts where that person was: their old group's place,
-- shown as it was. Not while undoing (the group's own place comes back with it). Security definer: a player's split
-- writes it; its line is the GM's.
create function private.follow_into_group() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  was public.group_places;
  there public.group_places;
  trip uuid;
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
    or (there.id is not null and there.place_id is not distinct from was.place_id and there.shown = coalesce(was.shown, false)) then
    return null;
  end if;
  if there.id is not null then
    update public.group_places gp set moved_on = true where gp.id = there.id;
  end if;
  insert into public.group_places (campaign_id, expedition_id, group_number, place_id, shown)
  values (new.campaign_id, trip, new.group_number, was.place_id, coalesce(was.shown, false));
  return null;
end;
$$;
revoke execute on function private.follow_into_group() from public, anon, authenticated;
create trigger follow_into_group after update of group_number on public.party_group_members
  for each row execute function private.follow_into_group();

-- 3. Join up only in the same place ----------------------------------------------------------------------------------

-- As in 20261030230000_m5_party_groups.sql, which counted every two groups as together: now they are when their
-- current places are the same place, or neither has one.
create or replace function private.groups_together(campaign uuid, one integer, other integer) returns boolean
language sql stable security definer set search_path = '' as $$
  select (private.current_group_place(campaign, one)).place_id is not distinct from (private.current_group_place(campaign, other)).place_id;
$$;
revoke execute on function private.groups_together(uuid, integer, integer) from public, anon, authenticated;

-- Which groups are in the same place, without saying where: each group with someone in it, and the lowest-numbered
-- group sharing its place (equal numbers: the same place). For any member.
create function public.groups_meeting(campaign uuid) returns table (group_number integer, meets integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_member(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return query
    with groups as (
      select distinct m.group_number as n from public.party_group_members m join public.actors a on a.id = m.actor_id
      where m.campaign_id = campaign and a.approval = 'approved' and a.status = 'active'
    )
    select g.n, (select min(o.n) from groups o where private.groups_together(campaign, g.n, o.n))::integer
    from groups g order by g.n;
end;
$$;
revoke execute on function public.groups_meeting(uuid) from public, anon;
grant execute on function public.groups_meeting(uuid) to authenticated, service_role;

-- 4. Start expedition puts every group at its place ---------------------------------------------------------------

drop function public.start_expedition(uuid, text, text);

-- As in 20261031150000_m5_start_clock.sql, plus: with a place, it is every group's current place (hidden until
-- shown), made in the same request (so Undo of the start marks them undone too).
create function public.start_expedition(campaign uuid, mode_id text, place_name text default null) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('expeditions');
  expedition public.expeditions;
  place uuid;
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
  if place_name is not null and length(trim(place_name)) > 200 then
    raise exception 'A place''s name is at most 200 characters.';
  end if;
  insert into public.expeditions (campaign_id, mode) values (campaign, trim(mode_id)) returning * into expedition;
  if place_name is not null and length(trim(place_name)) > 0 then
    insert into public.expedition_places (campaign_id, expedition_id, name, mode)
    values (campaign, expedition.id, trim(place_name), expedition.mode);
    place := private.place_named(campaign, place_name);
    insert into public.group_places (campaign_id, expedition_id, group_number, place_id)
    select campaign, expedition.id, g.n, place
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
revoke execute on function public.start_expedition(uuid, text, text) from public, anon;
grant execute on function public.start_expedition(uuid, text, text) to authenticated, service_role;

-- An expedition under way that started at a place: that place is its groups' current place (not logged: nothing
-- happened in play; the new tables' triggers are paused for these inserts). Inserts only.
alter table public.places disable trigger user;
alter table public.place_notes disable trigger user;
alter table public.group_places disable trigger user;
insert into public.places (campaign_id, name)
select distinct on (ep.campaign_id, lower(trim(ep.name))) ep.campaign_id, trim(ep.name)
from public.expedition_places ep join public.expeditions x on x.id = ep.expedition_id
where not ep.undone and x.ended_at is null and not x.undone
on conflict do nothing;
insert into public.place_notes (id, campaign_id)
select p.id, p.campaign_id from public.places p on conflict do nothing;
insert into public.group_places (campaign_id, expedition_id, group_number, place_id)
select ep.campaign_id, ep.expedition_id, g.number, p.id
from public.expedition_places ep
join public.expeditions x on x.id = ep.expedition_id
join public.places p on p.campaign_id = ep.campaign_id and lower(p.name) = lower(trim(ep.name)) and not p.undone
join public.party_groups g on g.campaign_id = ep.campaign_id
where not ep.undone and x.ended_at is null and not x.undone
  and (g.number = 1 or exists (select 1 from public.party_group_members m where m.campaign_id = g.campaign_id and m.group_number = g.number));
alter table public.places enable trigger user;
alter table public.place_notes enable trigger user;
alter table public.group_places enable trigger user;

-- 5. Send ------------------------------------------------------------------------------------------------------------

create table public.gm_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  kind text not null default 'text' check (kind in ('text', 'check')),
  -- Keep in Handouts, or Burn after reading: one or the other, or neither.
  keep boolean not null default false,
  burn boolean not null default false,
  everyone boolean not null default true,
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (keep and burn))
);
create index gm_messages_campaign on public.gm_messages (campaign_id, created_at desc) where not undone;

create table public.message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.gm_messages (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  actor_id uuid not null references public.actors (id) on delete cascade,
  -- The character's player when it was sent.
  user_id uuid not null references public.profiles (id) on delete cascade,
  closed_at timestamptz,
  undone boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, actor_id)
);
create index message_recipients_user on public.message_recipients (user_id, campaign_id);

-- May the reader read this message: the GM; a recipient, unless it was burnt and they closed it.
create function private.message_for_me(message uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.gm_messages g join public.message_recipients r on r.message_id = g.id
    where g.id = message and not g.undone and not r.undone and r.user_id = (select auth.uid())
      and private.is_member(g.campaign_id)
      and not (g.burn and r.closed_at is not null)
  );
$$;
revoke execute on function private.message_for_me(uuid) from public, anon, authenticated;

alter table public.gm_messages enable row level security;
alter table public.message_recipients enable row level security;
grant select, insert, update on public.gm_messages, public.message_recipients to authenticated;
grant select, insert, update, delete on public.gm_messages, public.message_recipients to service_role;

create policy "gm messages: the GM, and its recipients" on public.gm_messages
  for select to authenticated using (private.is_gm(campaign_id) or private.message_for_me(id));
create policy "gm messages: the GM sends" on public.gm_messages
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "gm messages: the GM sends, again" on public.gm_messages
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

create policy "message recipients: the GM, and the recipient" on public.message_recipients
  for select to authenticated using (private.is_gm(campaign_id) or (user_id = (select auth.uid()) and private.is_member(campaign_id)));
create policy "message recipients: the GM sends" on public.message_recipients
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "message recipients: the GM sends, again" on public.message_recipients
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- A message: trimmed, sent by the GM. A change: only undo's mark.
create function private.gm_message_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.body := trim(new.body);
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That message was undone.';
  end if;
  if (to_jsonb(new) - 'undone' - 'updated_at') is distinct from (to_jsonb(old) - 'undone' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.gm_message_rules() from public, anon, authenticated;

-- A recipient: a character of this campaign, with its player. A change: closed (by close_message) or undo's mark.
create function private.message_recipient_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.gm_messages g where g.id = new.message_id and g.campaign_id = new.campaign_id) then
      raise exception 'That message isn''t in this campaign.';
    end if;
    if not exists (select 1 from public.actors a where a.id = new.actor_id and a.campaign_id = new.campaign_id) then
      raise exception 'That character isn''t in this campaign.';
    end if;
    new.undone := false;
    new.closed_at := null;
    return new;
  end if;
  if old.undone then
    raise exception 'That message was undone.';
  end if;
  if (to_jsonb(new) - 'undone' - 'closed_at' - 'updated_at') is distinct from (to_jsonb(old) - 'undone' - 'closed_at' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.message_recipient_rules() from public, anon, authenticated;

create trigger gm_message_rules before insert or update on public.gm_messages
  for each row execute function private.gm_message_rules();
create trigger refuse_when_retired before insert or update or delete on public.gm_messages
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.gm_messages
  for each row execute function private.log_change();

create trigger message_recipient_rules before insert or update on public.message_recipients
  for each row execute function private.message_recipient_rules();
create trigger refuse_when_retired before insert or update or delete on public.message_recipients
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.message_recipients
  for each row execute function private.log_change();

-- A recipient's lines: their own (owner), unless the message burns after reading: then the GM's alone, so it never
-- enters the players' log. The message's own line (with the text) is the GM's (no function of its own).
create function private.log_audience_message_recipients(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
begin
  if coalesce((select g.burn from public.gm_messages g where g.id = (this_row ->> 'message_id')::uuid), true) then
    who_sees := 'gm';
    owner := null;
    return;
  end if;
  who_sees := 'owner';
  owner := (this_row ->> 'user_id')::uuid;
end;
$$;
revoke execute on function private.log_audience_message_recipients(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('gm_messages'), ('message_recipients');

-- Send: the text (or a check result's words, edited) to everyone (no characters given: every approved, active player
-- character) or to the characters chosen. The GM. A repeat changes nothing.
create function public.send_message(campaign uuid, body text, kind text default 'text', keep boolean default false,
  burn boolean default false, to_characters uuid[] default null) returns public.gm_messages
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('gm_messages');
  message public.gm_messages;
  sent integer;
begin
  if made is not null then
    select * into message from public.gm_messages g where g.id = made;
    return message;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if body is null or length(trim(body)) = 0 then
    raise exception 'Write something to send.';
  end if;
  if length(trim(body)) > 4000 then
    raise exception 'A message is at most 4000 characters.';
  end if;
  if keep and burn then
    raise exception 'Keep it or burn it, not both.';
  end if;
  insert into public.gm_messages (campaign_id, body, kind, keep, burn, everyone)
  values (campaign, body, coalesce(kind, 'text'), coalesce(keep, false), coalesce(burn, false), to_characters is null)
  returning * into message;
  insert into public.message_recipients (message_id, campaign_id, actor_id, user_id)
  select message.id, campaign, a.id, a.owner_user_id
  from public.actors a
  where a.campaign_id = campaign and a.kind = 'pc' and a.approval = 'approved' and a.status = 'active'
    and a.owner_type = 'user' and a.owner_user_id is not null
    and (to_characters is null or a.id = any (to_characters));
  get diagnostics sent = row_count;
  if sent = 0 then
    raise exception 'Nobody to send it to: pick at least one character in play.';
  end if;
  return message;
end;
$$;
revoke execute on function public.send_message(uuid, text, text, boolean, boolean, uuid[]) from public, anon;
grant execute on function public.send_message(uuid, text, text, boolean, boolean, uuid[]) to authenticated, service_role;

-- Close (message.close): the reader has read it. A burnt message is gone for them from now on. Their own copies only;
-- a repeat changes nothing.
create function public.close_message(message uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  closed integer;
begin
  if not exists (select 1 from public.message_recipients r where r.message_id = message and r.user_id = (select auth.uid()) and private.is_member(r.campaign_id)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  update public.message_recipients r set closed_at = now()
  where r.message_id = message and r.user_id = (select auth.uid()) and r.closed_at is null and not r.undone;
  get diagnostics closed = row_count;
  return closed;
end;
$$;
revoke execute on function public.close_message(uuid) from public, anon;
grant execute on function public.close_message(uuid) to authenticated, service_role;

-- Players' screens follow the rows they may read (Realtime applies the same rules as reading).
alter publication supabase_realtime add table public.group_places, public.places, public.message_recipients;

-- 6. Logged-command rows and undo ----------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('place.set', 'simple', true),
  ('place.show', 'simple', true),
  ('place.hide', 'simple', true),
  ('place.edit', 'verbose', true),
  ('message.send', 'simple', true),
  ('message.close', 'verbose', false);
-- Records these make are marked undone by Undo: a place, where a group is, a message. A split or a Join up can make a
-- group's place (the group someone joins starts where they were).
insert into public.undoable_makings (name) values ('place.set'), ('message.send'), ('party.chooseGroup'), ('party.joinUp');
