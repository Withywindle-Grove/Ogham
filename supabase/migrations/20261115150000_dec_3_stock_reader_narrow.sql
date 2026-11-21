-- A pack shop's stock reader narrowed (dec-3, town row W9; the lead's ruling sh-1 (a), 2026-11-15).
-- Francis's yes (sh-3, Francis, 2026-11-15), asked: "Replace the players' stock read so that, at a shop from your pack,
-- a player sees only what you have marked in today; nothing new becomes readable." He answered: "Yes".
-- public.shop_stock_in (newest: 20261115110000_dec_3_w12_shop_stock.sql:294-326) computed, for any shop key, a default
-- over EVERY item for sale in the campaign, read from each item's own availability. A pack's shop (keyed
-- `place:<entry id>`) has its own list and its own availabilities, which that default never read. Until the reader
-- knows a shop's list (LATER, on Francis's yes: w12-1, w12-2), a `place:` key returns ONLY the things the GM has
-- stored as in for that day: no default is computed, and the device's `offered` list is ignored (the device is not
-- trusted, as W12's review settled). The other filters stay: an item for sale in the campaign (its winning version,
-- its whole entry read), for a member only.
-- Every other key (a setting's `buy` service) reads exactly as before.
-- Narrowing only: for a `place:` key the answer is a subset of what the old reader returned (a stored in still needs
-- the item for sale; a thing that was in only by default, or by the device's list, is dropped). Same arguments, return
-- type, security definer, search_path and grants as W12 set them (restated). Replaces one function; drops, renames and
-- deletes no data; no rows written.

create or replace function public.shop_stock_in(campaign uuid, service text, on_day integer, offered text[] default null)
returns table (item_id text)
language plpgsql stable security definer set search_path = '' as $$
declare
  -- A pack's shop: the GM's stored answers only, the device's list ignored.
  pack_shop boolean := starts_with(coalesce(shop_stock_in.service, ''), 'place:');
begin
  if coalesce(cardinality(offered), 0) > 2000 then
    raise exception 'That''s too many things at once.';
  end if;
  return query
  with winners as (
    select distinct on (e.pack_entry_id) e.pack_entry_id as item, e.data || coalesce(h.data, '{}'::jsonb) as whole
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    left join public.campaign_pack_secrets s on s.id = cp.id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'item'
    left join public.library_entry_secrets h on h.id = e.id
    where cp.campaign_id = shop_stock_in.campaign
      and (select private.is_member(shop_stock_in.campaign))
      and (pack_shop or shop_stock_in.offered is null or e.pack_entry_id = any (shop_stock_in.offered))
    order by e.pack_entry_id, coalesce(s.overrides ? ('item:' || e.pack_entry_id), false) desc, (p.kind = 'homebrew') desc,
      cp.priority desc, cp.pack_id::text
  )
  select w.item
  from winners w
  left join public.shop_stock r
    on r.campaign_id = shop_stock_in.campaign and r.service_id = shop_stock_in.service and r.day = shop_stock_in.on_day
      and not r.undone and r.item_id = w.item
  where private.for_sale(w.whole)
    and case
      when pack_shop then r.answer is not distinct from 'in'
      else coalesce(r.answer, private.stock_default(w.whole -> 'availability', null)) = 'in'
    end
  order by w.item;
end;
$$;
revoke execute on function public.shop_stock_in(uuid, text, integer, text[]) from public, anon;
grant execute on function public.shop_stock_in(uuid, text, integer, text[]) to authenticated, service_role;
