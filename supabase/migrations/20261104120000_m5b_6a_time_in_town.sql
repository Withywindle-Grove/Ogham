-- M5b step 6a, time in town: End expedition, Start downtime and End downtime as their own taps
-- (docs/plans/m5b-6-settlements.md "Step 6a"; ruled 2026-11-02, dt-2, design/rulings/m7-downtime-2026-11-02.md;
-- 2026-10-30, ST10 and ST11; 05 Modes and Settlements).
--   1. End expedition no longer puts the campaign into Downtime (dt-2): it ends the expedition and leaves the campaign
--      in Adventure, with no expedition running. Everything else is as before (20261029170000_m5_clock.sql).
--   2. Start downtime (a separate tap, ST10): a full rest for every character in play (the approved, active
--      characters: the same who an expedition takes along), then the campaign goes into Downtime, in one change. The
--      town switches turn off with the move (20261104110000's trigger) and the secret check results so far reach the
--      players (20261029180000's and 20261029200000's, unchanged). Refused while an expedition is under way.
--   3. End downtime (ST11): the campaign goes back into Adventure. Nothing else (M7 adds its summary and clock ticks).
--   4. Next part of day's own log row (time.partOfDay, Simple), and the two new commands' rows, all the GM's.
-- Undo: each is one request, so Undo puts back every row it changed (the expedition; the campaign's mode and
-- switches; each character's ability uses).
-- Replaces public.end_expedition (its only definition is 20261029170000). Adds two functions and three
-- logged_commands rows. Drops no data; no rows are removed, renamed or changed by the migration itself.

-- 1. End expedition stays in Adventure ---------------------------------------------------------------------------

-- As in 20261029170000_m5_clock.sql, without the move into Downtime (dt-2: Start downtime is its own tap).
create or replace function public.end_expedition(expedition uuid, seen_version integer default null) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
declare
  found public.expeditions;
  now_at bigint;
begin
  select * into found from public.expeditions x where x.id = expedition;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That expedition was undone.';
  end if;
  if found.ended_at is not null then
    if private.repeated_request('expeditions', expedition) then
      return found;
    end if;
    raise exception 'That expedition has already ended.';
  end if;
  select greatest(c.seconds, found.started_at) into now_at from public.campaign_clocks c where c.campaign_id = found.campaign_id;
  now_at := coalesce(now_at, found.started_at);
  update public.expeditions x
  set ended_at = now_at, summary = jsonb_build_object('seconds', now_at - x.started_at), version = coalesce(seen_version, x.version)
  where x.id = expedition returning * into found;
  return found;
end;
$$;

-- 2. Start downtime ----------------------------------------------------------------------------------------------

-- `refills` as for public.full_rest ({ "<character id>": ["<ability name>", …] }: the uses that come back on a rest
-- or a day, worked out by the device from the setting rules), for any approved, active character of the campaign.
-- Gives back the campaign's mode ('downtime'). A repeat of the same request changes nothing.
create function public.start_downtime(campaign uuid, refills jsonb default '{}'::jsonb) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  current_mode text;
  who text;
  names jsonb;
  abilities text[];
begin
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select c.mode into current_mode from public.campaigns c where c.id = campaign;
  if current_mode is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if current_mode = 'downtime' then
    if private.repeated_request('campaigns', campaign) then
      return current_mode;
    end if;
    raise exception 'Downtime has already started.';
  end if;
  if exists (select 1 from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone) then
    raise exception 'End the expedition first.';
  end if;
  for who, names in
    select r.key, r.value from jsonb_each(case when jsonb_typeof(refills) = 'object' then refills else '{}'::jsonb end) r
    where r.key ~ '^[0-9a-fA-F-]{36}$' and jsonb_typeof(r.value) = 'array'
  loop
    if not exists (
      select 1 from public.actors a
      where a.id = who::uuid and a.campaign_id = campaign and a.kind = 'pc' and a.approval = 'approved' and a.status = 'active'
    ) then
      continue;
    end if;
    select coalesce(array_agg(n.value), '{}') into abilities from jsonb_array_elements_text(names) n;
    if cardinality(abilities) = 0 then
      continue;
    end if;
    update public.character_play p set uses_spent = p.uses_spent - abilities
    where p.actor_id = who::uuid and p.uses_spent ?| abilities;
  end loop;
  update public.campaigns c set mode = 'downtime' where c.id = campaign;
  return 'downtime';
end;
$$;
revoke execute on function public.start_downtime(uuid, jsonb) from public, anon;
grant execute on function public.start_downtime(uuid, jsonb) to authenticated, service_role;

-- 3. End downtime ------------------------------------------------------------------------------------------------

-- Back to Adventure, with no expedition (the GM starts one when the party sets out). A repeat changes nothing.
create function public.end_downtime(campaign uuid) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  current_mode text;
begin
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select c.mode into current_mode from public.campaigns c where c.id = campaign;
  if current_mode is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if current_mode <> 'downtime' then
    if private.repeated_request('campaigns', campaign) then
      return current_mode;
    end if;
    raise exception 'The campaign isn''t in downtime.';
  end if;
  update public.campaigns c set mode = 'adventure' where c.id = campaign;
  return 'adventure';
end;
$$;
revoke execute on function public.end_downtime(uuid) from public, anon;
grant execute on function public.end_downtime(uuid) to authenticated, service_role;

-- 4. The commands ------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('time.partOfDay', 'simple', true),
  ('downtime.start', 'simple', true),
  ('downtime.end', 'simple', true);
