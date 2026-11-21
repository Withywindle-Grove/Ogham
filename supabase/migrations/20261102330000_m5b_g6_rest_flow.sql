-- M5b step g6: rest as a shared flow (ruled 2026-11-01, M5 gate B5; docs/05 "Rest"; docs/06 "Rest flow";
-- plan docs/plans/m5b-g6-rest-and-table-view.md, build order 2). Replaces the GM's Rested / Push on and the players'
-- Rest this turn / Rest today with one flow per group:
--   1. character_rests keeps each character's answer for the rest under way: resting (chosen_at, as before), pushing
--      on (pushing_at, new), or waiting (neither). It also keeps when their group's countdown last restarted
--      (period_from), whether they pushed on and still owe a rest (pushed_on_at: "Rest due · you pushed on" stays on
--      their strip until they rest), and a rest called out of turn (called_at, called_by).
--   2. answer_rest: a player answers for their own characters (Rest, Push on, or back to waiting); the GM answers or
--      flips any row, and Everyone rests / No one rests answer a whole list. Row-level security is unchanged: the
--      owner or the GM (private.may_play) writes, and players can't touch the GM's columns (rest_rules, below).
--   3. call_rest: the Rest button under the marching order calls a rest for the caller's whole group (opening the
--      flow early; a due one is the same flow), and answers Rest for the caller.
--   4. advance_clock gains `rest`: the GM's Next turn sends who is in an open flow and the pack's condition. In the
--      same request as the clock's move: resting counts as rest (the rest condition ends, as before); Push on and
--      unanswered get the condition, stacked (add_status, source 'rest'); everyone in the flow has their countdown
--      restarted. One log line (rest.applied, Simple) is the record; undoing the clock move undoes it all.
-- Adds columns, functions and log rows. Replaces advance_clock (from its newest definition,
-- 20261031120000_m5_statuses.sql) with a version that takes `rest`: the old three-argument function is dropped (a
-- function, not data). Drops nothing else; no rows are removed or changed.

-- 1. The answers ---------------------------------------------------------------------------------------------------

alter table public.character_rests
  add column pushing_at bigint check (pushing_at is null or pushing_at >= 0),
  add column pushed_on_at bigint check (pushed_on_at is null or pushed_on_at >= 0),
  add column period_from bigint check (period_from is null or period_from >= 0),
  add column called_at bigint check (called_at is null or called_at >= 0),
  add column called_by uuid references public.actors (id) on delete set null,
  add constraint character_rests_one_answer check (chosen_at is null or pushing_at is null);

-- As in 20261031120000_m5_statuses.sql, plus: only the GM (moving the clock) changes when someone rested, the
-- countdown and whether they owe a rest; a called rest's columns change only through call_rest (or the GM).
create or replace function private.rest_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.campaign_id is distinct from old.campaign_id then
    raise exception 'That can''t be changed.';
  end if;
  if not private.is_gm(new.campaign_id) and coalesce(current_setting('grimoire.reverting', true), '') = '' then
    if new.rested_at is distinct from old.rested_at or new.period_from is distinct from old.period_from or new.pushed_on_at is distinct from old.pushed_on_at then
      raise exception 'Only the GM can do that.' using errcode = '42501';
    end if;
    if (new.called_at is distinct from old.called_at or new.called_by is distinct from old.called_by)
      and coalesce(current_setting('grimoire.rest_call', true), '') <> 'on' then
      raise exception 'Only the GM can do that.' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.rest_rules() from public, anon, authenticated;

-- 2. Answering -----------------------------------------------------------------------------------------------------

-- Rest, Push on, or back to waiting ('rest', 'push', 'wait') for the characters named: a player's own, or any for
-- the GM. Only during an expedition. An answer already given stays as it is; a repeat changes nothing.
create function public.answer_rest(actors uuid[], answer text) returns setof public.character_rests
language plpgsql security invoker set search_path = '' as $$
declare
  done uuid[] := private.request_targets('character_rests');
  campaign uuid;
  who uuid;
  found public.character_rests;
  now_at bigint;
  touched uuid[] := '{}';
begin
  if cardinality(done) > 0 then
    return query select r.* from public.character_rests r where r.id = any (done);
    return;
  end if;
  if actors is null or cardinality(actors) = 0 or cardinality(actors) > 50 or answer is null or answer not in ('rest', 'push', 'wait') then
    raise exception 'Who rests?';
  end if;
  select a.campaign_id into campaign from public.actors a where a.id = actors[1];
  if campaign is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone) then
    raise exception 'Resting counts during an expedition. Start one first.';
  end if;
  now_at := private.clock_now(campaign);
  foreach who in array actors loop
    if not exists (select 1 from public.actors a where a.id = who and a.campaign_id = campaign) or not private.may_play(campaign, who) then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    select * into found from public.character_rests r where r.actor_id = who for update;
    if found.id is null then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    if (answer = 'rest' and found.chosen_at is null)
      or (answer = 'push' and found.pushing_at is null)
      or (answer = 'wait' and (found.chosen_at is not null or found.pushing_at is not null)) then
      update public.character_rests r
      set chosen_at = case when answer = 'rest' then now_at end,
          pushing_at = case when answer = 'push' then now_at end
      where r.id = found.id
      returning * into found;
      if found.id is null then
        raise exception 'You don''t have permission to do that.' using errcode = '42501';
      end if;
    end if;
    touched := touched || found.id;
  end loop;
  return query select r.* from public.character_rests r where r.id = any (touched);
end;
$$;

-- 3. Calling a rest ------------------------------------------------------------------------------------------------

-- The Rest button under the marching order: a rest for the caller's whole group (its active characters and
-- hirelings), opening the flow now; the caller answers Rest. A player for their own character; the GM for anyone.
-- Runs as the database so it can mark the others' rows, but only after checking the caller may play the character.
create function public.call_rest(actor uuid) returns setof public.character_rests
language plpgsql security definer set search_path = '' as $$
declare
  done uuid[] := private.request_targets('character_rests');
  campaign uuid;
  group_of integer;
  now_at bigint;
  touched uuid[];
begin
  if cardinality(done) > 0 then
    return query select r.* from public.character_rests r where r.id = any (done);
    return;
  end if;
  select a.campaign_id into campaign from public.actors a where a.id = actor and a.kind in ('pc', 'hireling');
  if campaign is null or not private.may_play(campaign, actor) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone) then
    raise exception 'Resting counts during an expedition. Start one first.';
  end if;
  now_at := private.clock_now(campaign);
  select coalesce((select m.group_number from public.party_group_members m where m.actor_id = actor), 1) into group_of;
  perform set_config('grimoire.rest_call', 'on', true);
  with mates as (
    select a.id from public.actors a
    left join public.party_group_members m on m.actor_id = a.id
    where a.campaign_id = campaign and a.kind in ('pc', 'hireling') and a.approval = 'approved' and a.status = 'active'
      and coalesce(m.group_number, 1) = group_of
  ), marked as (
    update public.character_rests r
    set called_at = now_at, called_by = actor,
        chosen_at = case when r.actor_id = actor then now_at else r.chosen_at end,
        pushing_at = case when r.actor_id = actor then null else r.pushing_at end
    where r.campaign_id = campaign and r.actor_id in (select id from mates)
    returning r.id
  )
  select coalesce(array_agg(id), '{}') into touched from marked;
  perform set_config('grimoire.rest_call', '', true);
  return query select r.* from public.character_rests r where r.id = any (touched);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array['public.answer_rest(uuid[], text)', 'public.call_rest(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 4. Next turn applies the answers ---------------------------------------------------------------------------------

-- `rest`: {"actors": [who is in an open flow], "condition": {"name", "conditionId", "icon", "stacks", "levels",
-- "note"} or null}. Resting counts as rest (the rest condition ends); Push on and unanswered get the condition,
-- stacked, and owe a rest; everyone's countdown restarts at `from_at`. Logged as rest.applied (Simple), in the time
-- move's request. Runs as whoever moves the clock (the GM).
create function private.apply_rest_flow(campaign uuid, from_at bigint, rest jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  row_now public.character_rests;
  pushers uuid[] := '{}';
  wanted uuid[];
  cond jsonb := rest -> 'condition';
begin
  if from_at is null or rest is null or jsonb_typeof(rest -> 'actors') <> 'array' then
    return;
  end if;
  select coalesce(array_agg(value::uuid), '{}') into wanted from jsonb_array_elements_text(rest -> 'actors');
  if cardinality(wanted) = 0 then
    return;
  end if;
  perform set_config('grimoire.event_type', 'rest.applied', true);
  for row_now in
    select * from public.character_rests r where r.campaign_id = campaign and r.actor_id = any (wanted) order by r.actor_id for update
  loop
    if row_now.chosen_at is not null then
      update public.character_rests r
      set rested_at = from_at, chosen_at = null, pushing_at = null, pushed_on_at = null, period_from = from_at, called_at = null, called_by = null
      where r.id = row_now.id;
      update public.character_statuses s set ended_at = from_at, end_reason = 'rested'
      where s.actor_id = row_now.actor_id and s.source = 'rest' and s.ended_at is null and not s.undone;
    else
      update public.character_rests r
      set pushed_on_at = coalesce(r.pushed_on_at, from_at), pushing_at = null, period_from = from_at, called_at = null, called_by = null
      where r.id = row_now.id;
      pushers := pushers || row_now.actor_id;
    end if;
  end loop;
  if cardinality(pushers) > 0 and jsonb_typeof(cond) = 'object' and coalesce(trim(cond ->> 'name'), '') <> '' then
    perform public.add_status(
      campaign, pushers, cond ->> 'name', cond ->> 'conditionId', cond ->> 'icon',
      coalesce((cond ->> 'stacks')::boolean, false),
      case when jsonb_typeof(cond -> 'levels') = 'array' then cond -> 'levels' end,
      null, null, false, cond ->> 'note', 'rest'
    );
  end if;
  perform set_config('grimoire.event_type', '', true);
end;
$$;
revoke execute on function private.apply_rest_flow(uuid, bigint, jsonb) from public, anon;
grant execute on function private.apply_rest_flow(uuid, bigint, jsonb) to authenticated, service_role;

-- As in 20261031120000_m5_statuses.sql, plus `rest`: the shared flow's answers applied (above). Without `rest`
-- (Advance by… outside a flow, Downtime, an escape roll's time) no rest is applied.
drop function public.advance_clock(uuid, bigint, integer);
create function public.advance_clock(campaign uuid, by_seconds bigint, seen_version integer default null, rest jsonb default null)
returns public.campaign_clocks
language plpgsql security invoker set search_path = '' as $$
declare
  clock public.campaign_clocks;
  from_at bigint;
begin
  if by_seconds is null or by_seconds < 1 then
    raise exception 'Move the clock on by a whole amount above 0.';
  end if;
  select c.seconds into from_at from public.campaign_clocks c where c.campaign_id = campaign;
  update public.campaign_clocks c
  set seconds = c.seconds + by_seconds, version = coalesce(seen_version, c.version)
  where c.campaign_id = campaign
  returning * into clock;
  if clock.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.burn_lights(campaign, from_at, clock.seconds);
  perform private.apply_rest_flow(campaign, from_at, rest);
  perform private.end_statuses(campaign, clock.seconds);
  return clock;
end;
$$;
revoke execute on function public.advance_clock(uuid, bigint, integer, jsonb) from public, anon;
grant execute on function public.advance_clock(uuid, bigint, integer, jsonb) to authenticated, service_role;

-- 5. The log and undo ----------------------------------------------------------------------------------------------

-- The statuses Push on marks in a time move are made records: undoing the move marks them undone.
insert into public.undoable_makings (name) values ('time.advance'), ('time.advanceBy') on conflict do nothing;

insert into public.logged_commands (name, level, gm_only) values
  ('rest.answer', 'verbose', false),
  ('rest.call', 'simple', false),
  ('rest.applied', 'simple', true);
