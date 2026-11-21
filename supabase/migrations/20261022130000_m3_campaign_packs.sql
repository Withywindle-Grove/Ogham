-- M3 step 3a: setting rules attached to campaigns (docs/04-data-model.md CampaignPack).
-- * The GM attaches packs from their own library, with optional-rule choices; detaching keeps them in the library.
-- * Members read an attached pack's details, and its player-facing entries (classes, races, items, spells, spell
--   lists, conditions, light types, starting kits, optional rules); stat blocks, tables, treasure types, hooks,
--   rules sets, field templates and calendars stay with the GM.
-- * Attaching, changing optional rules and detaching are logged in the campaign; an optional-rule change can be undone.

create table public.campaign_packs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  pack_id uuid not null references public.packs (id) on delete cascade,
  option_choices jsonb not null default '{}'::jsonb check (jsonb_typeof(option_choices) = 'object'),
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (campaign_id, pack_id)
);
create index campaign_packs_pack_idx on public.campaign_packs (pack_id);

create trigger stamp before insert or update on public.campaign_packs
  for each row execute function private.stamp_row();

-- Only the choices and the order change; a link can't move to another campaign or pack.
create function private.guard_campaign_pack_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.campaign_id is distinct from old.campaign_id or new.pack_id is distinct from old.pack_id then
    raise exception 'Attached setting rules can''t move.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_campaign_pack_update before update on public.campaign_packs
  for each row execute function private.guard_campaign_pack_update();

-- Is this pack attached to a campaign this person belongs to (as GM, if asked)?
create function private.pack_in_my_campaign(pack uuid, gm_only boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_packs cp
    where cp.pack_id = pack
      and (case when gm_only then private.is_gm(cp.campaign_id) else private.is_member(cp.campaign_id) end)
  );
$$;
revoke execute on function private.pack_in_my_campaign(uuid, boolean) from public, anon;
grant execute on function private.pack_in_my_campaign(uuid, boolean) to authenticated, service_role;

alter table public.campaign_packs enable row level security;
grant select, insert, update, delete on public.campaign_packs to authenticated, service_role;

create policy "campaign packs: members read" on public.campaign_packs
  for select to authenticated using (private.is_member(campaign_id));
-- The GM attaches only packs from their own library.
create policy "campaign packs: the GM attaches their own" on public.campaign_packs
  for insert to authenticated
  with check (
    private.is_gm(campaign_id)
    and exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
  );
create policy "campaign packs: the GM changes" on public.campaign_packs
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));
create policy "campaign packs: the GM detaches" on public.campaign_packs
  for delete to authenticated using (private.is_gm(campaign_id));

-- Members read an attached pack's details (name, version)...
create policy "packs: members of campaigns using it read" on public.packs
  for select to authenticated using (private.pack_in_my_campaign(id));
-- ...its player-facing entries, and (as GM of a campaign using it) every entry.
create policy "library entries: campaigns using the pack read" on public.library_entries
  for select to authenticated
  using (
    private.pack_in_my_campaign(pack_id, true)
    or (
      private.pack_in_my_campaign(pack_id)
      and kind in ('class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option')
    )
  );

create trigger log_change after insert or update or delete on public.campaign_packs
  for each row execute function private.log_change();

-- The log knows the new commands' names (rules.* only for the GM; library.delete for the pack's owner).
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
      'rules.attach', 'rules.setOptions', 'rules.detach', 'library.delete'
    )
    or (
      event_type in (
        'campaign.update', 'campaign.setSigil', 'campaign.clearSigil', 'invite.create', 'invite.revoke',
        'company.create', 'company.rename', 'company.delete', 'character.review', 'character.restore',
        'character.assignCompany', 'field.create', 'field.update', 'field.reorder', 'field.delete',
        'rules.attach', 'rules.setOptions', 'rules.detach'
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

-- Undo can put back an optional-rule change.
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
    if change.target_table not in ('campaigns', 'members', 'invites', 'companies', 'field_definitions', 'assets', 'actors', 'actor_secrets', 'notes', 'campaign_packs') then
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
