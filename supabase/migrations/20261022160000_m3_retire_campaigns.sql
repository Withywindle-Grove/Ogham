-- Retiring a campaign (docs/05-features.md, Campaigns): the GM retires it and can bring it back.
-- * While retired, members still read everything, but nothing in the campaign can change and nobody can join:
--   a guard on every campaign table refuses inserts, changes and deletes with a plain message.
-- * The one change allowed is the GM bringing it back (retired_at back to empty, and nothing else).
-- * Deletes that follow from something else (setting rules deleted from a library, an account removed, the campaign
--   itself deleted) still go through, so a retired campaign never blocks clean-up elsewhere; they're still logged.
-- * Retiring and bringing back are logged as campaign.retire and campaign.restore, GM only.
-- Adds a column; drops and deletes nothing.

alter table public.campaigns add column retired_at timestamptz;

create function private.campaign_is_retired(campaign uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaigns c where c.id = campaign and c.retired_at is not null);
$$;
revoke execute on function private.campaign_is_retired(uuid) from public, anon, authenticated;

create function private.refuse_when_retired() returns trigger
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
  else
    campaign := (this_row ->> 'campaign_id')::uuid;
  end if;
  if private.campaign_is_retired(campaign) then
    raise exception 'This campaign is retired, so nothing in it can change.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function private.refuse_when_retired() from public, anon, authenticated;

create trigger refuse_when_retired before update on public.campaigns
  for each row execute function private.refuse_when_retired();
create trigger refuse_when_retired before insert or update or delete on public.actors
  for each row execute function private.refuse_when_retired();
create trigger refuse_when_retired before insert or update or delete on public.actor_secrets
  for each row execute function private.refuse_when_retired();
create trigger refuse_when_retired before insert or update or delete on public.assets
  for each row execute function private.refuse_when_retired();
create trigger refuse_when_retired before insert or update or delete on public.campaign_packs
  for each row execute function private.refuse_when_retired();
create trigger refuse_when_retired before insert or update or delete on public.companies
  for each row execute function private.refuse_when_retired();
create trigger refuse_when_retired before insert or update or delete on public.field_definitions
  for each row execute function private.refuse_when_retired();
create trigger refuse_when_retired before insert or update or delete on public.invites
  for each row execute function private.refuse_when_retired();
create trigger refuse_when_retired before insert or update or delete on public.members
  for each row execute function private.refuse_when_retired();
create trigger refuse_when_retired before insert or update or delete on public.notes
  for each row execute function private.refuse_when_retired();

-- The log knows the two new commands' names (GM only).
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
      'note.add', 'note.edit', 'event.undo',
      'rules.attach', 'rules.setOptions', 'rules.detach', 'library.delete',
      'campaign.retire', 'campaign.restore'
    )
    or (
      event_type in (
        'campaign.update', 'campaign.setSigil', 'campaign.clearSigil', 'invite.create', 'invite.revoke',
        'company.create', 'company.rename', 'company.delete', 'character.review', 'character.restore',
        'character.assignCompany', 'field.create', 'field.update', 'field.reorder', 'field.delete',
        'rules.attach', 'rules.setOptions', 'rules.detach', 'campaign.retire', 'campaign.restore'
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
