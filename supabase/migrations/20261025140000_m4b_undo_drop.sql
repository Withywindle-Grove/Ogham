-- M4b: undo a drop (ruled 2026-10-25; docs/05 "Dropping", CLAUDE.md hard rule 4's third exception). Dropping an
-- item deletes its line; the drop's events keep a full copy (the line, and its GM-only row), and Undo from the log
-- recreates it where it was. Replaces one function and adds one. Drops nothing.
--   Only drops: Drop (inventory.remove taking all of a line) and Empty… → Drop all (inventory.empty). Other
--   deletions (declining a one-off, giving to someone outside the party) still can't be undone.
--   It comes back only where it was: the character still in play (not archived), the container still there on the
--   same carrier (or coming back in the same undo), and nothing with its id since. Otherwise it says why and changes nothing.
--   A player undoing their own drop can't read or write the line's GM-only row, so that part is put back by
--   private.restore_dropped_secrets, which runs only inside this undo, for lines it has just put back.

-- The GM-only rows that went with the lines an undo has just put back (hidden charge totals). Only during an undo
-- of that action (grimoire.restoring names it), and only for lines that are back and have no such row.
create function private.restore_dropped_secrets(picked_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  picked public.events;
  change public.events;
begin
  if nullif(current_setting('grimoire.restoring', true), '') is distinct from picked_id::text then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select * into picked from public.events e where e.id = picked_id;
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id
      and e.target_table = 'inventory_line_secrets' and e.after is null and e.before is not null
      and (e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id))
      and not exists (select 1 from public.events r where r.reverts_event_id = e.id)
    order by e.seq
  loop
    if exists (select 1 from public.inventory_lines l where l.id = change.target_id)
      and not exists (select 1 from public.inventory_line_secrets s where s.id = change.target_id) then
      perform set_config('grimoire.reverting', change.id::text, true);
      insert into public.inventory_line_secrets
        select * from jsonb_populate_record(null::public.inventory_line_secrets, change.before);
    end if;
  end loop;
end;
$$;
revoke execute on function private.restore_dropped_secrets(uuid) from public, anon;
grant execute on function private.restore_dropped_secrets(uuid) to authenticated, service_role;

-- Undo: as in 20261023120000_m4_inventory.sql, plus putting back what a drop deleted.
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
  carrier_status text;
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
  -- A drop (ruled 2026-10-25): the only deletions that can be undone.
  is_drop := picked.type in ('inventory.remove', 'inventory.empty');
  select coalesce(array_agg(e.target_id), '{}') into dropped from public.events e
  where is_drop and e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.after is null
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

  -- Then put the changed values back, newest change first, each linked to the event it reverses.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id
      and e.after is not null
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
