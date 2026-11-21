-- M1: first tables and access rules.
-- Specs: docs/04-data-model.md (tables), docs/03-roles-permissions.md (who can do what).
-- Tests: supabase/tests/access-rules.test.ts (run against the test project first).
--
-- How the rules are built:
--   * Every table has row-level security on. Nothing is readable or writable unless a policy says so.
--   * Small helper checks live in the `private` schema, which the app's API can't call directly.
--     They are "security definer" so a policy can ask "is this person the GM?" without the
--     members table's own policy looping back on itself.
--   * Guard triggers stop changes a policy can't express (e.g. a player approving their own character).
--   * Writes made with the secret key (tests, maintenance) have no signed-in user and skip the guards.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One per signed-in user, created automatically when they first sign in.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_asset_id uuid, -- account-level picture; assets are per campaign, so no link yet
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  sigil_asset_id uuid, -- linked to assets below
  mode text not null default 'downtime' check (mode in ('adventure', 'downtime')),
  adventure_mode text not null default 'explore' check (adventure_mode in ('explore', 'encounter', 'fight')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- The only record of membership and roles.
create table public.members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  base_role text not null check (base_role in ('gm', 'player')),
  active_actor_id uuid, -- linked to actors below
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);
-- R1: one GM per campaign.
create unique index members_one_gm_per_campaign on public.members (campaign_id) where base_role = 'gm';

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  email text, -- optional note for the GM; the code alone is enough to join
  code text not null unique,
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (id, campaign_id) -- lets actors check their company is in the same campaign
);

-- Files: portraits, sigils, handouts and maps. Visibility lives only here.
-- The file itself is stored in the campaign-files bucket at storage_path.
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('portrait', 'sigil', 'handout', 'map')),
  name text not null default '',
  storage_path text generated always as (campaign_id::text || '/' || id::text) stored,
  visibility text not null default 'gm' check (visibility in ('gm', 'all', 'users')),
  visible_to uuid[] not null default '{}', -- used when visibility = 'users'
  revealed_at timestamptz, -- when a handout or map was shared (a record; visibility decides who sees it)
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  -- Portraits and sigils are always visible to every member.
  check (kind not in ('portrait', 'sigil') or visibility = 'all')
);

alter table public.campaigns
  add foreign key (sigil_asset_id) references public.assets (id) on delete set null;

-- Characters, companions, NPCs and monsters.
create table public.actors (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('pc', 'hireling', 'animal', 'vehicle', 'npc', 'monster')),
  name text not null check (length(trim(name)) > 0),
  portrait_asset_id uuid references public.assets (id) on delete set null,
  owner_type text not null check (owner_type in ('user', 'party', 'gm')),
  owner_user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'benched', 'retired', 'dead', 'archived')),
  approval text not null default 'pending' check (approval in ('pending', 'approved', 'rejected')),
  hp_current integer,
  hp_max integer,
  fields jsonb not null default '{}'::jsonb,
  edited_fields text[] not null default '{}',
  notes text not null default '',
  backstory text not null default '',
  company_id uuid, -- at most one company, in the same campaign
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (owner_type = 'user' or owner_user_id is null),
  -- A monster's HP lives only in actor_secrets.
  check (kind <> 'monster' or (hp_current is null and hp_max is null)),
  foreign key (company_id, campaign_id) references public.companies (id, campaign_id) on delete set null (company_id)
);
create index actors_campaign_idx on public.actors (campaign_id);

alter table public.members
  add foreign key (active_actor_id) references public.actors (id) on delete set null;

-- GM-only details about an actor, in their own table so they never reach players.
create table public.actor_secrets (
  actor_id uuid primary key references public.actors (id) on delete cascade,
  gm_notes text not null default '',
  hp_current integer, -- monsters only: the only copy of a monster's HP
  hp_max integer,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- Helper checks (private; used by the rules below)
-- ---------------------------------------------------------------------------

create function private.is_member(target_campaign uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.campaign_id = target_campaign and m.user_id = (select auth.uid())
  );
$$;

create function private.is_gm(target_campaign uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.campaign_id = target_campaign and m.user_id = (select auth.uid()) and m.base_role = 'gm'
  );
$$;

-- Is the signed-in user the GM of the campaign this actor belongs to?
create function private.is_gm_of_actor(target_actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.actors a
    join public.members m on m.campaign_id = a.campaign_id
    where a.id = target_actor and m.user_id = (select auth.uid()) and m.base_role = 'gm'
  );
$$;

-- Do the signed-in user and this person share a campaign?
create function private.shares_campaign(other_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members mine
    join public.members theirs on theirs.campaign_id = mine.campaign_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other_user
  );
$$;

-- May the signed-in user read the asset stored at this path? Same rule as the assets table.
create function private.can_read_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assets a
    where a.storage_path = path
      and (
        private.is_gm(a.campaign_id)
        or (
          private.is_member(a.campaign_id)
          and (a.visibility = 'all' or (a.visibility = 'users' and (select auth.uid()) = any (a.visible_to)))
        )
      )
  );
$$;

-- May the signed-in user upload the file for this asset? The GM can; a player only for their own portrait.
create function private.can_write_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assets a
    where a.storage_path = path
      and (
        private.is_gm(a.campaign_id)
        or (a.kind = 'portrait' and a.uploaded_by = (select auth.uid()) and private.is_member(a.campaign_id))
      )
  );
$$;

-- 8-character invite code from letters and digits that are hard to confuse (no I, O, 0 or 1).
create function private.new_invite_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

alter table public.invites alter column code set default private.new_invite_code();


-- ---------------------------------------------------------------------------
-- Stamps and guards (triggers)
-- ---------------------------------------------------------------------------

-- Fills created_at/created_by/updated_at so nobody can fake them.
create function private.stamp_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce((select auth.uid()), new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger stamp before insert or update on public.profiles for each row execute function private.stamp_row();
create trigger stamp before insert or update on public.campaigns for each row execute function private.stamp_row();
create trigger stamp before insert or update on public.members for each row execute function private.stamp_row();
create trigger stamp before insert or update on public.invites for each row execute function private.stamp_row();
create trigger stamp before insert or update on public.companies for each row execute function private.stamp_row();
create trigger stamp before insert or update on public.assets for each row execute function private.stamp_row();
create trigger stamp before insert or update on public.actors for each row execute function private.stamp_row();
create trigger stamp before insert or update on public.actor_secrets for each row execute function private.stamp_row();

-- Members may only change their active character, and only to one of their own in this campaign.
create function private.guard_member_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id
    or new.user_id is distinct from old.user_id
    or new.base_role is distinct from old.base_role
    or new.joined_at is distinct from old.joined_at then
    raise exception 'Only the active character can be changed here.' using errcode = '42501';
  end if;
  if new.active_actor_id is not null and new.active_actor_id is distinct from old.active_actor_id
    and not exists (
      select 1 from public.actors a
      where a.id = new.active_actor_id and a.campaign_id = new.campaign_id
        and a.owner_type = 'user' and a.owner_user_id = new.user_id
    ) then
    raise exception 'You can only switch to one of your own characters.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard before update on public.members for each row execute function private.guard_member_update();

-- Players can edit their own characters, but only the GM can approve them, change their owner,
-- kind or company. A player may resubmit a rejected character (rejected -> pending).
create function private.guard_actor_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'A character can''t move to another campaign.' using errcode = '42501';
  end if;
  if private.is_gm(old.campaign_id) then
    return new;
  end if;
  if new.owner_type is distinct from old.owner_type
    or new.owner_user_id is distinct from old.owner_user_id
    or new.kind is distinct from old.kind
    or new.company_id is distinct from old.company_id then
    raise exception 'Only the GM can change a character''s owner, kind or company.' using errcode = '42501';
  end if;
  if new.approval is distinct from old.approval
    and not (old.approval = 'rejected' and new.approval = 'pending') then
    raise exception 'Only the GM can approve or reject characters.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard before update on public.actors for each row execute function private.guard_actor_update();

-- A profile for every user, created when they first sign in.
create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, created_by)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.id
  );
  return new;
end;
$$;

create trigger create_profile after insert on auth.users for each row execute function private.create_profile();

-- Profiles for anyone who signed up before this migration.
insert into public.profiles (id, display_name, created_by)
select u.id, split_part(coalesce(u.email, ''), '@', 1), u.id
from auth.users u
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- Joining a campaign with an invite code
-- ---------------------------------------------------------------------------

-- The only way to join: present a pending, unexpired code. Joins as a player; the code is used up.
create function public.redeem_invite(invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  found_invite public.invites;
begin
  if me is null then
    raise exception 'Sign in before using an invite code.' using errcode = '42501';
  end if;

  select * into found_invite
  from public.invites
  where code = upper(trim(invite_code))
  for update;

  if not found or found_invite.status <> 'pending' or found_invite.expires_at <= now() then
    raise exception 'This invite code isn''t valid or has expired. Ask your GM for a new one.' using errcode = 'P0001';
  end if;

  -- Already a member: nothing to do, and the code stays usable for someone else.
  if exists (select 1 from public.members where campaign_id = found_invite.campaign_id and user_id = me) then
    return found_invite.campaign_id;
  end if;

  insert into public.members (campaign_id, user_id, base_role) values (found_invite.campaign_id, me, 'player');
  update public.invites set status = 'accepted', accepted_by = me, accepted_at = now() where id = found_invite.id;
  return found_invite.campaign_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Who may run the helpers
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_member(uuid), private.is_gm(uuid), private.is_gm_of_actor(uuid),
  private.shares_campaign(uuid), private.can_read_file(text), private.can_write_file(text),
  private.new_invite_code()
  to authenticated, service_role;

revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;


-- ---------------------------------------------------------------------------
-- Access rules (row-level security)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.companies enable row level security;
alter table public.assets enable row level security;
alter table public.actors enable row level security;
alter table public.actor_secrets enable row level security;

grant select, insert, update, delete on
  public.profiles, public.campaigns, public.members, public.invites,
  public.companies, public.assets, public.actors, public.actor_secrets
  to authenticated, service_role;

-- Profiles: your own, and those of people you share a campaign with. You edit only your own.
create policy "profiles: read own and fellow members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_campaign(id));
create policy "profiles: edit own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Campaigns: members read; only the GM edits. (Creating a campaign comes with the campaign screen.)
create policy "campaigns: members read" on public.campaigns
  for select to authenticated using (private.is_member(id));
create policy "campaigns: GM edits" on public.campaigns
  for update to authenticated using (private.is_gm(id)) with check (private.is_gm(id));

-- Members: members read the list. Each member may update their own row (active character only,
-- see guard). Nobody adds members directly: joining goes through redeem_invite.
create policy "members: members read" on public.members
  for select to authenticated using (private.is_member(campaign_id));
create policy "members: update own row" on public.members
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Invites: the GM only. Revoking is an update; nothing is deleted.
create policy "invites: GM reads" on public.invites
  for select to authenticated using (private.is_gm(campaign_id));
create policy "invites: GM creates" on public.invites
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "invites: GM updates" on public.invites
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- Companies: members read; the GM creates, renames and deletes.
create policy "companies: members read" on public.companies
  for select to authenticated using (private.is_member(campaign_id));
create policy "companies: GM creates" on public.companies
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "companies: GM updates" on public.companies
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));
create policy "companies: GM deletes" on public.companies
  for delete to authenticated using (private.is_gm(campaign_id));

-- Assets: by visibility (GM always). Players may add and edit their own portraits only.
create policy "assets: read by visibility" on public.assets
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and (visibility = 'all' or (visibility = 'users' and (select auth.uid()) = any (visible_to)))
    )
  );
create policy "assets: GM or own portrait creates" on public.assets
  for insert to authenticated
  with check (
    private.is_gm(campaign_id)
    or (private.is_member(campaign_id) and kind = 'portrait' and uploaded_by = (select auth.uid()))
  );
create policy "assets: GM or own portrait updates" on public.assets
  for update to authenticated
  using (private.is_gm(campaign_id) or (kind = 'portrait' and uploaded_by = (select auth.uid())))
  with check (
    private.is_gm(campaign_id)
    or (private.is_member(campaign_id) and kind = 'portrait' and uploaded_by = (select auth.uid()))
  );

-- Actors: the GM sees all; members see approved ones and their own (pending or rejected).
create policy "actors: read approved or own" on public.actors
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and (approval = 'approved' or (owner_type = 'user' and owner_user_id = (select auth.uid())))
    )
  );
-- Players create their own characters and companions, pending, outside any company.
create policy "actors: GM or player creates" on public.actors
  for insert to authenticated
  with check (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and owner_type = 'user' and owner_user_id = (select auth.uid())
      and approval = 'pending'
      and kind in ('pc', 'hireling', 'animal', 'vehicle')
      and company_id is null
    )
  );
create policy "actors: GM or owner edits" on public.actors
  for update to authenticated
  using (private.is_gm(campaign_id) or (owner_type = 'user' and owner_user_id = (select auth.uid())))
  with check (
    private.is_gm(campaign_id)
    or (private.is_member(campaign_id) and owner_type = 'user' and owner_user_id = (select auth.uid()))
  );

-- Actor secrets: the GM only, for everything.
create policy "actor_secrets: GM only" on public.actor_secrets
  for all to authenticated
  using (private.is_gm_of_actor(actor_id)) with check (private.is_gm_of_actor(actor_id));


-- ---------------------------------------------------------------------------
-- File storage: a private bucket whose rules mirror the assets table
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('campaign-files', 'campaign-files', false)
on conflict (id) do nothing;

create policy "campaign-files: read by asset visibility" on storage.objects
  for select to authenticated
  using (bucket_id = 'campaign-files' and private.can_read_file(name));
create policy "campaign-files: GM or own portrait uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'campaign-files' and private.can_write_file(name));
create policy "campaign-files: GM or own portrait replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'campaign-files' and private.can_write_file(name))
  with check (bucket_id = 'campaign-files' and private.can_write_file(name));
