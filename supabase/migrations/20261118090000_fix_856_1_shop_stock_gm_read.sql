-- fix-856-1: players read a shop's stock only through its reader (found by the look-back review of #856).
-- Francis's ruling, 2026-11-18, asked: "Players read shop stock only through shop_stock_in?" He answered: "Yes".
-- The read rule "shop stock: the GM, and players a thing in stock" (20261115110000_dec_3_w12_shop_stock.sql:65-69)
-- let any campaign member read every live `in` row straight from public.shop_stock: the item ids of things not for
-- sale, and hidden shops' `place:<entry id>` keys. The filters (for sale, the winning version, a pack shop's own
-- list) live only in the definer reader public.shop_stock_in, which is unchanged and stays the players' way in.
-- Narrowing only: the GM reads exactly as before; a player now reads no row of the table. Nothing is dropped from
-- the data; only a read rule is replaced. The undo rule ("shop stock: an undo by the GM") is untouched.

drop policy "shop stock: the GM, and players a thing in stock" on public.shop_stock;

create policy "shop stock: the GM reads" on public.shop_stock
  for select to authenticated using (private.is_gm(campaign_id));
