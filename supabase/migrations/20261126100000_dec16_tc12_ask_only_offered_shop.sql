-- TC12, review fixes round 1 (pull request #101; town row TC12, tn-7, tn-8; hard rule 5). Fixes forward
-- 20261125180000_dec16_tc12_ask_answered_at_once.sql, already applied to TEST (never edited).
--   1. Hidden means hidden: public.ask_for_thing answered from the day's stock for ANY shop key the device named
--      (prompt.serviceId), so a forged key read back the GM's stored "out" answers, and the difference between a
--      decided thing and an undecided one, for a shop the player can't see. Now the shop must be offered where the
--      asker's group is, as a listed lodging must be (20261106150000_m8b_0_places_settlement.sql, request_rules): the
--      group's visit (private.town_visit) at a town (safety or settlement set, not undone) whose list (places.town) has
--      the shop shown and open. A setting's shop is listed as `service:<id>`; a pack's shop is its own `place:<entry id>`
--      key, and its place row must also be live and one level under that town (as private.town_part_of reads it). A
--      shop not offered there answers nothing at once: the request waits for the GM, as an undecided thing does.
--   2. The price said: "In stock: <price>" took the price from the device's prompt, so a tampered prompt reached the
--      answer and the log ("(today's stock)"). Now the server says it, from the winning entry's `value` (the item's
--      winning version, as private.stock_answer_for picks it; its readable part only, private.visible_part, so a price
--      the pack keeps GM-only is never told), in the words the device's priceText uses ("2 herons", coin by coin, in the
--      order the entry's value reads). An "in" thing with no price to say still waits for the GM.
-- What it adds: private.shop_offered_to(campaign, actor, service), private.price_words(value) and
-- private.stock_price_for(campaign, item). What it replaces: public.ask_for_thing (same arguments, return type,
-- security invoker, search_path and grants, restated). Only adds checks: drops, renames and deletes nothing; no rows
-- written; no row changes.
-- Owed, not here: the players' reader public.shop_stock_in has the same gap (any shop key reads its "in" things). It takes
-- no character or group, so the check needs a rule for whose town counts; its own row in the pull request's text.

-- 1. The shop offered where the asker's group is ------------------------------------------------------------------------

-- builds on: the listed-lodging check of private.request_rules from 20261106150000_m8b_0_places_settlement.sql
create function private.shop_offered_to(campaign uuid, actor uuid, service text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(service) between 1 and 200, false) and exists (
    select 1
    from private.town_visit(campaign, coalesce(
      (select m.group_number from public.party_group_members m where m.campaign_id = campaign and m.actor_id = actor limit 1), 1)) v
    join public.places t on t.id = v.place_id and t.campaign_id = campaign and not t.undone
      and (t.safety is not null or t.settlement is not null)
    cross join lateral (
      select t.town -> (case when starts_with(service, 'place:') then service else 'service:' || service end) as entry
    ) k
    where (k.entry ->> 'shown') = 'true' and (k.entry ->> 'open') = 'true'
      and (not starts_with(service, 'place:') or exists (
        select 1 from public.places p
        where p.campaign_id = campaign and not p.undone
          and p.pack_id = t.pack_id and p.pack_parent_id = t.pack_entry_id
          and p.pack_entry_id = substr(service, 7)
      ))
  );
$$;
revoke execute on function private.shop_offered_to(uuid, uuid, text) from public, anon;
-- ask_for_thing (security invoker) calls it; the private schema isn't exposed to the API.
grant execute on function private.shop_offered_to(uuid, uuid, text) to authenticated, service_role;

-- 2. The price said, from the entry ------------------------------------------------------------------------------------

-- The device's priceText (src/app/AddItem.tsx): each coin with a number, "<amount> <coin>", joined by a space.
create function private.price_words(value jsonb) returns text
language sql immutable set search_path = '' as $$
  select coalesce(string_agg((v.amount #>> '{}') || ' ' || v.coin, ' ' order by v.n), '')
  from jsonb_each(case when jsonb_typeof(value) = 'object' then value else '{}'::jsonb end) with ordinality as v(coin, amount, n)
  where jsonb_typeof(v.amount) = 'number';
$$;
revoke execute on function private.price_words(jsonb) from public, anon;
grant execute on function private.price_words(jsonb) to authenticated, service_role;

-- builds on: the winning-version pick of private.stock_answer_for from 20261125180000_dec16_tc12_ask_answered_at_once.sql
create function private.stock_price_for(campaign uuid, item text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select private.price_words(private.visible_part(e.data || coalesce(h.data, '{}'::jsonb)) -> 'value')
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    left join public.campaign_pack_secrets sec on sec.id = cp.id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'item' and e.pack_entry_id = item
    left join public.library_entry_secrets h on h.id = e.id
    where cp.campaign_id = campaign and private.is_member(campaign)
    order by coalesce(sec.overrides ? ('item:' || e.pack_entry_id), false) desc, (p.kind = 'homebrew') desc,
      cp.priority desc, cp.pack_id::text
    limit 1
  ), '');
$$;
revoke execute on function private.stock_price_for(uuid, text) from public, anon;
grant execute on function private.stock_price_for(uuid, text) to authenticated, service_role;

-- 3. Ask for… answered at once, only at a shop offered here, at the server's price --------------------------------------

-- builds on: public.ask_for_thing from 20261125180000_dec16_tc12_ask_answered_at_once.sql
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
  -- The price said is the entry's, never the device's.
  if decided = 'in' then
    price := private.stock_price_for(campaign, item);
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
