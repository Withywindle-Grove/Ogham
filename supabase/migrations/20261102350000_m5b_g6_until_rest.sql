-- M5b step g6, build order 4 (B6, ruled 2026-11-01; docs/05 "Statuses at the M5 gate"; mockup
-- design/mockups/m5-gate/b6-statuses.html; plan docs/plans/m5b-g6-rest-and-table-view.md): the + Status pop-up's
-- **Until rest** duration. A status given "until rest" ends when a rest is applied to its character (the shared rest
-- flow's Next turn, for those resting), the same moment the rest condition ends.
--   1. character_statuses gains until_rest (default false: every status already on keeps lasting as it did).
--   2. private.status_rules (newest copy: 20261101142000_m5b_g1_status_rules_fixtures.sql): a player can't change
--      until_rest on their own status (one line added to the list of columns only the GM or a command changes).
--   3. public.add_status (newest copy: 20261101140000_m5b_g1_status_gm_only.sql) takes until_rest as a 13th argument
--      with a default, so every call that names 12 keeps working (apply_rest_flow does). The 12-argument function is
--      dropped first (a function, not data) so the two can't be confused.
--   4. private.apply_rest_flow (newest copy: 20261102330000_m5b_g6_rest_flow.sql): resting also ends the statuses
--      given until rest. Undoing the time move undoes it with the rest (the same log line, rest.applied).
-- Adds one column with a default; drops one function signature (replaced at once); no rows are removed or changed.

-- 1. The column ----------------------------------------------------------------------------------------------------

alter table public.character_statuses add column until_rest boolean not null default false;

-- 2. Who may change it ---------------------------------------------------------------------------------------------

-- As in 20261101142000_m5b_g1_status_rules_fixtures.sql, plus until_rest among the columns a player can't change.
create or replace function private.status_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  as_gm boolean := private.is_gm(new.campaign_id);
  by_command boolean := nullif(current_setting('grimoire.status_command', true), '') is not null
    or nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'UPDATE' and (new.actor_id is distinct from old.actor_id or new.campaign_id is distinct from old.campaign_id) then
    raise exception 'That can''t be changed.';
  end if;
  if tg_op = 'INSERT' and not as_gm and (select auth.uid()) is not null and nullif(current_setting('grimoire.reverting', true), '') is null then
    raise exception 'Only the GM gives a status.' using errcode = '42501';
  end if;
  if not as_gm and (
    (new.secret and (tg_op = 'INSERT' or not old.secret))
    or (new.source = 'rest' and (tg_op = 'INSERT' or old.source <> 'rest'))
  ) then
    raise exception 'Only the GM can do that.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and not as_gm and not by_command and (
    new.undone is distinct from old.undone or new.ended_at is distinct from old.ended_at
    or new.end_reason is distinct from old.end_reason or new.ends_at is distinct from old.ends_at
    or new.total_seconds is distinct from old.total_seconds or new.secret is distinct from old.secret
    or new.name is distinct from old.name or new.stacks is distinct from old.stacks
    or new.until_rest is distinct from old.until_rest
  ) then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 3. Giving a status until rest ------------------------------------------------------------------------------------

drop function public.add_status(uuid, uuid[], text, text, text, boolean, jsonb, bigint, text, boolean, text, text);

-- As in 20261101140000_m5b_g1_status_gm_only.sql, plus `until_rest` (stored on a new status; one already on keeps
-- its own when it stacks or steps up).
create function public.add_status(
  campaign uuid,
  actors uuid[],
  status_name text,
  condition_id text default null,
  icon text default null,
  stacking boolean default false,
  levels jsonb default null,
  timer_seconds bigint default null,
  timer_unit text default null,
  secret boolean default false,
  note text default null,
  source text default 'typed',
  until_rest boolean default false
) returns setof public.character_statuses
language plpgsql security invoker set search_path = '' as $$
declare
  done uuid[] := private.request_targets('character_statuses');
  who uuid;
  found public.character_statuses;
  now_at bigint := private.clock_now(campaign);
  kept_levels jsonb;
  shown_name text := trim(coalesce(status_name, ''));
  condition text := nullif(trim(coalesce(condition_id, '')), '');
  kind text := coalesce(source, 'typed');
  hidden boolean := coalesce(secret, false) and timer_seconds is not null;
  touched uuid[] := '{}';
begin
  if cardinality(done) > 0 then
    return query select s.* from public.character_statuses s where s.id = any (done);
    return;
  end if;
  if actors is null or cardinality(actors) = 0 or cardinality(actors) > 50 then
    raise exception 'Who has it?';
  end if;
  if length(shown_name) not between 1 and 80 then
    raise exception 'Give the status a name of up to 80 characters.';
  end if;
  if kind not in ('condition', 'typed', 'rest') then
    raise exception 'Where does it come from?';
  end if;
  if timer_seconds is not null and (timer_seconds < 1 or timer_seconds > 3153600000) then
    raise exception 'A timer runs for a whole amount of time above 0.';
  end if;
  if not private.is_gm(campaign) then
    raise exception 'Only the GM gives a status.' using errcode = '42501';
  end if;
  -- The levels, as names in order (each with an id and a name).
  if levels is not null then
    if jsonb_typeof(levels) <> 'array' or jsonb_array_length(levels) not between 1 and 20 then
      raise exception 'A status has 1 to 20 levels.';
    end if;
    select jsonb_agg(jsonb_build_object('id', trim(l ->> 'id'), 'name', trim(l ->> 'name')) order by o) into kept_levels
    from jsonb_array_elements(levels) with ordinality as t(l, o);
    if exists (select 1 from jsonb_array_elements(kept_levels) l where coalesce(l ->> 'name', '') = '' or length(l ->> 'name') > 80) then
      raise exception 'Each level needs a name of up to 80 characters.';
    end if;
  end if;

  perform set_config('grimoire.status_command', 'on', true);
  foreach who in array actors loop
    if not exists (select 1 from public.actors a where a.id = who and a.campaign_id = campaign) or not private.may_play(campaign, who) then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    select * into found from public.character_statuses s
    where s.actor_id = who and s.ended_at is null and not s.undone
      and ((condition is not null and s.condition_id = condition) or (condition is null and s.condition_id is null and lower(s.name) = lower(shown_name)))
    order by s.created_at
    limit 1
    for update;
    if found.id is not null then
      if found.stacking and found.stacks < 99 then
        update public.character_statuses s set stacks = s.stacks + 1 where s.id = found.id returning * into found;
      elsif found.levels is not null and coalesce(found.level, 0) < jsonb_array_length(found.levels) - 1 then
        update public.character_statuses s set level = coalesce(s.level, 0) + 1 where s.id = found.id returning * into found;
      end if;
    else
      insert into public.character_statuses (
        campaign_id, actor_id, name, condition_id, icon, stacking, levels, level, source, note,
        started_at, ends_at, total_seconds, unit, secret, until_rest
      ) values (
        campaign, who, shown_name, condition, nullif(trim(coalesce(icon, '')), ''), coalesce(stacking, false), kept_levels,
        case when kept_levels is not null then 0 end, kind, nullif(trim(coalesce(note, '')), ''),
        now_at,
        case when timer_seconds is not null and not hidden then now_at + timer_seconds end,
        case when not hidden then timer_seconds end,
        case when timer_seconds is not null and not hidden then nullif(trim(coalesce(timer_unit, '')), '') end,
        hidden,
        coalesce(until_rest, false)
      )
      returning * into found;
      if hidden then
        insert into public.status_secrets (id, campaign_id, ends_at, total_seconds, unit)
        values (found.id, campaign, now_at + timer_seconds, timer_seconds, nullif(trim(coalesce(timer_unit, '')), ''));
      end if;
    end if;
    touched := touched || found.id;
  end loop;
  perform set_config('grimoire.status_command', '', true);
  return query select s.* from public.character_statuses s where s.id = any (touched);
end;
$$;
revoke execute on function public.add_status(uuid, uuid[], text, text, text, boolean, jsonb, bigint, text, boolean, text, text, boolean) from public, anon;
grant execute on function public.add_status(uuid, uuid[], text, text, text, boolean, jsonb, bigint, text, boolean, text, text, boolean) to authenticated, service_role;

-- 4. Resting ends them ---------------------------------------------------------------------------------------------

-- As in 20261102330000_m5b_g6_rest_flow.sql, plus: resting ends the statuses given until rest (with the rest
-- condition, as before).
create or replace function private.apply_rest_flow(campaign uuid, from_at bigint, rest jsonb) returns void
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
      -- The changed line: until rest ends too.
      update public.character_statuses s set ended_at = from_at, end_reason = 'rested'
      where s.actor_id = row_now.actor_id and (s.source = 'rest' or s.until_rest) and s.ended_at is null and not s.undone;
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
