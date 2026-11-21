-- M5 step 9: statuses and rest (docs/04 "Status"; docs/05 "Status symbols", "Rest"; docs/03 "Add or remove a status
-- on a character", "Rest this turn"; ruled 2026-10-25, 2026-10-29 D27 and the technical ruling on secret timers,
-- 2026-10-30 DG5, WA3 and the answers after #170 on rest in day modes).
--   1. character_statuses: the statuses on characters and hirelings. Each has its name, the condition it comes from
--      (the setting's conditions; or typed by hand; or the pack's rest condition, marked by Push on), its symbol, its
--      stacks (a condition that stacks adds 1 each time: "×2"), its ordered levels with the one it's at (07: levels,
--      stepped up and down), and an optional timer on the campaign clock: when it ends (ends_at), its whole length and
--      the unit it's shown in. A status ends (ended_at, end_reason) when it's removed, when its timer runs out, when
--      its character rests (the rest condition), or when it's stepped down past its first level. Nothing is deleted:
--      an ended status stays as the log's record. Read like the character (everyone sees an approved character's
--      statuses); the character's owner or the GM changes them (03), through the functions below.
--   2. status_secrets: a secret timer's end and length (the GM's "Hide time left"), in a table only the GM reads
--      (technical ruling, 2026-10-29): it never reaches a player's device. The status itself says only that it's
--      secret, so players see it active, with no fill.
--   3. character_rests: one row per character and hireling, made with it: whether they chose "Rest this turn" (or
--      "Rest today") for the step under way, and when they last rested. The GM's next Next turn (or Next day) applies
--      the choices, in the same request as the clock's move: the step counts as rest for them, and the rest
--      condition Push on marked on them ends (05: resting clears the mark for those who rested). Logged as
--      rest.taken (Simple).
--   4. What the app calls: add_status (+ Status; Push on marks the rest condition on the names ticked, source
--      'rest'), remove_status (Remove), step_status (Step up / Step down) and choose_rest (Rest this turn; the GM's
--      Rested marks everyone). A repeat changes nothing.
--   5. The clock: advance_clock applies the rest choices and ends every status whose timer ran out (logged as
--      status.timerEnd, Simple), after the lights burn; set_clock forwards ends them too; backwards gives timers
--      their time back up to their whole length, and ended statuses stay ended (ruled 2026-10-29).
--   6. Undo: adding a status is marked undone (never removed), like a reminder; the other changes are put back.
--      Undoing a clock move puts back the rests it applied and the timers it ended. Logged-command rows.
-- Replaces public.advance_clock and public.set_clock (newest copies in 20261030161000_m5_light.sql) and
-- private.undo_body (newest copy in 20261029180000_m5_reminders.sql). Adds three tables, their rules, triggers and
-- policies, and functions. Drops nothing; no rows are removed. Every existing character and hireling gets a rest row.

-- 1. Statuses ---------------------------------------------------------------------------------------------------------

create table public.character_statuses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  actor_id uuid not null references public.actors (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  -- The setting's condition (conditions[].id), when it came from one.
  condition_id text check (condition_id is null or length(trim(condition_id)) between 1 and 200),
  icon text check (icon is null or length(icon) between 1 and 40),
  stacks integer not null default 1 check (stacks between 1 and 99),
  stacking boolean not null default false,
  -- Ordered levels (07: levels [{ id, name }], in order) and the one it's at (from 0).
  levels jsonb check (levels is null or (jsonb_typeof(levels) = 'array' and jsonb_array_length(levels) between 1 and 20)),
  level integer check (level is null or level >= 0),
  source text not null default 'typed' check (source in ('condition', 'typed', 'rest')),
  note text check (note is null or length(note) <= 500),
  -- On the campaign clock (seconds): when it started, and when its timer ends (null: no timer, or a secret one, kept
  -- in status_secrets). Its whole length (for the draining ring) and the unit it's shown in.
  started_at bigint not null default 0 check (started_at >= 0),
  ends_at bigint check (ends_at is null or ends_at >= 0),
  total_seconds bigint check (total_seconds is null or total_seconds > 0),
  unit text check (unit is null or length(unit) between 1 and 40),
  secret boolean not null default false,
  -- When and how it ended (null: it's on).
  ended_at bigint check (ended_at is null or ended_at >= 0),
  end_reason text check (end_reason is null or end_reason in ('removed', 'timer', 'rested', 'stepped')),
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index character_statuses_campaign on public.character_statuses (campaign_id) where ended_at is null and not undone;
create index character_statuses_actor on public.character_statuses (actor_id);

alter table public.character_statuses enable row level security;
grant select, insert, update on public.character_statuses to authenticated;
grant select, insert, update, delete on public.character_statuses to service_role;

-- Read like the character (as its light): members see approved characters' statuses, the owner their own draft's.
create policy "character statuses: read like the character" on public.character_statuses
  for select to authenticated
  using (
    exists (
      select 1 from public.actors a
      where a.id = actor_id and a.campaign_id = character_statuses.campaign_id
        and (
          (private.is_gm(a.campaign_id) and not private.is_others_draft(a.id))
          or (private.is_member(a.campaign_id) and (a.approval = 'approved' or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid()))))
        )
    )
  );
-- The owner (their own approved character) or the GM (any approved character): 03, "Add or remove a status".
create policy "character statuses: the owner or the GM" on public.character_statuses
  for insert to authenticated with check (private.may_play(campaign_id, actor_id));
create policy "character statuses: the owner or the GM, again" on public.character_statuses
  for update to authenticated using (private.may_play(campaign_id, actor_id)) with check (private.may_play(campaign_id, actor_id));

-- What the database decides, whatever a device sends: whose status it is never changes, and only the GM keeps a
-- timer secret or marks the rest condition.
create function private.status_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.actor_id is distinct from old.actor_id or new.campaign_id is distinct from old.campaign_id) then
    raise exception 'That can''t be changed.';
  end if;
  if not private.is_gm(new.campaign_id) and (
    (new.secret and (tg_op = 'INSERT' or not old.secret))
    or (new.source = 'rest' and (tg_op = 'INSERT' or old.source <> 'rest'))
  ) then
    raise exception 'Only the GM can do that.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.status_rules() from public, anon, authenticated;

create trigger check_copy_version before insert or update on public.character_statuses
  for each row execute function private.check_copy_version();
create trigger status_rules before insert or update on public.character_statuses
  for each row execute function private.status_rules();
create trigger refuse_when_retired before insert or update or delete on public.character_statuses
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.character_statuses
  for each row execute function private.log_change();

-- 2. Secret timers (the GM's alone) -------------------------------------------------------------------------------

create table public.status_secrets (
  id uuid primary key references public.character_statuses (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  ends_at bigint not null check (ends_at >= 0),
  total_seconds bigint not null check (total_seconds > 0),
  unit text check (unit is null or length(unit) between 1 and 40),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index status_secrets_campaign on public.status_secrets (campaign_id);

alter table public.status_secrets enable row level security;
grant select, insert, update on public.status_secrets to authenticated;
grant select, insert, update, delete on public.status_secrets to service_role;

create policy "status secrets: the GM reads" on public.status_secrets
  for select to authenticated using (private.is_gm(campaign_id));
create policy "status secrets: the GM keeps them" on public.status_secrets
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "status secrets: the GM keeps them, again" on public.status_secrets
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

create function private.status_secret_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.campaign_id is distinct from old.campaign_id) then
    raise exception 'That can''t be changed.';
  end if;
  if not exists (select 1 from public.character_statuses s where s.id = new.id and s.campaign_id = new.campaign_id) then
    raise exception 'That status isn''t in this campaign.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.status_secret_rules() from public, anon, authenticated;

-- Its making isn't logged (the status's own line is, without the timer); its changes are, for the GM only (no
-- log_audience function of its own: hidden means hidden).
create trigger check_copy_version before insert or update on public.status_secrets
  for each row execute function private.check_copy_version();
create trigger status_secret_rules before insert or update on public.status_secrets
  for each row execute function private.status_secret_rules();
create trigger refuse_when_retired before insert or update or delete on public.status_secrets
  for each row execute function private.refuse_when_retired();
create trigger log_change after update on public.status_secrets
  for each row execute function private.log_change();

-- 3. Rest choices -------------------------------------------------------------------------------------------------

create table public.character_rests (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null unique references public.actors (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- On the campaign clock: when they chose to rest this step (null: they haven't), and when they last rested.
  chosen_at bigint check (chosen_at is null or chosen_at >= 0),
  rested_at bigint check (rested_at is null or rested_at >= 0),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index character_rests_campaign on public.character_rests (campaign_id);

alter table public.character_rests enable row level security;
grant select, update on public.character_rests to authenticated;
grant select, insert, update, delete on public.character_rests to service_role;

create policy "character rests: read like the character" on public.character_rests
  for select to authenticated
  using (
    exists (
      select 1 from public.actors a
      where a.id = actor_id and a.campaign_id = character_rests.campaign_id
        and (
          (private.is_gm(a.campaign_id) and not private.is_others_draft(a.id))
          or (private.is_member(a.campaign_id) and (a.approval = 'approved' or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid()))))
        )
    )
  );
create policy "character rests: the owner or the GM" on public.character_rests
  for update to authenticated using (private.may_play(campaign_id, actor_id)) with check (private.may_play(campaign_id, actor_id));

create function private.rest_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.campaign_id is distinct from old.campaign_id then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.rest_rules() from public, anon, authenticated;

create function private.make_character_rest() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('pc', 'hireling') then
    insert into public.character_rests (actor_id, campaign_id) values (new.id, new.campaign_id) on conflict (actor_id) do nothing;
  end if;
  return null;
end;
$$;
revoke execute on function private.make_character_rest() from public, anon, authenticated;
create trigger make_character_rest after insert on public.actors
  for each row execute function private.make_character_rest();
insert into public.character_rests (actor_id, campaign_id)
  select a.id, a.campaign_id from public.actors a where a.kind in ('pc', 'hireling')
  on conflict (actor_id) do nothing;

create trigger check_copy_version before insert or update on public.character_rests
  for each row execute function private.check_copy_version();
create trigger rest_rules before update on public.character_rests
  for each row execute function private.rest_rules();
create trigger refuse_when_retired before insert or update or delete on public.character_rests
  for each row execute function private.refuse_when_retired();
create trigger log_change after update on public.character_rests
  for each row execute function private.log_change();

-- 4. What the app calls ------------------------------------------------------------------------------------------

-- The rows of a table this request (its id and part, from this person) made or changed in an earlier transaction:
-- a repeat gives them back and changes nothing.
create function private.request_targets(target_table text) returns uuid[]
language plpgsql stable security definer set search_path = '' as $$
declare
  tag jsonb := private.request_tag();
  request uuid;
  part integer;
begin
  begin
    request := (tag ->> 'requestId')::uuid;
    part := (tag ->> 'part')::integer;
  exception when others then
    return '{}';
  end;
  if request is null or part is null then
    return '{}';
  end if;
  return coalesce((
    select array_agg(distinct e.target_id) from public.events e
    where e.request_id = request and e.request_part = part and e.target_table = request_targets.target_table
      and e.actor_user_id is not distinct from (select auth.uid()) and e.created_at < now()
  ), '{}');
end;
$$;
revoke execute on function private.request_targets(text) from public, anon;
grant execute on function private.request_targets(text) to authenticated, service_role;

-- A status on one or more characters (+ Status; Push on with source 'rest'). The device reads the condition from the
-- setting rules (its name, symbol, whether it stacks, its levels) and works out the timer's length in seconds and its
-- unit. On a character who has it already (the same condition, or the same typed name): a condition that stacks adds
-- 1; one with levels steps up one level; anything else stays as it is. A secret timer (the GM's only) is kept in
-- status_secrets. Refused for a character this person can't play (the GM: any approved character; a player: their
-- own), and for a secret timer or the rest condition from anyone but the GM. A repeat gives back what it did.
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
  if (hidden or kind = 'rest') and not private.is_gm(campaign) then
    raise exception 'Only the GM can do that.' using errcode = '42501';
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
  return query select s.* from public.character_statuses s where s.id = any (touched);
end;
$$;

-- Remove: the status ends now. Refused when it has ended already, and from an old copy; a repeat changes nothing.
create function public.remove_status(status uuid, seen_version integer default null) returns public.character_statuses
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_statuses;
begin
  select * into found from public.character_statuses s where s.id = status;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if private.repeated_request('character_statuses', found.id) then
    return found;
  end if;
  if found.undone or found.ended_at is not null then
    raise exception 'That status has already ended.';
  end if;
  update public.character_statuses s
  set ended_at = private.clock_now(s.campaign_id), end_reason = 'removed', version = coalesce(seen_version, s.version)
  where s.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Step up / Step down a status with ordered levels (07: levels, in order). Refused at the last level going up;
-- stepping down from the first level ends it. Refused from an old copy; a repeat changes nothing.
create function public.step_status(status uuid, step integer, seen_version integer default null) returns public.character_statuses
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_statuses;
  at_level integer;
  top integer;
begin
  if step is null or step not in (-1, 1) then
    raise exception 'Step up or down one level.';
  end if;
  select * into found from public.character_statuses s where s.id = status;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if private.repeated_request('character_statuses', found.id) then
    return found;
  end if;
  if found.undone or found.ended_at is not null then
    raise exception 'That status has already ended.';
  end if;
  if found.levels is null then
    raise exception 'That status has no levels.';
  end if;
  at_level := coalesce(found.level, 0);
  top := jsonb_array_length(found.levels) - 1;
  if step = 1 and at_level >= top then
    raise exception 'It''s at its last level already: %.', found.levels -> top ->> 'name';
  end if;
  if step = -1 and at_level <= 0 then
    update public.character_statuses s
    set ended_at = private.clock_now(s.campaign_id), end_reason = 'stepped', version = coalesce(seen_version, s.version)
    where s.id = found.id
    returning * into found;
  else
    update public.character_statuses s
    set level = least(top, greatest(0, at_level + step)), version = coalesce(seen_version, s.version)
    where s.id = found.id
    returning * into found;
  end if;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Rest this turn (Rest today in day modes), or not after all: the characters' choice for the step under way, which
-- the GM's next Next turn (Next day) applies. Only during an expedition. The GM's Rested marks everyone. Refused for
-- a character this person can't play. A choice already made stays as it is; a repeat changes nothing.
create function public.choose_rest(actors uuid[], resting boolean) returns setof public.character_rests
language plpgsql security invoker set search_path = '' as $$
declare
  done uuid[] := private.request_targets('character_rests');
  campaign uuid;
  who uuid;
  found public.character_rests;
  touched uuid[] := '{}';
begin
  if cardinality(done) > 0 then
    return query select r.* from public.character_rests r where r.id = any (done);
    return;
  end if;
  if actors is null or cardinality(actors) = 0 or cardinality(actors) > 50 or resting is null then
    raise exception 'Who rests?';
  end if;
  select a.campaign_id into campaign from public.actors a where a.id = actors[1];
  if campaign is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone) then
    raise exception 'Resting counts during an expedition. Start one first.';
  end if;
  foreach who in array actors loop
    if not exists (select 1 from public.actors a where a.id = who and a.campaign_id = campaign) or not private.may_play(campaign, who) then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    select * into found from public.character_rests r where r.actor_id = who for update;
    if found.id is null then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    if (found.chosen_at is not null) is distinct from resting then
      update public.character_rests r
      set chosen_at = case when resting then private.clock_now(campaign) end
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

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.add_status(uuid, uuid[], text, text, text, boolean, jsonb, bigint, text, boolean, text, text)',
    'public.remove_status(uuid, integer)', 'public.step_status(uuid, integer, integer)',
    'public.choose_rest(uuid[], boolean)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 5. Statuses and rest on the clock -------------------------------------------------------------------------------

-- The rest choices made for the step that just passed (it began at `from_at`): those characters rested then, and the
-- rest condition Push on marked on them ends. Logged as rest.taken, in the time move's request. Runs as whoever moves
-- the clock (the GM).
create function private.apply_rests(campaign uuid, from_at bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  rest public.character_rests;
begin
  if from_at is null then
    return;
  end if;
  perform set_config('grimoire.event_type', 'rest.taken', true);
  for rest in
    select * from public.character_rests r where r.campaign_id = campaign and r.chosen_at is not null order by r.actor_id for update
  loop
    update public.character_rests r set rested_at = from_at, chosen_at = null where r.id = rest.id;
    update public.character_statuses s set ended_at = from_at, end_reason = 'rested'
    where s.actor_id = rest.actor_id and s.source = 'rest' and s.ended_at is null and not s.undone;
  end loop;
  perform set_config('grimoire.event_type', '', true);
end;
$$;
revoke execute on function private.apply_rests(uuid, bigint) from public, anon;
grant execute on function private.apply_rests(uuid, bigint) to authenticated, service_role;

-- Every status whose timer ran out by `to_at` ends then (a secret timer's end is read from status_secrets). Logged as
-- status.timerEnd, in the time move's request.
create function private.end_statuses(campaign uuid, to_at bigint) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if to_at is null then
    return;
  end if;
  perform set_config('grimoire.event_type', 'status.timerEnd', true);
  update public.character_statuses s set ended_at = s.ends_at, end_reason = 'timer'
  where s.campaign_id = campaign and s.ended_at is null and not s.undone and s.ends_at is not null and s.ends_at <= to_at;
  update public.character_statuses s set ended_at = x.ends_at, end_reason = 'timer'
  from public.status_secrets x
  where x.id = s.id and s.campaign_id = campaign and s.ended_at is null and not s.undone and x.ends_at <= to_at;
  perform set_config('grimoire.event_type', '', true);
end;
$$;
revoke execute on function private.end_statuses(uuid, bigint) from public, anon;
grant execute on function private.end_statuses(uuid, bigint) to authenticated, service_role;

-- As in 20261030161000_m5_light.sql, plus the rest choices applied and the status timers that ran out ended.
create or replace function public.advance_clock(campaign uuid, by_seconds bigint, seen_version integer default null)
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
  perform private.apply_rests(campaign, from_at);
  perform private.end_statuses(campaign, clock.seconds);
  return clock;
end;
$$;

-- As in 20261030161000_m5_light.sql, plus the status timers: forwards, those that ran out end; backwards they get
-- their time back up to their whole length, and ended statuses stay ended (ruled 2026-10-29). A correction applies
-- no rest choices (nothing in the procedure runs).
create or replace function public.set_clock(campaign uuid, to_seconds bigint, seen_version integer default null)
returns public.campaign_clocks
language plpgsql security invoker set search_path = '' as $$
declare
  clock public.campaign_clocks;
  from_at bigint;
begin
  if to_seconds is null or to_seconds < 0 then
    raise exception 'The time can''t be before the clock started.';
  end if;
  select c.seconds into from_at from public.campaign_clocks c where c.campaign_id = campaign;
  update public.campaign_clocks c
  set seconds = to_seconds, version = coalesce(seen_version, c.version)
  where c.campaign_id = campaign
  returning * into clock;
  if clock.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if clock.seconds > from_at then
    perform private.burn_lights(campaign, from_at, clock.seconds);
    perform private.end_statuses(campaign, clock.seconds);
  elsif clock.seconds < from_at then
    update public.character_lights l set lit_at = clock.seconds
    where l.campaign_id = campaign and l.lit_at is not null and l.lit_at > clock.seconds;
    update public.character_statuses s set ends_at = clock.seconds + s.total_seconds
    where s.campaign_id = campaign and s.ended_at is null and not s.undone and s.ends_at is not null and s.total_seconds is not null
      and s.ends_at - s.total_seconds > clock.seconds;
    update public.status_secrets x set ends_at = clock.seconds + x.total_seconds
    from public.character_statuses s
    where s.id = x.id and x.campaign_id = campaign and s.ended_at is null and not s.undone and x.ends_at - x.total_seconds > clock.seconds;
  end if;
  return clock;
end;
$$;

-- 6. Who sees the log lines, undo, and the logged commands ----------------------------------------------------------

-- A status's and a rest's lines: seen like the character. (A secret timer's lines have no function: the GM's only.)
create function private.log_audience_character_statuses(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select * from private.audience_of_character((coalesce(new_row, old_row) ->> 'actor_id')::uuid);
$$;
revoke execute on function private.log_audience_character_statuses(jsonb, jsonb) from public, anon, authenticated;
create function private.log_audience_character_rests(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select * from private.audience_of_character((coalesce(new_row, old_row) ->> 'actor_id')::uuid);
$$;
revoke execute on function private.log_audience_character_rests(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('character_statuses'), ('status_secrets'), ('character_rests');
-- Adding a status (+ Status, Push on) is marked undone, never removed, like a reminder.
insert into public.undoable_makings (name) values ('status.add'), ('rest.pushOn');

-- The tables whose made records undo marks undone: the undoable tables with an `undone` column (sessions,
-- expeditions, reminders, check results, statuses, and any later one).
create function private.made_tables() returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(u.name order by u.name), '{}') from public.undoable_tables u
  where exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = to_regclass(format('public.%I', u.name)) and a.attname = 'undone' and not a.attisdropped
  );
$$;
revoke execute on function private.made_tables() from public, anon;
grant execute on function private.made_tables() to authenticated, service_role;

-- As in 20261029180000_m5_reminders.sql, but the made records are those of any table private.made_tables names (so
-- statuses too).
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
  -- A record the action made (a session, an expedition, a reminder, a check result, a status…): marked undone, never
  -- removed. Any undoable table whose rows can be marked undone counts (private.made_tables), so a later table
  -- needn't copy this function again.
  select coalesce(array_agg(e.target_id), '{}') into made from public.events e
  where exists (select 1 from public.undoable_makings m where m.name = picked.type)
    and e.campaign_id = picked.campaign_id and e.target_table = any (private.made_tables())
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
    if change.target_id = any (made) and change.before is null then
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

insert into public.logged_commands (name, level, gm_only) values
  ('status.add', 'simple', false),
  ('status.remove', 'simple', false),
  ('status.step', 'simple', false),
  ('status.timerEnd', 'simple', true),
  ('rest.choose', 'simple', false),
  ('rest.pushOn', 'simple', true),
  ('rest.taken', 'simple', true);
