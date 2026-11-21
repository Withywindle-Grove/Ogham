-- M2 E4: notes. Free text from anyone in the campaign, optionally about a character, or added to a log entry.
-- * The author is whoever wrote it (created_by, stamped by the database, can't be faked).
-- * A note added to a log entry gets that entry's audience, so only people who can see the entry see the note;
--   you can only add a note to an entry you can see.
-- * You edit your own notes (the GM any); only the text changes; each edit is logged with the old text.
-- * Notes are never deleted (no delete rule).

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  text text not null check (length(trim(text)) between 1 and 2000),
  about_actor_id uuid references public.actors (id) on delete set null,
  annotates_event_id uuid references public.events (id) on delete cascade,
  audience text not null default 'all' check (audience in ('all', 'gm', 'owner')),
  owner_user_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index notes_campaign_idx on public.notes (campaign_id, created_at);

create trigger stamp before insert or update on public.notes
  for each row execute function private.stamp_row();

-- A note's place: the character it's about must be in the campaign; a note on an entry takes its audience.
create function private.prepare_note() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.events;
begin
  if new.about_actor_id is not null
    and not exists (select 1 from public.actors a where a.id = new.about_actor_id and a.campaign_id = new.campaign_id) then
    raise exception 'That character isn''t in this campaign.' using errcode = '42501';
  end if;
  new.audience := 'all';
  new.owner_user_id := null;
  if new.annotates_event_id is not null then
    select * into entry from public.events e where e.id = new.annotates_event_id;
    if entry.id is null or entry.campaign_id <> new.campaign_id then
      raise exception 'That log entry isn''t in this campaign.' using errcode = '42501';
    end if;
    new.audience := entry.audience;
    new.owner_user_id := entry.owner_user_id;
  end if;
  return new;
end;
$$;
revoke execute on function private.prepare_note() from public, anon, authenticated;
create trigger prepare_note before insert on public.notes
  for each row execute function private.prepare_note();

-- Only the text of a note changes.
create function private.guard_note_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.campaign_id is distinct from old.campaign_id
    or new.about_actor_id is distinct from old.about_actor_id
    or new.annotates_event_id is distinct from old.annotates_event_id
    or new.audience is distinct from old.audience
    or new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Only a note''s text can change.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_note_update before update on public.notes
  for each row execute function private.guard_note_update();

alter table public.notes enable row level security;
grant select, insert, update on public.notes to authenticated;
grant select, insert, update, delete on public.notes to service_role;

create policy "notes: read what you may see" on public.notes
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and (audience = 'all' or (audience = 'owner' and owner_user_id = (select auth.uid())))
    )
  );
-- Members write notes; one on a log entry only if they can see that entry (the events rule applies here).
create policy "notes: members write" on public.notes
  for insert to authenticated
  with check (
    private.is_member(campaign_id)
    and (annotates_event_id is null or exists (select 1 from public.events e where e.id = annotates_event_id))
  );
create policy "notes: edit your own, or any as GM" on public.notes
  for update to authenticated
  using (private.is_gm(campaign_id) or (private.is_member(campaign_id) and created_by = (select auth.uid())))
  with check (private.is_gm(campaign_id) or (private.is_member(campaign_id) and created_by = (select auth.uid())));

-- Logged like every other table, with the note's own audience.
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
  event_type := coalesce(nullif(left(tag ->> 'type', 80), ''), tg_table_name || '.' || lower(tg_op));
  if tag ->> 'level' in ('simple', 'verbose') then
    event_level := tag ->> 'level';
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

create trigger log_change after insert or update or delete on public.notes
  for each row execute function private.log_change();

-- Undo can put a note's earlier text back.
create or replace function public.undo_request(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  picked public.events;
  change public.events;
  current_row jsonb;
  key text;
  assignments text;
  id_column text;
begin
  select * into picked from public.events e where e.id = event_id;
  if picked.id is null
    or not (
      private.is_gm(picked.campaign_id)
      or (private.is_member(picked.campaign_id) and picked.actor_user_id = (select auth.uid()))
    ) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;

  -- Check everything first.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id
      and (e.id = picked.id or (picked.request_id is not null and e.request_id = picked.request_id))
  loop
    if change.before is null or change.after is null then
      raise exception 'Making or deleting things can''t be undone.';
    end if;
    if change.target_table not in ('campaigns', 'members', 'invites', 'companies', 'field_definitions', 'assets', 'actors', 'actor_secrets', 'notes') then
      raise exception 'That can''t be undone.';
    end if;
    if exists (select 1 from public.events r where r.reverts_event_id = change.id) then
      raise exception 'That was already undone.';
    end if;
    id_column := case when change.target_table = 'actor_secrets' then 'actor_id' else 'id' end;
    execute format('select to_jsonb(t) from public.%I t where t.%I = $1', change.target_table, id_column)
      into current_row using change.target_id;
    if current_row is null then
      raise exception 'That''s changed since. Undo the later change first.';
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
      and (e.id = picked.id or (picked.request_id is not null and e.request_id = picked.request_id))
    order by e.seq desc
  loop
    id_column := case when change.target_table = 'actor_secrets' then 'actor_id' else 'id' end;
    select string_agg(format('%I = r.%I', k, k), ', ') into assignments from jsonb_object_keys(change.before) k;
    perform set_config('grimoire.reverting', change.id::text, true);
    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.%I = $2',
      change.target_table, assignments, change.target_table, id_column
    ) using change.before, change.target_id;
  end loop;
  perform set_config('grimoire.reverting', '', true);
end;
$$;
