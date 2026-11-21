-- M5 calendar follow-ups (ruled 2026-10-30; docs/03, 05 "Seasons, weather and the calendar", 07 "Who sees what").
--   1. "Not now" on "Which season?" lasts the session, on every GM device: the campaign keeps when it was said
--      (campaigns.season_not_now_at). It holds until a session starts after it (a session that was undone doesn't
--      count). Said through its own command, calendar.seasonNotNow, logged Verbose and the GM's.
--   2. Players see the date and season: campaign members read the setting rules' calendars through
--      public.campaign_calendars (calendars stay out of players' reach in library_entries). What it gives is the
--      part players may see: an entry's gmOnly fields were already kept apart (library_entry_secrets) and never
--      come back here.
--   3. Special seasons' start chances (and their encounter swaps, an encounter chance and table) are the GM's:
--      a rules set's specialSeasons reaches players without each season's `start` and `encounterSwap`; the GM gets
--      the whole of it back from the hidden part, as with byOption. Replaces private.overrides_for_players,
--      private.hidden_keys and private.visible_of; the newest copies are all in 20261024230000_m4_review_fixes.sql.
--      Existing rules sets are re-filed in place, as that migration did (the whole section joins the hidden part).
-- Adds one column, three functions and one logged command; replaces three functions. Drops nothing; no rows are
-- removed.

-- 1. "Not now" for the session -------------------------------------------------------------------------------------

alter table public.campaigns add column season_not_now_at timestamptz;

-- The GM's "Not now" on "Which season?": kept with the campaign, so every GM device stops asking until a session
-- starts after it. Gives back when it was said.
create function public.season_not_now(campaign uuid) returns timestamptz
language plpgsql security invoker set search_path = '' as $$
declare
  said timestamptz;
begin
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  update public.campaigns c set season_not_now_at = now() where c.id = campaign returning c.season_not_now_at into said;
  if said is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return said;
end;
$$;
revoke execute on function public.season_not_now(uuid) from public, anon;
grant execute on function public.season_not_now(uuid) to authenticated, service_role;

insert into public.logged_commands (name, level, gm_only) values ('calendar.seasonNotNow', 'verbose', true);

-- 2. The calendar for every member ---------------------------------------------------------------------------------

-- The calendars of the campaign's setting rules, for its members (the GM reads them in library_entries too).
-- `preferred`: the GM's per-entry exception points at this pack's calendar, so stacking picks the same one on
-- every device (ruled 2026-10-29, A4: players get the exceptions for entries they can read).
create function public.campaign_calendars(campaign uuid)
returns table (id uuid, pack_id uuid, pack_entry_id text, name text, data jsonb, preferred boolean)
language sql stable security definer set search_path = '' as $$
  select e.id, e.pack_id, e.pack_entry_id, e.name, private.visible_of(e.kind, e.data),
    coalesce(cp.overrides ? ('calendar:' || e.pack_entry_id), false)
      or exists (
        select 1 from public.campaign_pack_secrets s
        where s.id = cp.id and s.overrides ? ('calendar:' || e.pack_entry_id)
      )
  from public.campaign_packs cp
  join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'calendar'
  where cp.campaign_id = campaign and private.is_member(campaign)
  order by e.id;
$$;
revoke execute on function public.campaign_calendars(uuid) from public, anon;
grant execute on function public.campaign_calendars(uuid) to authenticated, service_role;

-- 3. Special seasons without their start chances -------------------------------------------------------------------

-- What players may see of a rules set's special seasons: each without its start (the chance it begins) and its
-- encounter swap. Anything that isn't a list of seasons comes back as it is.
create function private.special_seasons_for_players(seasons jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(seasons) = 'array' then coalesce((
      select jsonb_agg(case when jsonb_typeof(s.value) = 'object' then s.value - 'start' - 'encounterSwap' else s.value end order by s.at)
      from jsonb_array_elements(seasons) with ordinality as s(value, at)
    ), '[]'::jsonb)
    else seasons
  end;
$$;
grant execute on function private.special_seasons_for_players(jsonb) to authenticated, service_role;

-- As in 20261024230000_m4_review_fixes.sql, plus each override's specialSeasons without their start chances.
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
      else o.value end), '{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(data -> 'byOption') = 'object' then data -> 'byOption' else '{}'::jsonb end) o;
$$;

-- As in 20261024230000_m4_review_fixes.sql, plus specialSeasons when a season has a start chance or an encounter
-- swap (the whole of it goes to the hidden part; players get it without those, below).
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
    ) keys
  );
$$;

-- As in 20261024230000_m4_review_fixes.sql, plus the special seasons without their start chances.
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
       end;
$$;

-- Existing rules sets whose special seasons (or whose overrides' special seasons) hold a start chance or an
-- encounter swap: the whole section goes with the hidden part (added to what's there), and players keep the rest.
-- Worked out on the whole entry (its hidden part added back); the split is paused, as this isn't a change anyone
-- made. Nothing is removed: what leaves the readable part is kept, whole, in the hidden part.
alter table public.library_entries disable trigger split_hidden_fields;
alter table public.library_entries disable trigger log_change;
alter table public.library_entries disable trigger refuse_when_retired;
with whole as (
  select e.id, e.pack_id, e.data || coalesce(s.data, '{}'::jsonb) as data
  from public.library_entries e left join public.library_entry_secrets s on s.id = e.id
  where e.kind = 'rulesSet'
), leaking as (
  select w.id, w.pack_id, w.data, private.hidden_keys('rulesSet', w.data) as keys from whole w
  where ('specialSeasons' = any (private.hidden_keys('rulesSet', w.data))
         and private.special_seasons_for_players(w.data -> 'specialSeasons') is distinct from (select e.data -> 'specialSeasons' from public.library_entries e where e.id = w.id))
     or ('byOption' = any (private.hidden_keys('rulesSet', w.data))
         and private.overrides_for_players(w.data) is distinct from (select e.data -> 'byOption' from public.library_entries e where e.id = w.id))
), kept as (
  insert into public.library_entry_secrets as s (id, pack_id, data)
  select l.id, l.pack_id,
    case when 'specialSeasons' = any (l.keys) then jsonb_build_object('specialSeasons', l.data -> 'specialSeasons') else '{}'::jsonb end
    || case when 'byOption' = any (l.keys) then jsonb_build_object('byOption', l.data -> 'byOption') else '{}'::jsonb end
  from leaking l
  on conflict (id) do update set data = s.data || excluded.data
  returning s.id
)
update public.library_entries e
  set data = e.data
    || case when 'specialSeasons' = any (l.keys)
         then jsonb_build_object('specialSeasons', private.special_seasons_for_players(l.data -> 'specialSeasons')) else '{}'::jsonb end
    || case when 'byOption' = any (l.keys)
         then jsonb_build_object('byOption', private.overrides_for_players(l.data)) else '{}'::jsonb end
  from leaking l
  where e.id = l.id;
alter table public.library_entries enable trigger refuse_when_retired;
alter table public.library_entries enable trigger log_change;
alter table public.library_entries enable trigger split_hidden_fields;
