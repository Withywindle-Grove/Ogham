-- Pack review area 3, build order 12 (docs/plans/m5b-review-area-3.md; ruled 2026-11-04, eq-3,
-- docs/design/rulings/m5b-pack-review-area-3-2026-11-04.md): "Carrying treasure" under basic (armour) encumbrance.
-- Treasure in a character's load suggests the switch on; the GM switches it per character, logged with Undo, and the
-- speed follows. "Significant" stays the GM's judgement.
--   1. actors.carrying_treasure: null = follow the pack (the suggestion), true / false = the GM's word. Every member
--      who reads the character reads it (the actors' own read rule, unchanged); only the GM changes it: the owner
--      may edit their character, so a guard refuses a change to this column by anyone else (row-level security
--      lets the owner update the row; the guard is the column's rule).
--   2. The database's tier line ("<name> is now Move 30 ft", private.load_tier_words, M5 step 4) reads the switch:
--      the GM's word, else whether treasure is in the pack. Replaced from its newest definition
--      (20261029160000_m5_intents.sql; only the armour branch changes, where `carries` is read).
--   3. A flip refreshes the kept tier quietly (carrier_loads.tier, no second log line: the flip's own line says it),
--      so travel's speed and the next "is now" line read the switch at once.
--   4. The command's logged_commands row (the GM's, Simple).
-- Adds one column (nullable, no default change to any row), two trigger functions and their triggers, replaces one
-- function (same signature), and inserts one logged_commands row. Drops, renames and deletes nothing.

-- 1. The switch ------------------------------------------------------------------------------------------------------

alter table public.actors add column carrying_treasure boolean;

comment on column public.actors.carrying_treasure is 'Carrying treasure (eq-3, basic encumbrance): null follows the pack (treasure in the load suggests on); true or false is the GM''s word.';

create function private.guard_carrying_treasure() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.carrying_treasure is distinct from old.carrying_treasure and not private.is_gm(old.campaign_id) then
    raise exception 'Only the GM can switch Carrying treasure.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_carrying_treasure() from public, anon, authenticated;

create trigger guard_carrying_treasure before update of carrying_treasure on public.actors
  for each row execute function private.guard_carrying_treasure();

-- 2. The tier line reads the switch ------------------------------------------------------------------------------------

-- As in 20261029160000_m5_intents.sql, plus: in armour mode, the GM's switch (actors.carrying_treasure) decides
-- `carries` when it is set; null keeps the pack's answer (treasure in the load).
create or replace function private.load_tier_words(campaign uuid, actor uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  raw jsonb := private.campaign_encumbrance(campaign);
  enc_mode text;
  separate text[];
  adds boolean := raw ->> 'containers' = 'add';
  total numeric;
  added numeric := 0;
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

  if enc_mode = 'slot' and jsonb_typeof(slot) = 'object' then
    select coalesce(sum(coalesce(l.slots, 0) * ceil(l.qty / greatest(1, l.stack))), 0) into total from private.load_lines(actor, separate) l where l.counted;
    if adds then
      select coalesce(sum(coalesce(l.cap_slots, 0) * l.qty), 0) into added from private.load_lines(actor, separate) l where l.counted and l.is_container and l.fixed is null;
    end if;
    select max(t.max_value) into last_max from private.load_tiers(slot -> 'tiers', 'maxSlots') t;
    hard_max := last_max + added;
    over_words := case when jsonb_typeof(slot -> 'overMax') = 'string' then slot ->> 'overMax' else '' end;
    select t.label into tier_label from private.load_tiers(slot -> 'tiers', 'maxSlots') t
    where total <= t.max_value + added order by t.max_value, t.at limit 1;
    is_over := hard_max is not null and total > hard_max;
  elsif enc_mode = 'coin' and jsonb_typeof(coin) = 'object' then
    select exists (
      select 1 from private.load_lines(actor, separate) l
      where l.counted and l.weight is null and l.fixed is null
        and l.category in (select jsonb_array_elements_text(
          case when jsonb_typeof(coin -> 'miscGearCategories') = 'array' then coin -> 'miscGearCategories' else '[]'::jsonb end))
    ) into misc;
    select coalesce(sum(case when l.fixed is not null then l.fixed * l.qty
      else round(coalesce(l.weight, 0) * l.qty / greatest(1, l.per_units)) end), 0)
    into total from private.load_lines(actor, separate) l where l.counted;
    if misc then
      total := total + coalesce(private.whole_or_null(coin -> 'miscGearCoin'), 0);
    end if;
    if adds then
      select coalesce(sum(coalesce(l.cap_coin, 0) * l.qty), 0) into added from private.load_lines(actor, separate) l where l.counted and l.is_container and l.fixed is null;
    end if;
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
    from private.load_lines(actor, separate) l
    where l.counted and jsonb_typeof(raw -> 'treasureWeights') = 'object' and (raw -> 'treasureWeights') ? l.category;
    -- The GM's switch (eq-3): their word when set; null follows the pack.
    if actor is not null then
      select coalesce(a.carrying_treasure, carries) into carries from public.actors a where a.id = actor;
    end if;
    -- The heaviest armour worn, through the pack's map ("none" when nothing maps).
    select coalesce((
      select r.row_name from (
        select case when jsonb_typeof(armour -> 'armourTypes' -> l.armour_type) = 'string' then armour -> 'armourTypes' ->> l.armour_type else '' end as row_name
        from private.load_lines(actor, separate) l where l.equipped and l.armour_type is not null
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
    hard_max := private.whole_or_null(armour -> 'maxLoadCoin');
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

-- 3. A flip refreshes the kept tier quietly ---------------------------------------------------------------------------

create function private.refresh_load_tier_on_treasure() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.carrying_treasure is distinct from old.carrying_treasure then
    update public.carrier_loads c set tier = left(private.load_tier_words(new.campaign_id, new.id), 60) where c.actor_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function private.refresh_load_tier_on_treasure() from public, anon, authenticated;

create trigger refresh_load_tier_on_treasure after update of carrying_treasure on public.actors
  for each row execute function private.refresh_load_tier_on_treasure();

-- 4. The command ------------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('inventory.carryingTreasure', 'simple', true);
