-- M2 review fixes, part 2: a player's undo runs as the player.
-- Postgres won't switch roles inside a SECURITY DEFINER function, so undo is split:
--   * private.undo_body: the checks and the writes, running with whoever calls it (SECURITY INVOKER);
--   * private.undo_as_gm: the GM's path, with the database's privileges (so the GM can also put back rows a
--     player's action touched, like the active character an approval set); refuses anyone but the GM;
--   * public.undo_request: what the app calls, running as the caller: the GM goes through undo_as_gm,
--     everyone else straight through undo_body, under their own access rules.

create function private.undo_body(event_id uuid) returns void
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
    if change.before is null or change.after is null then
      raise exception 'Making or deleting things can''t be undone.';
    end if;
    if change.target_table not in ('campaigns', 'members', 'invites', 'companies', 'field_definitions', 'assets', 'actors', 'actor_secrets', 'notes') then
      raise exception 'That can''t be undone.';
    end if;
    if exists (select 1 from public.events r where r.reverts_event_id = change.id) then
      raise exception 'That was already undone.';
    end if;
    id_column := case when change.target_table = 'actor_secrets' then 'actor_id' else 'id' end;
    -- Locked until the undo finishes, so nothing slips in between the check and the write.
    execute format('select to_jsonb(t) from public.%I t where t.%I = $1 for update', change.target_table, id_column)
      into current_row using change.target_id;
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

  -- Then put the values back, newest change first, each linked to the event it reverses.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id
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
revoke execute on function private.undo_body(uuid) from public, anon;
grant execute on function private.undo_body(uuid) to authenticated, service_role;

create function private.undo_as_gm(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.events e where e.id = event_id and private.is_gm(e.campaign_id)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.undo_body(event_id);
end;
$$;
revoke execute on function private.undo_as_gm(uuid) from public, anon;
grant execute on function private.undo_as_gm(uuid) to authenticated, service_role;

drop function public.undo_request(uuid);
create function public.undo_request(event_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  campaign uuid;
begin
  -- Only an entry this person can see (the events reading rule applies here).
  select e.campaign_id into campaign from public.events e where e.id = event_id;
  if campaign is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if private.is_gm(campaign) then
    perform private.undo_as_gm(event_id);
  else
    perform private.undo_body(event_id);
  end if;
end;
$$;
revoke execute on function public.undo_request(uuid) from public, anon;
grant execute on function public.undo_request(uuid) to authenticated, service_role;
