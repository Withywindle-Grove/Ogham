-- Weather tags are the GM's (docs/05 "Seasons, weather and the calendar", 07 "Seasons and weather": "Players see the
-- weather and the budget line, never tag names"). Until now a rules set's `weather` reached players whole, tags and
-- all. The same way 20261030140000_m5_calendar_followups.sql handled special seasons:
--   * a rules set's `weather` reaches players without its `tags` (the tag names, their budget changes, notes and
--     warnings); a mode's own weather (`exploration.modes[].weather`, which overrides the rules set's) the same;
--     and the same inside each optional-rule override (`byOption`);
--   * the GM gets the whole of it back from the hidden part (library_entry_secrets).
-- Replaces private.overrides_for_players, private.hidden_keys and private.visible_of; the newest copies are all in
-- 20261030140000_m5_calendar_followups.sql. Existing rules sets are re-filed in place, as that migration did (the
-- whole section joins the hidden part; players keep the rest).
-- Adds two functions; replaces three. Drops nothing; no rows are removed.

-- What players may see of a weather block: everything but its tags. Anything that isn't an object comes back as it is.
create function private.weather_for_players(weather jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(weather) = 'object' then weather - 'tags' else weather end;
$$;
grant execute on function private.weather_for_players(jsonb) to authenticated, service_role;

-- What players may see of the exploration section: each mode's own weather without its tags. Anything else (and
-- anything that isn't a list of modes) comes back as it is.
create function private.exploration_for_players(exploration jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(exploration) = 'object' and jsonb_typeof(exploration -> 'modes') = 'array' then
      exploration || jsonb_build_object('modes', coalesce((
        select jsonb_agg(
          case when jsonb_typeof(m.value) = 'object' and jsonb_typeof(m.value -> 'weather') = 'object'
            then m.value || jsonb_build_object('weather', private.weather_for_players(m.value -> 'weather'))
            else m.value end
          order by m.at)
        from jsonb_array_elements(exploration -> 'modes') with ordinality as m(value, at)
      ), '[]'::jsonb))
    else exploration
  end;
$$;
grant execute on function private.exploration_for_players(jsonb) to authenticated, service_role;

-- As in 20261030140000_m5_calendar_followups.sql, plus each override's weather and exploration without the tags.
create or replace function private.overrides_for_players(data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  with secret_sections as (
    select array['monsters', 'magicItems', 'procedures'] || coalesce(array(
      select e.key from jsonb_each(data) e where jsonb_typeof(e.value) = 'object' and (e.value -> 'gmOnly') = 'true'::jsonb
    ), '{}') as names
  )
  select coalesce(jsonb_object_agg(o.key,
      case when jsonb_typeof(o.value) = 'object' then
        (o.value - (select names from secret_sections) - coalesce(array(
          select p.key from jsonb_each(o.value) p where jsonb_typeof(p.value) = 'object' and (p.value -> 'gmOnly') = 'true'::jsonb
        ), '{}'))
        || case when jsonb_typeof(o.value -> 'magicItems' -> 'charges') = 'object'
             then jsonb_build_object('magicItems', jsonb_build_object('charges', o.value -> 'magicItems' -> 'charges'))
             else '{}'::jsonb end
        || case when jsonb_typeof(o.value -> 'specialSeasons') = 'array' and not exists (select 1 from secret_sections ss where 'specialSeasons' = any (ss.names))
             then jsonb_build_object('specialSeasons', private.special_seasons_for_players(o.value -> 'specialSeasons'))
             else '{}'::jsonb end
        || case when jsonb_typeof(o.value -> 'weather') = 'object' and not exists (select 1 from secret_sections ss where 'weather' = any (ss.names))
               and (o.value -> 'weather' -> 'gmOnly') is distinct from 'true'::jsonb
             then jsonb_build_object('weather', private.weather_for_players(o.value -> 'weather'))
             else '{}'::jsonb end
        || case when jsonb_typeof(o.value -> 'exploration') = 'object' and not exists (select 1 from secret_sections ss where 'exploration' = any (ss.names))
               and (o.value -> 'exploration' -> 'gmOnly') is distinct from 'true'::jsonb
             then jsonb_build_object('exploration', private.exploration_for_players(o.value -> 'exploration'))
             else '{}'::jsonb end
      else o.value end), '{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(data -> 'byOption') = 'object' then data -> 'byOption' else '{}'::jsonb end) o;
$$;

-- As in 20261030140000_m5_calendar_followups.sql, plus weather and exploration when they hold weather tags (the
-- whole section goes to the hidden part; players get it without the tags, below).
create or replace function private.hidden_keys(kind text, data jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select array(
    select distinct k from (
      select jsonb_array_elements_text(case when jsonb_typeof(data -> 'gmOnly') = 'array' then data -> 'gmOnly' else '[]'::jsonb end) as k
      union all
      select e.key from jsonb_each(case when kind = 'rulesSet' then data else '{}'::jsonb end) e
      where e.key in ('monsters', 'magicItems', 'procedures')
        or (jsonb_typeof(e.value) = 'object' and (e.value -> 'gmOnly') = 'true'::jsonb)
      union all
      select 'byOption' where kind = 'rulesSet' and jsonb_typeof(data -> 'byOption') = 'object'
        and private.overrides_for_players(data) is distinct from data -> 'byOption'
      union all
      select 'specialSeasons' where kind = 'rulesSet' and jsonb_typeof(data -> 'specialSeasons') = 'array'
        and private.special_seasons_for_players(data -> 'specialSeasons') is distinct from data -> 'specialSeasons'
      union all
      select 'weather' where kind = 'rulesSet' and jsonb_typeof(data -> 'weather') = 'object'
        and private.weather_for_players(data -> 'weather') is distinct from data -> 'weather'
      union all
      select 'exploration' where kind = 'rulesSet' and jsonb_typeof(data -> 'exploration') = 'object'
        and private.exploration_for_players(data -> 'exploration') is distinct from data -> 'exploration'
    ) keys
  );
$$;

-- As in 20261030140000_m5_calendar_followups.sql, plus weather and exploration without the weather tags. A section
-- the pack marks gmOnly stays wholly hidden.
create or replace function private.visible_of(kind text, data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select (data - private.hidden_keys(kind, data) - 'gmOnly')
    || case
         when kind = 'rulesSet' and jsonb_typeof(data -> 'magicItems' -> 'charges') = 'object'
           then jsonb_build_object('magicItems', jsonb_build_object('charges', data -> 'magicItems' -> 'charges'))
         else '{}'::jsonb
       end
    || case
         when kind = 'rulesSet' and 'byOption' = any (private.hidden_keys(kind, data))
           then jsonb_build_object('byOption', private.overrides_for_players(data))
         else '{}'::jsonb
       end
    || case
         when kind = 'rulesSet' and 'specialSeasons' = any (private.hidden_keys(kind, data))
           then jsonb_build_object('specialSeasons', private.special_seasons_for_players(data -> 'specialSeasons'))
         else '{}'::jsonb
       end
    || case
         when kind = 'rulesSet' and 'weather' = any (private.hidden_keys(kind, data))
           and (data -> 'weather' -> 'gmOnly') is distinct from 'true'::jsonb
           and not ('weather' = any (array(select jsonb_array_elements_text(case when jsonb_typeof(data -> 'gmOnly') = 'array' then data -> 'gmOnly' else '[]'::jsonb end))))
           then jsonb_build_object('weather', private.weather_for_players(data -> 'weather'))
         else '{}'::jsonb
       end
    || case
         when kind = 'rulesSet' and 'exploration' = any (private.hidden_keys(kind, data))
           and (data -> 'exploration' -> 'gmOnly') is distinct from 'true'::jsonb
           and not ('exploration' = any (array(select jsonb_array_elements_text(case when jsonb_typeof(data -> 'gmOnly') = 'array' then data -> 'gmOnly' else '[]'::jsonb end))))
           then jsonb_build_object('exploration', private.exploration_for_players(data -> 'exploration'))
         else '{}'::jsonb
       end;
$$;

-- Existing rules sets whose weather (or a mode's weather, or an override's) holds tags: the whole section goes with
-- the hidden part (added to what's there), and players keep the rest. Worked out on the whole entry (its hidden part
-- added back); the split is paused, as this isn't a change anyone made. Nothing is removed: what leaves the readable
-- part is kept, whole, in the hidden part.
alter table public.library_entries disable trigger split_hidden_fields;
alter table public.library_entries disable trigger log_change;
alter table public.library_entries disable trigger refuse_when_retired;
with whole as (
  select e.id, e.pack_id, e.data || coalesce(s.data, '{}'::jsonb) as data
  from public.library_entries e left join public.library_entry_secrets s on s.id = e.id
  where e.kind = 'rulesSet'
), leaking as (
  select w.id, w.pack_id, w.data, private.hidden_keys('rulesSet', w.data) as keys, private.visible_of('rulesSet', w.data) as visible
  from whole w
  where exists (
    select 1 from unnest(array['weather', 'exploration', 'byOption']) k
    where k = any (private.hidden_keys('rulesSet', w.data))
      and (private.visible_of('rulesSet', w.data) -> k) is distinct from (select e.data -> k from public.library_entries e where e.id = w.id)
  )
), kept as (
  insert into public.library_entry_secrets as s (id, pack_id, data)
  select l.id, l.pack_id,
    case when 'weather' = any (l.keys) then jsonb_build_object('weather', l.data -> 'weather') else '{}'::jsonb end
    || case when 'exploration' = any (l.keys) then jsonb_build_object('exploration', l.data -> 'exploration') else '{}'::jsonb end
    || case when 'byOption' = any (l.keys) then jsonb_build_object('byOption', l.data -> 'byOption') else '{}'::jsonb end
  from leaking l
  on conflict (id) do update set data = s.data || excluded.data
  returning s.id
)
update public.library_entries e
  set data = (e.data - array['weather', 'exploration', 'byOption'])
    || (l.visible - array(select k from jsonb_object_keys(l.visible) k where k not in ('weather', 'exploration', 'byOption')))
  from leaking l
  where e.id = l.id;
alter table public.library_entries enable trigger refuse_when_retired;
alter table public.library_entries enable trigger log_change;
alter table public.library_entries enable trigger split_hidden_fields;
