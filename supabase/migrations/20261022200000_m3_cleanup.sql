-- The M3 cleanup step (docs/09-decisions-log.md, 2026-10-22; supabase/tests/m3-cleanup.test.ts):
-- S1. Item fields a pack marks gmOnly (and the gmOnly list itself) move to library_entry_secrets, which only the
--     pack's owner and the GM of a campaign using it read: players' devices never receive them. Existing
--     entries are split, and earlier log lines lose the hidden values.
-- S2. Updating a library pack writes a "library.update" line in every campaign using it: players' line names what
--     changed in the kinds they can see; a second line, the GM's alone, names the rest. Neither can be undone.
-- S3. A campaign's homebrew can't be detached from its campaign (only deleting the campaign takes it).
-- S6. The log knows "field.useLayout" (GM only).
-- S8. packs.extra_meta keeps the meta keys Grimoire doesn't use.
-- Adds two columns' worth of storage (a table and a column), triggers and functions; redefines import_pack,
-- log_change, undo_body and refuse_when_retired. Deletes no rows; moves hidden values out of entries and log lines.

-- S8.
alter table public.packs add column extra_meta jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_meta) = 'object');

-- S3.
create function private.refuse_homebrew_detach() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 1
    and exists (select 1 from public.packs p where p.id = old.pack_id and p.campaign_id = old.campaign_id) then
    raise exception 'A campaign''s homebrew stays with its campaign.' using errcode = '42501';
  end if;
  return old;
end;
$$;
revoke execute on function private.refuse_homebrew_detach() from public, anon, authenticated;
create trigger refuse_homebrew_detach before delete on public.campaign_packs
  for each row execute function private.refuse_homebrew_detach();

-- S1. What a player may see of an entry: everything but the fields its gmOnly list names (and the list).
create function private.visible_part(data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(data -> 'gmOnly') = 'array'
      then data - array(select jsonb_array_elements_text(data -> 'gmOnly')) - 'gmOnly'
    else data
  end;
$$;
grant execute on function private.visible_part(jsonb) to authenticated, service_role;

create table public.library_entry_secrets (
  id uuid primary key references public.library_entries (id) on delete cascade deferrable initially deferred,
  pack_id uuid not null references public.packs (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object')
);
create index library_entry_secrets_pack_idx on public.library_entry_secrets (pack_id);

alter table public.library_entry_secrets enable row level security;
grant select, update on public.library_entry_secrets to authenticated;
grant select, insert, update, delete on public.library_entry_secrets to service_role;
-- Like reading GM-only entries: the pack's owner, or the GM of a campaign using it.
create policy "library entry secrets: owner or the campaign's GM read" on public.library_entry_secrets
  for select to authenticated
  using (
    exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
    or private.pack_in_my_campaign(pack_id, true)
  );
-- Only Undo writes here directly (for a campaign's homebrew); entries are split by the trigger below.
create policy "library entry secrets: the homebrew's GM changes" on public.library_entry_secrets
  for update to authenticated
  using (exists (select 1 from public.packs p where p.id = pack_id and p.campaign_id is not null and private.is_gm(p.campaign_id)))
  with check (exists (select 1 from public.packs p where p.id = pack_id and p.campaign_id is not null and private.is_gm(p.campaign_id)));

-- Every write of an entry with a gmOnly list keeps the hidden part apart. A change that drops the list drops the
-- hidden part too, except an Undo, which puts back only the visible part (the hidden part has its own events).
create function private.split_hidden_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  hidden jsonb;
begin
  -- An import's insert that meets an existing entry becomes an update (on conflict): that update splits it.
  if tg_op = 'INSERT' and exists (
    select 1 from public.library_entries x
    where x.pack_id = new.pack_id and x.kind = new.kind and x.pack_entry_id = new.pack_entry_id
  ) then
    return new;
  end if;
  if jsonb_typeof(new.data -> 'gmOnly') = 'array' then
    select jsonb_build_object('gmOnly', new.data -> 'gmOnly') || coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
      into hidden
      from jsonb_each(new.data) e
      where e.key in (select jsonb_array_elements_text(new.data -> 'gmOnly'));
    new.data := private.visible_part(new.data);
    insert into public.library_entry_secrets as s (id, pack_id, data) values (new.id, new.pack_id, hidden)
      on conflict (id) do update set data = excluded.data where s.data is distinct from excluded.data;
  elsif tg_op = 'UPDATE' and new.data is distinct from old.data
    and nullif(current_setting('grimoire.reverting', true), '') is null then
    delete from public.library_entry_secrets s where s.id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function private.split_hidden_fields() from public, anon, authenticated;
create trigger split_hidden_fields before insert or update on public.library_entries
  for each row execute function private.split_hidden_fields();

-- Existing entries are split quietly (the split isn't a change anyone made).
alter table public.library_entries disable trigger log_change;
alter table public.library_entries disable trigger refuse_when_retired;
update public.library_entries set data = data where jsonb_typeof(data -> 'gmOnly') = 'array';
alter table public.library_entries enable trigger refuse_when_retired;
alter table public.library_entries enable trigger log_change;

-- From now on its changes are logged (the GM's alone), undoable, and frozen with a retired campaign.
create trigger log_change after insert or update or delete on public.library_entry_secrets
  for each row execute function private.log_change();
create trigger refuse_when_retired before insert or update or delete on public.library_entry_secrets
  for each row execute function private.refuse_when_retired();

-- Earlier log lines keep only what players may see of an entry.
update public.events e
  set before = case when jsonb_typeof(e.before -> 'data' -> 'gmOnly') = 'array'
                 then jsonb_set(e.before, '{data}', private.visible_part(e.before -> 'data')) else e.before end,
      after = case when jsonb_typeof(e.after -> 'data' -> 'gmOnly') = 'array'
                then jsonb_set(e.after, '{data}', private.visible_part(e.after -> 'data')) else e.after end
  where e.target_table = 'library_entries'
    and (jsonb_typeof(e.before -> 'data' -> 'gmOnly') = 'array' or jsonb_typeof(e.after -> 'data' -> 'gmOnly') = 'array');

-- S2. One line per campaign using the pack (players'), plus one for the GM when GM-only things changed; the two
-- share a request id, so the GM reads them as one line. Called only from import_pack (private: not in the API).
create function private.log_pack_update(pack uuid, from_version text, to_version text, pack_name text, diff jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  link record;
  request uuid;
  for_players boolean := from_version is distinct from to_version
    or jsonb_array_length(diff -> 'added') + jsonb_array_length(diff -> 'changed') + jsonb_array_length(diff -> 'removed') > 0;
  for_gm boolean := jsonb_array_length(diff -> 'gm_added') + jsonb_array_length(diff -> 'gm_changed') + jsonb_array_length(diff -> 'gm_removed') > 0;
begin
  if not exists (select 1 from public.packs p where p.id = pack and p.owner_user_id = (select auth.uid())) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  for link in select cp.id, cp.campaign_id from public.campaign_packs cp where cp.pack_id = pack loop
    request := gen_random_uuid();
    if for_players then
      insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, before, after, audience, request_id)
      values (link.campaign_id, 'library.update', 'simple', (select auth.uid()), 'campaign_packs', link.id, null,
        jsonb_build_object('pack_name', pack_name, 'from_version', from_version, 'to_version', to_version,
          'added', diff -> 'added', 'changed', diff -> 'changed', 'removed', diff -> 'removed'),
        'all', request);
    end if;
    if for_gm then
      insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, before, after, audience, request_id)
      values (link.campaign_id, 'library.update', 'simple', (select auth.uid()), 'campaign_packs', link.id, null,
        jsonb_build_object('pack_name', pack_name, 'from_version', from_version, 'to_version', to_version,
          'added', diff -> 'gm_added', 'changed', diff -> 'gm_changed', 'removed', diff -> 'gm_removed'),
        'gm', request);
    end if;
  end loop;
end;
$$;
revoke execute on function private.log_pack_update(uuid, text, text, text, jsonb) from public, anon;
grant execute on function private.log_pack_update(uuid, text, text, text, jsonb) to authenticated, service_role;

-- S2 and S8. Import: as in 20261022120000_m3_library.sql, plus extra_meta and the update's log lines.
create or replace function public.import_pack(meta jsonb, entries jsonb, replace_pack_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  pack uuid;
  player_facing constant text[] := array['class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option'];
  was public.packs;
  diff jsonb;
begin
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) = 0 then
    raise exception 'A pack needs at least one entry.';
  end if;
  if replace_pack_id is null then
    insert into public.packs (name, version, kind, format_version, source, notes, extra_meta)
    values (meta ->> 'name', coalesce(meta ->> 'version', ''), coalesce(meta ->> 'kind', 'setting'),
            coalesce((meta ->> 'format_version')::integer, 1), coalesce(meta ->> 'source', ''), coalesce(meta ->> 'notes', ''),
            coalesce(meta -> 'extra', '{}'::jsonb))
    returning id into pack;
  else
    -- What changes, worked out before anything is written (against whole entries, hidden fields included):
    -- for players, only what they can see; the rest for the GM. Logged in each campaign using the pack.
    select * into was from public.packs p where p.id = replace_pack_id;
    with incoming as (
      select n ->> 'kind' as kind, n ->> 'pack_entry_id' as entry_id, n ->> 'name' as name, coalesce(n -> 'data', '{}'::jsonb) as data, at
      from jsonb_array_elements(entries) with ordinality as t(n, at)
    ), current_entries as (
      select e.kind, e.pack_entry_id as entry_id, e.name, e.data as visible, e.data || coalesce(s.data, '{}'::jsonb) as whole
      from public.library_entries e left join public.library_entry_secrets s on s.id = e.id
      where e.pack_id = replace_pack_id
    ), compared as (
      select i.kind, i.name, i.at,
        case
          when c.entry_id is null then 'added'
          when c.name is distinct from i.name or c.visible is distinct from private.visible_part(i.data) then 'changed'
          when c.whole is distinct from i.data then 'changed-hidden'
        end as what
      from incoming i left join current_entries c on c.kind = i.kind and c.entry_id = i.entry_id
      union all
      select c.kind, c.name, 1000000, 'removed' from current_entries c
      where not exists (select 1 from incoming i where i.kind = c.kind and i.entry_id = c.entry_id)
    )
    select jsonb_build_object(
      'added', coalesce(jsonb_agg(name order by at, name) filter (where what = 'added' and kind = any (player_facing)), '[]'),
      'changed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'changed' and kind = any (player_facing)), '[]'),
      'removed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'removed' and kind = any (player_facing)), '[]'),
      'gm_added', coalesce(jsonb_agg(name order by at, name) filter (where what = 'added' and not kind = any (player_facing)), '[]'),
      'gm_changed', coalesce(jsonb_agg(name order by at, name)
        filter (where what = 'changed-hidden' or (what = 'changed' and not kind = any (player_facing))), '[]'),
      'gm_removed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'removed' and not kind = any (player_facing)), '[]')
    ) into diff
    from compared where what is not null;

    update public.packs
    set name = meta ->> 'name', version = coalesce(meta ->> 'version', ''), kind = coalesce(meta ->> 'kind', 'setting'),
        format_version = coalesce((meta ->> 'format_version')::integer, 1), source = coalesce(meta ->> 'source', ''),
        notes = coalesce(meta ->> 'notes', ''), extra_meta = coalesce(meta -> 'extra', '{}'::jsonb)
    where id = replace_pack_id
    returning id into pack;
    if pack is null then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    -- Entries no longer in the file go; the rest are replaced or added below.
    delete from public.library_entries e
    where e.pack_id = pack
      and not exists (
        select 1 from jsonb_array_elements(entries) n
        where n ->> 'kind' = e.kind and n ->> 'pack_entry_id' = e.pack_entry_id
      );
  end if;

  insert into public.library_entries (pack_id, kind, pack_entry_id, name, data)
  select pack, n ->> 'kind', n ->> 'pack_entry_id', n ->> 'name', coalesce(n -> 'data', '{}'::jsonb)
  from jsonb_array_elements(entries) n
  on conflict (pack_id, kind, pack_entry_id) do update set name = excluded.name, data = excluded.data;

  if replace_pack_id is not null and was.campaign_id is null then
    perform private.log_pack_update(pack, was.version, coalesce(meta ->> 'version', ''), meta ->> 'name', diff);
  end if;
  return pack;
end;
$$;

-- S1 and S6. The log: as in 20261022190000_m3_review_fixes.sql, plus library_entry_secrets (by its pack, the GM's)
-- and field.useLayout (GM only).
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
  elsif tg_table_name in ('library_entries', 'library_entry_secrets') then
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
  elsif tg_table_name in ('invites', 'actor_secrets', 'campaign_pack_secrets', 'library_entry_secrets') then
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
      'homebrew.save', 'homebrew.delete', 'field.useLayout'
    )
    or (
      event_type in (
        'campaign.update', 'campaign.setSigil', 'campaign.clearSigil', 'invite.create', 'invite.revoke',
        'company.create', 'company.rename', 'company.delete', 'character.review', 'character.restore',
        'character.assignCompany', 'field.create', 'field.update', 'field.reorder', 'field.delete',
        'rules.attach', 'rules.setOptions', 'rules.detach', 'campaign.retire', 'campaign.restore',
        'rules.reorder', 'rules.prefer', 'rules.homebrew',
        'homebrew.save', 'homebrew.delete', 'field.useLayout'
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

-- S1. Undo: as in 20261022190000_m3_review_fixes.sql, plus library_entry_secrets.
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
    if change.target_table not in ('campaigns', 'members', 'invites', 'companies', 'field_definitions', 'assets', 'actors', 'actor_secrets', 'notes', 'campaign_packs', 'library_entries', 'campaign_pack_secrets', 'library_entry_secrets') then
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

-- S1. The retired guard: as in 20261022180000_m3_homebrew_entries.sql, plus library_entry_secrets (by its pack).
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
  elsif tg_table_name in ('library_entries', 'library_entry_secrets') then
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
