-- M1 C3a: GM-defined character fields (docs/04-data-model.md, FieldDefinition).
-- Members read them; only the GM adds, edits, hides or deletes them. A field's key and type never change.
-- A field can be deleted only while no character in the campaign has a value for it (otherwise it's hidden).

create table public.field_definitions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  applies_to text not null default 'pc' check (applies_to in ('pc', 'hireling', 'animal', 'vehicle', 'npc', 'monster')),
  key text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  label text not null check (length(trim(label)) between 1 and 60),
  type text not null check (type in ('number', 'text', 'longtext', 'checkbox', 'list')),
  choices text[] not null default '{}',
  field_group text not null default '',
  sort_order integer not null default 0,
  show_on_card boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (campaign_id, applies_to, key),
  -- Only lists have choices, and a list has at least one.
  check ((type = 'list') = (cardinality(choices) > 0))
);
create index field_definitions_campaign_idx on public.field_definitions (campaign_id);

create trigger stamp before insert or update on public.field_definitions
  for each row execute function private.stamp_row();

-- Key, type, campaign and kind are fixed once a field exists (values are stored under the key).
create function private.guard_field_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.key is distinct from old.key
    or new.type is distinct from old.type
    or new.campaign_id is distinct from old.campaign_id
    or new.applies_to is distinct from old.applies_to then
    raise exception 'A field''s key and type can''t change. Hide it and add a new one instead.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard before update on public.field_definitions
  for each row execute function private.guard_field_update();

-- Does any character in the campaign have a value for this key? (Sees every character, whatever the caller can see.)
create function private.field_in_use(campaign uuid, field_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.actors a where a.campaign_id = campaign and a.fields ? field_key);
$$;
revoke execute on function private.field_in_use(uuid, text) from public, anon;
grant execute on function private.field_in_use(uuid, text) to authenticated, service_role;

alter table public.field_definitions enable row level security;
grant select, insert, update, delete on public.field_definitions to authenticated, service_role;

create policy "field_definitions: members read" on public.field_definitions
  for select to authenticated using (private.is_member(campaign_id));
create policy "field_definitions: GM adds" on public.field_definitions
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "field_definitions: GM edits" on public.field_definitions
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));
create policy "field_definitions: GM deletes unused" on public.field_definitions
  for delete to authenticated
  using (private.is_gm(campaign_id) and not private.field_in_use(campaign_id, key));
