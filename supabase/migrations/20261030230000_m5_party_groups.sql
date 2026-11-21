-- M5 step 8 (part 3): party groups and the marching order per group (ruled 2026-10-30, DG14 and DG8; docs/04
-- "PartyGroup"; docs/05 "Splitting the party"), a Delete for saved orders, and lanterns that keep their fuel.
--   1. party_groups: a campaign's groups, numbered. Group 1 is the party, made with the campaign (and now for the
--      campaigns there are); more are made when someone splits off ("A new group"). Groups are never removed: a
--      group nobody is in is simply not shown, and the next split uses it again. Members read them.
--   2. party_group_members: which group each character and hireling is in (one row each, made with the character,
--      in group 1, or a new hireling in its player's group). Changed only through the functions below, logged
--      (Simple; everyone sees the lines) and undoable:
--        choose_party_group: a character goes to a group, or to a new one (its owner, or the GM: may_play). A
--          character's hirelings in the same group follow it. With only one group left, everyone is the party
--          (group 1) again, so the app looks as it did before any split.
--        join_party_groups: Join up, one group joins another (the GM; or any player while the two groups are in the
--          same place: places per group come in a later step, so for now any member may).
--   3. marching_orders: one per group now (group_number; group 1's is the campaign's order as before). Each group
--      has its own rows; the saved orders and the GM's lock stay the campaign's, kept on group 1's row. A group's
--      rows may hold only its own characters. set_marching_order, use_marching_preset, save_marching_preset and
--      lock_marching_order take the group (party_group, default 1); delete_marching_preset (new) removes a saved
--      order (Verbose, undoable).
--   4. Lights: a holder (a lantern) put out or swapped for another light keeps the fuel left in it
--      (inventory_lines.fuel_left_seconds), and burns on from there when lit again, even if another light was lit in
--      between; a refill fills it again. A consumable (a torch) still drops its leftover time when another light is
--      lit (ruled 2026-10-30).
-- Replaces private.make_marching_order, private.marching_rules and private.marching_of (newest copies in
-- 20261030201000_m5_marching.sql), public.light_light, public.refill_light and public.refill_and_light (newest copies
-- in 20261030200000_m5_light_refill_sticks.sql). Drops and remakes the four marching functions with one more
-- argument (functions only), and marching_orders' one-per-campaign unique constraint (replaced by one per group).
-- Adds two tables, columns and functions. No rows are removed; every existing marching order becomes group 1's.

-- 1. Groups ----------------------------------------------------------------------------------------------------------

create table public.party_groups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- 1 is the party; a split adds 2, 3, …
  number integer not null check (number between 1 and 50),
  created_at timestamptz not null default now(),
  unique (campaign_id, number)
);

alter table public.party_groups enable row level security;
grant select on public.party_groups to authenticated;
grant select, insert, update, delete on public.party_groups to service_role;
create policy "party groups: members read" on public.party_groups
  for select to authenticated using (private.is_member(campaign_id));
-- Every campaign's party (before the retired-campaign rule, which would refuse it for a retired one).
insert into public.party_groups (campaign_id, number) select c.id, 1 from public.campaigns c on conflict do nothing;
create trigger refuse_when_retired before insert or update or delete on public.party_groups
  for each row execute function private.refuse_when_retired();

-- 2. Who is in which group ------------------------------------------------------------------------------------------

create table public.party_group_members (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null unique references public.actors (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  group_number integer not null default 1,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, group_number) references public.party_groups (campaign_id, number) on delete cascade
);
create index party_group_members_campaign on public.party_group_members (campaign_id, group_number);

alter table public.party_group_members enable row level security;
grant select, update on public.party_group_members to authenticated;
grant select, insert, update, delete on public.party_group_members to service_role;
-- Members read who is where (the table hears a split); changes go through the functions below (and Undo).
create policy "party group members: members read" on public.party_group_members
  for select to authenticated using (private.is_member(campaign_id));
create policy "party group members: through the functions and Undo" on public.party_group_members
  for update to authenticated using (private.is_member(campaign_id)) with check (private.is_member(campaign_id));

-- Whatever a device sends: whose row it is never changes, and only the functions (or an Undo) move anyone.
create function private.party_member_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.campaign_id is distinct from old.campaign_id then
    raise exception 'That can''t be changed.';
  end if;
  if nullif(current_setting('grimoire.reverting', true), '') is null
    and nullif(current_setting('grimoire.regrouping', true), '') is null then
    raise exception 'Choose a group with Split the party.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.party_member_rules() from public, anon, authenticated;

-- The group a new character starts in: a hireling goes with its player's characters (their group when they're all in
-- one), anyone else with the party.
create function private.starting_group(campaign uuid, owner uuid, kind text) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select min(m.group_number) from public.party_group_members m
    join public.actors a on a.id = m.actor_id
    where kind = 'hireling' and owner is not null and m.campaign_id = campaign and a.kind = 'pc'
      and a.owner_type = 'user' and a.owner_user_id = owner and a.status = 'active'
    having count(distinct m.group_number) = 1
  ), 1);
$$;
revoke execute on function private.starting_group(uuid, uuid, text) from public, anon, authenticated;

create function private.make_group_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('pc', 'hireling') then
    insert into public.party_groups (campaign_id, number) values (new.campaign_id, 1) on conflict do nothing;
    insert into public.party_group_members (actor_id, campaign_id, group_number)
    values (new.id, new.campaign_id, private.starting_group(new.campaign_id, case when new.owner_type = 'user' then new.owner_user_id end, new.kind))
    on conflict (actor_id) do nothing;
  end if;
  return null;
end;
$$;
revoke execute on function private.make_group_member() from public, anon, authenticated;
create trigger make_group_member after insert on public.actors
  for each row execute function private.make_group_member();
insert into public.party_group_members (actor_id, campaign_id)
  select a.id, a.campaign_id from public.actors a where a.kind in ('pc', 'hireling')
  on conflict (actor_id) do nothing;

create trigger check_copy_version before insert or update on public.party_group_members
  for each row execute function private.check_copy_version();
create trigger party_member_rules before update on public.party_group_members
  for each row execute function private.party_member_rules();
create trigger refuse_when_retired before insert or update or delete on public.party_group_members
  for each row execute function private.refuse_when_retired();
create trigger log_change after update on public.party_group_members
  for each row execute function private.log_change();

-- Everyone in the campaign sees the groups' lines.
create function private.log_audience_party_group_members(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
revoke execute on function private.log_audience_party_group_members(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('party_group_members');

-- With one group left (everyone who plays is in it), it's the party again: group 1.
create function private.tidy_party_groups(campaign uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  in_play integer;
begin
  select count(distinct m.group_number) into in_play
  from public.party_group_members m join public.actors a on a.id = m.actor_id
  where m.campaign_id = campaign and a.approval = 'approved' and a.status = 'active';
  if in_play <= 1 then
    update public.party_group_members m set group_number = 1 where m.campaign_id = campaign and m.group_number <> 1;
  end if;
end;
$$;
revoke execute on function private.tidy_party_groups(uuid) from public, anon, authenticated;

-- Whether two groups are in the same place (players may Join up then). Places per group come in a later step
-- (DG14); until then the app can't tell them apart, so they count as together.
create function private.groups_together(campaign uuid, one integer, other integer) returns boolean
language sql stable security definer set search_path = '' as $$ select true; $$;
revoke execute on function private.groups_together(uuid, integer, integer) from public, anon, authenticated;

-- Split the party: the character goes to that group (by number), or with no number to a new one (an empty group is
-- used again before a new one is made). Its owner or the GM. Hirelings of the same player in the same group follow a
-- character. A repeat changes nothing.
create function public.choose_party_group(actor uuid, to_group integer default null) returns public.party_group_members
language plpgsql security definer set search_path = '' as $$
declare
  who public.actors;
  found public.party_group_members;
  target integer := to_group;
  alone boolean;
begin
  select * into who from public.actors a where a.id = actor;
  if who.id is null or who.kind not in ('pc', 'hireling') or not private.may_play(who.campaign_id, who.id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select * into found from public.party_group_members m where m.actor_id = actor;
  if found.id is null then
    insert into public.party_groups (campaign_id, number) values (who.campaign_id, 1) on conflict do nothing;
    insert into public.party_group_members (actor_id, campaign_id) values (who.id, who.campaign_id) returning * into found;
  end if;
  if private.repeated_request('party_group_members', found.id) then
    return found;
  end if;
  if target is null then
    select not exists (
      select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
      where m.campaign_id = who.campaign_id and m.group_number = found.group_number and m.actor_id <> who.id
        and a.approval = 'approved' and a.status = 'active'
    ) into alone;
    if alone and found.group_number <> 1 then
      raise exception 'They''re in a group of their own already.';
    end if;
    select min(g.number) into target from public.party_groups g
    where g.campaign_id = who.campaign_id and g.number > 1
      and not exists (select 1 from public.party_group_members m where m.campaign_id = g.campaign_id and m.group_number = g.number);
    if target is null then
      select max(g.number) + 1 into target from public.party_groups g where g.campaign_id = who.campaign_id;
      if target > 50 then
        raise exception 'That''s as many groups as there can be.';
      end if;
      insert into public.party_groups (campaign_id, number) values (who.campaign_id, target);
    end if;
  elsif not exists (select 1 from public.party_groups g where g.campaign_id = who.campaign_id and g.number = target) then
    raise exception 'That group isn''t there any more.';
  end if;
  if target = found.group_number then
    return found;
  end if;
  perform set_config('grimoire.regrouping', 'on', true);
  if who.kind = 'pc' and who.owner_type = 'user' and who.owner_user_id is not null then
    update public.party_group_members m set group_number = target
    from public.actors h
    where h.id = m.actor_id and m.campaign_id = who.campaign_id and m.group_number = found.group_number
      and h.kind = 'hireling' and h.owner_type = 'user' and h.owner_user_id = who.owner_user_id;
  end if;
  update public.party_group_members m set group_number = target where m.id = found.id returning * into found;
  perform private.tidy_party_groups(who.campaign_id);
  perform set_config('grimoire.regrouping', '', true);
  select * into found from public.party_group_members m where m.id = found.id;
  return found;
end;
$$;

-- Join up: everyone in one group joins another. The GM; any player while the two groups are together. With one group
-- left, it's the party again. Joining a group nobody is in any more changes nothing (a repeat, or someone was first).
create function public.join_party_groups(campaign uuid, from_group integer, into_group integer) returns public.party_groups
language plpgsql security definer set search_path = '' as $$
declare
  found public.party_groups;
begin
  if not private.is_member(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if from_group is null or into_group is null or from_group = into_group then
    raise exception 'Which groups join up?';
  end if;
  select * into found from public.party_groups g where g.campaign_id = campaign and g.number = into_group;
  if found.id is null or not exists (select 1 from public.party_groups g where g.campaign_id = campaign and g.number = from_group) then
    raise exception 'That group isn''t there any more.';
  end if;
  if not private.is_gm(campaign) and not private.groups_together(campaign, from_group, into_group) then
    raise exception 'Only the GM joins up groups that are in different places.' using errcode = '42501';
  end if;
  perform set_config('grimoire.regrouping', 'on', true);
  update public.party_group_members m set group_number = into_group where m.campaign_id = campaign and m.group_number = from_group;
  perform private.tidy_party_groups(campaign);
  perform set_config('grimoire.regrouping', '', true);
  return found;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['public.choose_party_group(uuid, integer)', 'public.join_party_groups(uuid, integer, integer)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 3. A marching order per group -------------------------------------------------------------------------------------

alter table public.marching_orders add column group_number integer not null default 1;
alter table public.marching_orders drop constraint marching_orders_campaign_id_key;
alter table public.marching_orders add constraint marching_orders_one_per_group unique (campaign_id, group_number);
alter table public.marching_orders add constraint marching_orders_group
  foreign key (campaign_id, group_number) references public.party_groups (campaign_id, number) on delete cascade;

-- A campaign is made with its party (group 1); each group is made with its marching order.
create or replace function private.make_marching_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.party_groups (campaign_id, number) values (new.id, 1) on conflict do nothing;
  insert into public.marching_orders (campaign_id, group_number) values (new.id, 1) on conflict do nothing;
  return null;
end;
$$;

create function private.make_group_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.marching_orders (campaign_id, group_number) values (new.campaign_id, new.number) on conflict do nothing;
  return null;
end;
$$;
revoke execute on function private.make_group_order() from public, anon, authenticated;
create trigger make_group_order after insert on public.party_groups
  for each row execute function private.make_group_order();

-- Whether the GM has locked the campaign's marching order (kept on group 1's row).
create function private.marching_locked(campaign uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select m.locked from public.marching_orders m where m.campaign_id = campaign and m.group_number = 1), false);
$$;
revoke execute on function private.marching_locked(uuid) from public, anon, authenticated;

-- As in 20261030201000_m5_marching.sql, plus: the group never changes; the lock is the campaign's (group 1's); a
-- group's rows hold only its own characters (someone who moved to another group since: "That's changed since").
create or replace function private.marching_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  preset jsonb;
begin
  if new.campaign_id is distinct from old.campaign_id or new.group_number is distinct from old.group_number then
    raise exception 'That can''t be changed.';
  end if;
  if not private.is_gm(new.campaign_id) then
    if new.locked is distinct from old.locked then
      raise exception 'Only the GM locks the marching order.' using errcode = '42501';
    end if;
    if old.locked or private.marching_locked(new.campaign_id) then
      raise exception 'The GM has locked the marching order.' using errcode = '42501';
    end if;
    if (select c.settings -> 'playersReorderMarching' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then
      raise exception 'Only the GM sets the marching order in this campaign.' using errcode = '42501';
    end if;
  end if;
  -- An undo puts back what was there (a character in it may have left since); anything else is checked.
  if not reverting then
    if new.rows is distinct from old.rows then
      if not private.marching_rows_ok(new.campaign_id, new.rows) then
        raise exception 'Each row holds 1 to 3 of the party, each once.';
      end if;
      if exists (
        select 1 from jsonb_array_elements(new.rows) r(row_ids), jsonb_array_elements_text(r.row_ids) x(id)
        where not exists (
          select 1 from public.party_group_members m
          where m.actor_id::text = x.id and m.campaign_id = new.campaign_id and m.group_number = new.group_number
        )
      ) then
        raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
      end if;
    end if;
    if new.presets is distinct from old.presets then
      for preset in select p from jsonb_array_elements(new.presets) p loop
        if jsonb_typeof(preset) <> 'object' or jsonb_typeof(preset -> 'name') <> 'string'
          or length(trim(preset ->> 'name')) not between 1 and 60 or not private.marching_rows_ok(null, preset -> 'rows') then
          raise exception 'A saved order needs a name (up to 60 characters) and rows of 1 to 3.';
        end if;
      end loop;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A group's order for a change (group 1, the party's, by default), or a refusal for someone outside the campaign.
create function private.marching_of(campaign uuid, party_group integer) returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders;
begin
  select * into found from public.marching_orders m where m.campaign_id = campaign and m.group_number = coalesce(party_group, 1);
  if found.id is null then
    if exists (select 1 from public.marching_orders m where m.campaign_id = campaign) then
      raise exception 'That group isn''t there any more.';
    end if;
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;
revoke execute on function private.marching_of(uuid, integer) from public, anon;
grant execute on function private.marching_of(uuid, integer) to authenticated, service_role;

drop function public.set_marching_order(uuid, jsonb, integer);
drop function public.use_marching_preset(uuid, text, integer);
drop function public.save_marching_preset(uuid, text, integer);
drop function public.lock_marching_order(uuid, boolean, integer);

-- A move: the group's order is now these rows (front to back). Refused from an old copy; a repeat changes nothing.
create function public.set_marching_order(campaign uuid, new_rows jsonb, seen_version integer default null, party_group integer default null)
returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders := private.marching_of(campaign, party_group);
begin
  if private.repeated_request('marching_orders', found.id) then
    return found;
  end if;
  update public.marching_orders m
  set rows = coalesce(new_rows, '[]'::jsonb), last_preset = null, version = coalesce(seen_version, m.version)
  where m.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Use a saved order (the campaign's, on group 1's row): the group's order is that one, leaving out anyone who isn't
-- in the group (or the campaign) now. seen_version is the group's order's.
create function public.use_marching_preset(campaign uuid, preset_name text, seen_version integer default null, party_group integer default null)
returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders := private.marching_of(campaign, party_group);
  party public.marching_orders := private.marching_of(campaign, 1);
  preset jsonb;
  kept jsonb;
begin
  if private.repeated_request('marching_orders', found.id) then
    return found;
  end if;
  select p into preset from jsonb_array_elements(party.presets) p
  where lower(trim(p ->> 'name')) = lower(trim(coalesce(preset_name, '')))
  limit 1;
  if preset is null then
    raise exception 'That saved order isn''t there any more.';
  end if;
  select coalesce(jsonb_agg(k.ids order by k.pos), '[]'::jsonb) into kept from (
    select r.pos, jsonb_agg(x.id order by x.pos) as ids
    from jsonb_array_elements(preset -> 'rows') with ordinality r(row_ids, pos)
    cross join lateral jsonb_array_elements(r.row_ids) with ordinality x(id, pos)
    where exists (
      select 1 from public.actors a join public.party_group_members g on g.actor_id = a.id
      where a.id::text = x.id #>> '{}' and a.campaign_id = campaign and a.kind in ('pc', 'hireling')
        and g.group_number = found.group_number
    )
    group by r.pos
  ) k;
  update public.marching_orders m
  set rows = kept, last_preset = trim(preset ->> 'name'), version = coalesce(seen_version, m.version)
  where m.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Save as…: the group's order as it is now, under a name, among the campaign's saved orders (the same name, any case,
-- is replaced). At most 12. seen_version is group 1's row's (where the saved orders are kept).
create function public.save_marching_preset(campaign uuid, preset_name text, seen_version integer default null, party_group integer default null)
returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  source public.marching_orders := private.marching_of(campaign, party_group);
  found public.marching_orders := private.marching_of(campaign, 1);
  named text := trim(coalesce(preset_name, ''));
  others jsonb;
begin
  if private.repeated_request('marching_orders', found.id) then
    return found;
  end if;
  if length(named) not between 1 and 60 then
    raise exception 'Give the saved order a name (up to 60 characters).';
  end if;
  if jsonb_array_length(source.rows) = 0 then
    raise exception 'There''s no order to save yet.';
  end if;
  select coalesce(jsonb_agg(q.p order by q.pos), '[]'::jsonb) into others
  from jsonb_array_elements(found.presets) with ordinality q(p, pos)
  where lower(trim(q.p ->> 'name')) <> lower(named);
  if jsonb_array_length(others) >= 12 then
    raise exception 'There are 12 saved orders already. Delete one, or replace one by saving under its name.';
  end if;
  update public.marching_orders m
  set presets = others || jsonb_build_array(jsonb_build_object('name', named, 'rows', source.rows)),
    version = coalesce(seen_version, m.version)
  where m.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Delete a saved order (Undo puts it back). seen_version is group 1's row's.
create function public.delete_marching_preset(campaign uuid, preset_name text, seen_version integer default null)
returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders := private.marching_of(campaign, 1);
  named text := lower(trim(coalesce(preset_name, '')));
  others jsonb;
begin
  if private.repeated_request('marching_orders', found.id) then
    return found;
  end if;
  select coalesce(jsonb_agg(q.p order by q.pos), '[]'::jsonb) into others
  from jsonb_array_elements(found.presets) with ordinality q(p, pos)
  where lower(trim(q.p ->> 'name')) <> named;
  if jsonb_array_length(others) = jsonb_array_length(found.presets) then
    raise exception 'That saved order isn''t there any more.';
  end if;
  update public.marching_orders m
  set presets = others, version = coalesce(seen_version, m.version)
  where m.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Lock or unlock (the GM's fiat), for every group: kept on group 1's row. seen_version is that row's.
create function public.lock_marching_order(campaign uuid, lock_it boolean, seen_version integer default null)
returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders := private.marching_of(campaign, 1);
begin
  if lock_it is null then
    raise exception 'Lock it or not?';
  end if;
  if not private.is_gm(campaign) then
    raise exception 'Only the GM locks the marching order.' using errcode = '42501';
  end if;
  update public.marching_orders m
  set locked = lock_it, version = coalesce(seen_version, m.version)
  where m.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.set_marching_order(uuid, jsonb, integer, integer)', 'public.use_marching_preset(uuid, text, integer, integer)',
    'public.save_marching_preset(uuid, text, integer, integer)', 'public.delete_marching_preset(uuid, text, integer)',
    'public.lock_marching_order(uuid, boolean, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 4. A lantern keeps its fuel -------------------------------------------------------------------------------------

-- A holder's fuel left in it (seconds), while it isn't the light burning: kept on its item line, so lighting another
-- light in between doesn't lose it. Null: full (or not a holder).
alter table public.inventory_lines add column fuel_left_seconds bigint check (fuel_left_seconds is null or fuel_left_seconds > 0);

-- As in 20261030200000_m5_light_refill_sticks.sql, plus: the light it replaces, if a holder with fuel left, keeps
-- that fuel on its line; a holder lit again burns on from the fuel kept on its line.
create or replace function public.light_light(
  actor uuid,
  line uuid,
  light_type text,
  light_name text,
  burn_seconds bigint,
  warn_seconds bigint,
  consumed boolean,
  fuel_item text,
  seen_version integer default null
) returns public.character_lights
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_lights := private.light_of(actor);
  carried public.inventory_lines;
  burn bigint := burn_seconds;
  kept bigint;
begin
  if private.repeated_request('character_lights', found.id) then
    return found;
  end if;
  if light_type is null or length(trim(light_type)) not between 1 and 200 or light_name is null or length(trim(light_name)) not between 1 and 200 then
    raise exception 'Which light?';
  end if;
  if (burn_seconds is not null and burn_seconds < 1) or (warn_seconds is not null and warn_seconds < 0) then
    raise exception 'A light burns for a whole amount of time above 0.';
  end if;
  select * into carried from public.inventory_lines l where l.id = line;
  if carried.id is null or carried.actor_id is distinct from actor or carried.approval <> 'approved' or carried.qty < 1 then
    raise exception 'That light isn''t in their pack any more.';
  end if;
  if found.lit_at is not null and found.line_id = line then
    raise exception 'That light is already lit.';
  end if;
  if carried.needs_fuel
    or (found.lit_at is null and found.out_at is not null and found.line_id = line and found.fuel_item is not null) then
    raise exception 'It burnt out. Refill it first.';
  end if;
  if found.line_id = line and found.type_id = trim(light_type) and found.left_seconds is not null then
    burn := found.left_seconds;
  elsif carried.fuel_left_seconds is not null and nullif(trim(coalesce(fuel_item, '')), '') is not null then
    burn := carried.fuel_left_seconds;
  end if;
  -- The holder it replaces keeps the fuel left in it (a torch's leftover time is dropped).
  if found.line_id is not null and found.line_id <> line and found.fuel_item is not null and not found.consumed then
    kept := case
      when found.lit_at is not null and found.burn_seconds is not null
        then greatest(1, found.lit_at + found.burn_seconds - private.clock_now(found.campaign_id))
      else found.left_seconds end;
    if kept is not null then
      update public.inventory_lines l set fuel_left_seconds = kept
      where l.id = found.line_id and l.fuel_left_seconds is distinct from kept;
    end if;
  end if;
  if carried.fuel_left_seconds is not null then
    update public.inventory_lines l set fuel_left_seconds = null where l.id = line;
  end if;
  update public.character_lights l
  set line_id = line, type_id = trim(light_type), name = trim(light_name), lit_at = private.clock_now(l.campaign_id),
    burn_seconds = burn, full_seconds = light_light.burn_seconds, warn_seconds = light_light.warn_seconds,
    left_seconds = null, consumed = coalesce(light_light.consumed, false),
    fuel_item = nullif(trim(coalesce(light_light.fuel_item, '')), ''), out_at = null,
    keep_lit = case when l.type_id is distinct from trim(light_type) then false else l.keep_lit end,
    version = coalesce(seen_version, l.version)
  where l.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- As in 20261030200000_m5_light_refill_sticks.sql, plus: a refill fills the holder (no fuel kept on its line).
create or replace function public.refill_light(actor uuid, seen_version integer default null) returns public.character_lights
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_lights := private.light_of(actor);
  fuel uuid;
begin
  if private.repeated_request('character_lights', found.id) then
    return found;
  end if;
  if found.fuel_item is null or found.line_id is null or found.full_seconds is null then
    raise exception 'That light doesn''t take fuel.';
  end if;
  if not exists (
    select 1 from public.inventory_lines l
    where l.id = found.line_id and l.actor_id = actor and l.approval = 'approved' and l.qty >= 1
  ) then
    raise exception 'That light isn''t in their pack any more.';
  end if;
  fuel := private.fuel_line(actor, found.fuel_item);
  if fuel is null then
    raise exception 'There''s no fuel left in their pack.';
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  perform private.use_one(fuel);
  update public.inventory_lines l set needs_fuel = false, fuel_left_seconds = null
  where l.id = found.line_id and (l.needs_fuel or l.fuel_left_seconds is not null);
  update public.character_lights l
  set lit_at = private.clock_now(l.campaign_id), burn_seconds = l.full_seconds, left_seconds = null, out_at = null,
    version = coalesce(seen_version, l.version)
  where l.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- As in 20261030200000_m5_light_refill_sticks.sql, plus: the light it replaces, if a holder with fuel left, keeps
-- that fuel on its line; the refilled holder is full.
create or replace function public.refill_and_light(
  actor uuid,
  line uuid,
  light_type text,
  light_name text,
  burn_seconds bigint,
  warn_seconds bigint,
  fuel_item text,
  seen_version integer default null
) returns public.character_lights
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_lights := private.light_of(actor);
  carried public.inventory_lines;
  fuel uuid;
  kept bigint;
begin
  if private.repeated_request('character_lights', found.id) then
    return found;
  end if;
  if light_type is null or length(trim(light_type)) not between 1 and 200 or light_name is null or length(trim(light_name)) not between 1 and 200 then
    raise exception 'Which light?';
  end if;
  if burn_seconds is null or burn_seconds < 1 or (warn_seconds is not null and warn_seconds < 0)
    or fuel_item is null or length(trim(fuel_item)) not between 1 and 200 then
    raise exception 'That light doesn''t take fuel.';
  end if;
  select * into carried from public.inventory_lines l where l.id = line;
  if carried.id is null or carried.actor_id is distinct from actor or carried.approval <> 'approved' or carried.qty < 1 then
    raise exception 'That light isn''t in their pack any more.';
  end if;
  if found.lit_at is not null and found.line_id = line then
    raise exception 'That light is already lit.';
  end if;
  fuel := private.fuel_line(actor, trim(fuel_item));
  if fuel is null then
    raise exception 'There''s no fuel left in their pack.';
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  perform private.use_one(fuel);
  if found.line_id is not null and found.line_id <> line and found.fuel_item is not null and not found.consumed then
    kept := case
      when found.lit_at is not null and found.burn_seconds is not null
        then greatest(1, found.lit_at + found.burn_seconds - private.clock_now(found.campaign_id))
      else found.left_seconds end;
    if kept is not null then
      update public.inventory_lines l set fuel_left_seconds = kept
      where l.id = found.line_id and l.fuel_left_seconds is distinct from kept;
    end if;
  end if;
  update public.inventory_lines l set needs_fuel = false, fuel_left_seconds = null
  where l.id = line and (l.needs_fuel or l.fuel_left_seconds is not null);
  update public.character_lights l
  set line_id = line, type_id = trim(light_type), name = trim(light_name), lit_at = private.clock_now(l.campaign_id),
    burn_seconds = refill_and_light.burn_seconds, full_seconds = refill_and_light.burn_seconds,
    warn_seconds = refill_and_light.warn_seconds, left_seconds = null, consumed = false,
    fuel_item = trim(refill_and_light.fuel_item), out_at = null,
    keep_lit = case when l.type_id is distinct from trim(light_type) then false else l.keep_lit end,
    version = coalesce(seen_version, l.version)
  where l.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- 5. The logged commands --------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('party.chooseGroup', 'simple', false),
  ('party.joinUp', 'simple', false),
  ('marching.deletePreset', 'verbose', false);
