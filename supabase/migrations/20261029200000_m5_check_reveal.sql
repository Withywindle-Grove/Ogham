-- M5 step 6, fix forward with the rulings of 2026-10-29 (night), items 3 and 5:
--   * checks[].secret (default true): a secret result stays hidden from players until the campaign next goes into
--     Downtime (as built); an open one (secret false) shows to them at once.
--   * A result recorded while the campaign is already in Downtime shows to them at once.
--   * The GM can reveal one secret result by hand (reveal_check, logged, undoable).
--   * Once a result is revealed (open, in Downtime, by hand, or at the next Downtime), all its log lines and the
--     notes on them reach players, not just the ones written before a Downtime.
--
-- What it changes, plainly. Adds two columns to check_results (secret, default true, and revealed_by_hand, default
-- false; existing results stay as they are), one function the app calls (reveal_check) and one small function.
-- Replaces record_check (it drops the seven-argument version and makes it again with an eighth, secret; callers that
-- pass seven still work), private.check_result_rules, private.log_reveal_check_results, private.event_revealed, the
-- check results' log trigger (it now also logs revealed_by_hand) and the rule "events: read what you may see" (the
-- same, plus a revealed result's lines). Drops no table, column or row.

alter table public.check_results add column secret boolean not null default true;
alter table public.check_results add column revealed_by_hand boolean not null default false;

-- Whether a result has reached players.
create function private.check_result_revealed(result uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select r.revealed and not r.undone from public.check_results r where r.id = result), false);
$$;
revoke execute on function private.check_result_revealed(uuid) from public, anon;
grant execute on function private.check_result_revealed(uuid) to authenticated, service_role;

-- As in 20261029190000_m5_note_reveal.sql, plus: a revealed check result's lines.
create or replace function private.event_revealed(event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select e.reveal_at = 'now' or private.revealed_by_downtime(e.campaign_id, e.seq)
      or (e.target_table = 'check_results' and private.check_result_revealed(e.target_id))
    from public.events e where e.id = event
  ), true);
$$;

-- As in 20261029180000_m5_reminders.sql, plus: a revealed check result's lines (open, in Downtime, by hand).
drop policy "events: read what you may see" on public.events;
create policy "events: read what you may see" on public.events
  for select to authenticated
  using (
    (private.is_gm(campaign_id) and not private.is_others_draft_event(target_table, target_id, coalesce(after, before)))
    or (
      private.is_member(campaign_id)
      and (
        reveal_at = 'now'
        or private.revealed_by_downtime(campaign_id, seq)
        or (target_table = 'check_results' and private.check_result_revealed(target_id))
      )
      and (audience = 'all' or (audience = 'owner' and owner_user_id = (select auth.uid())))
    )
  );

-- A result's lines reach players now when it's revealed already; otherwise at Downtime (or when revealed).
create or replace function private.log_reveal_check_results(old_row jsonb, new_row jsonb) returns text
language sql stable set search_path = '' as $$
  select case when coalesce((coalesce(new_row, old_row) ->> 'revealed')::boolean, false) then 'now' else 'downtime' end;
$$;

-- As in 20261029180000_m5_reminders.sql, plus: an open result, or one recorded in Downtime, is revealed at once;
-- the GM's reveal by hand (and its undo) may change revealed.
create or replace function private.check_result_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
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
    new.undone := false;
    new.revealed_by_hand := false;
    new.revealed := not new.secret or exists (select 1 from public.campaigns c where c.id = new.campaign_id and c.mode = 'downtime');
    return new;
  end if;
  if old.undone and new.undone then
    raise exception 'That result was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.check_key is distinct from old.check_key or new.name is distinct from old.name
    or new.source is distinct from old.source or new.outcome is distinct from old.outcome
    or new.at_seconds is distinct from old.at_seconds or new.modifiers is distinct from old.modifiers
    or new.created_by is distinct from old.created_by or new.secret is distinct from old.secret then
    raise exception 'That can''t be changed.';
  end if;
  if (new.revealed is distinct from old.revealed or new.revealed_by_hand is distinct from old.revealed_by_hand)
    and current_setting('grimoire.revealing', true) is distinct from 'on' and not reverting then
    raise exception 'Check results are revealed when the campaign goes into Downtime.';
  end if;
  if (new.table_id is not null or new.roll is not null) and new.outcome <> 'hit' then
    raise exception 'Only a hit rolls a table.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- The log trigger also logs a reveal by hand (a reveal at Downtime changes only `revealed`, and isn't a line).
drop trigger log_change on public.check_results;
create trigger log_change after insert or delete or update of table_id, roll, row_text, note, undone, revealed_by_hand on public.check_results
  for each row execute function private.log_change();

-- Hit or Miss, now with `secret` (the check's checks[].secret; default true). A repeat gives back what it made.
drop function public.record_check(uuid, text, text, text, text, jsonb, text);
create function public.record_check(
  campaign uuid, check_key text, name text, source text, outcome text, modifiers jsonb default '[]', note text default null,
  secret boolean default true
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
  insert into public.check_results (campaign_id, check_key, name, source, outcome, modifiers, note, secret)
  values (campaign, check_key, name, coalesce(source, 'mode'), outcome,
    case when jsonb_typeof(modifiers) = 'array' then modifiers else '[]'::jsonb end, note, coalesce(secret, true))
  returning * into found;
  return found;
end;
$$;

-- The GM shows one secret result to the players now (logged; undo hides it again). Refused from an old copy; a
-- result already revealed is given back as it is.
create function public.reveal_check(result uuid, seen_version integer default null) returns public.check_results
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
  if found.revealed then
    return found;
  end if;
  perform set_config('grimoire.revealing', 'on', true);
  update public.check_results r set revealed = true, revealed_by_hand = true, version = coalesce(seen_version, r.version)
  where r.id = result returning * into found;
  perform set_config('grimoire.revealing', '', true);
  return found;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.record_check(uuid, text, text, text, text, jsonb, text, boolean)',
    'public.reveal_check(uuid, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

insert into public.logged_commands (name, level, gm_only) values ('check.reveal', 'simple', true);
