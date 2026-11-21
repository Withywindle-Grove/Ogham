-- M2 review fixes (found by the milestone's fresh-session review; each pinned by supabase/tests/review-fixes.test.ts).
-- 1. Undo reverses only the picked person's changes: an action's events must share both its request id and its
--    author, so copying someone else's request id onto your own change no longer pulls their change in.
-- 2. A player's undo follows the normal access rules: it runs as the player (only the GM's undo keeps the
--    database's privileges), each row must still be one they may change, and they must be able to see the entry.
--    Rows are locked while checked, so a change landing at the same moment can't be overwritten.
-- 3. A note about a character takes that character's visibility (GM only, or its owner and the GM), combined with
--    the visibility of the entry it's added to.
-- 4. The database names log entries from a fixed list of commands (GM-only names only for the GM) and sets each
--    name's level itself, instead of trusting the request's tag.

create or replace function private.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  this_row jsonb := coalesce(new_row, old_row);
  campaign uuid;
  before_values jsonb := old_row;
  after_values jsonb := new_row;
  key text;
  tag jsonb;
  event_type text;
  event_level text := 'verbose';
  is_fiat boolean := false;
  why text;
  request uuid;
  who_sees text := 'all';
  owner uuid;
  reverting uuid := nullif(current_setting('grimoire.reverting', true), '')::uuid;
begin
  -- Which campaign it belongs to.
  if tg_table_name = 'campaigns' then
    campaign := (this_row ->> 'id')::uuid;
  elsif tg_table_name = 'actor_secrets' then
    select a.campaign_id into campaign from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
  else
    campaign := (this_row ->> 'campaign_id')::uuid;
  end if;
  -- A campaign being deleted takes its events with it; don't log the rows that go with it.
  if campaign is null or not exists (select 1 from public.campaigns c where c.id = campaign) then
    return null;
  end if;

  -- For a change, keep only the values that changed; a change that changes nothing isn't logged.
  if tg_op = 'UPDATE' then
    before_values := '{}'::jsonb;
    after_values := '{}'::jsonb;
    for key in select jsonb_object_keys(new_row) loop
      if key <> 'updated_at' and (old_row -> key) is distinct from (new_row -> key) then
        before_values := before_values || jsonb_build_object(key, old_row -> key);
        after_values := after_values || jsonb_build_object(key, new_row -> key);
      end if;
    end loop;
    if after_values = '{}'::jsonb then
      return null;
    end if;
  end if;

  -- Who may see it: like the rows themselves.
  if tg_table_name = 'notes' then
    -- A note carries its own audience (copied from the entry it was added to).
    who_sees := this_row ->> 'audience';
    owner := (this_row ->> 'owner_user_id')::uuid;
  elsif tg_table_name in ('invites', 'actor_secrets') then
    who_sees := 'gm';
  elsif tg_table_name = 'assets' and this_row ->> 'kind' not in ('portrait', 'sigil') then
    who_sees := 'gm';
  elsif tg_table_name = 'actors'
    and coalesce(new_row ->> 'approval', '') <> 'approved'
    and coalesce(old_row ->> 'approval', '') <> 'approved' then
    if this_row ->> 'owner_type' = 'user' then
      who_sees := 'owner';
      owner := (this_row ->> 'owner_user_id')::uuid;
    else
      who_sees := 'gm';
    end if;
  end if;

  -- The command's tag, if the request has one. A broken tag just means a plain name.
  begin
    tag := convert_from(
      decode(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-grimoire-command', 'base64'),
      'UTF8'
    )::jsonb;
    request := (tag ->> 'requestId')::uuid;
  exception when others then
    tag := null;
    request := null;
  end;
  -- The database names the entry: only our commands' names count (GM-only ones only for the GM), and each
  -- name's log level is fixed here. Anything else gets a plain name like "actors.update".
  event_type := tag ->> 'type';
  event_level := case
    when event_type in ('character.setHp', 'field.reorder', 'note.edit') then 'verbose'
    else 'simple'
  end;
  if event_type is null
    or event_type not in (
      'campaign.create', 'campaign.update', 'campaign.setSigil', 'campaign.clearSigil',
      'invite.create', 'invite.revoke', 'invite.redeem', 'member.setActiveCharacter',
      'company.create', 'company.rename', 'company.delete',
      'character.create', 'character.edit', 'character.review', 'character.resubmit', 'character.archive',
      'character.restore', 'character.delete', 'character.assignCompany', 'character.setPortrait',
      'character.clearPortrait', 'character.setHp',
      'field.create', 'field.update', 'field.reorder', 'field.delete',
      'note.add', 'note.edit', 'event.undo'
    )
    or (
      event_type in (
        'campaign.update', 'campaign.setSigil', 'campaign.clearSigil', 'invite.create', 'invite.revoke',
        'company.create', 'company.rename', 'company.delete', 'character.review', 'character.restore',
        'character.assignCompany', 'field.create', 'field.update', 'field.reorder', 'field.delete'
      )
      and not private.is_gm(campaign)
    ) then
    event_type := tg_table_name || '.' || lower(tg_op);
    event_level := 'verbose';
  end if;
  -- Only the GM's changes can be fiat; a player's claim is ignored.
  if coalesce(tag ->> 'fiat', 'false') = 'true' and private.is_gm(campaign) then
    is_fiat := true;
    why := nullif(left(trim(tag ->> 'reason'), 500), '');
  end if;

  -- An undo (undo_request) links to the event it reverses, at that event's log level.
  if reverting is not null then
    select e.level into event_level from public.events e where e.id = reverting;
  end if;

  insert into public.events (
    campaign_id, type, level, actor_user_id, target_table, target_id, before, after,
    fiat, reason, audience, owner_user_id, request_id, reverts_event_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, request, reverting
  );
  return null;
end;
$$;

create or replace function public.undo_request(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
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
  -- A player's undo runs with the player's own access rules from here on.
  if not as_gm then
    set local role authenticated;
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

-- 3. A note's visibility: the character it's about, and the entry it's added to; the stricter wins.
create or replace function private.prepare_note() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.events;
  about public.actors;
begin
  new.audience := 'all';
  new.owner_user_id := null;
  if new.about_actor_id is not null then
    select * into about from public.actors a where a.id = new.about_actor_id and a.campaign_id = new.campaign_id;
    if about.id is null then
      raise exception 'That character isn''t in this campaign.' using errcode = '42501';
    end if;
    -- Like who may see the character itself (and its log entries).
    if about.approval <> 'approved' then
      if about.owner_type = 'user' then
        new.audience := 'owner';
        new.owner_user_id := about.owner_user_id;
      else
        new.audience := 'gm';
      end if;
    end if;
  end if;
  if new.annotates_event_id is not null then
    select * into entry from public.events e where e.id = new.annotates_event_id;
    if entry.id is null or entry.campaign_id <> new.campaign_id then
      raise exception 'That log entry isn''t in this campaign.' using errcode = '42501';
    end if;
    if entry.audience = 'gm' or new.audience = 'gm'
      or (entry.audience = 'owner' and new.audience = 'owner' and entry.owner_user_id is distinct from new.owner_user_id) then
      new.audience := 'gm';
      new.owner_user_id := null;
    elsif entry.audience = 'owner' then
      new.audience := 'owner';
      new.owner_user_id := entry.owner_user_id;
    end if;
  end if;
  return new;
end;
$$;
