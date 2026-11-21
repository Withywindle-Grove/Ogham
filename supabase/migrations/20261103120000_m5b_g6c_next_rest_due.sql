-- M5b g6 follow-up, SC-g6-3 (ruled B by Francis, 2026-11-03; plan docs/plans/m5b-g6-rest-and-table-view.md,
-- Departures, "Follow-up (rulings of 2026-11-03)"; mockup docs/design/mockups/m5-gate/b5-rest-flow.html, panel 4):
-- the applied rest's log line names when the next rest falls due ("… · next rest due turn 20"). The database doesn't
-- know the mode's rest period, so the GM's Next turn sends it with the answers: `rest.nextDue` = {"at": clock
-- seconds, "unit": "turn", "number": 20}, counted as the time strip counts. apply_rest_flow keeps it on each row in the
-- flow (`character_rests.next_due`), so the rest.applied events carry it and the log line can read it. Old log lines
-- (without it) read as before. Only the GM (moving the clock) sets it.
-- Adds one column (empty on every row); replaces private.apply_rest_flow (from its newest definition,
-- 20261102350000_m5b_g6_until_rest.sql) and private.rest_rules (from its newest, 20261102330000_m5b_g6_rest_flow.sql).
-- Drops nothing; no rows are removed or changed.

alter table public.character_rests
  add column next_due jsonb check (next_due is null or jsonb_typeof(next_due) = 'object');

-- As in 20261102330000_m5b_g6_rest_flow.sql, plus: only the GM changes next_due.
create or replace function private.rest_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.campaign_id is distinct from old.campaign_id then
    raise exception 'That can''t be changed.';
  end if;
  if not private.is_gm(new.campaign_id) and coalesce(current_setting('grimoire.reverting', true), '') = '' then
    if new.rested_at is distinct from old.rested_at or new.period_from is distinct from old.period_from or new.pushed_on_at is distinct from old.pushed_on_at
      or new.next_due is distinct from old.next_due then
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

-- As in 20261102350000_m5b_g6_until_rest.sql, plus: `rest.nextDue`, when it is a well-formed object, is kept on every
-- row in the flow (null otherwise).
create or replace function private.apply_rest_flow(campaign uuid, from_at bigint, rest jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  row_now public.character_rests;
  pushers uuid[] := '{}';
  wanted uuid[];
  cond jsonb := rest -> 'condition';
  due jsonb := rest -> 'nextDue';
  due_next jsonb;
begin
  if from_at is null or rest is null or jsonb_typeof(rest -> 'actors') <> 'array' then
    return;
  end if;
  select coalesce(array_agg(value::uuid), '{}') into wanted from jsonb_array_elements_text(rest -> 'actors');
  if cardinality(wanted) = 0 then
    return;
  end if;
  -- The new part: the next due time, as the GM's device counted it.
  if jsonb_typeof(due) = 'object'
    and jsonb_typeof(due -> 'at') = 'number' and (due ->> 'at') ~ '^[0-9]{1,15}$'
    and jsonb_typeof(due -> 'number') = 'number' and (due ->> 'number') ~ '^[0-9]{1,9}$'
    and jsonb_typeof(due -> 'unit') = 'string' and char_length(trim(due ->> 'unit')) between 1 and 40 then
    due_next := jsonb_build_object('at', (due ->> 'at')::bigint, 'unit', trim(due ->> 'unit'), 'number', (due ->> 'number')::integer);
  end if;
  perform set_config('grimoire.event_type', 'rest.applied', true);
  for row_now in
    select * from public.character_rests r where r.campaign_id = campaign and r.actor_id = any (wanted) order by r.actor_id for update
  loop
    if row_now.chosen_at is not null then
      update public.character_rests r
      set rested_at = from_at, chosen_at = null, pushing_at = null, pushed_on_at = null, period_from = from_at, called_at = null, called_by = null,
          next_due = due_next
      where r.id = row_now.id;
      update public.character_statuses s set ended_at = from_at, end_reason = 'rested'
      where s.actor_id = row_now.actor_id and (s.source = 'rest' or s.until_rest) and s.ended_at is null and not s.undone;
    else
      update public.character_rests r
      set pushed_on_at = coalesce(r.pushed_on_at, from_at), pushing_at = null, period_from = from_at, called_at = null, called_by = null,
          next_due = due_next
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
