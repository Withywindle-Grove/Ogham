-- M3 step 1: your library of setting rules (packs, docs/07-content-packs.md). Account-level and private to
-- the account that imported it (attaching to campaigns, and players' read access, come in step 3).
-- import_pack saves a pack and all its entries in one step: a new pack, or a newer file replacing a pack's
-- contents (entries matched by kind and id: added, changed, removed). Library changes aren't campaign events.

create table public.packs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  version text not null default '',
  kind text not null default 'setting' check (kind in ('setting', 'adventure', 'homebrew')),
  format_version integer not null default 1 check (format_version in (1, 2)),
  source text not null default '',
  notes text not null default '',
  -- Set only for a campaign's own homebrew pack (step 5).
  campaign_id uuid references public.campaigns (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index packs_owner_idx on public.packs (owner_user_id);

create table public.library_entries (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.packs (id) on delete cascade,
  kind text not null check (kind in (
    'fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table',
    'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook'
  )),
  pack_entry_id text not null check (pack_entry_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 1 and 200),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  unique (pack_id, kind, pack_entry_id)
);
create index library_entries_pack_idx on public.library_entries (pack_id, kind);

create trigger stamp before insert or update on public.packs
  for each row execute function private.stamp_row();

-- The owner can't be changed.
create function private.guard_pack_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id or new.campaign_id is distinct from old.campaign_id then
    raise exception 'A pack''s owner and campaign can''t change.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_pack_update before update on public.packs
  for each row execute function private.guard_pack_update();

alter table public.packs enable row level security;
alter table public.library_entries enable row level security;
grant select, insert, update, delete on public.packs, public.library_entries to authenticated, service_role;

create policy "packs: owner only" on public.packs
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
create policy "library entries: the pack's owner" on public.library_entries
  for all to authenticated
  using (exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid())));

-- Import (replace_pack_id null) or update (a pack you own): the pack's details and all its entries, in one step.
-- Runs as the caller, so the access rules above apply.
create function public.import_pack(meta jsonb, entries jsonb, replace_pack_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  pack uuid;
begin
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) = 0 then
    raise exception 'A pack needs at least one entry.';
  end if;
  if replace_pack_id is null then
    insert into public.packs (name, version, kind, format_version, source, notes)
    values (meta ->> 'name', coalesce(meta ->> 'version', ''), coalesce(meta ->> 'kind', 'setting'),
            coalesce((meta ->> 'format_version')::integer, 1), coalesce(meta ->> 'source', ''), coalesce(meta ->> 'notes', ''))
    returning id into pack;
  else
    update public.packs
    set name = meta ->> 'name', version = coalesce(meta ->> 'version', ''), kind = coalesce(meta ->> 'kind', 'setting'),
        format_version = coalesce((meta ->> 'format_version')::integer, 1), source = coalesce(meta ->> 'source', ''),
        notes = coalesce(meta ->> 'notes', '')
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

  return pack;
end;
$$;
revoke execute on function public.import_pack(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.import_pack(jsonb, jsonb, uuid) to authenticated, service_role;
