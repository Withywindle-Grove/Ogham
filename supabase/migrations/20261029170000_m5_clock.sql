-- M5 step 5: the campaign clock, sessions and expeditions (docs/04 "Session", "Expedition", "Campaign clock";
-- docs/05 "Expeditions, time and light"; ruled 2026-10-29: D18–D23, D32, E36, and the afternoon ruling 1).
--   1. campaign_clocks: one seconds counter per campaign (D18), made by the database with each campaign. It moves
--      only when the GM moves it (D32): advance_clock (the mode's main advance, +N, Advance by…, Downtime's +1 day,
--      +1 week or a date) adds seconds; set_clock (Set time…, a correction) puts it at a time. Each is an intent with
--      a request id: a repeat changes nothing, and a save from an old copy (the version) is refused, as in
--      20261029160000_m5_intents.sql.
--   2. sessions: a simple record (D20). start_session (one tap) and end_session. Sessions mark play, never the clock.
--   3. expeditions: start_expedition (one tap plus a mode, D21) keeps where the clock was and who went (the
--      approved, active characters, a snapshot: E36), and puts the campaign into Adventure; end_expedition (D22, no
--      confirm) keeps how long it took and puts the campaign into Downtime; full_rest (D23) gives back the ability
--      uses the device names (those that come back on a rest or a day) for the characters who went.
--   4. Undo for each. Changes undo as before. Starting a session or an expedition makes a record, and undo can't
--      remove it (hard rule 4): it marks it undone instead (`undone`), and it stays in the log. The kinds of
--      action whose record undo marks undone are rows in public.undoable_makings. Also fixed: undo couldn't put
--      back a change to a row keyed by its character (character_play), which a full rest changes.
--   5. Who sees the log lines: everyone, for all three tables (players see the time). Logged-command rows.
--   6. The comparison function public.log_audience_check (for the M5 step 4 test only) moves out of the public
--      schema, so nothing can reach it through the API.
--
-- What it changes, plainly. Adds three tables, their rules and triggers, eight functions the app calls, a table of
-- undoable makings, and log rows. Replaces private.undo_body, private.undo_check_change and private.undo_put_back
-- (same behaviour, plus the two changes in 4). Moves one function to another schema. Drops nothing; no rows are
-- removed. Every existing campaign gets a clock at 0.

-- 1. The tables ------------------------------------------------------------------------------------------------------

create table public.campaign_clocks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.campaigns (id) on delete cascade,
  seconds bigint not null default 0 check (seconds >= 0),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  number integer not null check (number >= 1),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by uuid references public.profiles (id) on delete set null,
  ended_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_campaign on public.sessions (campaign_id);
-- One session running at a time; numbers count the sessions that weren't undone.
create unique index sessions_one_running on public.sessions (campaign_id) where ended_at is null and not undone;
create unique index sessions_number on public.sessions (campaign_id, number) where not undone;

create table public.expeditions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  -- The exploration mode's id (the setting rules' exploration.modes, or the fallbacks "dungeon" and "wilderness").
  mode text not null check (length(trim(mode)) between 1 and 200),
  -- On the campaign clock, in seconds.
  started_at bigint not null default 0 check (started_at >= 0),
  ended_at bigint check (ended_at is null or ended_at >= started_at),
  who_went uuid[] not null default '{}',
  -- Written at the end: { seconds } (how long it took), and { fullRest: true } after a full rest.
  summary jsonb check (summary is null or jsonb_typeof(summary) = 'object'),
  started_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expeditions_campaign on public.expeditions (campaign_id);
create unique index expeditions_one_under_way on public.expeditions (campaign_id) where ended_at is null and not undone;

alter table public.campaign_clocks enable row level security;
alter table public.sessions enable row level security;
alter table public.expeditions enable row level security;
grant select, update on public.campaign_clocks to authenticated;
grant select, insert, update on public.sessions, public.expeditions to authenticated;
grant select, insert, update, delete on public.campaign_clocks, public.sessions, public.expeditions to service_role;

-- Members read (players see the time, the session and the expedition); only the GM changes them.
create policy "campaign clocks: members read" on public.campaign_clocks
  for select to authenticated using (private.is_member(campaign_id));
create policy "campaign clocks: the GM moves it" on public.campaign_clocks
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));
create policy "sessions: members read" on public.sessions
  for select to authenticated using (private.is_member(campaign_id));
create policy "sessions: the GM starts one" on public.sessions
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "sessions: the GM changes one" on public.sessions
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));
create policy "expeditions: members read" on public.expeditions
  for select to authenticated using (private.is_member(campaign_id));
create policy "expeditions: the GM starts one" on public.expeditions
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "expeditions: the GM changes one" on public.expeditions
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- What the database decides, whatever a device sends.
create function private.clock_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A new session: the next number, started now by whoever starts it. A change: its number and start stay; ending
-- it stamps the time and who ended it. An undone session stays as it is.
create function private.session_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select coalesce(max(s.number), 0) + 1 into new.number from public.sessions s where s.campaign_id = new.campaign_id and not s.undone;
    new.started_at := now();
    new.started_by := (select auth.uid());
    new.ended_at := null;
    new.ended_by := null;
    new.undone := false;
    return new;
  end if;
  if old.undone then
    raise exception 'That session was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.number is distinct from old.number
    or new.started_at is distinct from old.started_at or new.started_by is distinct from old.started_by then
    raise exception 'That can''t be changed.';
  end if;
  if new.ended_at is not null and old.ended_at is null then
    new.ended_at := now();
    new.ended_by := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A new expedition: where the clock is now, the session running, and who went (the approved, active characters,
-- a snapshot: E36), all worked out here. A change: those stay; an undone expedition stays as it is.
create function private.expedition_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select c.seconds into new.started_at from public.campaign_clocks c where c.campaign_id = new.campaign_id;
    new.started_at := coalesce(new.started_at, 0);
    new.ended_at := null;
    new.summary := null;
    new.undone := false;
    new.started_by := (select auth.uid());
    select s.id into new.session_id from public.sessions s
    where s.campaign_id = new.campaign_id and s.ended_at is null and not s.undone;
    select coalesce(array_agg(a.id order by a.created_at, a.id), '{}') into new.who_went from public.actors a
    where a.campaign_id = new.campaign_id and a.kind = 'pc' and a.approval = 'approved' and a.status = 'active';
    return new;
  end if;
  if old.undone then
    raise exception 'That expedition was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.started_at is distinct from old.started_at
    or new.who_went is distinct from old.who_went or new.session_id is distinct from old.session_id
    or new.started_by is distinct from old.started_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.clock_rules() from public, anon, authenticated;
revoke execute on function private.session_rules() from public, anon, authenticated;
revoke execute on function private.expedition_rules() from public, anon, authenticated;

-- Every campaign has its clock, made with it (and now for the campaigns there are, at 0).
create function private.make_campaign_clock() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.campaign_clocks (campaign_id) values (new.id) on conflict (campaign_id) do nothing;
  return null;
end;
$$;
revoke execute on function private.make_campaign_clock() from public, anon, authenticated;
create trigger make_campaign_clock after insert on public.campaigns
  for each row execute function private.make_campaign_clock();
insert into public.campaign_clocks (campaign_id) select c.id from public.campaigns c on conflict (campaign_id) do nothing;

-- Triggers. Copy versions first (by name), as for inventory lines. The clock's making isn't logged (the database
-- makes it with the campaign); its changes are.
create trigger check_copy_version before insert or update on public.campaign_clocks
  for each row execute function private.check_copy_version();
create trigger clock_rules before update on public.campaign_clocks
  for each row execute function private.clock_rules();
create trigger refuse_when_retired before insert or update or delete on public.campaign_clocks
  for each row execute function private.refuse_when_retired();
create trigger log_change after update or delete on public.campaign_clocks
  for each row execute function private.log_change();

create trigger check_copy_version before insert or update on public.sessions
  for each row execute function private.check_copy_version();
create trigger session_rules before insert or update on public.sessions
  for each row execute function private.session_rules();
create trigger refuse_when_retired before insert or update or delete on public.sessions
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update or delete on public.sessions
  for each row execute function private.log_change();

create trigger check_copy_version before insert or update on public.expeditions
  for each row execute function private.check_copy_version();
create trigger expedition_rules before insert or update on public.expeditions
  for each row execute function private.expedition_rules();
create trigger refuse_when_retired before insert or update or delete on public.expeditions
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update or delete on public.expeditions
  for each row execute function private.log_change();

-- 2. What the app calls ---------------------------------------------------------------------------------------------

-- The row this request (its id and part) made in an earlier transaction, or null: a repeated start gives back what
-- the first one made.
create function private.made_by_request(target_table text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  tag jsonb := private.request_tag();
  made uuid;
begin
  begin
    select e.target_id into made from public.events e
    where e.request_id = (tag ->> 'requestId')::uuid and e.request_part = (tag ->> 'part')::integer
      and e.target_table = made_by_request.target_table and e.before is null
      and e.actor_user_id is not distinct from (select auth.uid()) and e.created_at < now()
    order by e.seq limit 1;
  exception when others then
    made := null;
  end;
  return made;
end;
$$;
revoke execute on function private.made_by_request(text) from public, anon;
grant execute on function private.made_by_request(text) to authenticated, service_role;

-- Moves the clock on (an intent: "advance 1 turn"). Refused when the clock changed since `seen_version` (if given);
-- a repeat changes nothing.
create function public.advance_clock(campaign uuid, by_seconds bigint, seen_version integer default null)
returns public.campaign_clocks
language plpgsql security invoker set search_path = '' as $$
declare
  clock public.campaign_clocks;
begin
  if by_seconds is null or by_seconds < 1 then
    raise exception 'Move the clock on by a whole amount above 0.';
  end if;
  update public.campaign_clocks c
  set seconds = c.seconds + by_seconds, version = coalesce(seen_version, c.version)
  where c.campaign_id = campaign
  returning * into clock;
  if clock.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return clock;
end;
$$;

-- Set time… (a correction): the clock at a time, forwards or back. Refused from an old copy; a repeat changes nothing.
create function public.set_clock(campaign uuid, to_seconds bigint, seen_version integer default null)
returns public.campaign_clocks
language plpgsql security invoker set search_path = '' as $$
declare
  clock public.campaign_clocks;
begin
  if to_seconds is null or to_seconds < 0 then
    raise exception 'The time can''t be before the clock started.';
  end if;
  update public.campaign_clocks c
  set seconds = to_seconds, version = coalesce(seen_version, c.version)
  where c.campaign_id = campaign
  returning * into clock;
  if clock.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return clock;
end;
$$;

-- Start session (one tap). Refused while one is running; a repeat gives back the session it started.
create function public.start_session(campaign uuid) returns public.sessions
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('sessions');
  session public.sessions;
begin
  if made is not null then
    select * into session from public.sessions s where s.id = made;
    return session;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if exists (select 1 from public.sessions s where s.campaign_id = campaign and s.ended_at is null and not s.undone) then
    raise exception 'A session is already running.';
  end if;
  insert into public.sessions (campaign_id, number) values (campaign, 1) returning * into session;
  return session;
end;
$$;

-- End session. Refused from an old copy, or when it has already ended (a repeat gives it back as it is).
create function public.end_session(session uuid, seen_version integer default null) returns public.sessions
language plpgsql security invoker set search_path = '' as $$
declare
  found public.sessions;
begin
  select * into found from public.sessions s where s.id = session;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That session was undone.';
  end if;
  if found.ended_at is not null then
    if private.repeated_request('sessions', session) then
      return found;
    end if;
    raise exception 'That session has already ended.';
  end if;
  update public.sessions s set ended_at = now(), version = coalesce(seen_version, s.version)
  where s.id = session returning * into found;
  return found;
end;
$$;

-- Start expedition (one tap plus a mode). Refused while one is under way; the campaign goes into Adventure. A repeat
-- gives back the expedition it started.
create function public.start_expedition(campaign uuid, mode_id text) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('expeditions');
  expedition public.expeditions;
begin
  if made is not null then
    select * into expedition from public.expeditions x where x.id = made;
    return expedition;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if exists (select 1 from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone) then
    raise exception 'An expedition is already under way. End it first.';
  end if;
  insert into public.expeditions (campaign_id, mode) values (campaign, trim(mode_id)) returning * into expedition;
  update public.campaigns c set mode = 'adventure' where c.id = campaign and c.mode <> 'adventure';
  return expedition;
end;
$$;

-- End expedition (no confirm: undo instead). Keeps how long it took; the campaign goes into Downtime. Refused from
-- an old copy, or when it has already ended (a repeat gives it back as it is).
create function public.end_expedition(expedition uuid, seen_version integer default null) returns public.expeditions
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
  update public.campaigns c set mode = 'downtime' where c.id = found.campaign_id and c.mode <> 'downtime';
  return found;
end;
$$;

-- Full rest, after the expedition ends (D23): for each character who went, the ability uses named in `refills`
-- ({ "<character id>": ["<ability name>", …] }: those that come back on a rest or a day, worked out by the device
-- from the setting rules) are given back. Once per expedition; a repeat changes nothing.
create function public.full_rest(expedition uuid, refills jsonb) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
declare
  found public.expeditions;
  who text;
  names jsonb;
  abilities text[];
begin
  select * into found from public.expeditions x where x.id = expedition;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That expedition was undone.';
  end if;
  if found.ended_at is null then
    raise exception 'End the expedition first.';
  end if;
  if coalesce(found.summary ->> 'fullRest', 'false') = 'true' then
    if private.repeated_request('expeditions', expedition) then
      return found;
    end if;
    raise exception 'The party has had its full rest.';
  end if;
  for who, names in
    select r.key, r.value from jsonb_each(case when jsonb_typeof(refills) = 'object' then refills else '{}'::jsonb end) r
    where r.key ~ '^[0-9a-fA-F-]{36}$' and jsonb_typeof(r.value) = 'array'
  loop
    if not (who::uuid = any (found.who_went)) then
      continue;
    end if;
    select coalesce(array_agg(n.value), '{}') into abilities from jsonb_array_elements_text(names) n;
    if cardinality(abilities) = 0 then
      continue;
    end if;
    update public.character_play p set uses_spent = p.uses_spent - abilities
    where p.actor_id = who::uuid and p.uses_spent ?| abilities;
  end loop;
  update public.expeditions x set summary = coalesce(x.summary, '{}'::jsonb) || jsonb_build_object('fullRest', true)
  where x.id = expedition returning * into found;
  return found;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.advance_clock(uuid, bigint, integer)', 'public.set_clock(uuid, bigint, integer)', 'public.start_session(uuid)',
    'public.end_session(uuid, integer)', 'public.start_expedition(uuid, text)', 'public.end_expedition(uuid, integer)',
    'public.full_rest(uuid, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 3. Undo ------------------------------------------------------------------------------------------------------------

-- The actions whose made record undo marks undone (it can't remove it): starting a session or an expedition.
create table public.undoable_makings (name text primary key);
alter table public.undoable_makings enable row level security;
grant select on public.undoable_makings to authenticated;
grant select, insert, update, delete on public.undoable_makings to service_role;
create policy "undoable makings: everyone signed in reads" on public.undoable_makings
  for select to authenticated using (true);
insert into public.undoable_makings (name) values ('session.start'), ('expedition.start');

insert into public.undoable_tables (name) values ('campaign_clocks'), ('sessions'), ('expeditions');

-- The column a logged row is found by: its id, or its character's (tables kept one row per character).
create function private.undo_id_column(target_table text) returns text
language sql stable set search_path = '' as $$
  select case when exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = to_regclass(format('public.%I', target_table)) and a.attname = 'id' and not a.attisdropped
  ) then 'id' else 'actor_id' end;
$$;
revoke execute on function private.undo_id_column(text) from public, anon;
grant execute on function private.undo_id_column(text) to authenticated, service_role;

-- A record the action made (a session or an expedition started): it can be marked undone while it's as the action
-- left it (not ended, not undone already).
create function private.undo_check_made(change public.events) returns void
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
end;
$$;
revoke execute on function private.undo_check_made(public.events) from public, anon;
grant execute on function private.undo_check_made(public.events) to authenticated, service_role;

-- The made records are marked undone, each linked to the event that made it.
create function private.undo_mark_made(picked public.events, made uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  change public.events;
  changed_rows integer;
begin
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id and e.before is null and e.after is not null and e.target_id = any (made)
      and (e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id))
  loop
    perform set_config('grimoire.reverting', change.id::text, true);
    execute format('update public.%I t set undone = true where t.id = $1', change.target_table) using change.target_id;
    get diagnostics changed_rows = row_count;
    if changed_rows <> 1 then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
  end loop;
end;
$$;
revoke execute on function private.undo_mark_made(public.events, uuid[]) from public, anon;
grant execute on function private.undo_mark_made(public.events, uuid[]) to authenticated, service_role;

-- As in 20261028091000_m4b_undo_split_up.sql, but the row is found by private.undo_id_column (character_play has
-- no id of its own).
create or replace function private.undo_check_change(picked public.events, change public.events, as_gm boolean, is_drop boolean, dropped uuid[])
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  moved_line boolean := picked.type = 'inventory.move' and change.target_table = 'inventory_lines';
  current_row jsonb;
  key text;
  id_column text;
begin
  if change.before is null
    or (change.after is null and not (is_drop and change.target_table in ('inventory_lines', 'inventory_line_secrets'))) then
    raise exception 'Making or deleting things can''t be undone.';
  end if;
  if not exists (select 1 from public.undoable_tables u where u.name = change.target_table) then
    raise exception 'That can''t be undone.';
  end if;
  if exists (select 1 from public.events r where r.reverts_event_id = change.id) then
    raise exception 'That was already undone.';
  end if;
  id_column := private.undo_id_column(change.target_table);
  if moved_line then
    -- A moved line may now be on another character, which the giver can read but not lock; private.unmove_line
    -- locks it and checks it again when it puts it back.
    select to_jsonb(t) into current_row from public.inventory_lines t where t.id = change.target_id;
  else
    -- Locked until the undo finishes, so nothing slips in between the check and the write.
    execute format('select to_jsonb(t) from public.%I t where t.%I = $1 for update', change.target_table, id_column)
      into current_row using change.target_id;
  end if;
  if change.after is null then
    perform private.undo_check_drop(change, dropped, current_row);
    return;
  end if;
  -- A change to a line this action then removed (whoever it went to): the line comes back as the removal left it,
  -- so nothing can have changed it since; the change is put back after.
  if change.target_table = 'inventory_lines' and change.target_id = any (dropped) then
    return;
  end if;
  if moved_line then
    perform private.undo_check_move(change, current_row);
    return;
  end if;
  if current_row is null then
    if as_gm then
      raise exception 'That''s changed since. Undo the later change first.';
    end if;
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  for key in select jsonb_object_keys(change.after) loop
    if (current_row -> key) is distinct from (change.after -> key) then
      raise exception 'That''s changed since. Undo the later change first.';
    end if;
  end loop;
end;
$$;

-- As in 20261028091000_m4b_undo_split_up.sql, but the row is found by private.undo_id_column, and a record the
-- action made (marked undone by private.undo_mark_made) has nothing to put back.
create or replace function private.undo_put_back(picked public.events, passing uuid[], splits uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  change public.events;
  assignments text;
  id_column text;
  changed_rows integer;
begin
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id
      and e.after is not null
      and e.before is not null
      and not (e.target_table in ('inventory_lines', 'inventory_line_secrets') and e.target_id = any (passing))
      and not (e.target_table in ('inventory_lines', 'inventory_line_secrets') and e.target_id = any (splits))
      and (
        e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id)
      )
    order by e.seq desc
  loop
    id_column := private.undo_id_column(change.target_table);
    select string_agg(format('%I = r.%I', k, k), ', ') into assignments from jsonb_object_keys(change.before) k;
    perform set_config('grimoire.reverting', change.id::text, true);
    if picked.type = 'inventory.move' and change.target_table = 'inventory_lines' then
      perform private.unmove_line(change.target_id, change.id);
      continue;
    end if;
    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.%I = $2',
      change.target_table, assignments, change.target_table, id_column
    ) using change.before, change.target_id;
    get diagnostics changed_rows = row_count;
    if changed_rows <> 1 then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
  end loop;
end;
$$;

-- As in 20261028091000_m4b_undo_split_up.sql, plus the records the action made (public.undoable_makings): checked
-- by private.undo_check_made and marked undone by private.undo_mark_made.
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
  -- A session or an expedition the action started: marked undone, never removed (M5 step 5).
  select coalesce(array_agg(e.target_id), '{}') into made from public.events e
  where exists (select 1 from public.undoable_makings m where m.name = picked.type)
    and e.campaign_id = picked.campaign_id and e.target_table in ('sessions', 'expeditions')
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
    if change.target_table in ('sessions', 'expeditions') and change.target_id = any (made) and change.before is null then
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

-- 4. Who sees the log lines, and the logged commands ------------------------------------------------------------------

create function private.log_audience_campaign_clocks(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
create function private.log_audience_sessions(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
create function private.log_audience_expeditions(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
revoke execute on function private.log_audience_campaign_clocks(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function private.log_audience_sessions(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function private.log_audience_expeditions(jsonb, jsonb) from public, anon, authenticated;

insert into public.logged_commands (name, level, gm_only) values
  ('session.start', 'simple', true),
  ('session.end', 'simple', true),
  ('expedition.start', 'simple', true),
  ('expedition.end', 'simple', true),
  ('expedition.fullRest', 'simple', true),
  ('time.advance', 'verbose', true),
  ('time.advanceBy', 'simple', true),
  ('time.set', 'simple', true),
  ('time.downtime', 'simple', true);

-- 5. The M5 step 4 comparison, out of the public schema (kept, not reachable through the API) -----------------------

alter function public.log_audience_check(text, jsonb, jsonb) set schema private;
revoke execute on function private.log_audience_check(text, jsonb, jsonb) from public, anon, authenticated, service_role;
