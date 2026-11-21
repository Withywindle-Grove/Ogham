-- Ruling on 5b (design Project, 2026-10-26): Undo of a give brings back what's left when the receiver only used some
-- (its count went down) or only moved it within their own pack (another container, worn or held). It's refused, with
-- the reason, when the item changed in any other way: renamed, identified or revealed, charges spent, or given on
-- ("Ilsa gave them to Bram"). Fixes forward 20261026170000_m4b_undo_whats_left.sql (already on the test project).
-- Replaces private.given_left, private.unmove_line and private.undo_body (same signatures). Drops nothing.

-- Who holds a line, by name: the character, or the place (the Party stash).
create function private.holder_name(actor uuid, place uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select a.name from public.actors a where a.id = actor),
                  (select c.name from public.locations c where c.id = place), 'someone');
$$;
revoke execute on function private.holder_name(uuid, uuid) from public, anon;
grant execute on function private.holder_name(uuid, uuid) to authenticated, service_role;

-- What's left of a moved line, or the reason it can't come back: only for the move's author or the GM. Everything
-- done to the line since the move (leaving out changes that were themselves undone) may only lower its count or move
-- it within the receiver's own pack. Returns {left, of, name, by}.
create or replace function private.given_left(line uuid, moved_by uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  moved public.events;
  move_end bigint;
  handed jsonb;
  receiver text;
  now_line public.inventory_lines;
  later public.events;
  next_to jsonb;
  key text;
  at_move integer;
begin
  select * into moved from public.events e where e.id = moved_by;
  if moved.id is null or moved.type <> 'inventory.move' or moved.target_table <> 'inventory_lines'
    or moved.target_id is distinct from line
    or not (private.is_gm(moved.campaign_id) or moved.actor_user_id = (select auth.uid())) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- The move's own changes to the line (a split is made on the giver, then handed over).
  select max(e.seq) into move_end from public.events e
  where e.campaign_id = moved.campaign_id
    and (e.id = moved.id or (moved.request_id is not null and e.request_id = moved.request_id
                             and e.actor_user_id is not distinct from moved.actor_user_id));
  select e.after into handed from public.events e
  where e.campaign_id = moved.campaign_id and e.target_table = 'inventory_lines' and e.target_id = line
    and e.seq <= move_end and e.after is not null and (e.after ? 'actor_id' or e.after ? 'location_id')
  order by e.seq desc limit 1;
  receiver := private.holder_name((handed ->> 'actor_id')::uuid, (handed ->> 'location_id')::uuid);

  for later in
    select * from public.events e
    where e.campaign_id = moved.campaign_id and e.target_table = 'inventory_lines' and e.target_id = line
      and e.seq > move_end and e.reverts_event_id is null
      and not exists (select 1 from public.events r where r.reverts_event_id = e.id)
    order by e.seq
  loop
    if later.after is null then
      if later.type = 'inventory.giveAway' then
        raise exception '% gave them to %.', receiver, coalesce(later.before ->> 'given_to', 'someone');
      end if;
      raise exception 'None of it is left, so nothing can come back.';
    end if;
    for key in select jsonb_object_keys(later.after) loop
      continue when key in ('updated_at', 'container_line_id', 'equipped');
      if key in ('actor_id', 'location_id') then
        raise exception '% gave them to %.', receiver,
          private.holder_name((later.after ->> 'actor_id')::uuid, (later.after ->> 'location_id')::uuid);
      end if;
      if key = 'qty' and later.type in ('inventory.move', 'inventory.giveAway') then
        -- Part of it split off and handed on: who got it is in the same action.
        select e.after into next_to from public.events e
        where e.campaign_id = later.campaign_id and later.request_id is not null and e.request_id = later.request_id
          and e.target_table = 'inventory_lines' and e.target_id <> line and e.after is not null
          and (e.after ? 'actor_id' or e.after ? 'location_id' or e.after ? 'given_to')
        order by e.seq desc limit 1;
        raise exception '% gave some to %.', receiver,
          coalesce(next_to ->> 'given_to',
                   private.holder_name((next_to ->> 'actor_id')::uuid, (next_to ->> 'location_id')::uuid));
      end if;
      continue when key = 'qty' and (later.after ->> 'qty')::integer < coalesce((later.before ->> 'qty')::integer, 0);
      if key = 'name' then
        raise exception '% renamed it since, so it can''t go back.', receiver;
      end if;
      if key in ('charges_used', 'charges_left', 'spent', 'spent_shown') then
        raise exception '% used its charges since, so it can''t go back.', receiver;
      end if;
      if key in ('item_data', 'charges_hidden') then
        raise exception 'It''s been identified since, so it can''t go back.';
      end if;
      raise exception 'It''s changed since, so it can''t go back.';
    end loop;
  end loop;

  select * into now_line from public.inventory_lines l where l.id = line;
  if now_line.id is null or now_line.qty < 1 then
    raise exception 'None of it is left, so nothing can come back.';
  end if;
  select (e.after ->> 'qty')::integer into at_move from public.events e
  where e.campaign_id = moved.campaign_id and e.target_table = 'inventory_lines' and e.target_id = line
    and e.seq <= move_end and e.after ? 'qty'
  order by e.seq desc limit 1;
  at_move := coalesce(at_move, now_line.qty);
  if now_line.qty > at_move then
    raise exception 'It''s changed since, so it can''t go back.';
  end if;
  return jsonb_build_object('left', now_line.qty, 'of', at_move, 'name', now_line.name, 'by', receiver);
end;
$$;

-- As in 20261026170000_m4b_undo_whats_left.sql, but a whole line the receiver moved within their own pack (another
-- container, worn or held) still goes back: only where it is (character or place) must be as the move left it.
create or replace function private.unmove_line(line uuid, moved_by uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  moved public.events;
  now_row jsonb;
  key text;
  assignments text;
  put_back jsonb;
  used integer := coalesce(nullif(current_setting('grimoire.used', true), '')::integer, 0);
begin
  select * into moved from public.events e where e.id = moved_by;
  if moved.id is null or moved.type <> 'inventory.move' or moved.target_table <> 'inventory_lines'
    or moved.target_id is distinct from line or moved.before is null or moved.after is null
    or nullif(current_setting('grimoire.reverting', true), '') is distinct from moved_by::text
    or not (private.is_gm(moved.campaign_id) or moved.actor_user_id = (select auth.uid())) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select to_jsonb(t) into now_row from public.inventory_lines t where t.id = line for update;
  if now_row is null then
    raise exception 'That''s changed since. Undo the later change first.';
  end if;
  for key in select jsonb_object_keys(moved.after) loop
    if key not in ('updated_at', 'container_line_id', 'equipped') and (now_row -> key) is distinct from (moved.after -> key) then
      raise exception 'That''s changed since. Undo the later change first.';
    end if;
  end loop;
  put_back := moved.before;
  if used > 0 and put_back ? 'qty' then
    put_back := jsonb_set(put_back, '{qty}', to_jsonb((put_back ->> 'qty')::integer - used));
  end if;
  -- Moved in the receiver's pack: it comes back where the giver had it (the give's own values), else loose.
  if not (moved.after ? 'qty') then
    put_back := jsonb_build_object('container_line_id', null, 'equipped', false) || put_back;
  end if;
  select string_agg(format('%I = r.%I', k, k), ', ') into assignments from jsonb_object_keys(put_back) k;
  execute format(
    'update public.inventory_lines t set %s from jsonb_populate_record(null::public.inventory_lines, $1) r where t.id = $2',
    assignments
  ) using put_back, line;
end;
$$;

-- Undo: as in 20261026170000_m4b_undo_whats_left.sql, but a given line the receiver moved within their own pack
-- (another container, worn or held) still comes back, and private.given_left gives the reason for any refusal.
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
  came_back jsonb;
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
        -- What's left, or the reason it can't come back (used some, or moved in their own pack, is fine).
        came_back := private.given_left(change.target_id, change.id);
        for key in select jsonb_object_keys(expected) loop
          if key not in ('updated_at', 'qty', 'container_line_id', 'equipped') and (current_row -> key) is distinct from (expected -> key) then
            raise exception 'It''s changed since, so it can''t go back.';
          end if;
        end loop;
        perform set_config('grimoire.came_back', came_back::text, true);
        perform set_config('grimoire.used', ((came_back ->> 'of')::integer - (came_back ->> 'left')::integer)::text, true);
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
    if picked.type = 'inventory.move' and change.target_table = 'inventory_lines' then
      -- A moved line may now be on another character, which the giver can read but not lock; private.unmove_line
      -- locks it and checks it again when it puts it back.
      select to_jsonb(t) into current_row from public.inventory_lines t where t.id = change.target_id;
    else
      -- Locked until the undo finishes, so nothing slips in between the check and the write.
      execute format('select to_jsonb(t) from public.%I t where t.%I = $1 for update', change.target_table, id_column)
        into current_row using change.target_id;
    end if;
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
    -- A whole line moved: what's left of it comes back (5b), or the reason it can't.
    if picked.type = 'inventory.move' and change.target_table = 'inventory_lines' and not (change.after ? 'qty') then
      came_back := private.given_left(change.target_id, change.id);
      perform set_config('grimoire.came_back', came_back::text, true);
    end if;
    if current_row is null and picked.type = 'inventory.move' and change.target_table = 'inventory_lines' then
      raise exception 'None of it is left, so nothing can come back.';
    end if;
    if current_row is null then
      if as_gm then
        raise exception 'That''s changed since. Undo the later change first.';
      end if;
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    for key in select jsonb_object_keys(change.after) loop
      if (current_row -> key) is distinct from (change.after -> key)
        and not (picked.type = 'inventory.move' and change.target_table = 'inventory_lines' and not (change.after ? 'qty')
                 and key in ('container_line_id', 'equipped', 'updated_at')) then
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
    if picked.type = 'inventory.move' and change.target_table = 'inventory_lines' then
      perform private.unmove_line(change.target_id, change.id);
      continue;
    end if;
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

