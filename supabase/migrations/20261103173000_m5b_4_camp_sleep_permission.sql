-- M5b step 4, part 2, fix forward (3): camp_sleep (from 20261103170000_m5b_4_camp_night.sql, its only definition)
-- refused a player's change of difficulty as a plain failure; it's a permission refusal (42501), as the app's own
-- check says. Replaces one function; changes no rows.

create or replace function public.camp_sleep(camp uuid, actor uuid, difficulty text default null, roll text default null, outcome text default null)
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
  if nullif(trim(coalesce(difficulty, '')), '') is not null and not private.is_gm(cmp.campaign_id) then
    raise exception 'Only the GM changes how hard sleep is.' using errcode = '42501';
  end if;
  if outcome is not null and outcome not in ('good', 'bad') then
    raise exception 'Say how they slept.';
  end if;
  if nullif(trim(coalesce(difficulty, '')), '') is null and outcome is null then
    raise exception 'Say how they slept.';
  end if;
  perform set_config('grimoire.camp_write', 'on', true);
  insert into public.camp_entries (camp_id, campaign_id, group_number, kind, actor_id, at, outcome, detail)
  values (cmp.id, cmp.campaign_id, cmp.group_number, 'sleep', actor, private.clock_now(cmp.campaign_id), outcome,
    jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('difficulty', nullif(left(trim(coalesce(difficulty, '')), 200), ''),
      'roll', nullif(left(trim(coalesce(roll, '')), 40), '')))))
  returning * into entry;
  perform set_config('grimoire.camp_write', '', true);
  return entry;
end;
$$;
