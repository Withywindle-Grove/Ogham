-- M5b: the players' weather roll (ruled 2026-10-30: D1, session 2 S2-1 and Answers A8–A12; docs/03 "Weather roll",
-- 04 ExplorationState "weather today" and the campaign setting weatherRolledBy, 05 "Seasons, weather and the
-- calendar", 07 "Seasons and weather").
--   1. weather_rolls: today's weather, one row per rollEvery step of an expedition (`period`, 0 the first; it lasts
--      until the next step): the table, the roll typed, the row's result and its tags, who entered it and when, and
--      who changed it since (the GM). Every member reads it (everyone sees the result and its effects); the weather
--      table itself stays the GM's (tables never reach players; the database reads the row here).
--   2. Who enters it: any member while "Weather rolled by" (campaigns.settings ->> 'weatherRolledBy') isn't 'gm'
--      (Players is the default), else the GM; the GM can always enter it instead. The first entry counts: one live
--      row per step (a unique index), a second entry is refused with plain words. The table must be one of the
--      setting rules' weather tables, so a player can never read another table's rows through this.
--   3. Changing it: the GM, any time (logged as weather.correct, a correction with the fiat seal). The player who
--      entered it can only undo it, from the toast (8 seconds; the database allows 30, for a slow connection).
--   4. What the app calls: enter_weather (an intent with a request id: a repeat changes nothing), correct_weather
--      (refused from an old copy), weather_die (only the die a weather table names, so players know what to roll).
--   5. Undo: entering makes a record, and undo marks it undone (never removed; hard rule 4); a correction puts back
--      what was. Replaces private.undo_body (the newest copy is in 20261029180000_m5_reminders.sql): the same, plus
--      weather_rolls among the made records.
--   6. Who sees the log lines (everyone), and the logged-command rows.
-- Adds a table with its rules, triggers and policies, eight functions and log rows; replaces one function. Drops
-- nothing; no rows are removed.

-- 1. The table -------------------------------------------------------------------------------------------------------

create table public.weather_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid not null references public.expeditions (id) on delete cascade,
  -- Which rollEvery step since the expedition began (0 the first), and where on the clock it began (seconds).
  period integer not null check (period between 0 and 10000000),
  starts_at bigint not null default 0 check (starts_at >= 0),
  -- The weather table (a table entry's id) and what the dice showed.
  table_id text not null check (length(table_id) between 1 and 200),
  roll text not null check (length(roll) between 1 and 20),
  -- The row it read, filled in by the database: its result and its weather tags (ids from the rules set's
  -- weather.tags).
  result text not null check (length(result) between 1 and 1000),
  tags jsonb not null default '[]' check (jsonb_typeof(tags) = 'array'),
  entered_by uuid references public.profiles (id) on delete set null,
  entered_at timestamptz not null default now(),
  corrected_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weather_rolls_campaign on public.weather_rolls (campaign_id, created_at desc);
-- The first entry counts: one live weather per step of an expedition.
create unique index weather_rolls_one_per_step on public.weather_rolls (expedition_id, period) where not undone;

alter table public.weather_rolls enable row level security;
grant select, insert, update on public.weather_rolls to authenticated;
grant select, insert, update, delete on public.weather_rolls to service_role;

-- Every member reads it; a member enters it (the rules below say when); the GM changes it, and the player who entered
-- it may undo it (the rules below hold them to that).
create policy "weather rolls: members read" on public.weather_rolls
  for select to authenticated using (private.is_member(campaign_id));
create policy "weather rolls: a member enters one" on public.weather_rolls
  for insert to authenticated with check (private.is_member(campaign_id));
create policy "weather rolls: the GM changes one, the entrant undoes it" on public.weather_rolls
  for update to authenticated
  using (private.is_gm(campaign_id) or (private.is_member(campaign_id) and entered_by = (select auth.uid())))
  with check (private.is_gm(campaign_id) or (private.is_member(campaign_id) and entered_by = (select auth.uid())));

-- 2. Reading the weather table (the GM's) ---------------------------------------------------------------------------

-- The weather tables one rules set (or one optional rule's override) names: its weather's, each mode's weather's,
-- the tables of each mode's weather roll steps (a `roll` with the `weather` icon) and the special seasons' own.
create function private.weather_table_ids_in(rules jsonb) returns setof text
language sql immutable set search_path = '' as $$
  with modes as (
    select m.value as mode
    from jsonb_array_elements(case when jsonb_typeof(rules -> 'exploration' -> 'modes') = 'array' then rules -> 'exploration' -> 'modes' else '[]'::jsonb end) m
    where jsonb_typeof(m.value) = 'object'
  ), steps as (
    select s.value as step
    from modes, jsonb_array_elements(case when jsonb_typeof(mode -> 'procedure') = 'array' then mode -> 'procedure' else '[]'::jsonb end) s
    where jsonb_typeof(s.value) = 'object' and s.value ->> 'icon' = 'weather'
  )
  select t.value from jsonb_each_text(case when jsonb_typeof(rules -> 'weather' -> 'tables') = 'object' then rules -> 'weather' -> 'tables' else '{}'::jsonb end) t
  union
  select t.value from modes, jsonb_each_text(case when jsonb_typeof(mode -> 'weather' -> 'tables') = 'object' then mode -> 'weather' -> 'tables' else '{}'::jsonb end) t
  union
  select step ->> 'tableId' from steps where jsonb_typeof(step -> 'tableId') = 'string'
  union
  select t.value from steps, jsonb_each_text(case when jsonb_typeof(step -> 'tableBySeason') = 'object' then step -> 'tableBySeason' else '{}'::jsonb end) t
  union
  select s.value ->> 'weatherTableId'
  from jsonb_array_elements(case when jsonb_typeof(rules -> 'specialSeasons') = 'array' then rules -> 'specialSeasons' else '[]'::jsonb end) s
  where jsonb_typeof(s.value -> 'weatherTableId') = 'string';
$$;

-- Every weather table the campaign's setting rules name (their hidden parts included, and every optional rule's
-- override, whichever is chosen).
create function private.campaign_weather_tables(campaign uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  with rules as (
    select e.data || coalesce(s.data, '{}'::jsonb) as data
    from public.campaign_packs cp
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'rulesSet'
    left join public.library_entry_secrets s on s.id = e.id
    where cp.campaign_id = campaign
  ), named as (
    select private.weather_table_ids_in(r.data) as id from rules r
    union all
    select private.weather_table_ids_in(o.value) from rules r,
      jsonb_each(case when jsonb_typeof(r.data -> 'byOption') = 'object' then r.data -> 'byOption' else '{}'::jsonb end) o
    where jsonb_typeof(o.value) = 'object'
  )
  select coalesce(array_agg(distinct n.id), '{}') from named n where n.id is not null and length(trim(n.id)) > 0;
$$;

-- A table of the campaign's setting rules by id, as the stack reads it: homebrew first, then the GM's order.
create function private.campaign_table(campaign uuid, table_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select e.data || coalesce(s.data, '{}'::jsonb)
  from public.campaign_packs cp
  join public.packs p on p.id = cp.pack_id
  join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'table' and e.pack_entry_id = table_id
  left join public.library_entry_secrets s on s.id = e.id
  where cp.campaign_id = campaign
  order by (p.kind = 'homebrew') desc, cp.priority desc
  limit 1;
$$;

-- "2", "3-4", "3–4", "8+" (or a whole number): the range a row covers, as src/modules/expedition/tables.ts reads it;
-- null when it can't be read.
create function private.row_range(spec jsonb) returns int4range
language plpgsql immutable set search_path = '' as $$
declare
  said text;
  parts text[];
begin
  if spec is null or jsonb_typeof(spec) not in ('number', 'string') then
    return null;
  end if;
  said := trim(spec #>> '{}');
  if said ~ '^\d{1,6}$' then
    return int4range(said::integer, said::integer, '[]');
  end if;
  parts := regexp_match(said, '^(\d{1,6})\s*[-–—]\s*(\d{1,6})$');
  if parts is not null then
    return int4range(parts[1]::integer, parts[2]::integer, '[]');
  end if;
  parts := regexp_match(said, '^(\d{1,6})\s*\+$');
  if parts is not null then
    return int4range(parts[1]::integer, null, '[)');
  end if;
  return null;
end;
$$;

-- The row a typed roll lands on, as the app reads a table (src/modules/expedition/tables.ts, rowFor): a whole number
-- in a row's range (min and max, else its roll, level or key), or "3/7" for a composite die's key. Gives back
-- { result, tags } (the row's result, or its first column's; its weather tags), or null when no row has it.
create function private.weather_reading(tbl jsonb, roll text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  said text := regexp_replace(coalesce(roll, ''), '\s+', '', 'g');
  n integer;
  r jsonb;
  covers int4range;
  result text;
begin
  if said ~ '^\d{1,4}$' then
    n := said::integer;
  elsif said !~ '^\d{1,4}/\d{1,4}$' then
    return null;
  end if;
  for r in
    select x.value from jsonb_array_elements(case when jsonb_typeof(tbl -> 'rows') = 'array' then tbl -> 'rows' else '[]'::jsonb end) x
  loop
    if jsonb_typeof(r) <> 'object' then
      continue;
    end if;
    if n is null then
      if not (jsonb_typeof(r -> 'key') = 'string' and regexp_replace(regexp_replace(r ->> 'key', '\s+', '', 'g'), '[\\|,]', '/', 'g') = said) then
        continue;
      end if;
    else
      covers := case
        when jsonb_typeof(r -> 'min') = 'number' and (r ->> 'min') ~ '^\d{1,6}$' then
          int4range((r ->> 'min')::integer,
            case when jsonb_typeof(r -> 'max') = 'number' and (r ->> 'max') ~ '^\d{1,6}$' then (r ->> 'max')::integer else (r ->> 'min')::integer end, '[]')
        else coalesce(private.row_range(r -> 'roll'), private.row_range(r -> 'level'),
          case when coalesce(position('/' in r ->> 'key'), 0) = 0 then private.row_range(r -> 'key') end)
      end;
      if covers is null or not (n <@ covers) then
        continue;
      end if;
    end if;
    result := coalesce(
      nullif(trim(case when jsonb_typeof(r -> 'result') in ('string', 'number') then r ->> 'result' end), ''),
      nullif(trim(case when jsonb_typeof(r -> 'value') in ('string', 'number') then r ->> 'value' end), ''),
      nullif(trim(case when jsonb_typeof(r -> 'results') = 'array' then r -> 'results' ->> 0 end), '')
    );
    -- A row with no result isn't a row the app reads either.
    if result is null then
      continue;
    end if;
    return jsonb_build_object(
      'result', left(result, 1000),
      'tags', coalesce((
        select jsonb_agg(t.value order by t.at)
        from jsonb_array_elements(case when jsonb_typeof(r -> 'tags') = 'array' then r -> 'tags' else '[]'::jsonb end) with ordinality as t(value, at)
        where jsonb_typeof(t.value) = 'string'
      ), '[]'::jsonb)
    );
  end loop;
  return null;
end;
$$;

-- Today's weather from a weather table of the campaign and a typed roll; says plainly what's wrong otherwise.
create function private.weather_read(campaign uuid, table_id text, roll text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tbl jsonb;
  reading jsonb;
begin
  if coalesce(trim(roll), '') = '' then
    raise exception 'Type what the dice showed.';
  end if;
  if not (table_id = any (private.campaign_weather_tables(campaign))) then
    raise exception 'That isn''t one of the setting''s weather tables.';
  end if;
  tbl := private.campaign_table(campaign, table_id);
  if tbl is null then
    raise exception 'That weather table isn''t in the setting rules.';
  end if;
  reading := private.weather_reading(tbl, roll);
  if reading is null then
    raise exception 'No row of the weather table has %. Check the roll.', trim(roll);
  end if;
  return reading;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'private.weather_table_ids_in(jsonb)',
    'private.campaign_weather_tables(uuid)',
    'private.campaign_table(uuid, text)',
    'private.row_range(jsonb)',
    'private.weather_reading(jsonb, text)',
    'private.weather_read(uuid, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- 3. What the database decides, whatever a device sends -------------------------------------------------------------

-- Entering: the expedition under way; a player only while players roll it; the row read here (never sent by a
-- device), stamped with who entered it and when. A change: only the GM's (a new table or roll is read again, and
-- marks who changed it), or the entrant's Undo within the toast's time (it marks the weather undone, nothing else).
create function private.weather_roll_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  as_gm boolean := private.is_gm(new.campaign_id);
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  reading jsonb;
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
revoke execute on function private.weather_roll_rules() from public, anon, authenticated;

create trigger check_copy_version before insert or update on public.weather_rolls
  for each row execute function private.check_copy_version();
create trigger weather_roll_rules before insert or update on public.weather_rolls
  for each row execute function private.weather_roll_rules();
create trigger refuse_when_retired before insert or update or delete on public.weather_rolls
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or delete or update of table_id, roll, result, tags, undone on public.weather_rolls
  for each row execute function private.log_change();

-- 4. What the app calls ---------------------------------------------------------------------------------------------

-- Enter today's weather: the step of the expedition it's for, the weather table and what the dice showed. A repeat
-- gives back the weather it entered; when someone else's entry came first, it says so.
create function public.enter_weather(campaign uuid, expedition uuid, period integer, starts_at bigint, table_id text, roll text)
returns public.weather_rolls
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('weather_rolls');
  found public.weather_rolls;
begin
  if made is not null then
    select * into found from public.weather_rolls w where w.id = made;
    return found;
  end if;
  if not private.is_member(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  begin
    insert into public.weather_rolls (campaign_id, expedition_id, period, starts_at, table_id, roll, result)
    values (campaign, expedition, coalesce(enter_weather.period, 0), coalesce(enter_weather.starts_at, 0),
      coalesce(enter_weather.table_id, ''), left(coalesce(enter_weather.roll, ''), 20), '—')
    returning * into found;
  exception when unique_violation then
    raise exception 'Someone entered the weather first. It''s on the card now.';
  end;
  return found;
end;
$$;

-- The GM changes today's weather (any time): another roll, or another of the weather tables. Refused from an old
-- copy; a repeat changes nothing.
create function public.correct_weather(weather uuid, table_id text, roll text, seen_version integer default null)
returns public.weather_rolls
language plpgsql security invoker set search_path = '' as $$
declare
  found public.weather_rolls;
begin
  select * into found from public.weather_rolls w where w.id = weather;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That weather was undone.';
  end if;
  update public.weather_rolls w set
    table_id = coalesce(correct_weather.table_id, w.table_id),
    roll = left(coalesce(correct_weather.roll, w.roll), 20),
    version = coalesce(seen_version, w.version)
  where w.id = weather
  returning * into found;
  return found;
end;
$$;

-- What to roll for a weather table ("d8"): only its die, so players know what to roll; never its rows. Null when
-- the table names none.
create function public.weather_die(campaign uuid, table_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  tbl jsonb;
begin
  if not private.is_member(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if not (table_id = any (private.campaign_weather_tables(campaign))) then
    return null;
  end if;
  tbl := private.campaign_table(campaign, table_id);
  return left(nullif(trim(coalesce(
    case when jsonb_typeof(tbl -> 'die') = 'string' then tbl ->> 'die' end,
    case when jsonb_typeof(tbl -> 'roll') = 'string' then tbl ->> 'roll' end, '')), ''), 20);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.enter_weather(uuid, uuid, integer, bigint, text, text)',
    'public.correct_weather(uuid, text, text, integer)',
    'public.weather_die(uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 5. Undo -------------------------------------------------------------------------------------------------------------

insert into public.undoable_makings (name) values ('weather.enter');
insert into public.undoable_tables (name) values ('weather_rolls');

-- As in 20261029180000_m5_reminders.sql, but the made records may also be weather rolls.
create or replace function private.undo_body(event_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  picked public.events;
  change public.events;
  as_gm boolean;
  is_drop boolean;
  dropped uuid[];
  passing uuid[];
  splits uuid[];
  made uuid[];
begin
  perform set_config('grimoire.came_back', '', true);
  perform set_config('grimoire.used', '', true);
  select * into picked from public.events e where e.id = event_id;
  if picked.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  as_gm := private.is_gm(picked.campaign_id);
  -- Players: only their own change, and only an entry they can see.
  if not as_gm and not (
    private.is_member(picked.campaign_id)
    and picked.actor_user_id = (select auth.uid())
    and picked.reveal_at = 'now'
    and (picked.audience = 'all' or (picked.audience = 'owner' and picked.owner_user_id = (select auth.uid())))
  ) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- The deletions that can be undone (ruled 2026-10-25), listed in public.undoable_deletions.
  is_drop := exists (select 1 from public.undoable_deletions d where d.name = picked.type);
  select coalesce(array_agg(e.target_id), '{}') into dropped from public.events e
  where is_drop and e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.after is null
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));
  -- Lines this action both made and removed: nothing to put back.
  select coalesce(array_agg(e.target_id), '{}') into passing from public.events e
  where is_drop and e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.before is null
    and e.target_id = any (dropped)
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));
  dropped := array(select d from unnest(dropped) d where not (d = any (passing)));
  -- Part of a stack moved (given inside the party, or put somewhere): the lines the move made by splitting.
  -- Undo merges them back (ruled 2026-10-26, a named exception to hard rule 4) while they're untouched.
  select coalesce(array_agg(e.target_id), '{}') into splits from public.events e
  where picked.type = 'inventory.move' and e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines'
    and e.before is null and e.after is not null
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));
  -- A session, an expedition, a reminder, a check result or a weather roll the action made: marked undone, never
  -- removed.
  select coalesce(array_agg(e.target_id), '{}') into made from public.events e
  where exists (select 1 from public.undoable_makings m where m.name = picked.type)
    and e.campaign_id = picked.campaign_id and e.target_table in ('sessions', 'expeditions', 'reminders', 'check_results', 'weather_rolls')
    and e.before is null and e.after is not null
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));

  -- Check everything first: the action's changes are those sharing its request id AND its author.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id
      and (
        e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id)
      )
  loop
    if change.target_table in ('inventory_lines', 'inventory_line_secrets') and change.target_id = any (passing) then
      continue;
    end if;
    if change.target_table = 'inventory_lines' and change.target_id = any (splits) then
      if change.before is null then
        perform private.undo_check_split_part(picked, change);
      end if;
      continue;
    end if;
    if change.target_table in ('sessions', 'expeditions', 'reminders', 'check_results', 'weather_rolls') and change.target_id = any (made) and change.before is null then
      perform private.undo_check_made(change);
      continue;
    end if;
    perform private.undo_check_change(picked, change, as_gm, is_drop, dropped);
  end loop;

  -- Then write: dropped lines back, split-off parts merged back, made records marked undone, changed values put back.
  if is_drop then
    perform private.undo_restore_drops(picked, dropped);
  end if;
  perform private.undo_unsplit(picked, splits);
  perform private.undo_mark_made(picked, made);
  perform private.undo_put_back(picked, passing, splits);
  perform set_config('grimoire.reverting', '', true);
end;
$$;

-- 6. Who sees the log lines, and the logged commands -----------------------------------------------------------------

-- Everyone sees the weather and its changes.
create function private.log_audience_weather_rolls(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
revoke execute on function private.log_audience_weather_rolls(jsonb, jsonb) from public, anon, authenticated;

insert into public.logged_commands (name, level, gm_only) values
  ('weather.enter', 'simple', false),
  ('weather.correct', 'simple', true);
