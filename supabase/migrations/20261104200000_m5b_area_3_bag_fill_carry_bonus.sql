-- Area 3, build order 11 (eq-5, eq-6; ruled 2026-11-04, docs/design/rulings/m5b-pack-review-area-3-2026-11-04.md):
-- the database's tier line ("<name> is now <tier>") works the load out the same as the app's load bar again
-- (src/modules/inventory/encumbrance.ts):
-- - a container with `weightEmpty` and `weightFull` weighs by how full it is, and its contents never count (eq-5);
-- - an item's `carryBonus` raises its wearer's limit (the max and every tier) while worn or held (eq-6);
-- - an item marked `treasure: true` counts as treasure in armour mode (bq3-9, already in the app).
-- Adds private.load_lines_by_fill and replaces private.load_tier_words (same signature; newest definition was in
-- 20261029160000_m5_intents.sql). private.load_lines stays as it was, unused. Drops, renames and deletes nothing;
-- writes no rows.

-- A character's lines as the load sees them, with the bag-by-fill weight worked out in the mode's unit (`unit`:
-- 'coin' or 'slot'; anything else reads as coin). `scaled` is the bag's weight now (encumbrance.ts bagFill): with
-- no capacity, or equal weights, its full weight; else weightEmpty plus the share of the difference its contents'
-- plain weights (at any depth) fill of its capacity, rounded. `counted` is false inside a bag with a fixed weight
-- or a weight by fill, at any depth.
create function private.load_lines_by_fill(actor uuid, separate text[], unit text)
returns table (id uuid, category text, qty numeric, weight numeric, slots numeric, stack numeric, per_units numeric,
  equipped boolean, armour_type text, cap_coin numeric, cap_slots numeric, fixed numeric, scaled numeric,
  is_container boolean, counted boolean, carry_bonus numeric, treasure boolean)
language sql stable security definer set search_path = '' as $$
  with recursive lines as (
    select l.id, l.container_line_id as container, l.category, l.qty::numeric as qty, l.weight_coin::numeric as weight,
      l.slots::numeric as slots, l.stack::numeric as stack, l.per_units::numeric as per_units, l.equipped,
      case when jsonb_typeof(d.data -> 'armourType') = 'string' and d.data ->> 'armourType' <> 'chosen' then d.data ->> 'armourType' end as armour_type,
      private.whole_or_null(b.block -> 'capacityCoin') as cap_coin,
      private.whole_or_null(b.block -> 'capacitySlots') as cap_slots,
      private.whole_or_null(b.block -> 'fixedWeightCoin') as fixed,
      private.whole_or_null(b.block -> 'weightEmpty') as w_empty,
      private.whole_or_null(b.block -> 'weightFull') as w_full,
      case when private.whole_or_null(d.data -> 'carryBonus') > 0 then private.whole_or_null(d.data -> 'carryBonus') end as carry_bonus,
      coalesce(d.data -> 'treasure' = 'true'::jsonb, false) as treasure
    from public.inventory_lines l
    cross join lateral (select case when jsonb_typeof(l.item_data) = 'object' then l.item_data else '{}'::jsonb end as data) d
    cross join lateral (select
      (case when jsonb_typeof(d.data -> 'container') = 'object' then d.data -> 'container' else '{}'::jsonb end)
      || (case when d.data ? 'fixedWeightCoin' then jsonb_build_object('fixedWeightCoin', d.data -> 'fixedWeightCoin') else '{}'::jsonb end)
      || (case when d.data ? 'weightEmpty' then jsonb_build_object('weightEmpty', d.data -> 'weightEmpty') else '{}'::jsonb end)
      || (case when d.data ? 'weightFull' then jsonb_build_object('weightFull', d.data -> 'weightFull') else '{}'::jsonb end) as block) b
    where actor is not null and l.actor_id = actor and l.approval = 'approved'
      and not (case when cardinality(separate) > 0 then l.category = any (separate)
               else coalesce(jsonb_typeof(d.data -> 'animal') = 'object' or jsonb_typeof(d.data -> 'vehicle') = 'object', false) end)
  ), up as (
    select ln.id as line, ln.container as at, array[ln.id] as seen from lines ln where ln.container is not null
    union all
    select up.line, p.container, up.seen || p.id
    from up join lines p on p.id = up.at
    where p.container is not null and not (p.id = any (up.seen))
  ), bags as (
    select ln.*, (ln.w_empty is not null and ln.w_full is not null) as scales,
      case when unit = 'slot' then coalesce(ln.cap_slots, 0) else coalesce(ln.cap_coin, 0) end as cap,
      greatest(1, ln.qty) as bag_qty,
      (select coalesce(sum(case when unit = 'slot' then coalesce(c.slots, 0) * ceil(c.qty / greatest(1, c.stack))
          else round(coalesce(c.weight, 0) * c.qty / greatest(1, c.per_units)) end), 0)
        from up join lines c on c.id = up.line where up.at = ln.id and c.id <> ln.id) as contents
    from lines ln
  )
  select bg.id, bg.category, bg.qty, bg.weight, bg.slots, bg.stack, bg.per_units, bg.equipped, bg.armour_type,
    bg.cap_coin, bg.cap_slots, bg.fixed,
    case when not bg.scales then null
      when bg.cap <= 0 or bg.w_empty = bg.w_full then bg.bag_qty * bg.w_full
      else bg.bag_qty * bg.w_empty + round((bg.w_full - bg.w_empty) * least(bg.contents, bg.cap * bg.bag_qty) / bg.cap) end,
    coalesce(bg.cap_coin, bg.cap_slots, bg.fixed, bg.w_empty, bg.w_full) is not null,
    not exists (select 1 from up join lines p on p.id = up.at
      where up.line = bg.id and (p.fixed is not null or (p.w_empty is not null and p.w_full is not null))),
    bg.carry_bonus, bg.treasure
  from bags bg;
$$;
revoke execute on function private.load_lines_by_fill(uuid, text[], text) from public, anon, authenticated;

-- What the tier line says for a character's load now (packHelpers.ts tierWords over encumbrance.ts carriedLoad):
-- as in 20261029160000, with bags by fill, carry bonuses and `treasure: true` read as the app reads them.
create or replace function private.load_tier_words(campaign uuid, actor uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  raw jsonb := private.campaign_encumbrance(campaign);
  enc_mode text;
  separate text[];
  adds boolean := raw ->> 'containers' = 'add';
  total numeric;
  added numeric := 0;
  bonus numeric := 0;
  hard_max numeric;
  last_max numeric;
  tier_label text;
  is_over boolean;
  over_words text;
  coin jsonb := raw -> 'coin';
  slot jsonb := raw -> 'slot';
  armour jsonb := raw -> 'armour';
  misc boolean;
  worn text;
  carries boolean;
  movement text;
begin
  select case when c.settings -> 'encumbrance' ->> 'mode' in ('none', 'armour', 'coin', 'slot')
    then c.settings -> 'encumbrance' ->> 'mode' else 'none' end
  into enc_mode from public.campaigns c where c.id = campaign;
  if enc_mode is null or enc_mode = 'none' then
    return '';
  end if;
  select coalesce(array_agg(s.value #>> '{}'), '{}') into separate
  from jsonb_array_elements(case when jsonb_typeof(raw -> 'separateCategories') = 'array' then raw -> 'separateCategories' else '[]'::jsonb end) s
  where jsonb_typeof(s.value) = 'string';
  -- Worn or held items that raise the limit (eq-6), each once.
  select coalesce(sum(l.carry_bonus), 0) into bonus from private.load_lines_by_fill(actor, separate, enc_mode) l where l.equipped and l.carry_bonus is not null;

  if enc_mode = 'slot' and jsonb_typeof(slot) = 'object' then
    select coalesce(sum(coalesce(l.scaled, coalesce(l.slots, 0) * ceil(l.qty / greatest(1, l.stack)))), 0) into total
    from private.load_lines_by_fill(actor, separate, 'slot') l where l.counted;
    if adds then
      select coalesce(sum(coalesce(l.cap_slots, 0) * l.qty), 0) into added from private.load_lines_by_fill(actor, separate, 'slot') l
      where l.counted and l.is_container and l.fixed is null and l.scaled is null;
    end if;
    added := added + bonus;
    select max(t.max_value) into last_max from private.load_tiers(slot -> 'tiers', 'maxSlots') t;
    hard_max := last_max + added;
    over_words := case when jsonb_typeof(slot -> 'overMax') = 'string' then slot ->> 'overMax' else '' end;
    select t.label into tier_label from private.load_tiers(slot -> 'tiers', 'maxSlots') t
    where total <= t.max_value + added order by t.max_value, t.at limit 1;
    is_over := hard_max is not null and total > hard_max;
  elsif enc_mode = 'coin' and jsonb_typeof(coin) = 'object' then
    select exists (
      select 1 from private.load_lines_by_fill(actor, separate, 'coin') l
      where l.counted and l.weight is null and l.fixed is null and l.scaled is null
        and l.category in (select jsonb_array_elements_text(
          case when jsonb_typeof(coin -> 'miscGearCategories') = 'array' then coin -> 'miscGearCategories' else '[]'::jsonb end))
    ) into misc;
    select coalesce(sum(case when l.scaled is not null then l.scaled
      when l.fixed is not null then l.fixed * l.qty
      else round(coalesce(l.weight, 0) * l.qty / greatest(1, l.per_units)) end), 0)
    into total from private.load_lines_by_fill(actor, separate, 'coin') l where l.counted;
    if misc then
      total := total + coalesce(private.whole_or_null(coin -> 'miscGearCoin'), 0);
    end if;
    if adds then
      select coalesce(sum(coalesce(l.cap_coin, 0) * l.qty), 0) into added from private.load_lines_by_fill(actor, separate, 'coin') l
      where l.counted and l.is_container and l.fixed is null and l.scaled is null;
    end if;
    added := added + bonus;
    hard_max := private.whole_or_null(coin -> 'maxLoadCoin') + added;
    over_words := case when jsonb_typeof(coin -> 'overMax') = 'string' then coin ->> 'overMax' else '' end;
    select t.label into tier_label from private.load_tiers(coin -> 'tiers', 'max') t
    where total <= t.max_value + added order by t.max_value, t.at limit 1;
    is_over := case when hard_max is not null then total > hard_max
      else tier_label is null and exists (select 1 from private.load_tiers(coin -> 'tiers', 'max')) end;
  elsif enc_mode = 'armour' and jsonb_typeof(armour) = 'object' then
    select coalesce(sum(coalesce(l.weight, private.whole_or_null(raw -> 'treasureWeights' -> l.category), 0) * l.qty), 0),
      count(*) > 0
    into total, carries
    from private.load_lines_by_fill(actor, separate, 'coin') l
    where l.counted and (l.treasure or (jsonb_typeof(raw -> 'treasureWeights') = 'object' and (raw -> 'treasureWeights') ? l.category));
    -- The heaviest armour worn, through the pack's map ("none" when nothing maps).
    select coalesce((
      select r.row_name from (
        select case when jsonb_typeof(armour -> 'armourTypes' -> l.armour_type) = 'string' then armour -> 'armourTypes' ->> l.armour_type else '' end as row_name
        from private.load_lines_by_fill(actor, separate, 'coin') l where l.equipped and l.armour_type is not null
      ) r
      where r.row_name in ('light', 'heavy')
      order by array_position(array['none', 'light', 'heavy'], r.row_name) desc limit 1
    ), 'none') into worn;
    select case when carries then
        case when jsonb_typeof(m.value -> 'withTreasure') = 'string' then m.value ->> 'withTreasure' else '' end
      else case when jsonb_typeof(m.value -> 'withoutTreasure') = 'string' then m.value ->> 'withoutTreasure' else '' end end
    into movement
    from jsonb_array_elements(case when jsonb_typeof(armour -> 'movement') = 'array' then armour -> 'movement' else '[]'::jsonb end)
      with ordinality as m(value, at)
    where jsonb_typeof(m.value) = 'object'
      and (case when jsonb_typeof(m.value -> 'armour') = 'string' then m.value ->> 'armour' else '' end) = worn
    order by m.at limit 1;
    hard_max := private.whole_or_null(armour -> 'maxLoadCoin') + bonus;
    is_over := hard_max is not null and total > hard_max;
    if is_over then
      return 'Over the limit';
    end if;
    return case when coalesce(movement, '') <> '' then 'Move ' || movement else '' end;
  else
    return '';
  end if;

  if is_over then
    return coalesce(nullif(over_words, ''), 'Over the limit');
  end if;
  return coalesce(tier_label, '');
end;
$$;
revoke execute on function private.load_tier_words(uuid, uuid) from public, anon, authenticated;
