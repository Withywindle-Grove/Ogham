-- TC12: the at-once answer (docs/plans/dec-16-town-carry.md row TC12, the stack's W10a; Francis's yes tn-7 and the
-- lead's tn-8, docs/design/rulings/dec-town-ask-card-2026-11-14.md). Data and logic only.
--   tn-7: a player's request for a thing already decided in the day's stock is answered by the app at once, with the
--   answer line a GM's answer gives today ("In stock: <price>" or "Not here"), and no card reaches the GM. A thing still
--   on "?" or not in the shop's list waits for the GM as before.
--   tn-8: it goes through a command and is logged like any answer (town.askFor, the player's line, read by the player
--   and the GM as every request's line is); a later flip in the stock table does not unsend it (the answer is on the
--   request, which a later stock.set never touches, and only a waiting request can be answered); a player reads none of
--   the day's stock lines that are out or undecided, and learns "Not here" only for the thing asked for.
-- What it adds:
--   1. private.stock_answer_for(campaign, service, item, on_day): what the day's stock says of one thing at one shop,
--      'in' or 'out', else null (undecided, not in the shop's list, or not to be answered at once). The same answer in
--      force as the players' reader (public.shop_stock_in, newest: 20261115150000_dec_3_stock_reader_narrow.sql): the
--      item's winning version for sale in the campaign (its whole entry, GM-only part included), the day's live row,
--      else (a setting's shop only) private.stock_default with the town's size unknown; a pack's shop (`place:`) reads
--      the GM's stored answers alone. For a member of the campaign only; null for anyone else. A day before the newest
--      day the campaign's stock has a live row on reads null: a device can't name a past day to learn its answers
--      (a later day has no rows, so it reads only the defaults a player's reader already gives).
--   2. public.ask_for_thing(campaign, actor, body, on_day, prompt) (town.askFor): a buy request, sent as
--      public.send_request sends one (security invoker: the requests table's rules and policies check the asker, their
--      own character in play, as for any request). When the day's stock has decided the thing, and an "in" thing has a
--      price to say, the request is made already answered: {kind: buy, result: inStock, price} or {kind: buy, result:
--      notHere}. Else it waits for the GM.
--   3. private.request_stock_answer() and its trigger request_stock_answer_on_insert (before insert on
--      public.requests, after request_rules_on_insert by name): it answers the new row only while ask_for_thing has
--      set the transaction's `grimoire.stock_answer` for this very request (its campaign, character and thing), and
--      only a buy a player sends. Nobody outside the database's own functions can set that setting.
--   4. logged_commands gains town.askFor (simple, the player's). Not undoable: an answer given is not unsent (tn-8).
-- Hidden means hidden: the answer is on the asker's own request (read by them and the GM only); nothing of the day's
-- other stock lines comes back.
-- Adds three functions, one trigger and one row in public.logged_commands. Replaces no function; drops, renames and
-- deletes no data; no existing row changes.

-- 1. What the day's stock says of one thing ----------------------------------------------------------------------------

create function private.stock_answer_for(campaign uuid, service text, item text, on_day integer) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  whole jsonb;
  stored text;
  newest integer;
  answer text;
begin
  if not private.is_member(campaign) or on_day is null or on_day < 1
    or length(coalesce(service, '')) not between 1 and 200 or length(coalesce(item, '')) not between 1 and 200 then
    return null;
  end if;
  select max(s.day) into newest from public.shop_stock s where s.campaign_id = campaign and not s.undone;
  if newest is not null and on_day < newest then
    return null;
  end if;
  -- The item's winning version in the campaign, as public.shop_stock_in picks it.
  select e.data || coalesce(h.data, '{}'::jsonb) into whole
  from public.campaign_packs cp
  join public.packs p on p.id = cp.pack_id
  left join public.campaign_pack_secrets sec on sec.id = cp.id
  join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'item' and e.pack_entry_id = item
  left join public.library_entry_secrets h on h.id = e.id
  where cp.campaign_id = campaign
  order by coalesce(sec.overrides ? ('item:' || e.pack_entry_id), false) desc, (p.kind = 'homebrew') desc,
    cp.priority desc, cp.pack_id::text
  limit 1;
  if whole is null or not private.for_sale(whole) then
    return null;
  end if;
  select r.answer into stored
  from public.shop_stock r
  where r.campaign_id = campaign and r.service_id = service and r.item_id = item and r.day = on_day and not r.undone;
  answer := case
    when starts_with(service, 'place:') then stored
    else coalesce(stored, private.stock_default(whole -> 'availability', null))
  end;
  return case when answer in ('in', 'out') then answer end;
end;
$$;
revoke execute on function private.stock_answer_for(uuid, text, text, integer) from public, anon;
grant execute on function private.stock_answer_for(uuid, text, text, integer) to authenticated, service_role;

-- 3. The answer on the new row (before 2, which uses it) -----------------------------------------------------------------

create function private.request_stock_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  given text := nullif(current_setting('grimoire.stock_answer', true), '');
  said jsonb;
begin
  if given is null then
    return new;
  end if;
  said := given::jsonb;
  if new.kind = 'buy' and new.direction = 'playerAsks'
    and new.campaign_id::text = said ->> 'campaign' and new.actor_id::text = said ->> 'actor'
    and coalesce(new.prompt ->> 'itemId', '') = said ->> 'item' then
    new.status := 'answered';
    new.answer := said -> 'answer';
    new.answered_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function private.request_stock_answer() from public, anon, authenticated;

create trigger request_stock_answer_on_insert before insert on public.requests
  for each row execute function private.request_stock_answer();

-- 2. Ask for… answered at once ------------------------------------------------------------------------------------------

create function public.ask_for_thing(campaign uuid, actor uuid, body text, on_day integer, prompt jsonb default '{}'::jsonb)
returns public.requests
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('requests');
  request public.requests;
  asked jsonb := case when jsonb_typeof(prompt) = 'object' then prompt else '{}'::jsonb end;
  service text := case when jsonb_typeof(asked -> 'serviceId') = 'string' then asked ->> 'serviceId' end;
  item text := case when jsonb_typeof(asked -> 'itemId') = 'string' then asked ->> 'itemId' end;
  price text := case when jsonb_typeof(asked -> 'price') = 'string' then private.stock_trim(asked ->> 'price') else '' end;
  decided text;
  answer jsonb;
begin
  if made is not null then
    select * into request from public.requests r where r.id = made;
    return request;
  end if;
  if not private.is_member(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if body is null or length(trim(body)) = 0 then
    raise exception 'Write what you want to do.';
  end if;
  if length(trim(body)) > 2000 then
    raise exception 'A request is at most 2000 characters.';
  end if;
  if on_day is null or on_day < 1 then
    raise exception 'That day isn''t on the campaign''s clock.';
  end if;
  if service is not null and item is not null then
    decided := private.stock_answer_for(campaign, service, item, on_day);
  end if;
  -- In stock needs a price to say (Buy it replies to a priced answer); without one the GM prices it, as today.
  if decided = 'in' and price <> '' then
    answer := jsonb_build_object('kind', 'buy', 'result', 'inStock', 'price', price, 'note', '');
  elsif decided = 'out' then
    answer := jsonb_build_object('kind', 'buy', 'result', 'notHere', 'price', '', 'note', '');
  end if;
  if answer is not null then
    perform set_config('grimoire.stock_answer',
      jsonb_build_object('campaign', campaign, 'actor', actor, 'item', item, 'answer', answer)::text, true);
  end if;
  insert into public.requests (campaign_id, expedition_id, group_number, requester_id, actor_id, kind, direction, text, cost_text, prompt)
  values (
    campaign, private.expedition_under_way(campaign),
    (select m.group_number from public.party_group_members m where m.campaign_id = campaign and m.actor_id = actor limit 1),
    (select auth.uid()), actor, 'buy', 'playerAsks', body, '', asked)
  returning * into request;
  perform set_config('grimoire.stock_answer', '', true);
  return request;
end;
$$;
revoke execute on function public.ask_for_thing(uuid, uuid, text, integer, jsonb) from public, anon;
grant execute on function public.ask_for_thing(uuid, uuid, text, integer, jsonb) to authenticated, service_role;

-- 4. The command's row ----------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('town.askFor', 'simple', false);
