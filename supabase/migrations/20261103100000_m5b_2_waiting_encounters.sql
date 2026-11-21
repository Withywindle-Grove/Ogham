-- M5b step 2 (docs/plans/m5b-2-encounters.md; ruled 2026-10-30, D11 and S2-4; docs/05 "Encounter waiting"): a hit
-- of an encounter check queues an Encounter waiting card on the GM console, one card per hit; the GM starts it when it
-- suits, views it, or dismisses it (undoable).
--   1. waiting_encounters: one row per queued hit. It names the check's result (check_results), which keeps the
--      check's name, when it fell, and (after the table pick, check.setRoll) the table, the row's range and its words,
--      so the card always reads the hit as it is now. `watch` is for a night hit's "Which watch?" (camp, m5b-4; empty
--      until then). `state`: waiting, started (Start in M5b opens the row's text for the GM; M6 turns it into a
--      fight) or dismissed.
--   2. What the app calls: queue_encounter (one per hit: a second queue of the same hit gives back the first),
--      start_encounter and dismiss_encounter (refused from an old copy; a repeat changes nothing). Each is an intent
--      with a request id.
--   3. The GM's alone: players never receive waiting encounters, nor their log lines (logged_commands gm_only; no
--      log audience function). A hit's own result stays as it was (players see it when revealed, as before).
--   4. Undo: undoing the queue marks the row undone (hard rule 4, never removed); undoing Start or Dismiss puts the
--      card back as waiting. Undoing the hit itself hides its card too (the card reads only hits not undone).
--      Logged commands: encounter.queue (Verbose: the hit is the Simple line), encounter.start and
--      encounter.dismiss (Simple).
-- Adds one table with its rules, triggers and policies, three functions and rows in logged_commands,
-- undoable_tables and undoable_makings. Replaces nothing; drops nothing; no rows are removed.

-- 1. The table ------------------------------------------------------------------------------------------------------

create table public.waiting_encounters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid references public.expeditions (id) on delete set null,
  check_result_id uuid not null references public.check_results (id) on delete cascade,
  -- A night hit's watch (camp, m5b-4); empty until then.
  watch text check (watch is null or length(watch) between 1 and 200),
  state text not null default 'waiting' check (state in ('waiting', 'started', 'dismissed')),
  started_at timestamptz,
  dismissed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index waiting_encounters_campaign on public.waiting_encounters (campaign_id, created_at desc);
-- One card per hit (an undone queue doesn't count).
create unique index waiting_encounters_one_per_hit on public.waiting_encounters (check_result_id) where not undone;

alter table public.waiting_encounters enable row level security;
grant select, insert, update on public.waiting_encounters to authenticated;
grant select, insert, update, delete on public.waiting_encounters to service_role;

-- The GM's alone: players never read them.
create policy "waiting encounters: the GM reads" on public.waiting_encounters
  for select to authenticated using (private.is_gm(campaign_id));
create policy "waiting encounters: the GM queues one" on public.waiting_encounters
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "waiting encounters: the GM starts or dismisses one" on public.waiting_encounters
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- 2. What the database decides, whatever a device sends ---------------------------------------------------------------

-- A queued card names a hit of its own campaign that isn't undone, and starts waiting, on the hit's expedition. A
-- change: only waiting → started or waiting → dismissed (each sets its time once); undo may put anything back.
create function private.waiting_encounter_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  hit public.check_results;
begin
  if tg_op = 'INSERT' then
    select * into hit from public.check_results r where r.id = new.check_result_id;
    if hit.id is null or hit.campaign_id <> new.campaign_id or hit.outcome <> 'hit' or hit.undone then
      raise exception 'Only a hit that stands can wait as an encounter.';
    end if;
    new.expedition_id := hit.expedition_id;
    new.watch := nullif(trim(coalesce(new.watch, '')), '');
    new.state := 'waiting';
    new.started_at := null;
    new.dismissed_at := null;
    new.undone := false;
    new.created_by := (select auth.uid());
  else
    new.campaign_id := old.campaign_id;
    new.expedition_id := old.expedition_id;
    new.check_result_id := old.check_result_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if not reverting then
      new.undone := old.undone;
      new.watch := old.watch;
      if new.state <> old.state then
        if old.state <> 'waiting' then
          raise exception 'That encounter was already %.', old.state;
        end if;
        if new.state = 'started' then
          new.started_at := now();
          new.dismissed_at := old.dismissed_at;
        else
          new.dismissed_at := now();
          new.started_at := old.started_at;
        end if;
      else
        new.started_at := old.started_at;
        new.dismissed_at := old.dismissed_at;
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.waiting_encounter_rules() from public, anon, authenticated;

create trigger check_copy_version before insert or update on public.waiting_encounters
  for each row execute function private.check_copy_version();
create trigger waiting_encounter_rules before insert or update on public.waiting_encounters
  for each row execute function private.waiting_encounter_rules();
create trigger refuse_when_retired before insert or update or delete on public.waiting_encounters
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or delete or update of state, undone on public.waiting_encounters
  for each row execute function private.log_change();

-- 3. What the app calls ---------------------------------------------------------------------------------------------

-- Queue a hit as an Encounter waiting card. A repeat gives back the card it made; a hit already waiting gives back
-- its card (one card per hit).
create function public.queue_encounter(result uuid) returns public.waiting_encounters
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('waiting_encounters');
  found public.waiting_encounters;
  hit public.check_results;
begin
  if made is not null then
    select * into found from public.waiting_encounters w where w.id = made;
    return found;
  end if;
  select * into hit from public.check_results r where r.id = result;
  if hit.id is null or not private.is_gm(hit.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select * into found from public.waiting_encounters w where w.check_result_id = result and not w.undone;
  if found.id is not null then
    return found;
  end if;
  insert into public.waiting_encounters (campaign_id, check_result_id) values (hit.campaign_id, result)
  returning * into found;
  return found;
end;
$$;

-- Start or dismiss a waiting card. Refused from an old copy, or once it's no longer waiting; a repeat changes nothing.
create function private.settle_encounter(encounter uuid, to_state text, seen_version integer) returns public.waiting_encounters
language plpgsql security invoker set search_path = '' as $$
declare
  found public.waiting_encounters;
begin
  select * into found from public.waiting_encounters w where w.id = encounter;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That encounter was undone.';
  end if;
  if found.state = to_state then
    return found;
  end if;
  update public.waiting_encounters w set state = to_state, version = coalesce(seen_version, w.version)
  where w.id = encounter
  returning * into found;
  return found;
end;
$$;
revoke execute on function private.settle_encounter(uuid, text, integer) from public, anon;
grant execute on function private.settle_encounter(uuid, text, integer) to authenticated, service_role;

create function public.start_encounter(encounter uuid, seen_version integer default null) returns public.waiting_encounters
language sql security invoker set search_path = '' as $$
  select * from private.settle_encounter(encounter, 'started', seen_version);
$$;

create function public.dismiss_encounter(encounter uuid, seen_version integer default null) returns public.waiting_encounters
language sql security invoker set search_path = '' as $$
  select * from private.settle_encounter(encounter, 'dismissed', seen_version);
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.queue_encounter(uuid)',
    'public.start_encounter(uuid, integer)',
    'public.dismiss_encounter(uuid, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 4. Undo and the logged commands -----------------------------------------------------------------------------------

insert into public.undoable_tables (name) values ('waiting_encounters');
insert into public.undoable_makings (name) values ('encounter.queue');

insert into public.logged_commands (name, level, gm_only) values
  ('encounter.queue', 'verbose', true),
  ('encounter.start', 'simple', true),
  ('encounter.dismiss', 'simple', true);
