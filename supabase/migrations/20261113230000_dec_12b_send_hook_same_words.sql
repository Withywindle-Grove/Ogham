-- Calls to adventure, the lead's ruling on #741's pictures (dec-12 piece B, 2026-11-13): two sends of one hook to one
-- hearer at the same moment are refused in the approved mockup's words, the same as a second send one after the
-- other ("It wasn't sent again: the party already has it. Nothing changed.", or "<name> already has it." for a
-- character). "That call to adventure has already gone to …" (20261113220000) is withdrawn.
-- Replaces one function, public.send_hook, from its newest definition in 20261113220000_dec_12b_send_hook_refusals.sql
-- (live on TEST and main), changing only the message of the unique_violation it catches: the same signature, return,
-- security definer, search_path and grants, the rp-11 strip and the other refusals as they were. Drops, renames and
-- deletes no data; no row is written. It doesn't change who may read what.

create or replace function public.send_hook(campaign uuid, pack uuid, hook_key text, body text, pays text, to_actor uuid default null)
returns public.hook_sends
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('hook_sends');
  sent public.hook_sends;
  hook public.library_entries;
  who public.actors;
  -- A link's code never reaches a player (rp-11): the words and pays are kept with each link mark as its words only
  -- (private.plain_link_text, 20261113200000_players_never_get_link_ids.sql), whatever the device sent.
  words text := trim(private.plain_link_text(coalesce(send_hook.body, '')));
  paid text := trim(private.plain_link_text(coalesce(send_hook.pays, '')));
  named text;
  now_seconds bigint;
begin
  if made is not null then
    select * into sent from public.hook_sends s where s.id = made;
    return sent;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select e.* into hook from public.library_entries e
  where e.pack_id = send_hook.pack and e.pack_entry_id = send_hook.hook_key and e.kind = 'adventureHook'
    and exists (select 1 from public.campaign_packs cp where cp.campaign_id = send_hook.campaign and cp.pack_id = e.pack_id);
  if hook.id is null then
    raise exception 'That call to adventure isn''t in an adventure this campaign uses.';
  end if;
  -- (a) and (b): the name as players will read it, its link marks as words.
  named := trim(private.plain_link_text(coalesce(hook.name, '')));
  if length(named) = 0 then
    raise exception 'This call to adventure has no name the players can read. It needs fixing in its pack.';
  end if;
  if length(named) > 200 then
    raise exception 'A call to adventure''s name is at most 200 characters.';
  end if;
  if to_actor is not null then
    select * into who from public.actors a where a.id = to_actor and a.campaign_id = send_hook.campaign;
    if who.id is null or who.kind <> 'pc' or who.approval <> 'approved' or who.status <> 'active'
      or who.owner_type <> 'user' or who.owner_user_id is null then
      raise exception 'Send it to a player''s character in play, or to the party.';
    end if;
  end if;
  if length(words) = 0 then
    raise exception 'Write the words to send.';
  end if;
  if length(words) > 4000 then
    raise exception 'The words are at most 4000 characters.';
  end if;
  if length(paid) > 500 then
    raise exception 'What it pays is at most 500 characters.';
  end if;
  if exists (
    select 1 from public.hook_sends s
    where s.campaign_id = send_hook.campaign and s.pack_id = send_hook.pack and s.hook_key = send_hook.hook_key
      and s.actor_id is not distinct from to_actor and not s.undone
  ) then
    raise exception 'It wasn''t sent again: % already has it. Nothing changed.',
      case when to_actor is null then 'the party' else who.name end;
  end if;
  select c.seconds into now_seconds from public.campaign_clocks c where c.campaign_id = send_hook.campaign;
  begin
    insert into public.hook_sends (campaign_id, pack_id, hook_key, actor_id, player_user_id, name, body, pays, clock_seconds)
    values (send_hook.campaign, send_hook.pack, send_hook.hook_key, to_actor, who.owner_user_id, named, words, paid, coalesce(now_seconds, 0))
    returning * into sent;
  exception when unique_violation then
    -- (c) A send of the same hook to the same hearer was written in the same moment: the same words as the check above.
    raise exception 'It wasn''t sent again: % already has it. Nothing changed.', case when to_actor is null then 'the party' else who.name end;
  end;
  return sent;
end;
$$;
revoke execute on function public.send_hook(uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.send_hook(uuid, uuid, text, text, text, uuid) to authenticated, service_role;
