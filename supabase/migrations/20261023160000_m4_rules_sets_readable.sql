-- M4 step 4: rules sets readable by campaign members (ruled 2026-10-23 for M4b, pulled forward on Francis's
-- ruling A: the Pack tab needs the encumbrance rules on players' devices). Docs: 07 "Who sees what".
-- A rules set's GM-only sections (monsters, magicItems, procedures, and any section marked gmOnly: true) are
-- kept apart in library_entry_secrets, like an item's gmOnly fields, and never reach players; the GM gets the
-- whole entry back. XP tables and hooks stay GM-only until M4b. Moves no data out of the database: existing
-- rules sets are split in place; drops and re-adds two constraints and the entries' read policy, with the
-- rules set kind added.

-- What an entry hides from players: its gmOnly list's fields, and for a rules set its GM-only sections.
create function private.hidden_keys(kind text, data jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select array(
    select distinct k from (
      select jsonb_array_elements_text(case when jsonb_typeof(data -> 'gmOnly') = 'array' then data -> 'gmOnly' else '[]'::jsonb end) as k
      union all
      select e.key from jsonb_each(case when kind = 'rulesSet' then data else '{}'::jsonb end) e
      where e.key in ('monsters', 'magicItems', 'procedures')
        or (jsonb_typeof(e.value) = 'object' and (e.value -> 'gmOnly') = 'true'::jsonb)
    ) keys
  );
$$;

-- What a player may see of an entry.
create function private.visible_of(kind text, data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select data - private.hidden_keys(kind, data) - 'gmOnly';
$$;
grant execute on function private.hidden_keys(text, jsonb) to authenticated, service_role;
grant execute on function private.visible_of(text, jsonb) to authenticated, service_role;

-- The split: as in 20261022200000_m3_cleanup.sql, for every hidden key (a rules set's GM-only sections too).
create or replace function private.split_hidden_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  hidden jsonb;
  keys text[] := private.hidden_keys(new.kind, new.data);
begin
  -- An import's insert that meets an existing entry becomes an update (on conflict): that update splits it.
  if tg_op = 'INSERT' and exists (
    select 1 from public.library_entries x
    where x.pack_id = new.pack_id and x.kind = new.kind and x.pack_entry_id = new.pack_entry_id
  ) then
    return new;
  end if;
  if cardinality(keys) > 0 or jsonb_typeof(new.data -> 'gmOnly') = 'array' then
    select (case when new.data ? 'gmOnly' then jsonb_build_object('gmOnly', new.data -> 'gmOnly') else '{}'::jsonb end)
        || coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
      into hidden
      from jsonb_each(new.data) e
      where e.key = any (keys);
    new.data := private.visible_of(new.kind, new.data);
    insert into public.library_entry_secrets as s (id, pack_id, data) values (new.id, new.pack_id, hidden)
      on conflict (id) do update set data = excluded.data where s.data is distinct from excluded.data;
  elsif tg_op = 'UPDATE' and new.data is distinct from old.data
    and nullif(current_setting('grimoire.reverting', true), '') is null then
    delete from public.library_entry_secrets s where s.id = new.id;
  end if;
  return new;
end;
$$;

-- Existing rules sets are split quietly (the split isn't a change anyone made).
alter table public.library_entries disable trigger log_change;
alter table public.library_entries disable trigger refuse_when_retired;
update public.library_entries set data = data where kind = 'rulesSet';
alter table public.library_entries enable trigger refuse_when_retired;
alter table public.library_entries enable trigger log_change;

-- Players read rules sets now (what's left of them).
create or replace function private.player_facing(kind text) returns boolean
language sql immutable set search_path = '' as $$
  select kind in ('class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet');
$$;

drop policy "library entries: owner or campaigns using the pack read" on public.library_entries;
create policy "library entries: owner or campaigns using the pack read" on public.library_entries
  for select to authenticated
  using (
    exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
    or private.pack_in_my_campaign(pack_id, true)
    or (private.pack_in_my_campaign(pack_id) and private.player_facing(kind))
  );

-- A GM's exception for a rules set now sits where players read (none exist yet: rules sets were GM-only).
alter table public.campaign_packs drop constraint campaign_packs_overrides_player_facing;
alter table public.campaign_pack_secrets drop constraint campaign_pack_secrets_overrides_gm_only;
alter table public.campaign_packs add constraint campaign_packs_overrides_player_facing
  check (not jsonb_path_exists(overrides, '$.keyvalue() ? (!(@.key like_regex "^(class|race|item|spell|spellList|condition|lightType|startingKit|option|rulesSet):"))'));
alter table public.campaign_pack_secrets add constraint campaign_pack_secrets_overrides_gm_only
  check (not jsonb_path_exists(overrides, '$.keyvalue() ? (@.key like_regex "^(class|race|item|spell|spellList|condition|lightType|startingKit|option|rulesSet):")'));

-- Import: as in 20261022200000_m3_cleanup.sql, with rules sets in players' update lines (their visible part).
create or replace function public.import_pack(meta jsonb, entries jsonb, replace_pack_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  pack uuid;
  player_facing constant text[] := array['class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet'];
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
          when c.name is distinct from i.name or c.visible is distinct from private.visible_of(i.kind, i.data) then 'changed'
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
