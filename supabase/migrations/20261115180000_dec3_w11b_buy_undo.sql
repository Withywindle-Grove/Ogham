-- December step 3, W11b: Undo on "Buy it" (Francis's bu-1 and hr4, docs/design/rulings/dec-pack-town-players-2026-11-14.md
-- and dec-late-2026-11-14.md). A NEW NAMED EXCEPTION to hard rule 4 (the sixth), ruled by Francis:
--   bu-1: "The buyer's own bought item is removed if nobody has touched it since; the log keeps a full copy. Only the
--   buyer's own Undo of their own purchase; refused once the item is touched; a spend made from the toast is separate;
--   the GM's general Undo goes on refusing a purchase." Francis: "Yes to both".
--   hr4: "Yes make the change": CLAUDE.md's hard rule 4 goes from five documented exceptions to six, naming this one.
--   bu-2 (the lead's): the bought line is untouched while its version is unchanged since the purchase made it (not
--   moved, pinned, equipped, given, split, used, its quantity not changed): the line's version unchanged since it was made.
--
-- public.undo_buy(request): its own command (request.undoBuy), as undo_activity is activity.undo. Only the buyer, on
-- their own accepted buy; finds the line that purchase made (the inventory event sharing the reply's request id);
-- refused when the line has changed since; otherwise deletes it (the delete event keeps a full copy, linked to the
-- event it reverses) and marks the request undone. Nothing was charged (costs are text until purses), so no coin moves.
-- private.undo_body and private.undo_check_change are NOT touched: the GM's general Undo goes on refusing a purchase.
-- Adds one function and one logged_commands row. Drops, renames and deletes nothing in existing data.

create function public.undo_buy(request uuid) returns public.requests
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
  -- pack of the character the request was for, that character is still the caller's (a character given to another
  -- player is refused), it came in as bought, and its version is still 1. A missing request id refuses. Any mismatch is
  -- the same plain refusal and never names a line. The type test below only narrows the match.
  if not exists (select 1 from public.actors a where a.id = req.actor_id and a.owner_type = 'user' and a.owner_user_id = (select auth.uid())) then
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
  -- bu-2: untouched while the line's version is unchanged since it was made (a new line starts at 1; the log never
  -- carries versions). Two uses that don't bump the version also count as touched: a light lit from it, and things put in it.
  if line.version <> 1
    or exists (select 1 from public.character_lights c where c.line_id = line.id)
    or exists (select 1 from public.inventory_lines o where o.container_line_id = line.id) then
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

insert into public.logged_commands (name, level, gm_only) values ('request.undoBuy', 'simple', false);
