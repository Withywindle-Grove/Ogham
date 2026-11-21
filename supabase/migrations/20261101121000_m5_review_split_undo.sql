-- M5 review fixes, item 7 (docs/plans/m5-review-fixes.md): a player's own split, undone, left a live place row for
-- the group they had made. A split's new group starts where they were (private.follow_into_group makes that row
-- in the player's request), but its log line is the GM's, so the player's undo (which sees only lines they can read)
-- never marked the row undone. Now the undo marks every place row the split or Join up made, with the owner's rights
-- (as the trigger made it), skipping any already undone (the GM's undo marks them itself).
-- Replaces private.undo_body (newest copy: 20261031120000_m5_statuses.sql); adds one function. Drops nothing; no
-- rows are removed.

create function private.undo_follow_places(picked public.events) returns void
language plpgsql security definer set search_path = '' as $$
declare
  change public.events;
begin
  if picked.type not in ('party.chooseGroup', 'party.joinUp') or picked.request_id is null then
    return;
  end if;
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id and e.target_table = 'group_places'
      and e.before is null and e.after is not null
      and e.request_id = picked.request_id and e.actor_user_id is not distinct from picked.actor_user_id
      and not exists (select 1 from public.events r where r.reverts_event_id = e.id)
  loop
    perform set_config('grimoire.reverting', change.id::text, true);
    update public.group_places gp set undone = true where gp.id = change.target_id and not gp.undone;
  end loop;
end;
$$;
revoke execute on function private.undo_follow_places(public.events) from public, anon;
grant execute on function private.undo_follow_places(public.events) to authenticated, service_role;

-- As in 20261031120000_m5_statuses.sql, plus the place rows a split or a Join up made (private.undo_follow_places).
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
  -- The place rows a split or a Join up made: the GM's lines, so a player's undo must mark them with the owner's rights.
  perform private.undo_follow_places(picked);
  perform private.undo_put_back(picked, passing, splits);
  perform set_config('grimoire.reverting', '', true);
end;
$$;
