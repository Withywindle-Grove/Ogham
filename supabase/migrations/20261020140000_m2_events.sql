-- M2 E1: the event log (docs/02-architecture.md, Foundation 1).
-- The database writes an event for every change to campaign data, in the same transaction as the change, from a
-- trigger on each table. The app's commands tag their requests with a header (x-grimoire-command: base64 JSON
-- with type, level, requestId, fiat, reason; see src/core/eventTags.ts); untagged writes are still logged under
-- a plain name like "actors.update". Nobody writes, changes or erases events directly.
-- Each event has an audience, so the log never shows what someone can't otherwise see.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity, -- strict order, even within one transaction
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  type text not null,
  level text not null default 'verbose' check (level in ('simple', 'verbose')),
  actor_user_id uuid references public.profiles (id) on delete set null, -- who; empty for maintenance
  target_table text not null,
  target_id uuid,
  before jsonb, -- the changed values before (the whole row for a deletion)
  after jsonb, -- the changed values after (the whole row for a creation)
  fiat boolean not null default false,
  reason text check (reason is null or length(reason) <= 500),
  reverts_event_id uuid references public.events (id) on delete cascade,
  audience text not null check (audience in ('all', 'gm', 'owner')),
  owner_user_id uuid, -- for audience 'owner': that player (and the GM)
  reveal_at text not null default 'now' check (reveal_at in ('now', 'downtime')),
  request_id uuid, -- shared by every event one command wrote
  created_at timestamptz not null default clock_timestamp()
);
create index events_campaign_seq_idx on public.events (campaign_id, seq desc);
create index events_target_idx on public.events (target_id);
create index events_request_idx on public.events (request_id);

alter table public.events enable row level security;
grant select on public.events to authenticated, service_role;
grant insert, update, delete on public.events to service_role;

-- The GM reads everything; members read what's for everyone, and what's for them as its owner.
create policy "events: read what you may see" on public.events
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and reveal_at = 'now'
      and (audience = 'all' or (audience = 'owner' and owner_user_id = (select auth.uid())))
    )
  );

create function private.log_change() returns trigger
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
  if tg_table_name in ('invites', 'actor_secrets') then
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
  event_type := coalesce(nullif(left(tag ->> 'type', 80), ''), tg_table_name || '.' || lower(tg_op));
  if tag ->> 'level' in ('simple', 'verbose') then
    event_level := tag ->> 'level';
  end if;
  -- Only the GM's changes can be fiat; a player's claim is ignored.
  if coalesce(tag ->> 'fiat', 'false') = 'true' and private.is_gm(campaign) then
    is_fiat := true;
    why := nullif(left(trim(tag ->> 'reason'), 500), '');
  end if;

  insert into public.events (
    campaign_id, type, level, actor_user_id, target_table, target_id, before, after,
    fiat, reason, audience, owner_user_id, request_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, request
  );
  return null;
end;
$$;
revoke execute on function private.log_change() from public, anon, authenticated;

create trigger log_change after insert or update or delete on public.campaigns
  for each row execute function private.log_change();
create trigger log_change after insert or update or delete on public.members
  for each row execute function private.log_change();
create trigger log_change after insert or update or delete on public.invites
  for each row execute function private.log_change();
create trigger log_change after insert or update or delete on public.companies
  for each row execute function private.log_change();
create trigger log_change after insert or update or delete on public.field_definitions
  for each row execute function private.log_change();
create trigger log_change after insert or update or delete on public.assets
  for each row execute function private.log_change();
create trigger log_change after insert or update or delete on public.actors
  for each row execute function private.log_change();
create trigger log_change after insert or update or delete on public.actor_secrets
  for each row execute function private.log_change();
