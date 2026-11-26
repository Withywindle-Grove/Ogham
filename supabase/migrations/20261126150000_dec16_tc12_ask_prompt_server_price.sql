-- TC12, review fixes round 2 (pull request #101; town row TC12, tn-7; hard rule 5). Fixes forward
-- 20261126100000_dec16_tc12_ask_only_offered_shop.sql (treated as applied; never edited).
--   The price on the stored request: round 1 made the answer's price the entry's, but the request row still kept the
--   device's prompt as sent, so a tampered prompt.price ("0 herons") was stored on the row and, through the row's log
--   line (town.askFor's `after`), stayed in the log the GM reads. Now the server writes the prompt it stores: the buy
--   prompt's own fields as sent (serviceId, shop, itemId, item; any other key is dropped, so no other device-claimed
--   price field is kept), and `price` the server's: the entry's price in words (private.stock_price_for, the same
--   words the answer says) when the prompt names a thing, '' for Something not listed… or a thing not in the setting.
--   A request that waits keeps the entry's price too, so the GM's card ("The pack's price: …") reads the server's
--   words, never the device's; an honest device sends those same words (priceText of the entry's readable value).
-- What it replaces: public.ask_for_thing (same arguments, return type, security invoker, search_path and grants,
-- restated; its checks and answer unchanged). Add-only: drops, renames and deletes nothing; no rows written; no row
-- changes (requests already stored keep their prompt).

-- builds on: public.ask_for_thing from 20261126100000_dec16_tc12_ask_only_offered_shop.sql
create or replace function public.ask_for_thing(campaign uuid, actor uuid, body text, on_day integer, prompt jsonb default '{}'::jsonb)
returns public.requests
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('requests');
  request public.requests;
  asked jsonb := case when jsonb_typeof(prompt) = 'object' then prompt else '{}'::jsonb end;
  service text := case when jsonb_typeof(asked -> 'serviceId') = 'string' then asked ->> 'serviceId' end;
  item text := case when jsonb_typeof(asked -> 'itemId') = 'string' then asked ->> 'itemId' end;
  price text := '';
  stored jsonb;
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
  -- Only a shop offered where the asker's group is (shown, open, in this town) answers at once; any other waits.
  if service is not null and item is not null and private.shop_offered_to(campaign, actor, service) then
    decided := private.stock_answer_for(campaign, service, item, on_day);
  end if;
  -- The price is the entry's, never the device's: said in the answer, and written on the stored prompt.
  if item is not null then
    price := private.stock_price_for(campaign, item);
  end if;
  -- The prompt stored (and so logged): the buy prompt's own fields as sent, with the server's price.
  stored := coalesce((select jsonb_object_agg(f.key, f.value) from jsonb_each(asked) f where f.key in ('serviceId', 'shop', 'itemId', 'item')), '{}'::jsonb)
    || jsonb_build_object('price', price);
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
    (select auth.uid()), actor, 'buy', 'playerAsks', body, '', stored)
  returning * into request;
  perform set_config('grimoire.stock_answer', '', true);
  return request;
end;
$$;
revoke execute on function public.ask_for_thing(uuid, uuid, text, integer, jsonb) from public, anon;
grant execute on function public.ask_for_thing(uuid, uuid, text, integer, jsonb) to authenticated, service_role;
