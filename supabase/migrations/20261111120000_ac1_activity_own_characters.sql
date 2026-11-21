-- ac-1 (ruled 2026-11-11, docs/design/rulings/m5b-morning-rulings-2026-11-11.md; plan docs/plans/m5b-ac-1.md; F80):
-- in an activity ONE character does, a player names only their own characters and hirelings (a hireling carries its
-- player as owner_user_id) as the one who acts and the one who finds; the GM names anyone. An activity several or the
-- whole party do stays open to the travel group, as before.
--
-- The kind is the pack's: the activity's `who` ('one', 'several', 'party'; anything else, or missing, reads 'one', as
-- src/modules/expedition/modes.ts readActivity). The database reads it from the campaign's own rules sets, never from
-- the client: the exploration of the highest rules set with a readable mode (as readExploration and weather_every pick), any of its modes.
-- An activity it can't find there reads 'one' (the strict reading).
--
-- Replaces public.apply_activity from 20261103130000_m5b_3_activities.sql (its only definition); unchanged except
-- for the check marked ac-1.

-- The `who` of an activity in a campaign's setting: 'one', 'several' or 'party'.
create function private.activity_who(campaign uuid, activity text) returns text
language sql stable security definer set search_path = '' as $$
  with chosen as (
    select s.value -> 'exploration' -> 'modes' as modes
    from jsonb_array_elements(private.campaign_rules_sets(campaign)) with ordinality s(value, n)
    where jsonb_typeof(s.value -> 'exploration' -> 'modes') = 'array'
      and exists (select 1 from jsonb_array_elements(s.value -> 'exploration' -> 'modes') m where private.mode_readable(m.value))
    order by s.n desc
    limit 1
  )
  select case when bool_and(a.value ->> 'who' in ('several', 'party')) then min(a.value ->> 'who') else 'one' end
  from chosen, jsonb_array_elements(chosen.modes) m(value), jsonb_array_elements(
    case when jsonb_typeof(m.value -> 'activities') = 'array' then m.value -> 'activities' else '[]'::jsonb end
  ) a(value)
  where a.value ->> 'id' = activity;
$$;
revoke execute on function private.activity_who(uuid, text) from public, anon, authenticated;

-- Whether an actor is the caller's own (a character or hireling their user owns).
create function private.actor_is_mine(actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.actors a where a.id = actor and a.owner_type = 'user' and a.owner_user_id = auth.uid());
$$;
revoke execute on function private.actor_is_mine(uuid) from public, anon, authenticated;

create or replace function public.apply_activity(
  campaign uuid, group_no integer, activity_id text, activity_name text, actors uuid[], finder uuid,
  rolls jsonb, outcome text, spend integer,
  yield_entry uuid default null, yield_name text default null, yield_category text default '', yield_weight integer default null,
  yield_slots integer default null, yield_stack integer default 1, yield_qty integer default 0
)
returns public.activity_runs
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('activity_runs');
  run public.activity_runs;
  trip uuid;
  row_now public.travel_groups;
  line_id uuid;
  who uuid;
begin
  if made is not null then
    select * into run from public.activity_runs r where r.id = made;
    return run;
  end if;
  if not (private.is_gm(campaign) or private.in_my_group(campaign, group_no)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  trip := private.expedition_under_way(campaign);
  if trip is null then
    raise exception 'Start an expedition first.';
  end if;
  if actors is null or cardinality(actors) = 0 then
    raise exception 'Pick who''s acting.';
  end if;
  foreach who in array actors loop
    if not private.actor_in_group(campaign, group_no, who) then
      raise exception 'Everyone acting must be in the group.';
    end if;
  end loop;
  -- ac-1: in an activity one character does, a player acts and finds only with their own characters and hirelings.
  if not private.is_gm(campaign) and private.activity_who(campaign, activity_id) = 'one' then
    foreach who in array actors loop
      if not private.actor_is_mine(who) then
        raise exception 'You don''t have permission to do that.' using errcode = '42501';
      end if;
    end loop;
    if finder is not null and not private.actor_is_mine(finder) then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
  end if;
  if outcome is null or outcome not in ('worked', 'failed', 'done') then
    raise exception 'Say how it went.';
  end if;
  if spend is null or spend < 0 or spend > 100000 then
    raise exception 'A whole number of points, 0 or more, is needed.';
  end if;
  if coalesce(yield_qty, 0) < 0 or coalesce(yield_qty, 0) > 100000 then
    raise exception 'How many must be a whole number, 0 or more.';
  end if;
  if coalesce(yield_qty, 0) > 0 then
    if finder is null or not (finder = any (actors)) then
      raise exception 'The finder must be one of those acting.';
    end if;
    if yield_entry is null or yield_name is null or length(trim(yield_name)) = 0 then
      raise exception 'That item isn''t in the setting rules.';
    end if;
    line_id := gen_random_uuid();
  end if;
  if spend > 0 then
    row_now := private.travel_row(campaign, group_no);
  end if;

  insert into public.activity_runs (
    campaign_id, expedition_id, group_number, travel_group_id, day, activity_id, activity_name, actor_ids, rolls, outcome,
    spent, finder_id, yield_line_id, yield_name, yield_qty
  ) values (
    campaign, trip, group_no, row_now.id, row_now.day, left(trim(activity_id), 200), left(trim(activity_name), 200), actors,
    coalesce(rolls, '[]'::jsonb), outcome, spend, case when line_id is null then null else finder end, line_id,
    case when line_id is null then null else left(trim(yield_name), 200) end, case when line_id is null then 0 else yield_qty end
  ) returning * into run;

  if spend > 0 then
    update public.travel_groups t set spent = least(100000, t.spent + spend) where t.id = row_now.id;
  end if;
  if line_id is not null then
    insert into public.inventory_lines (id, campaign_id, actor_id, library_entry_id, name, category, weight_coin, slots, stack, item_data, qty, how_got)
    values (line_id, campaign, finder, yield_entry, left(trim(yield_name), 200), coalesce(yield_category, ''), yield_weight, yield_slots,
      greatest(1, coalesce(yield_stack, 1)), '{}'::jsonb, yield_qty, 'found');
  end if;
  return run;
end;
$$;
