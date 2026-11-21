-- Fix F86/F87 (gate walk, 2026-11-11; docs/plans/fix-f86-f87-travel-day.md): a new day's travel record starts with
-- the clock's move into that day, in the same request and the same transaction.
-- Until now the day's row (travel_groups: day, total, pace, spent, forced, what's owed) was started only by the GM's
-- travel card, in its own request, when that card saw the clock on a new day. With the GM's screen elsewhere or out of
-- date the row stayed on yesterday: a player's forced march landed on yesterday's row while camp was today's (no rest
-- fell due, F86), and players' travel cards kept yesterday's points (F87).
-- Now public.advance_clock takes `days`: each group's new-day budget as the GM's device worked it out (the travellers'
-- speeds, the pace, the weather, the GM's number), and starts those days right after the clock moves. One Undo of the
-- move takes the clock and every started day back together (the changes share the request). The travel card's own
-- start (public.start_travel_day, unchanged) stays as a fallback: a day already started is left as it is.
--
-- Replaces one function, public.advance_clock, from its newest definition (20261102330000_m5b_g6_rest_flow.sql), with
-- one more argument; the old four-argument function is dropped (a function, not data) and the grants are given again.
-- Adds private.start_travel_days. No table, row or policy is changed, removed or renamed.

-- The days a move of the clock starts: `days` is a list of { group, day, total, pace, gmPerDay }. As
-- public.start_travel_day (20261103110000_m5b_1_travel.sql) does for one group: the row moves on to the day with its
-- new budget, nothing spent and no forced march, and yesterday's shortfall is paid first (the group arrives when it's
-- paid in full). A group with no row yet (its first day) is left to the travel card, and a row already on that day
-- (or a later one) is left as it is, so a repeat starts nothing twice. Logged as travel.dayStart, in the move's request.
-- Runs as the caller: only the GM may write the rows (row-level security).
create function private.start_travel_days(campaign uuid, days jsonb) returns void
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
  arriving_at text;
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
    arriving_at := row_now.pending_place_name;
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
      perform private.group_goes_to(campaign, group_no, arriving_at);
    end if;
  end loop;
  perform set_config('grimoire.event_type', '', true);
end;
$$;
revoke execute on function private.start_travel_days(uuid, jsonb) from public, anon;
grant execute on function private.start_travel_days(uuid, jsonb) to authenticated, service_role;

-- As in 20261102330000_m5b_g6_rest_flow.sql, plus `days`: the travel days this move starts (above), after the rest
-- flow's answers are applied. Without `days` (a move inside a day, a turn-pace mode, Downtime, an escape roll's
-- time) no day is started.
drop function public.advance_clock(uuid, bigint, integer, jsonb);
create function public.advance_clock(campaign uuid, by_seconds bigint, seen_version integer default null, rest jsonb default null, days jsonb default null)
returns public.campaign_clocks
language plpgsql security invoker set search_path = '' as $$
declare
  clock public.campaign_clocks;
  from_at bigint;
begin
  if by_seconds is null or by_seconds < 1 then
    raise exception 'Move the clock on by a whole amount above 0.';
  end if;
  select c.seconds into from_at from public.campaign_clocks c where c.campaign_id = campaign;
  update public.campaign_clocks c
  set seconds = c.seconds + by_seconds, version = coalesce(seen_version, c.version)
  where c.campaign_id = campaign
  returning * into clock;
  if clock.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.burn_lights(campaign, from_at, clock.seconds);
  perform private.apply_rest_flow(campaign, from_at, rest);
  perform private.end_statuses(campaign, clock.seconds);
  perform private.start_travel_days(campaign, days);
  return clock;
end;
$$;
revoke execute on function public.advance_clock(uuid, bigint, integer, jsonb, jsonb) from public, anon;
grant execute on function public.advance_clock(uuid, bigint, integer, jsonb, jsonb) to authenticated, service_role;
