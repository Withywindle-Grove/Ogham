-- A rules set's GM reference panels are the GM's (ruled 2026-11-01, M5 gate B4; docs/07 `gmReference`, G-45):
-- `gmReference` joins monsters, magicItems and procedures as a section players' devices never receive. The GM
-- gets it back from the hidden part (library_entry_secrets), as with the others. An optional rule's override
-- (`byOption`) that carries one loses it for players too.
-- Replaces private.overrides_for_players and private.hidden_keys; the newest copies of both are in
-- 20261030160000_m5_weather_tags.sql (20261030220000_m5_weather_tags_readable.sql replaced only
-- private.weather_for_players). private.visible_of and private.split_hidden_fields call private.hidden_keys, so
-- they hide the new section without being replaced.
-- Existing rules sets that already hold a `gmReference` in their readable part are re-filed in place: the section
-- moves, whole, to the hidden part (added to what's there); nothing is lost. Drops nothing; no rows are removed.

-- As in 20261030160000_m5_weather_tags.sql, plus gmReference among the secret sections.
create or replace function private.overrides_for_players(data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  with secret_sections as (
    select array['monsters', 'magicItems', 'procedures', 'gmReference'] || coalesce(array(
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

-- As in 20261030160000_m5_weather_tags.sql, plus gmReference among a rules set's GM-only sections.
create or replace function private.hidden_keys(kind text, data jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select array(
    select distinct k from (
      select jsonb_array_elements_text(case when jsonb_typeof(data -> 'gmOnly') = 'array' then data -> 'gmOnly' else '[]'::jsonb end) as k
      union all
      select e.key from jsonb_each(case when kind = 'rulesSet' then data else '{}'::jsonb end) e
      where e.key in ('monsters', 'magicItems', 'procedures', 'gmReference')
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

-- Rules sets whose readable part holds a gmReference, or an override that does: worked out on the whole entry (its
-- hidden part added back).
create temporary table gm_reference_refile as
select e.id, e.pack_id, e.data || coalesce(s.data, '{}'::jsonb) as data
from public.library_entries e left join public.library_entry_secrets s on s.id = e.id
where e.kind = 'rulesSet'
  and (e.data ? 'gmReference'
    or (jsonb_typeof(e.data -> 'byOption') = 'object'
      and exists (select 1 from jsonb_each(e.data -> 'byOption') o where jsonb_typeof(o.value) = 'object' and o.value ? 'gmReference')));

-- The split is paused, as this isn't a change anyone made.
alter table public.library_entries disable trigger split_hidden_fields;
alter table public.library_entries disable trigger log_change;
alter table public.library_entries disable trigger refuse_when_retired;
alter table public.library_entry_secrets disable trigger log_change;
alter table public.library_entry_secrets disable trigger refuse_when_retired;

-- The hidden part gets the whole sections (added to what's there).
insert into public.library_entry_secrets as s (id, pack_id, data)
select r.id, r.pack_id,
  case when r.data ? 'gmReference' then jsonb_build_object('gmReference', r.data -> 'gmReference') else '{}'::jsonb end
  || case when 'byOption' = any (private.hidden_keys('rulesSet', r.data)) then jsonb_build_object('byOption', r.data -> 'byOption') else '{}'::jsonb end
from gm_reference_refile r
on conflict (id) do update set data = s.data || excluded.data;

-- The readable part keeps what players may see.
update public.library_entries e
  set data = (e.data - 'gmReference')
    || case when 'byOption' = any (private.hidden_keys('rulesSet', r.data))
         then jsonb_build_object('byOption', private.overrides_for_players(r.data))
         else '{}'::jsonb end
  from gm_reference_refile r
  where e.id = r.id;

-- The hidden part's link to its entry is checked at commit (deferred); run those checks now, or turning the
-- triggers back on is refused ("pending trigger events"; added 2026-11-02 when the main push failed, Francis's OK).
set constraints all immediate;

alter table public.library_entry_secrets enable trigger refuse_when_retired;
alter table public.library_entry_secrets enable trigger log_change;
alter table public.library_entries enable trigger refuse_when_retired;
alter table public.library_entries enable trigger log_change;
alter table public.library_entries enable trigger split_hidden_fields;

drop table gm_reference_refile;
