-- M5 review fixes (docs/plans/m5-review-fixes.md; the fresh-session review of M5, 2026-11-01): closing holes against
-- rules already ruled. No behaviour or screen changes.
--   1. A player can't move their character (or a hireling) into a group that's in another place (choose_party_group
--      with an explicit group bypassed groups_together). Replaces public.choose_party_group (newest copy:
--      20261030231000_m5_party_group_ids.sql).
--   2. A player enters only the weather that's due now: the step under way is worked out here from the clock, the
--      expedition's start and the setting's "roll every" (as src/modules/expedition/procedure.ts weatherNow reads it),
--      so made-up periods can't read the weather table row by row. A player who undid their entry for a step can't
--      enter that step again (no re-rolling by Undo); the GM can. Replaces private.weather_roll_rules (newest copy:
--      20261031090000_m5b_weather_roll.sql); adds the helpers that read the setting.
--   3. A player can't rewrite their status directly: its end, name, stacks, timer, secrecy or undone mark change only
--      through the status commands (a flag, grimoire.status_command, as party_member_rules uses grimoire.regrouping),
--      the clock (the GM's) or an undo. Replaces private.status_rules, public.add_status, public.remove_status and
--      public.step_status (newest copies: 20261031120000_m5_statuses.sql).
--   4. The GM can withdraw what the GM asked (an escape roll: waiting → withdrawn on gmAsks rows). Replaces
--      private.request_rules (newest copy: 20261101091000_m5_requests_rules.sql).
--   5. A note on a log entry the caller can't read is refused with the same words as a made-up entry, so the note
--      can't tell that the entry exists. The events reading rule and prepare_note now share one function
--      (private.event_readable), so they can't drift apart. Replaces private.prepare_note (newest copy:
--      20261029210000_m5_note_hidden_fix.sql) and the events reading rule (20261029200000_m5_check_reveal.sql).
-- Drops one access rule (replaced at once, the same rule as a function); no rows are changed or removed.

-- 1. A player's own character only joins a group in the same place -------------------------------------------------

-- As in 20261030231000_m5_party_group_ids.sql, plus: a non-GM moving into a group someone is in may only when that
-- group is in the same place as the one they leave (the GM moves anyone anywhere).
create or replace function public.choose_party_group(actor uuid, to_group integer default null) returns public.party_group_members
language plpgsql security definer set search_path = '' as $$
declare
  who public.actors;
  found public.party_group_members;
  from_group integer;
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
    insert into public.party_group_members (id, actor_id, campaign_id) values (who.id, who.id, who.campaign_id) returning * into found;
  end if;
  if private.repeated_request('party_group_members', found.id) then
    return found;
  end if;
  from_group := found.group_number;
  if target is null then
    select not exists (
      select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
      where m.campaign_id = who.campaign_id and m.group_number = from_group and m.actor_id <> who.id
        and a.approval = 'approved' and a.status = 'active'
    ) into alone;
    if alone and from_group <> 1 then
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
  if target = from_group then
    return found;
  end if;
  -- Join up only in the same place (B1): a player joins a group someone is in only while it's where they are.
  if not private.is_gm(who.campaign_id)
    and exists (
      select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
      where m.campaign_id = who.campaign_id and m.group_number = target and m.actor_id <> who.id
        and a.approval = 'approved' and a.status = 'active'
    )
    and not private.groups_together(who.campaign_id, from_group, target) then
    raise exception 'Only the GM moves someone into a group that''s in another place.' using errcode = '42501';
  end if;
  perform set_config('grimoire.regrouping', 'on', true);
  update public.party_group_members m set group_number = target where m.id = found.id;
  if who.kind = 'pc' and who.owner_type = 'user' and who.owner_user_id is not null then
    update public.party_group_members m set group_number = target
    from public.actors h
    where h.id = m.actor_id and m.campaign_id = who.campaign_id and m.group_number = from_group
      and h.kind = 'hireling' and h.owner_type = 'user' and h.owner_user_id = who.owner_user_id;
  end if;
  perform private.tidy_party_groups(who.campaign_id);
  perform set_config('grimoire.regrouping', '', true);
  select * into found from public.party_group_members m where m.id = found.id;
  return found;
end;
$$;

-- 2. Only the weather that's due now ---------------------------------------------------------------------------------

-- Two objects merged, the second winning, inside out (src/modules/library/options.ts, merge).
create function private.jsonb_deep_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(a) <> 'object' or jsonb_typeof(b) <> 'object' then
    return b;
  end if;
  return coalesce((
    select jsonb_object_agg(k.key, case
      when a ? k.key and b ? k.key then private.jsonb_deep_merge(a -> k.key, b -> k.key)
      when b ? k.key then b -> k.key
      else a -> k.key
    end)
    from (select jsonb_object_keys(a) as key union select jsonb_object_keys(b)) k
  ), '{}'::jsonb);
end;
$$;

-- A rules set with the pack's optional rules applied: each `byOption` ("option=choice") whose choice was made is
-- merged in (options.ts, applyChoices; the top level only).
create function private.rules_with_choices(data jsonb, choices jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  resolved jsonb := coalesce(data, '{}'::jsonb) - 'byOption';
  o record;
begin
  if jsonb_typeof(data -> 'byOption') = 'object' then
    for o in select e.key, e.value from jsonb_each(data -> 'byOption') e loop
      if split_part(o.key, '=', 1) <> '' and coalesce(choices, '{}'::jsonb) ->> split_part(o.key, '=', 1) = split_part(o.key, '=', 2) then
        resolved := private.jsonb_deep_merge(resolved, o.value);
      end if;
    end loop;
  end if;
  return resolved;
end;
$$;

-- The campaign's rules sets, lowest pack first (src/app/campaignSetting.ts: the top of the stack is the homebrew
-- layer, then the highest priority), each with its pack's choices applied.
create function private.campaign_rules_sets(campaign uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.rules_with_choices(x.data, x.choices) order by x.homebrew, x.priority, x.pack_id desc, x.id), '[]'::jsonb)
  from (
    select e.data || coalesce(s.data, '{}'::jsonb) as data, cp.option_choices as choices,
      (p.kind = 'homebrew') as homebrew, cp.priority, p.id as pack_id, e.id
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'rulesSet'
    left join public.library_entry_secrets s on s.id = e.id
    where cp.campaign_id = campaign
  ) x;
$$;

-- A whole number above 0 in a JSON value, else null.
create function private.whole_of(value jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'number' and (value #>> '{}') ~ '^\d{1,9}$' and (value #>> '{}')::integer > 0 then (value #>> '{}')::integer end;
$$;

-- Seconds in each unit (src/modules/expedition/clock.ts, timeUnits; play.ts, campaignUnits): the campaign's time
-- lengths, the rules set's turns per hour (which wins over the 60-minute hour) and extra lengths, the calendar's
-- days per week.
create function private.campaign_units(campaign uuid, sets jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  time_settings jsonb := coalesce((select c.settings -> 'time' from public.campaigns c where c.id = campaign), '{}'::jsonb);
  n integer := jsonb_array_length(sets);
  turn_s bigint := coalesce(private.whole_of(time_settings -> 'turnMinutes'), 10) * 60;
  hour_s bigint;
  day_s bigint;
  tph integer;
  extra jsonb;
  units jsonb;
  e jsonb;
  seconds bigint;
  i integer;
begin
  -- The top rules set that says it wins.
  for i in reverse n - 1 .. 0 loop
    if tph is null then
      tph := private.whole_of(sets -> i -> 'time' -> 'turnsPerHour');
    end if;
    if extra is null and jsonb_typeof(sets -> i -> 'time' -> 'extra') = 'array' then
      extra := sets -> i -> 'time' -> 'extra';
    end if;
  end loop;
  hour_s := coalesce(tph * turn_s, 3600);
  day_s := coalesce(private.whole_of(time_settings -> 'dayHours'), 24) * hour_s;
  units := jsonb_build_object(
    'minute', 60,
    'round', coalesce(private.whole_of(time_settings -> 'roundSeconds'), 6),
    'turn', turn_s,
    'hour', hour_s,
    'day', day_s,
    'week', day_s * coalesce((
      select private.whole_of(e.data -> 'daysPerWeek')
      from public.campaign_packs cp
      join public.packs p on p.id = cp.pack_id
      join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'calendar'
      where cp.campaign_id = campaign
      order by (p.kind = 'homebrew') desc, cp.priority desc, p.id, e.id
      limit 1
    ), 7)
  );
  for e in select x.value from jsonb_array_elements(coalesce(extra, '[]'::jsonb)) x loop
    if jsonb_typeof(e) <> 'object' or coalesce(e ->> 'id', '') = '' or units ? (e ->> 'id') then
      continue;
    end if;
    seconds := coalesce(private.whole_of(e -> 'minutes') * 60, private.whole_of(e -> 'hours') * 3600, private.whole_of(e -> 'days') * 86400);
    if seconds is not null then
      units := units || jsonb_build_object(e ->> 'id', seconds);
    end if;
  end loop;
  return units;
end;
$$;

-- An amount ({ value, unit }) in seconds (clock.ts, toSeconds and unitName: "turns" and "Turn" are "turn"); null
-- when the unit isn't known or the amount isn't whole.
create function private.amount_seconds(amount jsonb, units jsonb) returns bigint
language plpgsql immutable set search_path = '' as $$
declare
  unit text := amount ->> 'unit';
  value text := amount #>> '{value}';
  per bigint;
begin
  if jsonb_typeof(amount) <> 'object' or jsonb_typeof(amount -> 'value') <> 'number' or value !~ '^\d{1,9}$' or coalesce(unit, '') = '' then
    return null;
  end if;
  per := coalesce(
    (units ->> unit)::bigint,
    (units ->> lower(trim(unit)))::bigint,
    (units ->> regexp_replace(lower(trim(unit)), 's$', ''))::bigint);
  return value::bigint * per;
end;
$$;

-- A mode as the app reads it (modes.ts, readMode): an id and a step above 0.
create function private.mode_readable(mode jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(mode) = 'object' and coalesce(mode ->> 'id', '') <> ''
    and private.whole_of(mode -> 'step' -> 'value') is not null and coalesce(mode -> 'step' ->> 'unit', '') <> '';
$$;

-- How often the weather is rolled on an expedition in this mode, in seconds (procedure.ts, weatherNow): the mode's
-- weather block's rollEvery (else the rules set's, for day-by-day modes; a day without one), or without a weather
-- block, the mode's step when its procedure rolls the weather. Null when the weather isn't rolled: no block and no
-- weather step, or the block's optional rule is off.
create function private.weather_every(campaign uuid, mode_id text) returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare
  sets jsonb := private.campaign_rules_sets(campaign);
  n integer := jsonb_array_length(sets);
  rules jsonb := '{}'::jsonb;
  modes jsonb := '[]'::jsonb;
  mode jsonb;
  pace text;
  weather jsonb;
  spec text;
  choices jsonb;
  units jsonb;
  every bigint;
  i integer;
begin
  -- The rules set whose modes the campaign uses: the top one with modes (modes.ts, readExploration); the top set
  -- without any.
  for i in reverse n - 1 .. 0 loop
    if exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(sets -> i -> 'exploration' -> 'modes') = 'array' then sets -> i -> 'exploration' -> 'modes' else '[]'::jsonb end) m
      where private.mode_readable(m.value)
    ) then
      rules := sets -> i;
      modes := rules -> 'exploration' -> 'modes';
      exit;
    end if;
  end loop;
  if modes = '[]'::jsonb and n > 0 then
    rules := sets -> (n - 1);
  end if;
  -- The mode by id; "dungeon" is the first turn-by-turn mode and "wilderness" the first day-by-day one (modeById);
  -- else the plain fallbacks.
  select m.value into mode from jsonb_array_elements(modes) with ordinality m
  where private.mode_readable(m.value) and m.value ->> 'id' = mode_id order by m.ordinality limit 1;
  if mode is null and mode_id in ('dungeon', 'wilderness') then
    select m.value into mode from jsonb_array_elements(modes) with ordinality m
    where private.mode_readable(m.value)
      and (lower(m.value -> 'step' ->> 'unit') in ('turn', 'turns', 'round', 'rounds', 'minute', 'minutes')) = (mode_id = 'dungeon')
    order by m.ordinality limit 1;
  end if;
  if mode is null then
    mode := case when mode_id = 'wilderness'
      then '{"id": "wilderness", "step": {"value": 1, "unit": "day"}}'::jsonb
      else '{"id": "dungeon", "step": {"value": 1, "unit": "turn"}}'::jsonb end;
  end if;
  pace := case when lower(mode -> 'step' ->> 'unit') in ('turn', 'turns', 'round', 'rounds', 'minute', 'minutes') then 'turn' else 'day' end;
  weather := case
    when jsonb_typeof(mode -> 'weather') = 'object' then mode -> 'weather'
    when pace = 'day' and jsonb_typeof(rules -> 'weather') = 'object' then rules -> 'weather'
  end;
  units := private.campaign_units(campaign, sets);
  if weather is null then
    -- A weather roll step of the procedure, every step; none: no weather.
    if not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(mode -> 'procedure') = 'array' then mode -> 'procedure' else '[]'::jsonb end) s
      where s.value ->> 'kind' = 'roll' and s.value ->> 'icon' = 'weather'
    ) then
      return null;
    end if;
    every := private.amount_seconds(mode -> 'step', units);
  else
    -- Its optional rule ("option" or "option:choice"), off: the weather is skipped entirely (engine ruling 4).
    spec := nullif(trim(coalesce(weather ->> 'onlyWithOption', '')), '');
    if spec is not null then
      select coalesce(jsonb_object_agg(k.key, k.value), '{}'::jsonb) into choices
      from public.campaign_packs cp, jsonb_each(cp.option_choices) k where cp.campaign_id = campaign;
      if choices ->> split_part(spec, ':', 1) is distinct from coalesce(nullif(split_part(spec, ':', 2), ''), 'on') then
        return null;
      end if;
    end if;
    every := private.amount_seconds(
      case when private.whole_of(weather -> 'rollEvery' -> 'value') is not null or (weather -> 'rollEvery' ->> 'value') = '0'
        then weather -> 'rollEvery' else '{"value": 1, "unit": "day"}'::jsonb end,
      units);
  end if;
  return case when every > 0 then every end;
end;
$$;

-- The weather step under way on an expedition (procedure.ts, weatherNow): { every, period, startsAt } on the
-- campaign clock; null when the weather isn't rolled on it.
create function private.weather_now(campaign uuid, expedition uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  trip public.expeditions;
  every bigint;
  period bigint;
begin
  select * into trip from public.expeditions x where x.id = expedition and x.campaign_id = campaign;
  if trip.id is null then
    return null;
  end if;
  every := private.weather_every(campaign, trip.mode);
  if every is null then
    return null;
  end if;
  period := greatest(0, private.clock_now(campaign) - trip.started_at) / every;
  return jsonb_build_object('every', every, 'period', period, 'startsAt', trip.started_at + period * every);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'private.jsonb_deep_merge(jsonb, jsonb)',
    'private.rules_with_choices(jsonb, jsonb)',
    'private.campaign_rules_sets(uuid)',
    'private.whole_of(jsonb)',
    'private.campaign_units(uuid, jsonb)',
    'private.amount_seconds(jsonb, jsonb)',
    'private.mode_readable(jsonb)',
    'private.weather_every(uuid, text)',
    'private.weather_now(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- As in 20261031090000_m5b_weather_roll.sql, plus: a player enters only the step under way, worked out here (its
-- start too), and never a step whose entry they undid.
create or replace function private.weather_roll_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  as_gm boolean := private.is_gm(new.campaign_id);
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  reading jsonb;
  due jsonb;
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.expeditions x
      where x.id = new.expedition_id and x.campaign_id = new.campaign_id and x.ended_at is null and not x.undone
    ) then
      raise exception 'The weather is entered while an expedition is under way.';
    end if;
    if who is not null and not as_gm
      and (select c.settings ->> 'weatherRolledBy' from public.campaigns c where c.id = new.campaign_id) = 'gm' then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    if who is not null and not as_gm then
      due := private.weather_now(new.campaign_id, new.expedition_id);
      if due is null then
        raise exception 'The weather isn''t rolled on this expedition.';
      end if;
      if new.period is distinct from (due ->> 'period')::integer then
        raise exception 'That isn''t the weather that''s due. Enter today''s.';
      end if;
      new.starts_at := (due ->> 'startsAt')::bigint;
      if exists (
        select 1 from public.weather_rolls w
        where w.expedition_id = new.expedition_id and w.period = new.period and w.undone and w.entered_by = who
      ) then
        raise exception 'You undid the weather for this step. The GM enters it now.';
      end if;
    end if;
    new.table_id := trim(new.table_id);
    new.roll := regexp_replace(coalesce(new.roll, ''), '\s+', '', 'g');
    reading := private.weather_read(new.campaign_id, new.table_id, new.roll);
    new.result := reading ->> 'result';
    new.tags := reading -> 'tags';
    new.entered_by := who;
    new.entered_at := now();
    new.corrected_by := null;
    new.undone := false;
    return new;
  end if;
  if old.undone then
    raise exception 'That weather was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.period is distinct from old.period or new.starts_at is distinct from old.starts_at
    or new.entered_by is distinct from old.entered_by or new.entered_at is distinct from old.entered_at
    or new.created_at is distinct from old.created_at then
    raise exception 'That can''t be changed.';
  end if;
  if who is not null and not as_gm then
    -- The entrant's Undo from the toast, and only that, while the toast could still be showing.
    if not (reverting and new.undone and old.entered_by = who and old.entered_at >= now() - interval '30 seconds'
      and new.table_id is not distinct from old.table_id and new.roll is not distinct from old.roll
      and new.result is not distinct from old.result and new.tags is not distinct from old.tags
      and new.corrected_by is not distinct from old.corrected_by) then
      raise exception 'Only the GM changes the weather once it''s in.' using errcode = '42501';
    end if;
  elsif not reverting then
    if new.table_id is distinct from old.table_id or new.roll is distinct from old.roll then
      new.table_id := trim(new.table_id);
      new.roll := regexp_replace(coalesce(new.roll, ''), '\s+', '', 'g');
      reading := private.weather_read(new.campaign_id, new.table_id, new.roll);
      new.result := reading ->> 'result';
      new.tags := reading -> 'tags';
      new.corrected_by := who;
    else
      new.result := old.result;
      new.tags := old.tags;
      new.corrected_by := old.corrected_by;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 3. A status changes only through its commands ---------------------------------------------------------------------

-- As in 20261031120000_m5_statuses.sql, plus: a player's change to a status's end, name, stacks, timer, secrecy or
-- undone mark is refused unless it comes from a status command (grimoire.status_command) or an undo.
create or replace function private.status_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  as_gm boolean := private.is_gm(new.campaign_id);
  by_command boolean := nullif(current_setting('grimoire.status_command', true), '') is not null
    or nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'UPDATE' and (new.actor_id is distinct from old.actor_id or new.campaign_id is distinct from old.campaign_id) then
    raise exception 'That can''t be changed.';
  end if;
  if not as_gm and (
    (new.secret and (tg_op = 'INSERT' or not old.secret))
    or (new.source = 'rest' and (tg_op = 'INSERT' or old.source <> 'rest'))
  ) then
    raise exception 'Only the GM can do that.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and not as_gm and not by_command and (
    new.undone is distinct from old.undone or new.ended_at is distinct from old.ended_at
    or new.end_reason is distinct from old.end_reason or new.ends_at is distinct from old.ends_at
    or new.total_seconds is distinct from old.total_seconds or new.secret is distinct from old.secret
    or new.name is distinct from old.name or new.stacks is distinct from old.stacks
  ) then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- As in 20261031120000_m5_statuses.sql, plus the grimoire.status_command flag around its writes.
create or replace function public.add_status(
  campaign uuid,
  actors uuid[],
  status_name text,
  condition_id text default null,
  icon text default null,
  stacking boolean default false,
  levels jsonb default null,
  timer_seconds bigint default null,
  timer_unit text default null,
  secret boolean default false,
  note text default null,
  source text default 'typed'
) returns setof public.character_statuses
language plpgsql security invoker set search_path = '' as $$
declare
  done uuid[] := private.request_targets('character_statuses');
  who uuid;
  found public.character_statuses;
  now_at bigint := private.clock_now(campaign);
  kept_levels jsonb;
  shown_name text := trim(coalesce(status_name, ''));
  condition text := nullif(trim(coalesce(condition_id, '')), '');
  kind text := coalesce(source, 'typed');
  hidden boolean := coalesce(secret, false) and timer_seconds is not null;
  touched uuid[] := '{}';
begin
  if cardinality(done) > 0 then
    return query select s.* from public.character_statuses s where s.id = any (done);
    return;
  end if;
  if actors is null or cardinality(actors) = 0 or cardinality(actors) > 50 then
    raise exception 'Who has it?';
  end if;
  if length(shown_name) not between 1 and 80 then
    raise exception 'Give the status a name of up to 80 characters.';
  end if;
  if kind not in ('condition', 'typed', 'rest') then
    raise exception 'Where does it come from?';
  end if;
  if timer_seconds is not null and (timer_seconds < 1 or timer_seconds > 3153600000) then
    raise exception 'A timer runs for a whole amount of time above 0.';
  end if;
  if (hidden or kind = 'rest') and not private.is_gm(campaign) then
    raise exception 'Only the GM can do that.' using errcode = '42501';
  end if;
  -- The levels, as names in order (each with an id and a name).
  if levels is not null then
    if jsonb_typeof(levels) <> 'array' or jsonb_array_length(levels) not between 1 and 20 then
      raise exception 'A status has 1 to 20 levels.';
    end if;
    select jsonb_agg(jsonb_build_object('id', trim(l ->> 'id'), 'name', trim(l ->> 'name')) order by o) into kept_levels
    from jsonb_array_elements(levels) with ordinality as t(l, o);
    if exists (select 1 from jsonb_array_elements(kept_levels) l where coalesce(l ->> 'name', '') = '' or length(l ->> 'name') > 80) then
      raise exception 'Each level needs a name of up to 80 characters.';
    end if;
  end if;

  perform set_config('grimoire.status_command', 'on', true);
  foreach who in array actors loop
    if not exists (select 1 from public.actors a where a.id = who and a.campaign_id = campaign) or not private.may_play(campaign, who) then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    select * into found from public.character_statuses s
    where s.actor_id = who and s.ended_at is null and not s.undone
      and ((condition is not null and s.condition_id = condition) or (condition is null and s.condition_id is null and lower(s.name) = lower(shown_name)))
    order by s.created_at
    limit 1
    for update;
    if found.id is not null then
      if found.stacking and found.stacks < 99 then
        update public.character_statuses s set stacks = s.stacks + 1 where s.id = found.id returning * into found;
      elsif found.levels is not null and coalesce(found.level, 0) < jsonb_array_length(found.levels) - 1 then
        update public.character_statuses s set level = coalesce(s.level, 0) + 1 where s.id = found.id returning * into found;
      end if;
    else
      insert into public.character_statuses (
        campaign_id, actor_id, name, condition_id, icon, stacking, levels, level, source, note,
        started_at, ends_at, total_seconds, unit, secret
      ) values (
        campaign, who, shown_name, condition, nullif(trim(coalesce(icon, '')), ''), coalesce(stacking, false), kept_levels,
        case when kept_levels is not null then 0 end, kind, nullif(trim(coalesce(note, '')), ''),
        now_at,
        case when timer_seconds is not null and not hidden then now_at + timer_seconds end,
        case when not hidden then timer_seconds end,
        case when timer_seconds is not null and not hidden then nullif(trim(coalesce(timer_unit, '')), '') end,
        hidden
      )
      returning * into found;
      if hidden then
        insert into public.status_secrets (id, campaign_id, ends_at, total_seconds, unit)
        values (found.id, campaign, now_at + timer_seconds, timer_seconds, nullif(trim(coalesce(timer_unit, '')), ''));
      end if;
    end if;
    touched := touched || found.id;
  end loop;
  perform set_config('grimoire.status_command', '', true);
  return query select s.* from public.character_statuses s where s.id = any (touched);
end;
$$;

-- As in 20261031120000_m5_statuses.sql, plus the grimoire.status_command flag around its write.
create or replace function public.remove_status(status uuid, seen_version integer default null) returns public.character_statuses
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_statuses;
begin
  select * into found from public.character_statuses s where s.id = status;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if private.repeated_request('character_statuses', found.id) then
    return found;
  end if;
  if found.undone or found.ended_at is not null then
    raise exception 'That status has already ended.';
  end if;
  perform set_config('grimoire.status_command', 'on', true);
  update public.character_statuses s
  set ended_at = private.clock_now(s.campaign_id), end_reason = 'removed', version = coalesce(seen_version, s.version)
  where s.id = found.id
  returning * into found;
  perform set_config('grimoire.status_command', '', true);
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- As in 20261031120000_m5_statuses.sql, plus the grimoire.status_command flag around its write.
create or replace function public.step_status(status uuid, step integer, seen_version integer default null) returns public.character_statuses
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_statuses;
  at_level integer;
  top integer;
begin
  if step is null or step not in (-1, 1) then
    raise exception 'Step up or down one level.';
  end if;
  select * into found from public.character_statuses s where s.id = status;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if private.repeated_request('character_statuses', found.id) then
    return found;
  end if;
  if found.undone or found.ended_at is not null then
    raise exception 'That status has already ended.';
  end if;
  if found.levels is null then
    raise exception 'That status has no levels.';
  end if;
  at_level := coalesce(found.level, 0);
  top := jsonb_array_length(found.levels) - 1;
  if step = 1 and at_level >= top then
    raise exception 'It''s at its last level already: %.', found.levels -> top ->> 'name';
  end if;
  perform set_config('grimoire.status_command', 'on', true);
  if step = -1 and at_level <= 0 then
    update public.character_statuses s
    set ended_at = private.clock_now(s.campaign_id), end_reason = 'stepped', version = coalesce(seen_version, s.version)
    where s.id = found.id
    returning * into found;
  else
    update public.character_statuses s
    set level = least(top, greatest(0, at_level + step)), version = coalesce(seen_version, s.version)
    where s.id = found.id
    returning * into found;
  end if;
  perform set_config('grimoire.status_command', '', true);
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- 4. The GM takes back what the GM asked -----------------------------------------------------------------------------

-- As in 20261101091000_m5_requests_rules.sql, plus: the GM withdraws a request the GM made (gmAsks) while it waits.
create or replace function private.request_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  as_gm boolean := private.is_gm(new.campaign_id);
  owner uuid;
  state text;
begin
  if tg_op = 'INSERT' then
    new.text := trim(coalesce(new.text, ''));
    new.cost_text := trim(coalesce(new.cost_text, ''));
    new.status := 'waiting';
    new.answer := null;
    new.answered_by := null;
    new.answered_at := null;
    new.undone := false;
    new.created_by := (select auth.uid());
    if new.expedition_id is not null and not exists (select 1 from public.expeditions x where x.id = new.expedition_id and x.campaign_id = new.campaign_id) then
      raise exception 'That expedition isn''t in this campaign.';
    end if;
    if new.actor_id is not null then
      select a.owner_user_id, a.approval || '/' || a.status into owner, state
      from public.actors a where a.id = new.actor_id and a.campaign_id = new.campaign_id and a.owner_type = 'user';
      if owner is null then
        raise exception 'That character isn''t in this campaign.';
      end if;
      if new.direction = 'playerAsks' and owner <> new.requester_id then
        raise exception 'You don''t have permission to do that.' using errcode = '42501';
      end if;
      if new.direction = 'playerAsks' and state <> 'approved/active' then
        raise exception 'Only a character in play can ask.';
      end if;
      if new.direction = 'gmAsks' and new.requester_id is distinct from owner then
        raise exception 'That character''s player is who the GM asks.';
      end if;
    elsif new.direction = 'playerAsks' then
      raise exception 'Pick which character asks.';
    end if;
    return new;
  end if;
  if old.undone and not reverting then
    raise exception 'That request was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.group_number is distinct from old.group_number or new.requester_id is distinct from old.requester_id
    or new.actor_id is distinct from old.actor_id or new.kind is distinct from old.kind or new.direction is distinct from old.direction
    or new.text is distinct from old.text or new.prompt is distinct from old.prompt or new.answer_kind is distinct from old.answer_kind
    or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  if reverting then
    return new;
  end if;
  if new.undone <> old.undone then
    raise exception 'That can''t be changed.';
  end if;
  if old.status <> 'waiting' then
    raise exception 'That request was already %.', old.status;
  end if;
  if as_gm and new.status = 'answered' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    new.answered_by := (select auth.uid());
    new.answered_at := now();
    new.cost_text := trim(coalesce(new.cost_text, ''));
    return new;
  end if;
  if new.cost_text is distinct from old.cost_text or new.answer is distinct from old.answer
    or new.answered_by is distinct from old.answered_by or new.answered_at is distinct from old.answered_at then
    raise exception 'Only the GM answers.';
  end if;
  -- The GM takes back what the GM asked (an escape roll), while it waits.
  if as_gm and new.status = 'withdrawn' and old.direction = 'gmAsks' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    return new;
  end if;
  -- From here: the requester's own changes (Cancel, Enter roll); the GM has no part in them.
  if as_gm then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if new.status = 'withdrawn' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    if old.direction <> 'playerAsks' then
      raise exception 'Only the GM takes back what the GM asked.';
    end if;
    return new;
  end if;
  if new.status = 'waiting' then
    return new;
  end if;
  raise exception 'That can''t be changed.';
end;
$$;

-- 5. A note only on a log entry the caller can read -----------------------------------------------------------------

-- May the caller read this log entry: the rule of 20261029200000_m5_check_reveal.sql, as one function the reading
-- rule and prepare_note share. The GM reads all but another GM's draft; a member reads what has reached players
-- (now, by Downtime or a revealed check) for everyone or for them.
create function private.event_readable(campaign uuid, target_table text, target_id uuid, after jsonb, before jsonb, reveal_at text, seq bigint, audience text, owner_user_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (private.is_gm(campaign) and not private.is_others_draft_event(target_table, target_id, coalesce(after, before)))
    or (
      private.is_member(campaign)
      and (
        reveal_at = 'now'
        or private.revealed_by_downtime(campaign, seq)
        or (target_table = 'check_results' and private.check_result_revealed(target_id))
      )
      and (audience = 'all' or (audience = 'owner' and owner_user_id = (select auth.uid())))
    );
$$;
revoke execute on function private.event_readable(uuid, text, uuid, jsonb, jsonb, text, bigint, text, uuid) from public, anon;
grant execute on function private.event_readable(uuid, text, uuid, jsonb, jsonb, text, bigint, text, uuid) to authenticated, service_role;

drop policy "events: read what you may see" on public.events;
create policy "events: read what you may see" on public.events
  for select to authenticated
  using (private.event_readable(campaign_id, target_table, target_id, after, before, reveal_at, seq, audience, owner_user_id));

-- As in 20261029210000_m5_note_hidden_fix.sql, plus: an entry the caller can't read is "not in this campaign" (the
-- same words as a made-up id, so the note can't tell that the entry exists).
create or replace function private.prepare_note() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.events;
  about public.actors;
begin
  new.audience := 'all';
  new.owner_user_id := null;
  new.reveal_at := 'now';
  if new.about_actor_id is not null then
    select * into about from public.actors a where a.id = new.about_actor_id and a.campaign_id = new.campaign_id;
    if about.id is null then
      raise exception 'That character isn''t in this campaign.' using errcode = '42501';
    end if;
    -- Like who may see the character itself (and its log entries).
    if about.approval <> 'approved' then
      if about.owner_type = 'user' then
        new.audience := 'owner';
        new.owner_user_id := about.owner_user_id;
      else
        new.audience := 'gm';
      end if;
    end if;
  end if;
  if new.annotates_event_id is not null then
    select * into entry from public.events e where e.id = new.annotates_event_id;
    if entry.id is null or entry.campaign_id <> new.campaign_id
      or not private.event_readable(entry.campaign_id, entry.target_table, entry.target_id, entry.after, entry.before, entry.reveal_at, entry.seq, entry.audience, entry.owner_user_id) then
      raise exception 'That log entry isn''t in this campaign.' using errcode = '42501';
    end if;
    -- The character and the entry: the stricter wins.
    if entry.audience = 'gm' or new.audience = 'gm'
      or (entry.audience = 'owner' and new.audience = 'owner' and entry.owner_user_id is distinct from new.owner_user_id) then
      new.audience := 'gm';
      new.owner_user_id := null;
    elsif entry.audience = 'owner' then
      new.audience := 'owner';
      new.owner_user_id := entry.owner_user_id;
    end if;
    new.reveal_at := entry.reveal_at;
  end if;
  return new;
end;
$$;
