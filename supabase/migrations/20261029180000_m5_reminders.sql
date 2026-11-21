-- M5 step 6: the GM's reminders and the results of checks (docs/04 "TimeTrigger", "Event"; docs/05 "Expeditions,
-- time and light", "Explore, Encounter and Fight"; docs/03: reminders the GM makes and changes, players see the
-- public ones; checks the GM records, players see results only when the campaign next goes into Downtime; ruled
-- 2026-10-18 and 2026-10-29, D30–D31).
--   1. reminders: the GM's own, made any time (a reminder, or a check with Hit / Miss, maybe an Encounter check),
--      repeating on the campaign clock from when they were made. Public ones are read by every member; the GM's
--      own never reach a player's device (hidden means hidden).
--   2. check_results: a Hit or a Miss, logged at once, then (after a hit) the table, the roll and the row read. Only
--      the GM reads them until the campaign next goes into Downtime; then they're revealed to the players, and so
--      are their log lines (events.reveal_at = 'downtime', which existed but wasn't used until now).
--   3. Four functions the app calls (add_reminder, edit_reminder, record_check, set_check_roll), each an intent with
--      a request id: a repeat changes nothing, and a change from an old copy (the version) is refused, as in
--      20261029160000_m5_intents.sql.
--   4. Undo: a made reminder or result is marked undone, never removed (hard rule 4), like a started session; a
--      change puts back what it changed. A made record can't be undone while a later change to it stands.
--   5. Who sees the log lines (one function per table), when they're revealed (one more small function per table,
--      private.log_reveal_<table>, found by name like the audience), and the logged-command rows.
--
-- What it changes, plainly. Adds two tables with their rules and triggers, four functions the app calls, a trigger
-- on campaigns that reveals check results when the campaign goes into Downtime, and rows in logged_commands,
-- undoable_makings and undoable_tables. Replaces private.log_change (the same, plus reveal_at from the table's own
-- function), private.undo_body and private.undo_check_made (the same, plus the two new tables and the later-change
-- check), and the events reading rule "events: read what you may see" (the same, plus: a member also reads a
-- line kept for Downtime once the campaign has gone into Downtime after it). Drops nothing; no rows are removed.

-- 1. The tables ------------------------------------------------------------------------------------------------------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 200),
  kind text not null default 'reminder' check (kind in ('reminder', 'check')),
  encounter_check boolean not null default false,
  every_value integer not null check (every_value between 1 and 100000),
  every_unit text not null check (length(trim(every_unit)) between 1 and 40),
  -- When it was set going, on the campaign clock (seconds): when it was made, or started again.
  anchor bigint not null default 0 check (anchor >= 0),
  active boolean not null default true,
  is_public boolean not null default false,
  -- A check's chance ({ die, on }), when the GM gave one.
  chance jsonb check (chance is null or jsonb_typeof(chance) = 'object'),
  -- The table a hit rolls (a table entry's id), when the GM named one.
  table_id text check (table_id is null or length(table_id) <= 200),
  note text check (note is null or length(note) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reminders_campaign on public.reminders (campaign_id);

create table public.check_results (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid references public.expeditions (id) on delete set null,
  -- Which check: "check:mode:<check id>" for a mode's, "gm:<reminder id>" for the GM's own.
  check_key text not null check (length(check_key) between 1 and 300),
  name text not null check (length(trim(name)) between 1 and 200),
  source text not null default 'mode' check (source in ('mode', 'location', 'gm')),
  outcome text not null check (outcome in ('hit', 'miss')),
  -- Where the clock was (seconds).
  at_seconds bigint not null default 0 check (at_seconds >= 0),
  -- The modifiers it had, each { label, add, source } (the GM's "+ Modifier" among them).
  modifiers jsonb not null default '[]' check (jsonb_typeof(modifiers) = 'array'),
  note text check (note is null or length(note) <= 500),
  -- After a hit: the table rolled, what the dice showed, and the row it read.
  table_id text check (table_id is null or length(table_id) <= 200),
  roll text check (roll is null or length(roll) <= 20),
  row_text text check (row_text is null or length(row_text) <= 1000),
  -- Players read it once the campaign has gone into Downtime after it was made.
  revealed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index check_results_campaign on public.check_results (campaign_id, created_at desc);

alter table public.reminders enable row level security;
alter table public.check_results enable row level security;
grant select, insert, update on public.reminders, public.check_results to authenticated;
grant select, insert, update, delete on public.reminders, public.check_results to service_role;

-- The GM reads and writes them; members read the public reminders and the revealed results, nothing else.
create policy "reminders: the GM reads, members the public ones" on public.reminders
  for select to authenticated
  using (private.is_gm(campaign_id) or (private.is_member(campaign_id) and is_public and not undone));
create policy "reminders: the GM makes one" on public.reminders
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "reminders: the GM changes one" on public.reminders
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));
create policy "check results: the GM reads, members once revealed" on public.check_results
  for select to authenticated
  using (private.is_gm(campaign_id) or (private.is_member(campaign_id) and revealed and not undone));
create policy "check results: the GM records one" on public.check_results
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "check results: the GM changes one" on public.check_results
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- What the database decides, whatever a device sends.
-- A new reminder starts counting from the clock now, made by whoever makes it. A change: its campaign and maker
-- stay; changing how often, or starting it again, sets it going from now (an undo puts back what was).
create function private.reminder_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  now_at bigint;
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  select c.seconds into now_at from public.campaign_clocks c where c.campaign_id = new.campaign_id;
  new.label := trim(new.label);
  new.every_unit := trim(new.every_unit);
  new.table_id := nullif(trim(coalesce(new.table_id, '')), '');
  new.note := nullif(trim(coalesce(new.note, '')), '');
  if new.kind <> 'check' then
    new.encounter_check := false;
    new.chance := null;
    new.table_id := null;
  end if;
  if new.chance is not null and jsonb_typeof(new.chance -> 'on') is distinct from 'array' then
    raise exception 'A chance needs the faces it hits on.';
  end if;
  if tg_op = 'INSERT' then
    new.anchor := coalesce(now_at, 0);
    new.active := true;
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone and new.undone then
    raise exception 'That reminder was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  if not reverting then
    if new.anchor is distinct from old.anchor then
      new.anchor := old.anchor;
    end if;
    if (new.active and not old.active) or new.every_value is distinct from old.every_value or new.every_unit is distinct from old.every_unit then
      new.anchor := coalesce(now_at, old.anchor);
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A new result: where the clock is, the expedition under way, who recorded it; nothing rolled yet, not revealed.
-- A change: only what a hit rolled, the note, and (by undo) undone; revealed only when the campaign goes into
-- Downtime (private.reveal_check_results).
create function private.check_result_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select c.seconds into new.at_seconds from public.campaign_clocks c where c.campaign_id = new.campaign_id;
    new.at_seconds := coalesce(new.at_seconds, 0);
    select x.id into new.expedition_id from public.expeditions x
    where x.campaign_id = new.campaign_id and x.ended_at is null and not x.undone;
    new.created_by := (select auth.uid());
    new.name := trim(new.name);
    new.note := nullif(trim(coalesce(new.note, '')), '');
    new.table_id := null;
    new.roll := null;
    new.row_text := null;
    new.revealed := false;
    new.undone := false;
    return new;
  end if;
  if old.undone and new.undone then
    raise exception 'That result was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.check_key is distinct from old.check_key or new.name is distinct from old.name
    or new.source is distinct from old.source or new.outcome is distinct from old.outcome
    or new.at_seconds is distinct from old.at_seconds or new.modifiers is distinct from old.modifiers
    or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  if new.revealed is distinct from old.revealed and current_setting('grimoire.revealing', true) is distinct from 'on' then
    raise exception 'Check results are revealed when the campaign goes into Downtime.';
  end if;
  if (new.table_id is not null or new.roll is not null) and new.outcome <> 'hit' then
    raise exception 'Only a hit rolls a table.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.reminder_rules() from public, anon, authenticated;
revoke execute on function private.check_result_rules() from public, anon, authenticated;

-- Going into Downtime reveals the campaign's check results so far (05, "Revealed this downtime").
create function private.reveal_check_results() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('grimoire.revealing', 'on', true);
  update public.check_results r set revealed = true where r.campaign_id = new.id and not r.revealed;
  perform set_config('grimoire.revealing', '', true);
  return null;
end;
$$;
revoke execute on function private.reveal_check_results() from public, anon, authenticated;
create trigger reveal_check_results after update of mode on public.campaigns
  for each row when (new.mode = 'downtime' and old.mode is distinct from new.mode)
  execute function private.reveal_check_results();

-- Triggers. Copy versions first (by name). A result's revealing isn't a change anyone made: only the columns a
-- command changes are logged.
create trigger check_copy_version before insert or update on public.reminders
  for each row execute function private.check_copy_version();
create trigger reminder_rules before insert or update on public.reminders
  for each row execute function private.reminder_rules();
create trigger refuse_when_retired before insert or update or delete on public.reminders
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update or delete on public.reminders
  for each row execute function private.log_change();

create trigger check_copy_version before insert or update on public.check_results
  for each row execute function private.check_copy_version();
create trigger check_result_rules before insert or update on public.check_results
  for each row execute function private.check_result_rules();
create trigger refuse_when_retired before insert or update or delete on public.check_results
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or delete or update of table_id, roll, row_text, note, undone on public.check_results
  for each row execute function private.log_change();

-- 2. What the app calls ---------------------------------------------------------------------------------------------

-- A new reminder (the GM, any time). A repeat gives back the reminder it made.
create function public.add_reminder(
  campaign uuid, label text, kind text, encounter_check boolean, every_value integer, every_unit text,
  is_public boolean, chance jsonb default null, table_id text default null, note text default null
) returns public.reminders
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('reminders');
  found public.reminders;
begin
  if made is not null then
    select * into found from public.reminders r where r.id = made;
    return found;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if label is null or length(trim(label)) = 0 then
    raise exception 'Give the reminder a few words.';
  end if;
  if every_value is null or every_value < 1 then
    raise exception 'How often: a whole number above 0.';
  end if;
  insert into public.reminders (campaign_id, label, kind, encounter_check, every_value, every_unit, is_public, chance, table_id, note)
  values (campaign, label, coalesce(kind, 'reminder'), coalesce(encounter_check, false), every_value, coalesce(every_unit, 'turn'),
    coalesce(is_public, false), case when jsonb_typeof(chance) = 'object' then chance end, table_id, note)
  returning * into found;
  return found;
end;
$$;

-- A change to a reminder: the fields given in `changes` (label, kind, encounter_check, every_value, every_unit,
-- is_public, chance, table_id, note, active). Refused from an old copy; a repeat changes nothing.
create function public.edit_reminder(reminder uuid, changes jsonb, seen_version integer default null) returns public.reminders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.reminders;
begin
  select * into found from public.reminders r where r.id = reminder;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That reminder was undone.';
  end if;
  if jsonb_typeof(changes) is distinct from 'object' then
    raise exception 'Nothing to change.';
  end if;
  update public.reminders r set
    label = coalesce(changes ->> 'label', r.label),
    kind = coalesce(changes ->> 'kind', r.kind),
    encounter_check = coalesce((changes ->> 'encounter_check')::boolean, r.encounter_check),
    every_value = coalesce((changes ->> 'every_value')::integer, r.every_value),
    every_unit = coalesce(changes ->> 'every_unit', r.every_unit),
    is_public = coalesce((changes ->> 'is_public')::boolean, r.is_public),
    chance = case when changes ? 'chance' then (case when jsonb_typeof(changes -> 'chance') = 'object' then changes -> 'chance' end) else r.chance end,
    table_id = case when changes ? 'table_id' then changes ->> 'table_id' else r.table_id end,
    note = case when changes ? 'note' then changes ->> 'note' else r.note end,
    active = coalesce((changes ->> 'active')::boolean, r.active),
    version = coalesce(seen_version, r.version)
  where r.id = reminder
  returning * into found;
  return found;
end;
$$;

-- Hit or Miss (the GM). A repeat gives back the result it made.
create function public.record_check(
  campaign uuid, check_key text, name text, source text, outcome text, modifiers jsonb default '[]', note text default null
) returns public.check_results
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('check_results');
  found public.check_results;
begin
  if made is not null then
    select * into found from public.check_results r where r.id = made;
    return found;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if outcome is null or outcome not in ('hit', 'miss') then
    raise exception 'A check is a hit or a miss.';
  end if;
  insert into public.check_results (campaign_id, check_key, name, source, outcome, modifiers, note)
  values (campaign, check_key, name, coalesce(source, 'mode'), outcome,
    case when jsonb_typeof(modifiers) = 'array' then modifiers else '[]'::jsonb end, note)
  returning * into found;
  return found;
end;
$$;

-- After a hit: the table rolled, what the dice showed and the row read. Refused from an old copy; a repeat changes
-- nothing.
create function public.set_check_roll(result uuid, table_id text, roll text, row_text text, seen_version integer default null)
returns public.check_results
language plpgsql security invoker set search_path = '' as $$
declare
  found public.check_results;
begin
  select * into found from public.check_results r where r.id = result;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That result was undone.';
  end if;
  update public.check_results r set
    table_id = nullif(trim(coalesce(set_check_roll.table_id, '')), ''),
    roll = nullif(trim(coalesce(set_check_roll.roll, '')), ''),
    row_text = nullif(trim(coalesce(set_check_roll.row_text, '')), ''),
    version = coalesce(seen_version, r.version)
  where r.id = result
  returning * into found;
  return found;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.add_reminder(uuid, text, text, boolean, integer, text, boolean, jsonb, text, text)',
    'public.edit_reminder(uuid, jsonb, integer)',
    'public.record_check(uuid, text, text, text, text, jsonb, text)',
    'public.set_check_roll(uuid, text, text, text, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 3. Undo -------------------------------------------------------------------------------------------------------------

insert into public.undoable_makings (name) values ('reminder.add'), ('check.record');
insert into public.undoable_tables (name) values ('reminders'), ('check_results');

-- As in 20261029170000_m5_clock.sql, plus: a made record with a later change still standing (a reminder edited, a
-- hit's roll entered) can't be marked undone until that change is undone.
create or replace function private.undo_check_made(change public.events) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  current_row jsonb;
begin
  if exists (select 1 from public.events r where r.reverts_event_id = change.id) then
    raise exception 'That was already undone.';
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1 for update', change.target_table)
    into current_row using change.target_id;
  if current_row is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if (current_row ->> 'undone')::boolean then
    raise exception 'That was already undone.';
  end if;
  if current_row ->> 'ended_at' is not null then
    raise exception 'That''s changed since. Undo the later change first.';
  end if;
  if exists (
    select 1 from public.events l
    where l.campaign_id = change.campaign_id and l.target_table = change.target_table and l.target_id = change.target_id
      and l.seq > change.seq and l.reverts_event_id is null
      and (change.request_id is null or l.request_id is distinct from change.request_id)
      and not exists (select 1 from public.events r where r.reverts_event_id = l.id)
  ) then
    raise exception 'That''s changed since. Undo the later change first.';
  end if;
end;
$$;

-- As in 20261029170000_m5_clock.sql, but the made records may also be reminders and check results.
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
  -- A session, an expedition, a reminder or a check result the action made: marked undone, never removed.
  select coalesce(array_agg(e.target_id), '{}') into made from public.events e
  where exists (select 1 from public.undoable_makings m where m.name = picked.type)
    and e.campaign_id = picked.campaign_id and e.target_table in ('sessions', 'expeditions', 'reminders', 'check_results')
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
    if change.target_table in ('sessions', 'expeditions', 'reminders', 'check_results') and change.target_id = any (made) and change.before is null then
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

-- 4. Who sees the log lines, and when -------------------------------------------------------------------------------

-- A reminder's lines: everyone's while it's public before and after; the GM's alone otherwise.
create function private.log_audience_reminders(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable set search_path = '' as $$
begin
  owner := null;
  if (old_row is null or coalesce((old_row ->> 'is_public')::boolean, false))
    and (new_row is null or coalesce((new_row ->> 'is_public')::boolean, false)) then
    who_sees := 'all';
  else
    who_sees := 'gm';
  end if;
end;
$$;
-- A check result's lines are for everyone, kept for Downtime (private.log_reveal_check_results).
create function private.log_audience_check_results(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
create function private.log_reveal_check_results(old_row jsonb, new_row jsonb) returns text
language sql stable set search_path = '' as $$ select 'downtime'::text; $$;
revoke execute on function private.log_audience_reminders(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function private.log_audience_check_results(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function private.log_reveal_check_results(jsonb, jsonb) from public, anon, authenticated;

-- When a table's log line reaches players: its own function (private.log_reveal_<table>), or now.
create function private.log_reveal(table_name text, old_row jsonb, new_row jsonb) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  reveal text;
begin
  if to_regprocedure(format('private.%I(jsonb, jsonb)', 'log_reveal_' || table_name)) is null then
    return 'now';
  end if;
  execute format('select private.%I($1, $2)', 'log_reveal_' || table_name) into reveal using old_row, new_row;
  return case when reveal = 'downtime' then 'downtime' else 'now' end;
end;
$$;
revoke execute on function private.log_reveal(text, jsonb, jsonb) from public, anon, authenticated;

-- Whether the campaign has gone into Downtime since a log line (its seq) was written.
create function private.revealed_by_downtime(campaign uuid, at_seq bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events d
    where d.campaign_id = campaign and d.seq > at_seq and d.target_table = 'campaigns' and d.after ->> 'mode' = 'downtime'
  );
$$;
revoke execute on function private.revealed_by_downtime(uuid, bigint) from public, anon;
grant execute on function private.revealed_by_downtime(uuid, bigint) to authenticated, service_role;

-- As in 20261026130000_m4b_draft.sql, plus: a line kept for Downtime is read by members once the campaign has gone
-- into Downtime after it (and only then; the GM always reads it).
drop policy "events: read what you may see" on public.events;
create policy "events: read what you may see" on public.events
  for select to authenticated
  using (
    (private.is_gm(campaign_id) and not private.is_others_draft_event(target_table, target_id, coalesce(after, before)))
    or (
      private.is_member(campaign_id)
      and (reveal_at = 'now' or private.revealed_by_downtime(campaign_id, seq))
      and (audience = 'all' or (audience = 'owner' and owner_user_id = (select auth.uid())))
    )
  );

-- The log: as in 20261029160000_m5_intents.sql, plus when the line reaches players (the table's own function).
create or replace function private.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'version' end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'version' end;
  this_row jsonb := coalesce(new_row, old_row);
  campaign uuid;
  before_values jsonb := old_row;
  after_values jsonb := new_row;
  key text;
  tag jsonb;
  event_type text;
  event_level text;
  command_gm_only boolean;
  is_fiat boolean := false;
  why text;
  request uuid;
  part integer;
  who_sees text;
  owner uuid;
  reveal text;
  reverting uuid := nullif(current_setting('grimoire.reverting', true), '')::uuid;
begin
  -- Which campaign it belongs to.
  if tg_table_name = 'campaigns' then
    campaign := (this_row ->> 'id')::uuid;
  elsif tg_table_name = 'actor_secrets' then
    select a.campaign_id into campaign from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
  elsif tg_table_name in ('library_entries', 'library_entry_secrets') then
    -- Only a campaign's own homebrew is logged (in that campaign); library packs belong to no campaign.
    select p.campaign_id into campaign from public.packs p where p.id = (this_row ->> 'pack_id')::uuid;
  else
    campaign := (this_row ->> 'campaign_id')::uuid;
  end if;
  -- A campaign being deleted takes its events with it; don't log the rows that go with it.
  if campaign is null or not exists (select 1 from public.campaigns c where c.id = campaign) then
    return null;
  end if;

  -- For a change, keep only the values that changed; a change that changes nothing isn't logged.
  if tg_op = 'UPDATE' then
    before_values := '{}'::jsonb;
    after_values := '{}'::jsonb;
    for key in select jsonb_object_keys(new_row) loop
      if key <> 'updated_at' and (old_row -> key) is distinct from (new_row -> key) then
        before_values := before_values || jsonb_build_object(key, old_row -> key);
        after_values := after_values || jsonb_build_object(key, new_row -> key);
      end if;
    end loop;
    if after_values = '{}'::jsonb then
      return null;
    end if;
  end if;

  -- Who may see it: like the rows themselves (the table's own function); and when (now, or at Downtime).
  select a.who_sees, a.owner into who_sees, owner from private.log_audience(tg_table_name, old_row, new_row) a;
  reveal := private.log_reveal(tg_table_name, old_row, new_row);

  -- The command's tag, if the request has one. A broken tag just means a plain name.
  tag := private.request_tag();
  begin
    request := (tag ->> 'requestId')::uuid;
    part := (tag ->> 'part')::integer;
  exception when others then
    request := null;
    part := null;
  end;
  -- The database names the entry: only the commands in public.logged_commands count (GM-only ones only for
  -- the GM), at the log level listed there. Anything else gets a plain name like "actors.update".
  event_type := tag ->> 'type';
  select c.level, c.gm_only into event_level, command_gm_only from public.logged_commands c where c.name = event_type;
  if event_level is null
    or (command_gm_only and not private.is_gm(campaign))
    -- Setting rules leaving the campaign because their owner deleted them: nothing else carries that name.
    or (event_type = 'library.delete' and not (tg_table_name = 'campaign_packs' and tg_op = 'DELETE')) then
    event_type := tg_table_name || '.' || lower(tg_op);
    event_level := 'verbose';
  end if;
  -- Only the GM's changes can be fiat; a player's claim is ignored.
  if coalesce(tag ->> 'fiat', 'false') = 'true' and private.is_gm(campaign) then
    is_fiat := true;
    why := nullif(left(trim(tag ->> 'reason'), 500), '');
  end if;

  -- An undo (undo_request) links to the event it reverses, at that event's log level.
  if reverting is not null then
    select e.level into event_level from public.events e where e.id = reverting;
  end if;

  insert into public.events (
    campaign_id, type, level, actor_user_id, target_table, target_id, before, after,
    fiat, reason, audience, owner_user_id, reveal_at, request_id, request_part, reverts_event_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, reveal, request, part, reverting
  );
  return null;
end;
$$;

-- 5. The logged commands -----------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('reminder.add', 'simple', true),
  ('reminder.edit', 'simple', true),
  ('check.record', 'simple', true),
  ('check.setRoll', 'simple', true);
