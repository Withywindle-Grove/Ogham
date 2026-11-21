-- p2p-b8-weather: point to point's weather by the day (docs/plans/scene-point-to-point.md, B8 and flag 10; Francis,
-- 2026-11-18, "Day weather": in point to point the setting's day weather runs, rolled once a day; not at a turn's
-- pace, and not none).
-- One function is replaced and nothing else: private.weather_every, how often the weather is rolled on an
-- expedition in a mode. Until now it read point to point's id, which it did not know, as the plain Dungeon (a turn's
-- pace, with no weather), so private.weather_now gave nothing and a player's weather entry on a point-to-point
-- expedition was refused ("The weather isn't rolled on this expedition.") while the app (procedure.ts,
-- weatherBlock) asked for it once a day.
-- Add-only: nothing is dropped, renamed or deleted, and no stored data changes.
-- The id is the app's own: POINT_TO_POINT_ID in src/modules/expedition/modes.ts ('app:' + 'point-to-point'), as
-- public.expeditions.mode stores it. A rules set cannot take that id in the app (readMode leaves such a mode out),
-- so here too a mode a pack wrote under it is never the one used.
-- Unchanged, word for word: every other id (a rules set's own modes, "dungeon", "wilderness", the plain
-- fallbacks), the weather block's optional rule and its rollEvery, a weather step of the procedure, and what the
-- function returns when the weather isn't rolled.
-- builds on: private.weather_every from 20261101120000_m5_review_fixes.sql (its only definition). The only lines
-- added are the block marked "Point to point" below.
create or replace function private.weather_every(campaign uuid, mode_id text) returns bigint
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
  -- Point to point, the app's own method (modes.ts, pointToPoint): never a rules set's mode, with no weather block
  -- and no weather step of its own. For the weather it goes by the day (flag 10, ruled 2026-11-18), whatever unit
  -- its ways are counted in, so the lines below give it the setting's day weather: the rules set's weather block at
  -- that block's own rollEvery (a day without one), switched off by its optional rule as in any mode; none without
  -- a block.
  if mode_id = 'app:point-to-point' then
    mode := '{"id": "app:point-to-point", "step": {"value": 1, "unit": "day"}}'::jsonb;
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
-- As before (replacing a function keeps who may run it; said again so it can't drift).
revoke execute on function private.weather_every(uuid, text) from public, anon, authenticated;
grant execute on function private.weather_every(uuid, text) to service_role;
