-- M5b step 4, part 1: camp (docs/plans/m5b-4-camp.md, build orders 1–4; ruled 2026-10-30, D5, D13–D17; docs/05
-- "Exploration modes", Camp). A group makes camp for the evening; its players work through the pack's camp steps on
-- their own screens and the GM sees all of it. Nothing here applies the camp: Next day does that (part 2).
--   1. camps: one row per group per evening of the expedition (the day it's made on, 0 the first). It names the
--      campfire's light type (07 `camp.fire`) and whether it was a quick camp (07 `camp.quick`, one tap). The GM reads
--      all; a player reads their own group's camp (private.in_my_group) and nothing of another group's.
--   2. camp_entries: what was done in the camp, one row each, never changed but for being undone:
--        fuel  firewood from a pack for the campfire (D16): `qty` bundles, `seconds` of burning they add, `at` the
--              clock when they went on (a fire that was out starts again from there: the light engine, light.ts);
--        cook  the cook's portions (D15): `qty` portions in the camp's pot, the ingredients used in `detail`;
--        talk  campfire talk (D17): `outcome` worked or failed (the sleep check reads it, part 2);
--        meal  a character ate (D14): from the pot (a portion) or from their own pack (`line_id`, `food_name`,
--              `food_kind`); one meal each per camp.
--      Read as the camp is; the log lines are everyone's (camp is done at the table, as activities are).
--   3. What the app calls, each an intent with a request id (a repeat changes nothing): open_camp (the GM, or a
--      player of the group), add_camp_fuel, cook_at_camp, camp_talk and eat_at_camp (the GM for anyone; a player for
--      their own characters, from their own pack). Firewood and ingredients are used up (taken off the line, the
--      line goes with the last: items leaving play, hard rule 4's third exception, the log keeps a copy).
--   4. Undo is the log's own (undoable_tables, undoable_makings, undoable_deletions): a made row is marked undone and
--      a used-up line comes back. Undoing a camp with steps done, or a cooking whose portions were eaten, is refused.
-- Adds two tables with their rules, triggers and policies, five functions and rows in logged_commands,
-- undoable_tables, undoable_makings and undoable_deletions. Replaces nothing; drops nothing; no rows are removed,
-- renamed or changed.

-- 1. The camp ----------------------------------------------------------------------------------------------------------

create table public.camps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid not null references public.expeditions (id) on delete cascade,
  group_number integer not null,
  -- The expedition's day whose evening this camp is (0 its first), as the device counts it on the clock.
  day integer not null check (day between 0 and 10000000),
  quick boolean not null default false,
  -- The campfire's light type (07 camp.fire.lightTypeId) and its name, as the pack had them.
  fire_type_id text check (fire_type_id is null or length(fire_type_id) between 1 and 200),
  fire_name text check (fire_name is null or length(fire_name) between 1 and 200),
  -- The firewood item (the light type's fuelItemId): the only item add_camp_fuel takes.
  fuel_item text check (fuel_item is null or length(fuel_item) between 1 and 200),
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, group_number) references public.party_groups (campaign_id, number) on delete cascade
);
create index camps_campaign on public.camps (campaign_id);
create unique index camps_one_per_evening on public.camps (expedition_id, group_number, day) where not undone;

alter table public.camps enable row level security;
grant select, update on public.camps to authenticated;
grant select, insert, update, delete on public.camps to service_role;

create policy "camps: the GM, and players for their own group" on public.camps
  for select to authenticated using (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number));
-- Only an undo writes (the trigger below), as the person undoing.
create policy "camps: undone by the GM or the group's players" on public.camps
  for update to authenticated using (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number))
  with check (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number));

create table public.camp_entries (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  group_number integer not null,
  kind text not null check (kind in ('fuel', 'cook', 'talk', 'meal')),
  -- Whose pack the firewood came from, the cook, who led the talk, who ate.
  actor_id uuid not null references public.actors (id) on delete cascade,
  qty integer not null default 0 check (qty between 0 and 100000),
  seconds bigint not null default 0 check (seconds between 0 and 100000000000),
  -- The campaign clock when it was done.
  at bigint not null default 0,
  -- The line it was taken from (it may be gone: the log keeps it).
  line_id uuid,
  food_name text check (food_name is null or length(food_name) between 1 and 200),
  food_kind text check (food_kind is null or food_kind in ('cooked', 'fresh', 'preserved')),
  from_pot boolean not null default false,
  outcome text check (outcome is null or outcome in ('worked', 'failed')),
  detail jsonb not null default '[]'::jsonb check (jsonb_typeof(detail) = 'array'),
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'fuel' or (qty >= 1 and seconds >= 0 and line_id is not null)),
  check (kind <> 'cook' or qty >= 0),
  check (kind <> 'talk' or outcome is not null),
  check (kind <> 'meal' or (from_pot or line_id is not null))
);
create index camp_entries_camp on public.camp_entries (camp_id, created_at);
create index camp_entries_campaign on public.camp_entries (campaign_id);
create unique index camp_entries_one_meal on public.camp_entries (camp_id, actor_id) where kind = 'meal' and not undone;

alter table public.camp_entries enable row level security;
grant select, update on public.camp_entries to authenticated;
grant select, insert, update, delete on public.camp_entries to service_role;

create policy "camp entries: the GM, and players for their own group" on public.camp_entries
  for select to authenticated using (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number));
create policy "camp entries: undone by the GM or the group's players" on public.camp_entries
  for update to authenticated using (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number))
  with check (private.is_gm(campaign_id) or private.in_my_group(campaign_id, group_number));

-- The functions below write with this set; anything else only marks a row undone, and only as an undo.
create function private.camp_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  writing boolean := current_setting('grimoire.camp_write', true) = 'on';
begin
  if tg_op = 'INSERT' then
    if not writing then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if not reverting or (to_jsonb(new) - 'undone' - 'version' - 'updated_at') is distinct from (to_jsonb(old) - 'undone' - 'version' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  if tg_table_name = 'camps' and new.undone and not old.undone
    and exists (select 1 from public.camp_entries e where e.camp_id = new.id and not e.undone) then
    raise exception 'Undo the camp''s steps first.';
  end if;
  if tg_table_name = 'camp_entries' and new.undone and not old.undone and old.kind = 'cook'
    and (select coalesce(sum(e.qty), 0) from public.camp_entries e where e.camp_id = old.camp_id and e.kind = 'cook' and not e.undone and e.id <> old.id)
      < (select count(*) from public.camp_entries e where e.camp_id = old.camp_id and e.kind = 'meal' and e.from_pot and not e.undone) then
    raise exception 'Some of those portions were eaten: undo the meals first.';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.camp_rules() from public, anon, authenticated;

create trigger camp_rules before insert or update on public.camps
  for each row execute function private.camp_rules();
create trigger refuse_when_retired before insert or update or delete on public.camps
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update of undone on public.camps
  for each row execute function private.log_change();

create trigger camp_rules before insert or update on public.camp_entries
  for each row execute function private.camp_rules();
create trigger refuse_when_retired before insert or update or delete on public.camp_entries
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update of undone on public.camp_entries
  for each row execute function private.log_change();

-- The lines are everyone's: camp is done at the table.
create function private.log_audience_camps(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  who_sees := 'all';
  owner := null;
end;
$$;
revoke execute on function private.log_audience_camps(jsonb, jsonb) from public, anon, authenticated;

create function private.log_audience_camp_entries(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  who_sees := 'all';
  owner := null;
end;
$$;
revoke execute on function private.log_audience_camp_entries(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('camps'), ('camp_entries');

-- 2. Making camp and its steps -------------------------------------------------------------------------------------------

-- The camp this request may write to: open, of the expedition under way, and the caller's (the GM, or a player of the
-- group). Locked for the rest of the request.
create function private.camp_for_me(camp uuid) returns public.camps
language plpgsql security definer set search_path = '' as $$
declare
  cmp public.camps;
begin
  select * into cmp from public.camps c where c.id = camp and not c.undone for update;
  if cmp.id is null or not (private.is_gm(cmp.campaign_id) or private.in_my_group(cmp.campaign_id, cmp.group_number)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if cmp.expedition_id is distinct from private.expedition_under_way(cmp.campaign_id) then
    raise exception 'That camp is over.';
  end if;
  return cmp;
end;
$$;
revoke execute on function private.camp_for_me(uuid) from public, anon, authenticated;

-- A character the caller may act for in this camp: active in the camp's group, and the GM's or the caller's own.
create function private.camp_actor(camp public.camps, actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.may_play(camp.campaign_id, actor) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if not private.actor_in_group(camp.campaign_id, camp.group_number, actor) then
    raise exception 'Only someone in the camp can do that.';
  end if;
end;
$$;
revoke execute on function private.camp_actor(public.camps, uuid) from public, anon, authenticated;

-- Takes `qty` off a line the actor carries (approved), the line going with the last: items used up.
create function private.use_up_line(who uuid, line_ref uuid, how_many integer) returns public.inventory_lines
language plpgsql security definer set search_path = '' as $$
declare
  got public.inventory_lines;
begin
  select * into got from public.inventory_lines l where l.id = line_ref for update;
  if got.id is null or got.actor_id is distinct from who or got.approval <> 'approved' then
    raise exception 'That isn''t in their pack.';
  end if;
  if how_many is null or how_many < 1 or how_many > got.qty then
    raise exception 'How many must be a whole number from 1 to %.', got.qty;
  end if;
  if how_many = got.qty then
    delete from public.inventory_lines l where l.id = got.id;
  else
    update public.inventory_lines l set qty = l.qty - how_many where l.id = got.id;
  end if;
  return got;
end;
$$;
revoke execute on function private.use_up_line(uuid, uuid, integer) from public, anon, authenticated;

-- camp.open: the group makes camp for the evening of `day`. With one open already for that evening, it is given back
-- (two players tapping at once make one camp). `fire_*` and `fuel_item` come from the pack (the device reads them).
create function public.open_camp(campaign uuid, group_no integer, day integer, quick boolean default false,
  fire_type_id text default null, fire_name text default null, fuel_item text default null)
returns public.camps
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('camps');
  trip uuid;
  cmp public.camps;
begin
  if made is not null then
    select * into cmp from public.camps c where c.id = made;
    return cmp;
  end if;
  if not (private.is_gm(campaign) or private.in_my_group(campaign, group_no)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  trip := private.expedition_under_way(campaign);
  if trip is null then
    raise exception 'Start an expedition first.';
  end if;
  if day is null or day < 0 then
    raise exception 'Which day is it?';
  end if;
  select * into cmp from public.camps c
  where c.expedition_id = trip and c.group_number = group_no and c.day = open_camp.day and not c.undone;
  if cmp.id is not null then
    return cmp;
  end if;
  perform set_config('grimoire.camp_write', 'on', true);
  insert into public.camps (campaign_id, expedition_id, group_number, day, quick, fire_type_id, fire_name, fuel_item)
  values (campaign, trip, group_no, day, coalesce(quick, false), nullif(left(trim(fire_type_id), 200), ''),
    nullif(left(trim(fire_name), 200), ''), nullif(left(trim(fuel_item), 200), ''))
  returning * into cmp;
  perform set_config('grimoire.camp_write', '', true);
  return cmp;
end;
$$;
revoke execute on function public.open_camp(uuid, integer, integer, boolean, text, text, text) from public, anon;
grant execute on function public.open_camp(uuid, integer, integer, boolean, text, text, text) to authenticated, service_role;

-- camp.fuel: firewood from a character's pack onto the campfire (D16): `qty` bundles of the camp's fuel item, each
-- burning `seconds_each` (the light type's duration, worked out by the device). Lights the fire when it's out.
create function public.add_camp_fuel(camp uuid, actor uuid, line uuid, qty integer, seconds_each bigint)
returns public.camp_entries
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('camp_entries');
  cmp public.camps;
  wood public.inventory_lines;
  entry public.camp_entries;
begin
  if made is not null then
    select * into entry from public.camp_entries e where e.id = made;
    return entry;
  end if;
  cmp := private.camp_for_me(camp);
  perform private.camp_actor(cmp, actor);
  if cmp.fuel_item is null then
    raise exception 'This camp has no campfire.';
  end if;
  if seconds_each is null or seconds_each < 0 or seconds_each > 100000000 then
    raise exception 'How long a bundle burns must be a whole number of seconds.';
  end if;
  select * into wood from public.inventory_lines l where l.id = line;
  if wood.id is null or wood.source_entry_id is distinct from cmp.fuel_item then
    raise exception 'That isn''t firewood.';
  end if;
  wood := private.use_up_line(actor, line, qty);
  perform set_config('grimoire.camp_write', 'on', true);
  insert into public.camp_entries (camp_id, campaign_id, group_number, kind, actor_id, qty, seconds, at, line_id, food_name)
  values (cmp.id, cmp.campaign_id, cmp.group_number, 'fuel', actor, qty, qty * seconds_each, private.clock_now(cmp.campaign_id),
    wood.id, left(wood.name, 200))
  returning * into entry;
  perform set_config('grimoire.camp_write', '', true);
  return entry;
end;
$$;
revoke execute on function public.add_camp_fuel(uuid, uuid, uuid, integer, bigint) from public, anon;
grant execute on function public.add_camp_fuel(uuid, uuid, uuid, integer, bigint) to authenticated, service_role;

-- camp.cook: the cook's ingredients ([{line, qty}], each from the cook's own pack) become `portions` in the camp's pot
-- (D15; the device works the number out from the pack's cooking rule, or the roll as entered).
create function public.cook_at_camp(camp uuid, cook uuid, ingredients jsonb, portions integer)
returns public.camp_entries
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('camp_entries');
  cmp public.camps;
  used public.inventory_lines;
  item jsonb;
  said jsonb := '[]'::jsonb;
  entry public.camp_entries;
begin
  if made is not null then
    select * into entry from public.camp_entries e where e.id = made;
    return entry;
  end if;
  cmp := private.camp_for_me(camp);
  perform private.camp_actor(cmp, cook);
  if portions is null or portions < 0 or portions > 1000 then
    raise exception 'How many portions must be a whole number, 0 or more.';
  end if;
  if ingredients is null or jsonb_typeof(ingredients) <> 'array' or jsonb_array_length(ingredients) = 0 then
    raise exception 'Pick what to cook.';
  end if;
  for item in select * from jsonb_array_elements(ingredients) loop
    used := private.use_up_line(cook, (item ->> 'line')::uuid, (item ->> 'qty')::integer);
    said := said || jsonb_build_object('line', used.id, 'name', used.name, 'qty', (item ->> 'qty')::integer);
  end loop;
  perform set_config('grimoire.camp_write', 'on', true);
  insert into public.camp_entries (camp_id, campaign_id, group_number, kind, actor_id, qty, at, detail)
  values (cmp.id, cmp.campaign_id, cmp.group_number, 'cook', cook, portions, private.clock_now(cmp.campaign_id), said)
  returning * into entry;
  perform set_config('grimoire.camp_write', '', true);
  return entry;
end;
$$;
revoke execute on function public.cook_at_camp(uuid, uuid, jsonb, integer) from public, anon;
grant execute on function public.cook_at_camp(uuid, uuid, jsonb, integer) to authenticated, service_role;

-- camp.talk: campfire talk (D17), led by a character of the group; it worked or it didn't.
create function public.camp_talk(camp uuid, actor uuid, outcome text)
returns public.camp_entries
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('camp_entries');
  cmp public.camps;
  entry public.camp_entries;
begin
  if made is not null then
    select * into entry from public.camp_entries e where e.id = made;
    return entry;
  end if;
  cmp := private.camp_for_me(camp);
  perform private.camp_actor(cmp, actor);
  if outcome is null or outcome not in ('worked', 'failed') then
    raise exception 'Say how it went.';
  end if;
  perform set_config('grimoire.camp_write', 'on', true);
  insert into public.camp_entries (camp_id, campaign_id, group_number, kind, actor_id, at, outcome)
  values (cmp.id, cmp.campaign_id, cmp.group_number, 'talk', actor, private.clock_now(cmp.campaign_id), outcome)
  returning * into entry;
  perform set_config('grimoire.camp_write', '', true);
  return entry;
end;
$$;
revoke execute on function public.camp_talk(uuid, uuid, text) from public, anon;
grant execute on function public.camp_talk(uuid, uuid, text) to authenticated, service_role;

-- camp.eat: a character eats (D14): a portion from the pot, or one of a food line in their own pack (used up). Once
-- per camp; the GM may eat for anyone (a player without a device).
create function public.eat_at_camp(camp uuid, actor uuid, from_pot boolean, line uuid default null)
returns public.camp_entries
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('camp_entries');
  cmp public.camps;
  food public.inventory_lines;
  kind_of text;
  entry public.camp_entries;
begin
  if made is not null then
    select * into entry from public.camp_entries e where e.id = made;
    return entry;
  end if;
  cmp := private.camp_for_me(camp);
  perform private.camp_actor(cmp, actor);
  if exists (select 1 from public.camp_entries e where e.camp_id = cmp.id and e.kind = 'meal' and e.actor_id = actor and not e.undone) then
    raise exception 'They have eaten already.';
  end if;
  if coalesce(from_pot, false) then
    if (select coalesce(sum(e.qty), 0) from public.camp_entries e where e.camp_id = cmp.id and e.kind = 'cook' and not e.undone)
      <= (select count(*) from public.camp_entries e where e.camp_id = cmp.id and e.kind = 'meal' and e.from_pot and not e.undone) then
      raise exception 'The pot is empty.';
    end if;
  else
    if line is null then
      raise exception 'Pick what they eat.';
    end if;
    food := private.use_up_line(actor, line, 1);
    kind_of := case when food.item_data ->> 'food' in ('cooked', 'fresh', 'preserved') then food.item_data ->> 'food' end;
  end if;
  perform set_config('grimoire.camp_write', 'on', true);
  insert into public.camp_entries (camp_id, campaign_id, group_number, kind, actor_id, qty, at, line_id, food_name, food_kind, from_pot)
  values (cmp.id, cmp.campaign_id, cmp.group_number, 'meal', actor, 1, private.clock_now(cmp.campaign_id),
    food.id, case when food.id is null then null else left(food.name, 200) end,
    case when coalesce(from_pot, false) then 'cooked' else kind_of end, coalesce(from_pot, false))
  returning * into entry;
  perform set_config('grimoire.camp_write', '', true);
  return entry;
end;
$$;
revoke execute on function public.eat_at_camp(uuid, uuid, boolean, uuid) from public, anon;
grant execute on function public.eat_at_camp(uuid, uuid, boolean, uuid) to authenticated, service_role;

-- 3. The log and undo ----------------------------------------------------------------------------------------------------

insert into public.undoable_makings (name) values ('camp.open'), ('camp.fuel'), ('camp.cook'), ('camp.talk'), ('camp.eat') on conflict do nothing;
-- Firewood, ingredients and food used up: the line goes with the last, and Undo puts it back (hard rule 4, items
-- leaving play: used up).
insert into public.undoable_deletions (name) values ('camp.fuel'), ('camp.cook'), ('camp.eat') on conflict do nothing;

insert into public.logged_commands (name, level, gm_only) values
  ('camp.open', 'simple', false),
  ('camp.fuel', 'simple', false),
  ('camp.cook', 'simple', false),
  ('camp.talk', 'simple', false),
  ('camp.eat', 'verbose', false);
