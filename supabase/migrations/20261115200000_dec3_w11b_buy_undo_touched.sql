-- December step 3, W11b round 4 (the lead's bu-2b), fix forward: public.undo_buy (newest: 20261115190000, applied on TEST,
-- so not edited) judged "touched" by the line's version alone, but two uses leave the version at 1: a torch lit and then
-- replaced by another light (character_lights keeps one row per character, so the burnt torch's line is untouched
-- in the row) and the GM's hidden charges set on the line (inventory_line_secrets: the version doesn't move and the
-- cascade would delete the GM's secret row). "Touched" now also reads the log (events): any logged change to the line,
-- to any light that ever pointed at it, or to its secrets after the event that made it. No new read rule or table: the
-- function is security definer and reads events as the earlier ones do. The version test stays.
-- Replaces one function (create or replace; grants and revokes kept). Adds nothing; drops, renames and deletes nothing.

-- The whole rule of public.undo_buy, in plain sentences (bu-1, bu-2, bu-2b, hr4):
--   Who may call it: only the buyer: the signed-in member who made the buy request, who still owns the character it was
--   for (not given to another player, not the GM's or the party's, not archived, not deleted), in a campaign that is not
--   retired. The GM and everyone else are refused; the GM's general Undo goes on refusing a purchase.
--   What it needs: an accepted buy (the reply was Buy it), not already undone, and a reply that carries a request id.
--   The line is found through the buyer's own creating event for that request id, in the pack of that character, and
--   must have come in as bought.
--   What counts as touched (bu-2b): the line's version moved; a light is, or ever was, pointed at it; something sits
--   inside it; or the log holds any change after the one that made the line, to the line, to a light that pointed at
--   it, or to its hidden-charges row, by anyone. Touched means refused, in one text whatever the reason.
--   What it deletes: only that one bought line; no coin moves (nothing was charged); the request is marked undone.
--   What the log keeps: the delete event with the line's full copy, linked to the event that made it, and the request's
--   update linked to the reply; both under the command request.undoBuy. A spend made from the toast is separate.

create or replace function public.undo_buy(request uuid) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  req public.requests;
  reply_event public.events;
  made_event public.events;
  line public.inventory_lines;
begin
  select * into req from public.requests r where r.id = request for update;
  if req.id is null or not private.is_member(req.campaign_id) or req.requester_id is distinct from (select auth.uid()) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if req.undone then
    raise exception 'That was already undone.';
  end if;
  if req.kind <> 'buy' or req.reply is distinct from 'accept' then
    raise exception 'There''s no purchase to undo.';
  end if;
  select * into reply_event from public.events e
  where e.campaign_id = req.campaign_id and e.target_table = 'requests' and e.target_id = req.id
    and e.before is not null and e.after ->> 'reply' = 'accept' and e.before ->> 'reply' is null
  order by e.seq desc limit 1;
  -- The reply's request id and the event's type come from the client's own tag (log_change), so neither is a trust
  -- check. The boundary is: the caller made the line's creating event (actor_user_id = auth.uid()), the line is in the
  -- pack of the character the request was for, that character is still the caller's and not archived (a character given to another
  -- player is refused), it came in as bought, and its version is still 1. A missing request id refuses. Any mismatch is
  -- the same plain refusal and never names a line. The type test below only narrows the match.
  if not exists (select 1 from public.actors a where a.id = req.actor_id and a.owner_type = 'user' and a.owner_user_id = (select auth.uid()) and a.status <> 'archived') then
    raise exception 'There''s no purchase to undo.';
  end if;
  if reply_event.id is null or reply_event.request_id is null then
    raise exception 'There''s no purchase to undo.';
  end if;
  select * into made_event from public.events e
  where e.campaign_id = req.campaign_id and e.target_table = 'inventory_lines' and e.before is null
    and e.request_id = reply_event.request_id and e.actor_user_id = (select auth.uid()) and e.type = 'request.reply'
  order by e.seq limit 1;
  if made_event.id is null then
    raise exception 'There''s no purchase to undo.';
  end if;
  select * into line from public.inventory_lines l where l.id = made_event.target_id for update;
  if line.id is null or line.actor_id is distinct from req.actor_id or line.how_got is distinct from 'bought' then
    raise exception 'There''s no purchase to undo.';
  end if;
  -- bu-2b: the line is TOUCHED once any logged change to the line, to a light that ever pointed at it, or to its
  -- hidden-charges row exists after the event that made it, by anyone; or its version moved; or a light still points at
  -- it; or something sits inside it. One refusal text for every reason (it never says which, so it can never tell a
  -- player that the GM set something hidden).
  if line.version <> 1
    or exists (select 1 from public.character_lights c where c.line_id = line.id)
    or exists (select 1 from public.inventory_lines o where o.container_line_id = line.id)
    or exists (
      select 1 from public.events e
      where e.campaign_id = req.campaign_id and e.seq > made_event.seq
        and e.target_table in ('inventory_lines', 'inventory_line_secrets') and e.target_id = line.id
    )
    or exists (
      select 1 from public.events e
      where e.campaign_id = req.campaign_id and e.target_table = 'character_lights'
        and (e.before ->> 'line_id' = line.id::text or e.after ->> 'line_id' = line.id::text)
    ) then
    raise exception 'That''s changed since: the % was used or moved. Undo the later change first.', line.name;
  end if;

  perform set_config('grimoire.reverting', made_event.id::text, true);
  delete from public.inventory_lines l where l.id = line.id;
  perform set_config('grimoire.reverting', reply_event.id::text, true);
  update public.requests r set undone = true where r.id = req.id returning * into req;
  perform set_config('grimoire.reverting', '', true);
  return req;
end;
$$;
revoke execute on function public.undo_buy(uuid) from public, anon;
grant execute on function public.undo_buy(uuid) to authenticated, service_role;
