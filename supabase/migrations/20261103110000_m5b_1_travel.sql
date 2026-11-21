-- M5b step 1: travel (docs/plans/m5b-1-travel.md, build order 1; ruled 2026-10-30, S1–S7, D4, D7–D10, S2-5, S4-6;
-- 2026-10-31: per-group wilderness state, Getting lost defaults Secret; docs/05 "Movement", "Lost"; docs/04
-- "ExplorationState"; docs/03 "Lost"). The GM moves a group through a day on the pack's travel budget; the state is
-- per group of a split party, one clock for all.
--   1. travel_groups: one row per group of the expedition under way: today's day, the budget (`total`, as the device
--      works it out from the pack: the slowest member's speed, riding or a cart, or the GM's own `gm_per_day`),
--      `spent`, forced marches today, the shortfall still owed (`pending_*`: the place the group is entering) and
--      where the group is now (`terrain_id`, `route_id`: the ground around them, always shown to players, Q1).
--      The GM reads all; a player reads their own group's row (private.in_my_group) and nothing of another's.
--   2. group_lost: a group is Lost (set by the lost check's hit, or by hand) until Found the way; `attempts` counts
--      Still lost; `roll` is the recovery roll as entered. The GM reads all; a player reads their group's row only
--      while the campaign's Getting lost is Open (settings.gettingLost = 'open'; the default Secret keeps it from
--      them, hard rule 5).
--   3. places gains `terrain_id` and `image_asset_id` for the location view's minimal parts (build order 7): the
--      GM writes them as place.edit writes the description; the picture is an asset of kind 'map', the GM's.
--   4. What the app calls, each an intent with a request id: start_travel_day (the morning: yesterday's shortfall is
--      paid first, the group arrives when it's paid in full; a stale call changes nothing), travel_move (Move…: pays
--      what it can, the rest is owed and the group is "entering"; a new move replaces what was owed; on arrival the
--      group's place moves on as Where now? does), set_travel_budget (the pace, the GM's number, the weather's
--      recount), force_march (the players' button: adds the pack's points, pays what's owed first, and calls the
--      group's rest for that evening through the shared rest flow, g6), spend_travel_day, set_lost, enter_lost_roll
--      (a player while Open), resolve_lost (Found the way / Still lost: the GM's).
--   5. Undo: every change reverts (undoable_tables); a first day, a lost mark and the place rows a move makes are
--      makings (undoable_makings). Log lines are the GM's (no log_audience function: hidden means hidden); players
--      read the state itself through row-level security. travel.forceMarch and travel.lost.roll are a player's
--      commands, so they aren't gm_only.
-- Adds two tables with their rules, triggers and policies, two columns, nine functions and rows in logged_commands,
-- undoable_tables and undoable_makings. Replaces nothing; drops nothing; no rows are removed, renamed or changed.

-- 1. The travel state per group ---------------------------------------------------------------------------------------

create table public.travel_groups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid not null references public.expeditions (id) on delete cascade,
  group_number integer not null,
  -- The expedition's day this row is for (0 its first day), as the device counts it on the clock.
  day integer not null default 0 check (day between 0 and 10000000),
  -- Today's points: worked out by the device from the pack (base, weather, forced marches), or set by hand.
  total integer not null default 0 check (total between 0 and 100000),
  gm_per_day integer check (gm_per_day is null or gm_per_day between 0 and 100000),
  pace text not null default 'foot' check (pace in ('foot', 'riding', 'cart')),
  spent integer not null default 0 check (spent between 0 and 100000),
  forced integer not null default 0 check (forced between 0 and 100),
  -- Where the group is now: the ground around them (the mode's terrain and route ids); null: not known yet.
  terrain_id text check (terrain_id is null or length(terrain_id) between 1 and 200),
  route_id text check (route_id is null or length(route_id) between 1 and 200),
  -- The shortfall (S4): the place the group is entering, and what's still owed for it.
  pending_place_name text check (pending_place_name is null or length(pending_place_name) between 1 and 200),
  pending_place_id uuid references public.places (id) on delete set null,
  pending_terrain_id text check (pending_terrain_id is null or length(pending_terrain_id) between 1 and 200),
  pending_route_id text check (pending_route_id is null or length(pending_route_id) between 1 and 200),
  pending_owed integer check (pending_owed is null or pending_owed between 1 and 100000),
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, group_number) references public.party_groups (campaign_id, number) on delete cascade,
  -- Owed and entering go together.
  check ((pending_owed is null) = (pending_terrain_id is null and pending_route_id is null and pending_place_id is null and pending_place_name is null))
);
create index travel_groups_campaign on public.travel_groups (campaign_id);
create unique index travel_groups_one_per_group on public.travel_groups (expedition_id, group_number) where not undone;

alter table public.travel_groups enable row level security;
grant select, insert, update on public.travel_groups to authenticated;
grant select, insert, update, delete on public.travel_groups to service_role;

create policy "travel: the GM, and players for their own group" on public.travel_groups
  for select to authenticated using (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number));
create policy "travel: the GM starts the day" on public.travel_groups
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "travel: the GM moves the group" on public.travel_groups
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- The row is this campaign's expedition and group; what names it never changes; an undone row stays as it is.
create function private.travel_group_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.expeditions x where x.id = new.expedition_id and x.campaign_id = new.campaign_id) then
      raise exception 'That expedition isn''t in this campaign.';
    end if;
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.group_number is distinct from old.group_number or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  if old.undone and not reverting then
    raise exception 'That was undone.';
  end if;
  if not reverting then
    new.undone := old.undone;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.travel_group_rules() from public, anon, authenticated;

create trigger check_copy_version before insert or update on public.travel_groups
  for each row execute function private.check_copy_version();
create trigger travel_group_rules before insert or update on public.travel_groups
  for each row execute function private.travel_group_rules();
create trigger refuse_when_retired before insert or update or delete on public.travel_groups
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or delete or update of day, total, gm_per_day, pace, spent, forced, terrain_id, route_id, pending_place_name, pending_place_id, pending_terrain_id, pending_route_id, pending_owed, undone on public.travel_groups
  for each row execute function private.log_change();

-- 2. Lost ------------------------------------------------------------------------------------------------------------

create table public.group_lost (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid not null references public.expeditions (id) on delete cascade,
  group_number integer not null,
  -- The day the group got lost, and the day it found the way (null while lost).
  since_day integer not null default 0 check (since_day between 0 and 10000000),
  found_day integer check (found_day is null or found_day between 0 and 10000000),
  -- Still lost, so many mornings.
  attempts integer not null default 0 check (attempts between 0 and 10000),
  -- The recovery roll as entered this morning, and by whom; cleared by Still lost.
  roll text check (roll is null or length(roll) between 1 and 20),
  roll_by uuid references public.profiles (id) on delete set null,
  note text not null default '' check (length(note) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, group_number) references public.party_groups (campaign_id, number) on delete cascade
);
create index group_lost_campaign on public.group_lost (campaign_id);
create unique index group_lost_one_open on public.group_lost (expedition_id, group_number) where found_day is null and not undone;

-- "Getting lost" (04 gettingLost; S4-6): Open shows players their group's Lost and its roll; Secret (the default) keeps it the GM's.
create function private.getting_lost_open(campaign uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.settings ->> 'gettingLost' from public.campaigns c where c.id = campaign), 'secret') = 'open';
$$;
revoke execute on function private.getting_lost_open(uuid) from public, anon, authenticated;

alter table public.group_lost enable row level security;
grant select, insert, update on public.group_lost to authenticated;
grant select, insert, update, delete on public.group_lost to service_role;

create policy "lost: the GM, and players for their own group while Getting lost is Open" on public.group_lost
  for select to authenticated using (private.is_gm(campaign_id) or (private.getting_lost_open(campaign_id) and private.in_my_group(campaign_id, group_number)));
create policy "lost: the GM marks it" on public.group_lost
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "lost: the GM resolves it" on public.group_lost
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

create function private.group_lost_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.expeditions x where x.id = new.expedition_id and x.campaign_id = new.campaign_id) then
      raise exception 'That expedition isn''t in this campaign.';
    end if;
    new.found_day := null;
    new.attempts := 0;
    new.roll := null;
    new.roll_by := null;
    new.note := trim(coalesce(new.note, ''));
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.group_number is distinct from old.group_number or new.created_by is distinct from old.created_by
    or new.since_day is distinct from old.since_day then
    raise exception 'That can''t be changed.';
  end if;
  if old.undone and not reverting then
    raise exception 'That was undone.';
  end if;
  if not reverting then
    new.undone := old.undone;
    if old.found_day is not null and new.found_day is distinct from old.found_day then
      raise exception 'The group already found the way.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.group_lost_rules() from public, anon, authenticated;

create trigger check_copy_version before insert or update on public.group_lost
  for each row execute function private.check_copy_version();
create trigger group_lost_rules before insert or update on public.group_lost
  for each row execute function private.group_lost_rules();
create trigger refuse_when_retired before insert or update or delete on public.group_lost
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or delete or update of found_day, attempts, roll, note, undone on public.group_lost
  for each row execute function private.log_change();

-- 3. The location view's minimal parts on a place ---------------------------------------------------------------------

alter table public.places
  add column terrain_id text check (terrain_id is null or length(terrain_id) between 1 and 200),
  add column image_asset_id uuid references public.assets (id) on delete set null;

-- 4. What the app calls ---------------------------------------------------------------------------------------------

-- The group goes to the place named (blank: somewhere unnamed), as Where now? does (set_group_place), without the GM
-- check: an arrival paid by a forced march is a player's request. Callers check who may.
create function private.group_goes_to(campaign uuid, group_no integer, place_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  trip uuid;
  place uuid;
  row_now public.group_places;
begin
  select x.id into trip from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone;
  if trip is null then
    return;
  end if;
  place := private.place_named(campaign, place_name);
  row_now := private.current_group_place(campaign, group_no);
  if row_now.id is not null and row_now.place_id is not distinct from place and place is not null then
    return;
  end if;
  if row_now.id is not null then
    update public.group_places gp set moved_on = true where gp.id = row_now.id;
  end if;
  insert into public.group_places (campaign_id, expedition_id, group_number, place_id) values (campaign, trip, group_no, place);
end;
$$;
revoke execute on function private.group_goes_to(uuid, integer, text) from public, anon, authenticated;

-- The group's row in the expedition under way, locked; raises when there is none (the day wasn't started).
create function private.travel_row(campaign uuid, group_no integer) returns public.travel_groups
language plpgsql security definer set search_path = '' as $$
declare
  row_now public.travel_groups;
begin
  select t.* into row_now from public.travel_groups t
  join public.expeditions x on x.id = t.expedition_id
  where t.campaign_id = campaign and t.group_number = group_no and not t.undone and x.ended_at is null and not x.undone
  for update of t;
  if row_now.id is null then
    raise exception 'Start the day first.';
  end if;
  return row_now;
end;
$$;
revoke execute on function private.travel_row(uuid, integer) from public, anon, authenticated;

-- Pays what's owed from `points`; the group arrives when it's paid in full. Gives back the row as it is after.
create function private.pay_owed(row_now public.travel_groups, points integer) returns public.travel_groups
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
  perform private.group_goes_to(row_now.campaign_id, row_now.group_number, row_now.pending_place_name);
  return paid_row;
end;
$$;
revoke execute on function private.pay_owed(public.travel_groups, integer) from public, anon, authenticated;

-- The morning (travel.dayStart): today's budget for the group; yesterday's shortfall is paid first (the group arrives
-- when it's paid in full). The GM. A call for a day the row already has (or an earlier one) changes nothing: two
-- GM devices start the same day once. The log keeps yesterday's total and spent on the line (unused points lost).
create function public.start_travel_day(campaign uuid, group_no integer, day integer, total integer, pace text default 'foot', gm_per_day integer default null)
returns public.travel_groups
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('travel_groups');
  done uuid[] := private.request_targets('travel_groups');
  row_now public.travel_groups;
  trip uuid;
begin
  if made is not null then
    select * into row_now from public.travel_groups t where t.id = made;
    return row_now;
  end if;
  if cardinality(done) > 0 then
    select * into row_now from public.travel_groups t where t.id = done[1];
    return row_now;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if day is null or day < 0 or total is null or total < 0 or pace not in ('foot', 'riding', 'cart') then
    raise exception 'A day, a budget and a pace are needed.';
  end if;
  select x.id into trip from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone;
  if trip is null then
    raise exception 'Start an expedition first.';
  end if;
  if not exists (select 1 from public.party_groups g where g.campaign_id = campaign and g.number = group_no) then
    raise exception 'That group isn''t there any more.';
  end if;
  select t.* into row_now from public.travel_groups t where t.expedition_id = trip and t.group_number = group_no and not t.undone for update;
  if row_now.id is null then
    insert into public.travel_groups (campaign_id, expedition_id, group_number, day, total, pace, gm_per_day)
    values (campaign, trip, group_no, day, total, pace, gm_per_day) returning * into row_now;
    return row_now;
  end if;
  if row_now.day >= day then
    return row_now;
  end if;
  update public.travel_groups t set day = start_travel_day.day, total = start_travel_day.total, pace = start_travel_day.pace, gm_per_day = start_travel_day.gm_per_day, spent = 0, forced = 0
  where t.id = row_now.id returning * into row_now;
  return private.pay_owed(row_now, total);
end;
$$;

-- Move… (travel.move): the cost comes off what's left; the rest is owed and the group is entering the place (the
-- terrain, the route, the name or the existing place). A move while another is owed replaces it. On arrival the
-- group's place moves on. The GM; refused from an old copy.
create function public.travel_move(campaign uuid, group_no integer, cost integer, terrain_id text default null, route_id text default null,
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
  perform private.group_goes_to(campaign, group_no, name_now);
  return row_now;
end;
$$;

-- The budget card's number (travel.setBudget): today's total as the device works it out again (the pace changed, the
-- GM set a number, the weather was entered). What's spent stays spent. The GM.
create function public.set_travel_budget(campaign uuid, group_no integer, total integer, pace text default 'foot', gm_per_day integer default null, seen_version integer default null)
returns public.travel_groups
language plpgsql security invoker set search_path = '' as $$
declare
  done uuid[] := private.request_targets('travel_groups');
  row_now public.travel_groups;
begin
  if cardinality(done) > 0 then
    select * into row_now from public.travel_groups t where t.id = done[1];
    return row_now;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if total is null or total < 0 or pace not in ('foot', 'riding', 'cart') then
    raise exception 'A budget and a pace are needed.';
  end if;
  row_now := private.travel_row(campaign, group_no);
  update public.travel_groups t
  set total = set_travel_budget.total, pace = set_travel_budget.pace, gm_per_day = set_travel_budget.gm_per_day, version = coalesce(seen_version, t.version)
  where t.id = row_now.id returning * into row_now;
  return row_now;
end;
$$;

-- Force march (travel.forceMarch, D4): the players' choice, applied at once. `added` is what the pack gives (the
-- device works it out: factor or add, stacked as the pack says; 0 when it stacks once and today has one). It pays
-- what's owed first (the group may arrive now), and calls the group's rest for that evening: the shared rest flow
-- opens for the group (g6), applied by the GM's Next day. Any member of the group, or the GM. Runs as the database:
-- a player can't write the row or the others' rest rows themselves.
create function public.force_march(campaign uuid, group_no integer, added integer, seen_version integer default null)
returns public.travel_groups
language plpgsql security definer set search_path = '' as $$
declare
  done uuid[] := private.request_targets('travel_groups');
  row_now public.travel_groups;
  now_at bigint;
begin
  if cardinality(done) > 0 then
    select * into row_now from public.travel_groups t where t.id = done[1];
    return row_now;
  end if;
  if not (private.is_gm(campaign) or private.in_my_group(campaign, group_no)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if added is null or added < 0 or added > 100000 then
    raise exception 'A whole number of points, 0 or more, is needed.';
  end if;
  row_now := private.travel_row(campaign, group_no);
  update public.travel_groups t
  set total = t.total + added, forced = t.forced + 1, version = coalesce(seen_version, t.version)
  where t.id = row_now.id returning * into row_now;
  row_now := private.pay_owed(row_now, added);
  -- Rest due that evening: the group's flow opens now (a called rest, g6); Next day applies the answers.
  now_at := private.clock_now(campaign);
  perform set_config('grimoire.rest_call', 'on', true);
  update public.character_rests r
  set called_at = now_at
  where r.campaign_id = campaign and r.actor_id in (
    select a.id from public.actors a
    left join public.party_group_members m on m.actor_id = a.id
    where a.campaign_id = campaign and a.kind in ('pc', 'hireling') and a.approval = 'approved' and a.status = 'active'
      and coalesce(m.group_number, 1) = group_no
  ) and (r.called_at is null or r.called_at < now_at);
  perform set_config('grimoire.rest_call', '', true);
  return row_now;
end;
$$;

-- Spend the day looking (travel.spendDay, D8): what's left today is used up. The GM.
create function public.spend_travel_day(campaign uuid, group_no integer, seen_version integer default null)
returns public.travel_groups
language plpgsql security invoker set search_path = '' as $$
declare
  done uuid[] := private.request_targets('travel_groups');
  row_now public.travel_groups;
begin
  if cardinality(done) > 0 then
    select * into row_now from public.travel_groups t where t.id = done[1];
    return row_now;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  row_now := private.travel_row(campaign, group_no);
  update public.travel_groups t set spent = greatest(t.spent, t.total), version = coalesce(seen_version, t.version)
  where t.id = row_now.id returning * into row_now;
  return row_now;
end;
$$;

-- Lost (travel.lost.set, D7): the group is lost from today (the lost check's hit, or by hand). The GM. A group already
-- lost gives back its row; a repeat changes nothing.
create function public.set_lost(campaign uuid, group_no integer, day integer, note text default '')
returns public.group_lost
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('group_lost');
  row_now public.group_lost;
  trip uuid;
begin
  if made is not null then
    select * into row_now from public.group_lost l where l.id = made;
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
  select * into row_now from public.group_lost l where l.expedition_id = trip and l.group_number = group_no and l.found_day is null and not l.undone;
  if row_now.id is not null then
    return row_now;
  end if;
  insert into public.group_lost (campaign_id, expedition_id, group_number, since_day, note)
  values (campaign, trip, group_no, greatest(coalesce(day, 0), 0), coalesce(note, '')) returning * into row_now;
  return row_now;
end;
$$;

-- The recovery roll (travel.lost.roll): the GM, or a member of the group while Getting lost is Open (S4-6). Runs as
-- the database so a player's entry lands on the GM's row; refused while Secret.
create function public.enter_lost_roll(lost uuid, roll text, seen_version integer default null)
returns public.group_lost
language plpgsql security definer set search_path = '' as $$
declare
  done uuid[] := private.request_targets('group_lost');
  row_now public.group_lost;
  roll_now text := nullif(trim(coalesce(roll, '')), '');
begin
  if cardinality(done) > 0 then
    select * into row_now from public.group_lost l where l.id = done[1];
    return row_now;
  end if;
  select * into row_now from public.group_lost l where l.id = lost for update;
  if row_now.id is null
    or not (private.is_gm(row_now.campaign_id) or (private.getting_lost_open(row_now.campaign_id) and private.in_my_group(row_now.campaign_id, row_now.group_number))) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if row_now.found_day is not null or row_now.undone then
    raise exception 'The group already found the way.';
  end if;
  if roll_now is null or length(roll_now) > 20 then
    raise exception 'What did the dice show?';
  end if;
  update public.group_lost l set roll = roll_now, roll_by = (select auth.uid()), version = coalesce(seen_version, l.version)
  where l.id = lost returning * into row_now;
  return row_now;
end;
$$;

-- Found the way / Still lost (travel.lost.resolve, S2-5): the GM's taps. Found ends it today; Still lost counts the
-- morning and clears the roll for the next.
create function public.resolve_lost(lost uuid, outcome text, day integer, seen_version integer default null)
returns public.group_lost
language plpgsql security invoker set search_path = '' as $$
declare
  done uuid[] := private.request_targets('group_lost');
  row_now public.group_lost;
begin
  if cardinality(done) > 0 then
    select * into row_now from public.group_lost l where l.id = done[1];
    return row_now;
  end if;
  select * into row_now from public.group_lost l where l.id = lost for update;
  if row_now.id is null or not private.is_gm(row_now.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if row_now.found_day is not null or row_now.undone then
    raise exception 'The group already found the way.';
  end if;
  if outcome = 'found' then
    update public.group_lost l set found_day = greatest(coalesce(day, l.since_day), l.since_day), version = coalesce(seen_version, l.version)
    where l.id = lost returning * into row_now;
  elsif outcome = 'still' then
    update public.group_lost l set attempts = l.attempts + 1, roll = null, roll_by = null, version = coalesce(seen_version, l.version)
    where l.id = lost returning * into row_now;
  else
    raise exception 'Found the way, or still lost?';
  end if;
  return row_now;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.start_travel_day(uuid, integer, integer, integer, text, integer)',
    'public.travel_move(uuid, integer, integer, text, text, text, uuid, integer)',
    'public.set_travel_budget(uuid, integer, integer, text, integer, integer)',
    'public.force_march(uuid, integer, integer, integer)',
    'public.spend_travel_day(uuid, integer, integer)',
    'public.set_lost(uuid, integer, integer, text)',
    'public.enter_lost_roll(uuid, text, integer)',
    'public.resolve_lost(uuid, text, integer, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 5. Undo and the logged commands -----------------------------------------------------------------------------------

insert into public.undoable_tables (name) values ('travel_groups'), ('group_lost');
insert into public.undoable_makings (name) values ('travel.dayStart'), ('travel.move'), ('travel.forceMarch'), ('travel.lost.set');

insert into public.logged_commands (name, level, gm_only) values
  ('travel.dayStart', 'simple', true),
  ('travel.move', 'simple', true),
  ('travel.setBudget', 'verbose', true),
  ('travel.forceMarch', 'simple', false),
  ('travel.spendDay', 'simple', true),
  ('travel.lost.set', 'simple', true),
  ('travel.lost.roll', 'verbose', false),
  ('travel.lost.resolve', 'simple', true);
