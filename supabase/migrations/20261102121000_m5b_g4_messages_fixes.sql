-- M5b step g4 (fix forward on 20261102120000_m5b_g4_messages.sql, found by its database test):
--   1. A player's Undo of their own message was refused: Postgres checks the updated row against the reading rule
--      too (the update's WHERE reads the table), and private.message_visible hid an undone row from everyone, its
--      sender included (the GM's undo runs as the table's owner, so it slipped past). Now a sender still reads their
--      own undone message (the app lists only those not undone); nobody else does.
--   2. public.send_messages gave back nothing when called without a request tag (the app always tags; a direct call
--      didn't): it now returns the rows it made by their ids. A repeat of a tagged request still gives back what
--      that request made.
-- Replaces private.message_visible and public.send_messages (both newest in 20261102120000). Drops nothing.

create or replace function private.message_visible(m public.messages) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member(m.campaign_id)
    and (private.is_gm(m.campaign_id) or m.player_user_id = (select auth.uid()))
    and (not m.undone or m.sender_user_id = (select auth.uid()))
    and not (
      m.disappears and m.read_at is not null
      and (case when m.from_gm then m.player_user_id = (select auth.uid()) else private.is_gm(m.campaign_id) end)
    );
$$;

create or replace function public.send_messages(campaign uuid, to_characters uuid[], body text default '', disappears boolean default false,
  attachment jsonb default null) returns setof public.messages
language plpgsql security invoker set search_path = '' as $$
declare
  tag jsonb := private.request_tag();
  made uuid := private.made_by_request('messages');
  character uuid;
  made_now uuid[] := '{}';
  one uuid;
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
    from public.actors a where a.id = character and a.campaign_id = campaign
    returning id into one;
    if one is null then
      raise exception 'That character isn''t in this campaign.';
    end if;
    made_now := made_now || one;
    one := null;
  end loop;
  return query select m.* from public.messages m where m.id = any (made_now) order by m.created_at, m.id;
end;
$$;
