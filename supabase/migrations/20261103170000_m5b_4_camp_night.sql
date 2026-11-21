-- M5b step 4, part 2: camp's night (docs/plans/m5b-4-camp.md, build orders 5–7; ruled 2026-10-30, D18–D20; docs/05
-- Camp: Watches, Sleep, No separate Confirm). Builds on 20261103160000_m5b_4_camp.sql (part 1).
--   1. camp_entries gains two kinds: `watches` (the group's watch order, `detail` [[actor ids], …], each watch 1–3
--      characters; the newest stands) and `sleep` (one character's sleep: `detail` [{difficulty, roll}], `outcome`
--      good or bad; the newest with a difficulty and the newest with an outcome stand). `outcome` now also takes
--      good and bad. The two check constraints are replaced (no row changes: every row already meets the new ones).
--   2. camps gains `applied_at`: the clock when Next day applied the camp (D20). An applied camp takes no more steps.
--   3. private.camp_rules (from part 1's definition, its newest) lets the apply (and its undo) change `applied_at`;
--      private.camp_for_me (from part 1's) refuses an applied camp.
--   4. What the app calls: set_camp_watches (camp.watches: the GM, or a player of the group: the order is the group's),
--      camp_sleep (camp.sleep: a player for their own characters, the roll and how they slept; the GM for anyone, and
--      only the GM changes the difficulty), apply_camps (camp.apply: the GM's Next day, in the same request as the
--      clock's move, so the time move's Undo takes it back too) and set_encounter_watch (encounter.watch: Which
--      watch? on a night hit's waiting card, the GM's).
--   5. private.waiting_encounter_rules (from 20261103100000, its only definition) lets set_encounter_watch write
--      `watch`; nothing else changes.
-- Adds two columns' worth of meaning (one new column), four functions and rows in logged_commands and
-- undoable_makings; replaces three functions and two check constraints. Drops no data; no rows are removed,
-- renamed or changed.

-- 1. The new kinds ---------------------------------------------------------------------------------------------------

alter table public.camp_entries drop constraint camp_entries_kind_check;
alter table public.camp_entries add constraint camp_entries_kind_check check (kind in ('fuel', 'cook', 'talk', 'meal', 'watches', 'sleep'));
alter table public.camp_entries drop constraint camp_entries_outcome_check;
alter table public.camp_entries add constraint camp_entries_outcome_check check (outcome is null or outcome in ('worked', 'failed', 'good', 'bad'));

-- 2. Applied ---------------------------------------------------------------------------------------------------------

alter table public.camps add column applied_at bigint;
-- The apply is logged (and so undone with the time move) like any other change.
create trigger log_apply after update of applied_at on public.camps
  for each row execute function private.log_change();

-- 3. The rules ---------------------------------------------------------------------------------------------------------

-- As in 20261103160000_m5b_4_camp.sql, but a camp's `applied_at` may change with the apply (camp_write on) or its undo.
create or replace function private.camp_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  writing boolean := current_setting('grimoire.camp_write', true) = 'on';
  free text[] := array['undone', 'version', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    if not writing then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    new.undone := false;
    new.created_by := (select auth.uid());
    if tg_table_name = 'camps' then
      new.applied_at := null;
    end if;
    return new;
  end if;
  if tg_table_name = 'camps' and (writing or reverting) then
    free := free || 'applied_at';
  end if;
  if not (reverting or (writing and tg_table_name = 'camps'))
    or (to_jsonb(new) - free) is distinct from (to_jsonb(old) - free)
    or (writing and not reverting and new.undone is distinct from old.undone) then
    raise exception 'That can''t be changed.';
  end if;
  if tg_table_name = 'camps' and new.undone and not old.undone
    and exists (select 1 from public.camp_entries e where e.camp_id = new.id and not e.undone) then
    raise exception 'Undo the camp''s steps first.';
  end if;
  if tg_table_name = 'camp_entries' and new.undone and not old.undone and old.kind = 'cook'
    and (select coalesce(sum(e.qty), 0) from public.camp_entries e where e.camp_id = old.camp_id and e.kind = 'cook' and not e.undone and e.id <> old.id)
      < (select count(*) from public.camp_entries e where e.camp_id = old.camp_id and e.kind = 'meal' and e.from_pot and not e.undone) then
    raise exception 'Some of those portions were eaten: undo the meals first.';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

-- As in 20261103160000_m5b_4_camp.sql, and an applied camp is over.
create or replace function private.camp_for_me(camp uuid) returns public.camps
language plpgsql security definer set search_path = '' as $$
declare
  cmp public.camps;
begin
  select * into cmp from public.camps c where c.id = camp and not c.undone for update;
  if cmp.id is null or not (private.is_gm(cmp.campaign_id) or private.in_my_group(cmp.campaign_id, cmp.group_number)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if cmp.expedition_id is distinct from private.expedition_under_way(cmp.campaign_id) or cmp.applied_at is not null then
    raise exception 'That camp is over.';
  end if;
  return cmp;
end;
$$;
revoke execute on function private.camp_for_me(uuid) from public, anon, authenticated;

-- 4. Watches, sleep, applying ------------------------------------------------------------------------------------------

-- camp.watches: the group's watch order (D18): `watches` [[actor ids], …], each watch 1–3 of the group's characters,
-- nobody twice. The order is the group's: the GM or any player of the group sets it. `actor` is who set it (one of the
-- caller's characters in the group; the GM's: any of the group's).
create function public.set_camp_watches(camp uuid, actor uuid, watches jsonb)
returns public.camp_entries
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('camp_entries');
  cmp public.camps;
  one jsonb;
  who text;
  seen uuid[] := '{}';
  entry public.camp_entries;
begin
  if made is not null then
    select * into entry from public.camp_entries e where e.id = made;
    return entry;
  end if;
  cmp := private.camp_for_me(camp);
  perform private.camp_actor(cmp, actor);
  if watches is null or jsonb_typeof(watches) <> 'array' or jsonb_array_length(watches) > 24 then
    raise exception 'The watches must be a list.';
  end if;
  for one in select * from jsonb_array_elements(watches) loop
    if jsonb_typeof(one) <> 'array' or jsonb_array_length(one) not between 1 and 3 then
      raise exception 'Each watch holds 1 to 3 characters.';
    end if;
    for who in select * from jsonb_array_elements_text(one) loop
      if not private.actor_in_group(cmp.campaign_id, cmp.group_number, who::uuid) or who::uuid = any (seen) then
        raise exception 'Each watch is the group''s own characters, each once.';
      end if;
      seen := seen || who::uuid;
    end loop;
  end loop;
  perform set_config('grimoire.camp_write', 'on', true);
  insert into public.camp_entries (camp_id, campaign_id, group_number, kind, actor_id, at, detail)
  values (cmp.id, cmp.campaign_id, cmp.group_number, 'watches', actor, private.clock_now(cmp.campaign_id), watches)
  returning * into entry;
  perform set_config('grimoire.camp_write', '', true);
  return entry;
end;
$$;
revoke execute on function public.set_camp_watches(uuid, uuid, jsonb) from public, anon;
grant execute on function public.set_camp_watches(uuid, uuid, jsonb) to authenticated, service_role;

-- camp.sleep: one character's sleep (D19). A player for their own character: the roll as entered and how they slept
-- (good or bad). The GM for anyone, and only the GM sets the difficulty (`difficulty`, the pack's id; changing it).
create function public.camp_sleep(camp uuid, actor uuid, difficulty text default null, roll text default null, outcome text default null)
returns public.camp_entries
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('camp_entries');
  cmp public.camps;
  entry public.camp_entries;
begin
  if made is not null then
    select * into entry from public.camp_entries e where e.id = made;
    return entry;
  end if;
  cmp := private.camp_for_me(camp);
  perform private.camp_actor(cmp, actor);
  if nullif(trim(coalesce(difficulty, '')), '') is not null and not private.is_gm(cmp.campaign_id) then
    raise exception 'Only the GM changes how hard sleep is.';
  end if;
  if outcome is not null and outcome not in ('good', 'bad') then
    raise exception 'Say how they slept.';
  end if;
  if nullif(trim(coalesce(difficulty, '')), '') is null and outcome is null then
    raise exception 'Say how they slept.';
  end if;
  perform set_config('grimoire.camp_write', 'on', true);
  insert into public.camp_entries (camp_id, campaign_id, group_number, kind, actor_id, at, outcome, detail)
  values (cmp.id, cmp.campaign_id, cmp.group_number, 'sleep', actor, private.clock_now(cmp.campaign_id), outcome,
    jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('difficulty', nullif(left(trim(coalesce(difficulty, '')), 200), ''),
      'roll', nullif(left(trim(coalesce(roll, '')), 40), '')))))
  returning * into entry;
  perform set_config('grimoire.camp_write', '', true);
  return entry;
end;
$$;
revoke execute on function public.camp_sleep(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.camp_sleep(uuid, uuid, text, text, text) to authenticated, service_role;

-- camp.apply: Next day applies the camps (D20): each named camp of the expedition under way, open, is marked applied
-- at the clock's time. The GM's; sent in the same request as the clock's move, so its Undo takes this back too.
create function public.apply_camps(campaign uuid, camps uuid[])
returns setof public.camps
language plpgsql security definer set search_path = '' as $$
declare
  trip uuid;
begin
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  trip := private.expedition_under_way(campaign);
  perform set_config('grimoire.camp_write', 'on', true);
  return query
    with applied as (
      update public.camps c set applied_at = private.clock_now(campaign)
      where c.id = any (coalesce(apply_camps.camps, '{}')) and c.campaign_id = campaign and c.expedition_id = trip and not c.undone and c.applied_at is null
      returning c.*
    )
    select * from applied;
  perform set_config('grimoire.camp_write', '', true);
end;
$$;
revoke execute on function public.apply_camps(uuid, uuid[]) from public, anon;
grant execute on function public.apply_camps(uuid, uuid[]) to authenticated, service_role;

-- 5. Which watch? ------------------------------------------------------------------------------------------------------

-- As in 20261103100000_m5b_2_waiting_encounters.sql, but set_encounter_watch may write `watch` (grimoire.set_watch on).
create or replace function private.waiting_encounter_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  setting_watch boolean := current_setting('grimoire.set_watch', true) = 'on';
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
      if setting_watch then
        new.watch := nullif(trim(coalesce(new.watch, '')), '');
      else
        new.watch := old.watch;
      end if;
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

-- encounter.watch: Which watch? (D18): the watch awake when the night hit came ("Watch 2 · Reed, Moss"). The GM's.
create function public.set_encounter_watch(encounter uuid, watch text, seen_version integer default null)
returns public.waiting_encounters
language plpgsql security invoker set search_path = '' as $$
declare
  found_row public.waiting_encounters;
begin
  perform set_config('grimoire.set_watch', 'on', true);
  update public.waiting_encounters w set watch = left(trim(coalesce(set_encounter_watch.watch, '')), 200), version = coalesce(seen_version, w.version)
  where w.id = encounter and w.state = 'waiting' and not w.undone
  returning * into found_row;
  perform set_config('grimoire.set_watch', '', true);
  if found_row.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found_row;
end;
$$;
revoke execute on function public.set_encounter_watch(uuid, text, integer) from public, anon;
grant execute on function public.set_encounter_watch(uuid, text, integer) to authenticated, service_role;

-- 6. The log and undo ----------------------------------------------------------------------------------------------------

insert into public.undoable_makings (name) values ('camp.watches'), ('camp.sleep') on conflict do nothing;

insert into public.logged_commands (name, level, gm_only) values
  ('camp.watches', 'simple', false),
  ('camp.sleep', 'verbose', false),
  ('camp.apply', 'simple', true),
  ('encounter.watch', 'verbose', true);
