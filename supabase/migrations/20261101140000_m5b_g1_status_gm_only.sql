-- M5b step g1 (docs/plans/m5b-g1-gate-sweep.md; M5 gate C1, ruled 2026-11-01; 03 "Add a status to a character"):
-- players never add a status to their own character: a status comes from the GM (or, from M7, automatically from a
-- spell or ability). Players still remove and step their own statuses (03 "Add or remove a status", the remove half).
--   Replaces private.status_rules and public.add_status (newest copies: 20261101120000_m5_review_fixes.sql), each
--   with one change: a status row is inserted only by the GM, and add_status (which also stacks or steps up a status
--   already on) is the GM's.
-- Nothing is dropped, renamed or deleted; no rows change.

-- As in 20261101120000_m5_review_fixes.sql, plus (C1): only the GM inserts a status row (an undo may still put one
-- back).
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
  if tg_op = 'INSERT' and not as_gm and nullif(current_setting('grimoire.reverting', true), '') is null then
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
  ) then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- As in 20261101120000_m5_review_fixes.sql, plus (C1): the GM's only (a player's + Status is refused, also on a status
-- they have already, which would otherwise stack or step up).
create or replace function public.add_status(
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
  source text default 'typed'
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
        started_at, ends_at, total_seconds, unit, secret
      ) values (
        campaign, who, shown_name, condition, nullif(trim(coalesce(icon, '')), ''), coalesce(stacking, false), kept_levels,
        case when kept_levels is not null then 0 end, kind, nullif(trim(coalesce(note, '')), ''),
        now_at,
        case when timer_seconds is not null and not hidden then now_at + timer_seconds end,
        case when not hidden then timer_seconds end,
        case when timer_seconds is not null and not hidden then nullif(trim(coalesce(timer_unit, '')), '') end,
        hidden
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
