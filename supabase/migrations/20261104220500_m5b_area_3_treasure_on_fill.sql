-- Area 3, build order 12, a fix forward to 20261104220000_m5b_area_3_carrying_treasure.sql (already applied to the
-- test project, so not edited). That migration replaced private.load_tier_words starting from 20261029160000, but
-- #435's 20261104200000_m5b_area_3_bag_fill_carry_bonus.sql (on the main database before it; its file on another
-- branch when 220000 was written) had already replaced the same function with bags by fill
-- (private.load_lines_by_fill), carry bonuses (eq-6) and armour-mode `treasure: true` (bq3-9). Applied after 220000,
-- 220000 would have dropped that logic. This file redefines private.load_tier_words from 200000's body (its newest
-- definition) plus 220000's one change: in armour mode, the GM's Carrying treasure switch (actors.carrying_treasure;
-- null follows the pack) decides whether treasure counts (eq-3). Same signature. Needs 200000 (load_lines_by_fill).
-- Drops, renames and deletes nothing; writes no rows.

-- As in 20261104200000, plus the switch read in the armour branch.
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
    -- The GM's switch (eq-3, 20261104220000): their word when set; null follows the pack.
    if actor is not null then
      select coalesce(a.carrying_treasure, carries) into carries from public.actors a where a.id = actor;
    end if;
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
