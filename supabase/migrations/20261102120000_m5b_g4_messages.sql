-- M5b step g4: messaging (M5 gate B3, ruled 2026-11-01; docs/05 "Messaging", docs/03 "Messaging" row; the plan is
-- docs/plans/m5b-g4-messaging.md). One private feature between the GM and a player only: one thread per character
-- (the GM's view), one thread with the GM (a player's view). A message is text, or a picture from the GM's device
-- (ruled 2026-11-01: the GM only may attach a file, up to 10 MB), or both; "Disappears once read" hides it from its
-- recipient once they close it (the GM's log keeps the text); Undo (message.send is an undoable making) marks it
-- undone. Only the two parties' devices receive a message, and only they can read its file: the rules below, and
-- the message-files bucket's.
-- Replaces Send (M5 step 11): gm_messages, message_recipients, send_message and close_message stay as they are, so
-- the log keeps reading the old lines; no row is dropped or deleted. message.close's logged-command row goes
-- (configuration, not data; as 20261024140000_m4_at_hand.sql did for inventory.showAll).

-- 1. The record -----------------------------------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The thread: the character it is about (the GM writes to a character; a player writes as one).
  actor_id uuid not null references public.actors (id) on delete cascade,
  -- The character's player when it was sent (docs/10: a character changing hands keeps old messages with the old player).
  player_user_id uuid not null references public.profiles (id) on delete cascade,
  from_gm boolean not null,
  sender_user_id uuid references public.profiles (id) on delete set null,
  body text not null default '' check (length(body) <= 4000),
  -- A picture from the device, kept in the message-files bucket at <campaign id>/<message id>. The GM only.
  attachment_name text check (attachment_name is null or length(trim(attachment_name)) between 1 and 200),
  attachment_type text check (attachment_type is null or attachment_type like 'image/%'),
  attachment_size integer check (attachment_size is null or attachment_size between 1 and 10485760),
  disappears boolean not null default false,
  -- When its recipient read it (a plain message: on opening the thread; a disappearing one: on closing it).
  read_at timestamptz,
  undone boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(body)) > 0 or attachment_name is not null),
  check ((attachment_name is null) = (attachment_type is null) and (attachment_name is null) = (attachment_size is null)),
  check (attachment_name is null or from_gm)
);
create index messages_thread on public.messages (campaign_id, actor_id, created_at desc) where not undone;
create index messages_player on public.messages (player_user_id, campaign_id) where not undone;

-- May the signed-in person read this message: one of its two parties (the GM, or the character's player), and not
-- a disappearing one its recipient has closed. (private.message_for_me is the old Send's rule; it stays.)
create function private.message_visible(m public.messages) returns boolean
language sql stable security definer set search_path = '' as $$
  select not m.undone
    and private.is_member(m.campaign_id)
    and (private.is_gm(m.campaign_id) or m.player_user_id = (select auth.uid()))
    and not (
      m.disappears and m.read_at is not null
      and (case when m.from_gm then m.player_user_id = (select auth.uid()) else private.is_gm(m.campaign_id) end)
    );
$$;
-- The access rules below call it as the reader.
revoke execute on function private.message_visible(public.messages) from public, anon;
grant execute on function private.message_visible(public.messages) to authenticated;

alter table public.messages enable row level security;
grant select, insert, update on public.messages to authenticated;
grant select, insert, update, delete on public.messages to service_role;

create policy "messages: its two parties" on public.messages
  for select to authenticated using (private.message_visible(messages.*));
create policy "messages: the GM, or the character's player, writes" on public.messages
  for insert to authenticated
  with check (private.is_member(campaign_id) and (private.is_gm(campaign_id) or player_user_id = (select auth.uid())));
create policy "messages: read, or taken back" on public.messages
  for update to authenticated
  using (private.is_member(campaign_id) and (private.is_gm(campaign_id) or player_user_id = (select auth.uid())))
  with check (private.is_member(campaign_id) and (private.is_gm(campaign_id) or player_user_id = (select auth.uid())));

-- A message: about a player's character in play, from the GM or from that player as the character; trimmed; a file
-- only from the GM. A change: read_at (set once, by its recipient) or undo's mark (by its sender). The service role
-- (fixtures) writes the row as given.
create function private.message_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  character public.actors;
  recipient_is_me boolean;
begin
  if tg_op = 'INSERT' then
    select * into character from public.actors a where a.id = new.actor_id and a.campaign_id = new.campaign_id;
    if character.id is null then
      raise exception 'That character isn''t in this campaign.';
    end if;
    if character.kind <> 'pc' or character.approval <> 'approved' or character.status <> 'active'
      or character.owner_type <> 'user' or character.owner_user_id is null then
      raise exception 'Messages go to a player''s character in play.';
    end if;
    new.player_user_id := character.owner_user_id;
    new.body := trim(coalesce(new.body, ''));
    new.disappears := coalesce(new.disappears, false);
    new.read_at := null;
    new.undone := false;
    if who is not null then
      new.from_gm := private.is_gm(new.campaign_id);
      new.sender_user_id := who;
      if not new.from_gm and character.owner_user_id is distinct from who then
        raise exception 'You don''t have permission to do that.' using errcode = '42501';
      end if;
    end if;
    if new.attachment_name is not null and not new.from_gm then
      raise exception 'Only the GM can attach a file.';
    end if;
    if length(new.body) = 0 and new.attachment_name is null then
      raise exception 'Write something to send.';
    end if;
    return new;
  end if;
  if old.undone then
    raise exception 'That message was undone.';
  end if;
  if (to_jsonb(new) - 'undone' - 'read_at' - 'updated_at') is distinct from (to_jsonb(old) - 'undone' - 'read_at' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  if new.read_at is distinct from old.read_at then
    if old.read_at is not null or new.read_at is null then
      raise exception 'That can''t be changed.';
    end if;
    recipient_is_me := case when old.from_gm then old.player_user_id = who else private.is_gm(old.campaign_id) end;
    if who is not null and not recipient_is_me then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
  end if;
  if new.undone and not old.undone and who is not null and old.sender_user_id is distinct from who then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.message_rules() from public, anon, authenticated;

create trigger message_rules before insert or update on public.messages
  for each row execute function private.message_rules();
create trigger refuse_when_retired before insert or update or delete on public.messages
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.messages
  for each row execute function private.log_change();

-- A message's lines are its player's own (the GM reads every line); a disappearing one's are the GM's alone, so the
-- text never enters the player's log.
create function private.log_audience_messages(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
begin
  if coalesce((this_row ->> 'disappears')::boolean, false) then
    who_sees := 'gm';
    owner := null;
    return;
  end if;
  who_sees := 'owner';
  owner := (this_row ->> 'player_user_id')::uuid;
end;
$$;
revoke execute on function private.log_audience_messages(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('messages');

-- 2. Send and read ----------------------------------------------------------------------------------------------------

-- Send (message.send): the text, or a picture (the GM only; its name, type and size, the file itself uploaded next),
-- or both, to one or more characters: one message per character, each in its thread. The GM writes to any character
-- in play; a player to the GM, as one of their own characters. A repeat (the same request) gives back what it made.
create function public.send_messages(campaign uuid, to_characters uuid[], body text default '', disappears boolean default false,
  attachment jsonb default null) returns setof public.messages
language plpgsql security invoker set search_path = '' as $$
declare
  tag jsonb := private.request_tag();
  made uuid := private.made_by_request('messages');
  character uuid;
begin
  if made is not null then
    return query
      select m.* from public.messages m
      join public.events e on e.target_id = m.id
      where e.request_id = (tag ->> 'requestId')::uuid and e.target_table = 'messages' and e.before is null
        and e.actor_user_id is not distinct from (select auth.uid())
      order by m.created_at, m.id;
    return;
  end if;
  if not private.is_member(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if to_characters is null or coalesce(array_length(to_characters, 1), 0) = 0 then
    raise exception 'Pick at least one character.';
  end if;
  if not private.is_gm(campaign) and array_length(to_characters, 1) > 1 then
    raise exception 'A player writes to the GM as one character at a time.';
  end if;
  if length(trim(coalesce(body, ''))) = 0 and attachment is null then
    raise exception 'Write something to send.';
  end if;
  if length(trim(body)) > 4000 then
    raise exception 'A message is at most 4000 characters.';
  end if;
  if attachment is not null and not private.is_gm(campaign) then
    raise exception 'Only the GM can attach a file.';
  end if;
  if attachment is not null and coalesce((attachment ->> 'size')::integer, 0) > 10485760 then
    raise exception 'That picture is too large. Choose one under 10 MB.';
  end if;
  foreach character in array to_characters loop
    insert into public.messages (campaign_id, actor_id, player_user_id, from_gm, body, disappears, attachment_name, attachment_type, attachment_size)
    select campaign, a.id, a.owner_user_id, private.is_gm(campaign), coalesce(body, ''), coalesce(disappears, false),
      nullif(trim(attachment ->> 'name'), ''), attachment ->> 'type', (attachment ->> 'size')::integer
    from public.actors a where a.id = character and a.campaign_id = campaign;
    if not found then
      raise exception 'That character isn''t in this campaign.';
    end if;
  end loop;
  return query
    select m.* from public.messages m
    join public.events e on e.target_id = m.id
    where e.request_id = (tag ->> 'requestId')::uuid and e.target_table = 'messages' and e.before is null
      and e.actor_user_id is not distinct from (select auth.uid())
    order by m.created_at, m.id;
end;
$$;
revoke execute on function public.send_messages(uuid, uuid[], text, boolean, jsonb) from public, anon;
grant execute on function public.send_messages(uuid, uuid[], text, boolean, jsonb) to authenticated, service_role;

-- Read (message.read): the recipient has read these (a plain one on opening the thread, a disappearing one on
-- closing it, after which it leaves their device). Their own unread ones among those given; a repeat changes nothing.
-- Refused when none of them is theirs to read.
create function public.read_messages(message_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  read_now integer;
begin
  if who is null or not exists (
    select 1 from public.messages m
    where m.id = any (message_ids) and not m.undone and private.is_member(m.campaign_id)
      and (case when m.from_gm then m.player_user_id = who else private.is_gm(m.campaign_id) end)
  ) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  update public.messages m set read_at = now()
  where m.id = any (message_ids) and not m.undone and m.read_at is null and private.is_member(m.campaign_id)
    and (case when m.from_gm then m.player_user_id = who else private.is_gm(m.campaign_id) end);
  get diagnostics read_now = row_count;
  return read_now;
end;
$$;
revoke execute on function public.read_messages(uuid[]) from public, anon;
grant execute on function public.read_messages(uuid[]) to authenticated, service_role;

-- Players' and the GM's screens follow the rows they may read (a disappearing message makes no line of the player's).
alter publication supabase_realtime add table public.messages;

-- 3. The file: a private bucket of its own, 10 MB a file, readable by the message's two parties only ------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('message-files', 'message-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- The file at <campaign id>/<message id>: readable while its message is; written once, by the GM who sent it.
create function private.can_read_message_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.messages m
    where m.campaign_id::text = split_part(path, '/', 1) and m.id::text = split_part(path, '/', 2)
      and m.attachment_name is not null and private.message_visible(m)
  );
$$;
create function private.can_write_message_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.messages m
    where m.campaign_id::text = split_part(path, '/', 1) and m.id::text = split_part(path, '/', 2)
      and m.attachment_name is not null and not m.undone and m.from_gm
      and m.sender_user_id = (select auth.uid()) and private.is_gm(m.campaign_id)
  );
$$;
revoke execute on function private.can_read_message_file(text), private.can_write_message_file(text) from public, anon;
grant execute on function private.can_read_message_file(text), private.can_write_message_file(text) to authenticated;

create policy "message-files: the message's two parties read" on storage.objects
  for select to authenticated
  using (bucket_id = 'message-files' and private.can_read_message_file(name));
create policy "message-files: the GM who sent it uploads once" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-files' and private.can_write_message_file(name));

-- 4. Logged-command rows ----------------------------------------------------------------------------------------------

-- message.send now belongs to players too (to the GM); message.read replaces message.close (whose rows in the log stay).
update public.logged_commands set gm_only = false where name = 'message.send';
insert into public.logged_commands (name, level, gm_only) values ('message.read', 'verbose', false);
delete from public.logged_commands where name = 'message.close';
