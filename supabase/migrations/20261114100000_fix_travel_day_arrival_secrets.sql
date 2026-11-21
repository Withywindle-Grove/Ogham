-- Fix: a group that overspent its day arrives, on Next day, at the place the GM named.
-- Two changes met on the databases without knowing each other. fm-1 (20261111100000_fm1_group_log_audience.sql, 7)
-- moved the place a group is entering, as the GM names it and by its id, into the GM's part of the travel row
-- (travel_group_secrets); travel_groups.pending_place_name keeps only the players' name for it (nothing until the place
-- has been shown to them) and pending_place_id is no longer filled. The fix for F86/F87
-- (20261112100000_fix_travel_day_with_clock.sql) made Next day start each group's travel day and pay yesterday's
-- shortfall, and on arrival sent the group to travel_groups.pending_place_name: the players' part.
-- So the next morning the group arrived at a place called by the players' name for it (a new place of that name beside
-- the real one), or somewhere unnamed when the place had not been shown; and the GM's part of the row kept the place
-- after the arrival. Nothing was shown to anyone who may not read it.
-- Now private.start_travel_days reads the place from the GM's part of the row, as private.pay_owed does (fm-1): the
-- group goes to the place itself when one was picked (private.group_goes_to_id), else to the GM's name for it
-- (private.group_goes_to), and the GM's part is cleared in the same request, so one Undo of the move puts it back with
-- the rest. Runs as the caller, as before: only the GM moves the clock, and the GM reads and keeps that part.
--
-- Replaces one function, private.start_travel_days, from its newest definition
-- (20261112100000_fix_travel_day_with_clock.sql): the same arguments, so its grants stay as they are. No reader, rule
-- or policy is changed.
-- Data: drops, renames and deletes nothing; no row is rewritten. A group that already arrived under the old function
-- stays where it is, and its GM's part of the row keeps the old place until that group's next Move… or arrival
-- overwrites or clears it.

create or replace function private.start_travel_days(campaign uuid, days jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  trip uuid;
  item jsonb;
  group_no integer;
  day_no integer;
  points integer;
  pace_now text;
  gm_points integer;
  row_now public.travel_groups;
  paid integer;
  arrived boolean;
  entering public.travel_group_secrets;
begin
  if days is null or jsonb_typeof(days) <> 'array' or jsonb_array_length(days) = 0 then
    return;
  end if;
  select x.id into trip from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone;
  if trip is null then
    return;
  end if;
  perform set_config('grimoire.event_type', 'travel.dayStart', true);
  for item in select d.value from jsonb_array_elements(days) d loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'group') is distinct from 'number'
      or jsonb_typeof(item -> 'day') is distinct from 'number' or jsonb_typeof(item -> 'total') is distinct from 'number'
      or (item ? 'gmPerDay' and jsonb_typeof(item -> 'gmPerDay') not in ('number', 'null')) then
      raise exception 'A day, a budget and a pace are needed.';
    end if;
    group_no := (item ->> 'group')::integer;
    day_no := (item ->> 'day')::integer;
    points := (item ->> 'total')::integer;
    pace_now := coalesce(item ->> 'pace', 'foot');
    gm_points := (item ->> 'gmPerDay')::integer;
    if day_no < 0 or points < 0 or pace_now not in ('foot', 'riding', 'cart') then
      raise exception 'A day, a budget and a pace are needed.';
    end if;
    select t.* into row_now from public.travel_groups t
    where t.expedition_id = trip and t.group_number = group_no and not t.undone for update;
    if row_now.id is null or row_now.day >= day_no then
      continue;
    end if;
    -- One change to the row (the new day with yesterday's shortfall already paid from its points, as private.pay_owed
    -- counts it), not a start and then a payment: Undo checks each change of a request against the row as it is now,
    -- so two changes to the same columns in one request could never be undone.
    paid := least(coalesce(row_now.pending_owed, 0), points);
    arrived := row_now.pending_owed is not null and row_now.pending_owed - paid <= 0;
    update public.travel_groups t
    set day = day_no, total = points, pace = pace_now, gm_per_day = gm_points, spent = paid, forced = 0,
        pending_owed = case when row_now.pending_owed is null or arrived then null else row_now.pending_owed - paid end,
        terrain_id = case when arrived then t.pending_terrain_id else t.terrain_id end,
        route_id = case when arrived then t.pending_route_id else t.route_id end,
        pending_place_name = case when arrived then null else t.pending_place_name end,
        pending_place_id = case when arrived then null else t.pending_place_id end,
        pending_terrain_id = case when arrived then null else t.pending_terrain_id end,
        pending_route_id = case when arrived then null else t.pending_route_id end
    where t.id = row_now.id;
    if arrived then
      -- As private.pay_owed (20261111100000_fm1_group_log_audience.sql): the place being entered is read from, and
      -- cleared in, the GM's part of the row; the players' part was cleared just above.
      select * into entering from public.travel_group_secrets s where s.id = row_now.id;
      update public.travel_group_secrets s set pending_place_name = null, pending_place_id = null where s.id = row_now.id;
      if entering.pending_place_id is not null then
        perform private.group_goes_to_id(campaign, group_no, entering.pending_place_id);
      else
        perform private.group_goes_to(campaign, group_no, entering.pending_place_name);
      end if;
    end if;
  end loop;
  perform set_config('grimoire.event_type', '', true);
end;
$$;
