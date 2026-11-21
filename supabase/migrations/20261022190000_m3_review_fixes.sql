-- Fixes from the M3 fresh-session review (supabase/tests/m3-review.test.ts pins each one):
-- 1. A library entry stays in its pack and kind (a homebrew entry could be moved out, unlogged).
-- 2. A campaign's homebrew pack goes only with its campaign (deleting it alone took its entries, unlogged);
--    a retired campaign's homebrew pack can't change.
-- 3. A retired campaign's files are frozen like the rest of it.
-- 4. Hidden means hidden: the GM's exceptions for GM-only entries (stat blocks, tables, ...) move from
--    campaign_packs.overrides, which players read, to campaign_pack_secrets, which only the GM reads. Existing
--    ones are moved there (nothing is lost), and earlier log lines about them become the GM's.
-- 6. A campaign's homebrew can be attached only to that campaign.
-- 7. Only a pack leaving a campaign can be logged as "library.delete".
-- Adds a table, triggers and checks; redefines functions and one policy. Deletes no data.

-- 1.
create function private.guard_library_entry_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.pack_id is distinct from old.pack_id or new.kind is distinct from old.kind then
    raise exception 'An entry can''t move to other setting rules or become another kind.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_library_entry_update before update on public.library_entries
  for each row execute function private.guard_library_entry_update();

-- 2. Direct deletes only; a cascade (the campaign or the account being deleted) goes through.
create function private.refuse_homebrew_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.campaign_id is not null and pg_trigger_depth() = 1 then
    raise exception 'A campaign''s homebrew goes only with its campaign.' using errcode = '42501';
  end if;
  return old;
end;
$$;
create trigger refuse_homebrew_delete before delete on public.packs
  for each row execute function private.refuse_homebrew_delete();
-- Library packs have no campaign, so this only stops a retired campaign's homebrew.
create trigger refuse_when_retired before insert or update on public.packs
  for each row execute function private.refuse_when_retired();

-- 3. As in 20261019120000_m1_core_tables.sql, plus: not while the campaign is retired.
create or replace function private.can_write_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assets a
    where a.storage_path = path
      and not private.campaign_is_retired(a.campaign_id)
      and (
        private.is_gm(a.campaign_id)
        or (a.kind = 'portrait' and a.uploaded_by = (select auth.uid()) and private.is_member(a.campaign_id))
      )
  );
$$;

-- 4. One row per attached pack, made with it and gone with it; only the GM reads or changes it.
create table public.campaign_pack_secrets (
  id uuid primary key references public.campaign_packs (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(overrides) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index campaign_pack_secrets_campaign_idx on public.campaign_pack_secrets (campaign_id);

create trigger stamp before insert or update on public.campaign_pack_secrets
  for each row execute function private.stamp_row();

create function private.guard_campaign_pack_secret_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.campaign_id is distinct from old.campaign_id then
    raise exception 'Attached setting rules can''t move.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_campaign_pack_secret_update before update on public.campaign_pack_secrets
  for each row execute function private.guard_campaign_pack_secret_update();

create function private.add_campaign_pack_secrets() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.campaign_pack_secrets (id, campaign_id) values (new.id, new.campaign_id);
  return null;
end;
$$;
revoke execute on function private.add_campaign_pack_secrets() from public, anon, authenticated;
create trigger add_campaign_pack_secrets after insert on public.campaign_packs
  for each row execute function private.add_campaign_pack_secrets();

alter table public.campaign_pack_secrets enable row level security;
grant select, update on public.campaign_pack_secrets to authenticated;
grant select, insert, update, delete on public.campaign_pack_secrets to service_role;
create policy "campaign pack secrets: the GM reads" on public.campaign_pack_secrets
  for select to authenticated using (private.is_gm(campaign_id));
create policy "campaign pack secrets: the GM changes" on public.campaign_pack_secrets
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- Changes are logged (the GM's alone) and can be undone; the row's making and going aren't separate log lines.
create trigger log_change after update on public.campaign_pack_secrets
  for each row execute function private.log_change();
create trigger refuse_when_retired before update on public.campaign_pack_secrets
  for each row execute function private.refuse_when_retired();

-- Move the existing GM-only exceptions, quietly (the move itself isn't a change anyone made).
alter table public.campaign_packs disable trigger log_change;
alter table public.campaign_packs disable trigger refuse_when_retired;
insert into public.campaign_pack_secrets (id, campaign_id, overrides, created_by)
  select cp.id, cp.campaign_id,
    coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(cp.overrides) e where e.key !~ '^(class|race|item|spell|spellList|condition|lightType|startingKit|option):'), '{}'::jsonb),
    cp.created_by
  from public.campaign_packs cp;
update public.campaign_packs cp
  set overrides = coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(cp.overrides) e where e.key ~ '^(class|race|item|spell|spellList|condition|lightType|startingKit|option):'), '{}'::jsonb)
  where exists (select 1 from jsonb_object_keys(cp.overrides) k where k !~ '^(class|race|item|spell|spellList|condition|lightType|startingKit|option):');
alter table public.campaign_packs enable trigger refuse_when_retired;
alter table public.campaign_packs enable trigger log_change;

-- From now on each place holds only its own kinds.
alter table public.campaign_packs add constraint campaign_packs_overrides_player_facing
  check (not jsonb_path_exists(overrides, '$.keyvalue() ? (!(@.key like_regex "^(class|race|item|spell|spellList|condition|lightType|startingKit|option):"))'));
alter table public.campaign_pack_secrets add constraint campaign_pack_secrets_overrides_gm_only
  check (not jsonb_path_exists(overrides, '$.keyvalue() ? (@.key like_regex "^(class|race|item|spell|spellList|condition|lightType|startingKit|option):")'));

-- Earlier log lines that named a GM-only exception become the GM's (they stay in the log).
update public.events e
  set audience = 'gm'
  where e.target_table = 'campaign_packs' and e.audience <> 'gm'
    and (
      jsonb_path_exists(coalesce(e.before, '{}'::jsonb), '$.overrides.keyvalue() ? (!(@.key like_regex "^(class|race|item|spell|spellList|condition|lightType|startingKit|option):"))')
      or jsonb_path_exists(coalesce(e.after, '{}'::jsonb), '$.overrides.keyvalue() ? (!(@.key like_regex "^(class|race|item|spell|spellList|condition|lightType|startingKit|option):"))')
    );

-- 6. As in 20261022130000_m3_campaign_packs.sql, plus: a campaign's homebrew only in that campaign.
drop policy "campaign packs: the GM attaches their own" on public.campaign_packs;
create policy "campaign packs: the GM attaches their own" on public.campaign_packs
  for insert to authenticated
  with check (
    private.is_gm(campaign_id)
    and exists (
      select 1 from public.packs p
      where p.id = pack_id
        and p.owner_user_id = (select auth.uid())
        and (p.campaign_id is null or p.campaign_id = campaign_packs.campaign_id)
    )
  );

-- 4 and 7. The log: as in 20261022180000_m3_homebrew_entries.sql, plus campaign_pack_secrets (the GM's) and
-- library.delete only for a pack leaving a campaign.
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
  elsif tg_table_name in ('invites', 'actor_secrets', 'campaign_pack_secrets') then
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
    )
    -- Setting rules leaving the campaign because their owner deleted them: nothing else carries that name.
    or (event_type = 'library.delete' and not (tg_table_name = 'campaign_packs' and tg_op = 'DELETE')) then
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

-- 4. Undo: as in 20261022180000_m3_homebrew_entries.sql, plus campaign_pack_secrets.
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
    if change.target_table not in ('campaigns', 'members', 'invites', 'companies', 'field_definitions', 'assets', 'actors', 'actor_secrets', 'notes', 'campaign_packs', 'library_entries', 'campaign_pack_secrets') then
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
