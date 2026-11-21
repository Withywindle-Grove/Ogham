-- Players see weather effects again (ruled 2026-10-30, D1; docs/design/rulings/m5b-wilderness-2026-10-30.md):
-- weather tags are player-readable as effects. The weather table stays the GM's: tables (library entries of kind
-- 'table') were never player-facing, and nothing here changes that.
-- Fixes forward 20261030160000_m5_weather_tags.sql, which kept a rules set's weather tags (and a mode's, and an
-- optional rule's override's) from players. Its private.weather_for_players now hands the weather block back whole,
-- so private.exploration_for_players, private.overrides_for_players, private.hidden_keys and private.visible_of (the
-- newest copies are in that migration) no longer take tags out: weather and exploration go back to the readable
-- part unless the pack marks them gmOnly, as before 20261030160000.
-- Existing rules sets that migration re-filed are re-filed back: the readable part gets the whole section again, and
-- the hidden part drops its copy of a section that is no longer hidden. Nothing is lost: every value taken out of the
-- hidden part is, whole, in the readable part. No rows are removed (a hidden part left empty stays, empty).
-- Replaces one function. Drops nothing.

-- What players may see of a weather block: all of it (D1). Kept as a function so its callers stay as they are.
create or replace function private.weather_for_players(weather jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select weather;
$$;

-- Rules sets whose readable part differs from what players may now see, for weather, exploration or byOption.
-- Worked out on the whole entry (its hidden part added back).
create temporary table weather_refile as
with whole as (
  select e.id, e.data as readable, s.data as secret, e.data || s.data as data
  from public.library_entries e join public.library_entry_secrets s on s.id = e.id
  where e.kind = 'rulesSet'
)
select w.id, w.readable, w.secret,
  private.hidden_keys('rulesSet', w.data) as keys,
  private.visible_of('rulesSet', w.data) as visible
from whole w
where exists (
  select 1 from unnest(array['weather', 'exploration', 'byOption']) k
  where (private.visible_of('rulesSet', w.data) -> k) is distinct from (w.readable -> k)
);

-- The split is paused, as this isn't a change anyone made.
alter table public.library_entries disable trigger split_hidden_fields;
alter table public.library_entries disable trigger log_change;
alter table public.library_entries disable trigger refuse_when_retired;
alter table public.library_entry_secrets disable trigger log_change;
alter table public.library_entry_secrets disable trigger refuse_when_retired;

-- The readable part gets what players may now see of the three sections.
update public.library_entries e
  set data = (e.data - array['weather', 'exploration', 'byOption'])
    || (r.visible - array(select k from jsonb_object_keys(r.visible) k where k not in ('weather', 'exploration', 'byOption')))
  from weather_refile r
  where e.id = r.id;

-- The hidden part keeps only the sections still hidden (it is now all in the readable part otherwise).
update public.library_entry_secrets s
  set data = s.data - array(
    select k from unnest(array['weather', 'exploration', 'byOption']) k where not (k = any (r.keys))
  )
  from weather_refile r
  where s.id = r.id;

alter table public.library_entry_secrets enable trigger refuse_when_retired;
alter table public.library_entry_secrets enable trigger log_change;
alter table public.library_entries enable trigger refuse_when_retired;
alter table public.library_entries enable trigger log_change;
alter table public.library_entries enable trigger split_hidden_fields;

drop table weather_refile;
