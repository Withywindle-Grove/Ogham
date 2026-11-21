-- Fix forward for 20261026120000_m4b_undo_split.sql (re-test ruling 5): a player undoing part of a stack given to
-- another character was told the part was gone, because the check locked the part (FOR UPDATE), and locking a line
-- needs the right to change it, which the giver no longer has. The check now only reads it; the removal runs in the
-- same step. Replaces one function. Drops nothing.

-- Undo: as in 20261026120000_m4b_undo_split.sql, reading the split-off part without locking it.
create or replace function private.undo_body(event_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  picked public.events;
  change public.events;
  current_row jsonb;
  key text;
  assignments text;
  id_column text;
  as_gm boolean;
  changed_rows integer;
  is_drop boolean;
  dropped uuid[];
  passing uuid[];
  carrier_status text;
  splits uuid[];
  expected jsonb;
begin
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
    -- A split-off part: it goes back only as the move left it (every value the move gave it, still there).
    if change.target_table = 'inventory_lines' and change.target_id = any (splits) then
      if change.before is null then
        if exists (select 1 from public.events r where r.reverts_event_id = change.id) then
          raise exception 'That was already undone.';
        end if;
        -- Read, not locked: a player may read a line on another character but not lock it (locking needs the right
        -- to change it); the removal below runs in the same step.
        select to_jsonb(t) into current_row from public.inventory_lines t where t.id = change.target_id;
        select coalesce(jsonb_object_agg(k.key, k.value), '{}') into expected from (
          select distinct on (kv.key) kv.key, kv.value
          from public.events e, jsonb_each(e.after) kv
          where e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.target_id = change.target_id
            and e.after is not null
            and (e.id = picked.id
              or (picked.request_id is not null and e.request_id = picked.request_id
                  and e.actor_user_id is not distinct from picked.actor_user_id))
          order by kv.key, e.seq desc
        ) k;
        if current_row is null then
          raise exception 'The part that was moved is gone, so it can''t go back.';
        end if;
        for key in select jsonb_object_keys(expected) loop
          if key <> 'updated_at' and (current_row -> key) is distinct from (expected -> key) then
            raise exception 'The part that was moved has changed since, so it can''t go back.';
          end if;
        end loop;
      end if;
      continue;
    end if;
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
    id_column := case when change.target_table = 'actor_secrets' then 'actor_id' else 'id' end;
    -- Locked until the undo finishes, so nothing slips in between the check and the write.
    execute format('select to_jsonb(t) from public.%I t where t.%I = $1 for update', change.target_table, id_column)
      into current_row using change.target_id;
    if change.after is null then
      -- A dropped item comes back only where it was, and only if nothing has taken its place.
      if current_row is not null then
        raise exception 'That''s changed since. Undo the later change first.';
      end if;
      if change.target_table = 'inventory_lines' then
        if change.before ->> 'actor_id' is not null then
          select a.status into carrier_status from public.actors a where a.id = (change.before ->> 'actor_id')::uuid;
          if carrier_status is null or carrier_status = 'archived' then
            raise exception 'Whoever carried it isn''t in play any more, so it can''t come back.';
          end if;
        end if;
        if change.before ->> 'container_line_id' is not null
          and not ((change.before ->> 'container_line_id')::uuid = any (dropped))
          and not exists (
            select 1 from public.inventory_lines l
            where l.id = (change.before ->> 'container_line_id')::uuid
              and l.actor_id is not distinct from (change.before ->> 'actor_id')::uuid
              and l.location_id is not distinct from (change.before ->> 'location_id')::uuid
          ) then
          raise exception 'The container it was in is gone or has moved, so it can''t go back.';
        end if;
      end if;
      continue;
    end if;
    -- A change to a line this action then removed (whoever it went to): the line comes back as the removal left
    -- it, so nothing can have changed it since; the change is put back after.
    if change.target_table = 'inventory_lines' and change.target_id = any (dropped) then
      continue;
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
  end loop;

  -- First the dropped lines come back, as they were (containers before what was in them), with their GM-only rows.
  if is_drop then
    for change in
      select * from public.events e
      where e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.after is null
        and e.target_id = any (dropped)
        and (e.id = picked.id
          or (picked.request_id is not null and e.request_id = picked.request_id
              and e.actor_user_id is not distinct from picked.actor_user_id))
      order by (e.before ->> 'container_line_id') is not null, e.seq
    loop
      perform set_config('grimoire.reverting', change.id::text, true);
      insert into public.inventory_lines
        select * from jsonb_populate_record(null::public.inventory_lines, change.before);
    end loop;
    perform set_config('grimoire.restoring', picked.id::text, true);
    perform private.restore_dropped_secrets(picked.id);
    perform set_config('grimoire.restoring', '', true);
  end if;

  -- A split-off part goes back into the stack it came from: the part is removed (logged against the event that
  -- made it), and the stack's count is put back below.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.before is null
      and e.target_id = any (splits)
      and (e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id))
  loop
    perform set_config('grimoire.reverting', change.id::text, true);
    perform private.unsplit_line(change.target_id, change.id);
  end loop;

  -- Then put the changed values back, newest change first, each linked to the event it reverses.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id
      and e.after is not null
      and not (e.target_table in ('inventory_lines', 'inventory_line_secrets') and e.target_id = any (passing))
      and not (e.target_table in ('inventory_lines', 'inventory_line_secrets') and e.target_id = any (splits))
      and (
        e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id)
      )
    order by e.seq desc
  loop
    id_column := case when change.target_table = 'actor_secrets' then 'actor_id' else 'id' end;
    select string_agg(format('%I = r.%I', k, k), ', ') into assignments from jsonb_object_keys(change.before) k;
    perform set_config('grimoire.reverting', change.id::text, true);
    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.%I = $2',
      change.target_table, assignments, change.target_table, id_column
    ) using change.before, change.target_id;
    get diagnostics changed_rows = row_count;
    if changed_rows <> 1 then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
  end loop;
  perform set_config('grimoire.reverting', '', true);
end;
$$;
