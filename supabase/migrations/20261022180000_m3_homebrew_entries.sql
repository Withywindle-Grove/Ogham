-- M3 step 7a, the in-app editor: a campaign's own homebrew entries are part of the campaign's record.
-- * Changes to entries of a campaign's homebrew pack are logged in that campaign (homebrew.save,
--   homebrew.delete; GM-only names). Players see the log lines for the kinds they can read; the rest are the
--   GM's. Entries of library packs belong to no campaign and stay unlogged, as before.
-- * Undo can put back a change to a homebrew entry (making or deleting one can't be undone, as everywhere).
-- * A retired campaign's homebrew can't change.
-- Adds triggers and redefines three functions (each a copy of its latest version plus the lines above);
-- drops and deletes nothing.

-- Logging: as in 20261022170000_m3_stacking.sql, plus library_entries and the two new names.
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
  elsif tg_table_name = 'library_entries' then
    -- Only a campaign's own homebrew is logged (in that campaign); library packs belong to no campaign.
    select p.campaign_id into campaign from public.packs p where p.id = (this_row ->> 'pack_id')::uuid;
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
  elsif tg_table_name = 'library_entries'
    and this_row ->> 'kind' not in ('class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option') then
    -- Like reading the entries: stat blocks, tables, treasure and the rest are the GM's.
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
      'note.add', 'note.edit', 'event.undo',
      'rules.attach', 'rules.setOptions', 'rules.detach', 'library.delete',
      'campaign.retire', 'campaign.restore',
      'rules.reorder', 'rules.prefer', 'rules.homebrew',
      'homebrew.save', 'homebrew.delete'
    )
    or (
      event_type in (
        'campaign.update', 'campaign.setSigil', 'campaign.clearSigil', 'invite.create', 'invite.revoke',
        'company.create', 'company.rename', 'company.delete', 'character.review', 'character.restore',
        'character.assignCompany', 'field.create', 'field.update', 'field.reorder', 'field.delete',
        'rules.attach', 'rules.setOptions', 'rules.detach', 'campaign.retire', 'campaign.restore',
        'rules.reorder', 'rules.prefer', 'rules.homebrew',
        'homebrew.save', 'homebrew.delete'
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

create trigger log_change after insert or update or delete on public.library_entries
  for each row execute function private.log_change();

-- Undo: as in 20261022130000_m3_campaign_packs.sql, plus library_entries.
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
    if change.target_table not in ('campaigns', 'members', 'invites', 'companies', 'field_definitions', 'assets', 'actors', 'actor_secrets', 'notes', 'campaign_packs', 'library_entries') then
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

-- The retired guard: as in 20261022160000_m3_retire_campaigns.sql, plus library_entries (by their pack).
create or replace function private.refuse_when_retired() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  this_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  campaign uuid;
begin
  if tg_table_name = 'campaigns' then
    if tg_op = 'UPDATE' then
      if old.retired_at is null then
        -- Retiring: the database stamps the time.
        if new.retired_at is not null then
          new.retired_at := now();
        end if;
        return new;
      end if;
      -- Retired: only bringing it back, with nothing else changed.
      if new.retired_at is null
        and (to_jsonb(new) - 'retired_at' - 'updated_at') = (to_jsonb(old) - 'retired_at' - 'updated_at') then
        return new;
      end if;
      raise exception 'This campaign is retired, so nothing in it can change.';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Deletes that follow from another change (a cascade) go through.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if tg_table_name = 'actor_secrets' then
    select a.campaign_id into campaign from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
  elsif tg_table_name = 'library_entries' then
    select p.campaign_id into campaign from public.packs p where p.id = (this_row ->> 'pack_id')::uuid;
  else
    campaign := (this_row ->> 'campaign_id')::uuid;
  end if;
  if private.campaign_is_retired(campaign) then
    raise exception 'This campaign is retired, so nothing in it can change.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger refuse_when_retired before insert or update or delete on public.library_entries
  for each row execute function private.refuse_when_retired();
