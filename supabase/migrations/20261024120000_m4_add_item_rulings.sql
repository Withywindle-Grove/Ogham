-- After the M4 gate run (rulings 2026-10-23; docs/05 "Add an item", 07 forSale/bundle/unitName). Adds two columns,
-- a trigger and logged commands; replaces the item-copy function. Drops nothing.
--   approval: a player's one-off waits for the GM ("pending") and counts for nothing until approved; only the GM
--             approves (inventory.approve) or declines (inventory.decline, the line goes).
--   how_got "given" (with an optional note) is the GM's alone; a player's choices are Bought or No cost.
--   per_units: how many units the line's weight is for (a bundle's), so units carry their share of it.
-- Note: a player splitting a stack of an approved one-off makes a new one-off line, which waits for the GM again.

alter table public.inventory_lines
  add column approval text not null default 'approved' check (approval in ('approved', 'pending')),
  add column per_units integer not null default 1 check (per_units >= 1);

create function private.guard_lines_from_players() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.how_got = 'given' then
      raise exception 'Only the GM gives items.' using errcode = '42501';
    end if;
    -- A one-off (from no setting rules) waits for the GM.
    if new.library_entry_id is null and new.source_pack_id is null then
      new.approval := 'pending';
    end if;
    return new;
  end if;
  if new.approval is distinct from old.approval or new.how_got is distinct from old.how_got then
    raise exception 'Only the GM approves items.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_lines_from_players before insert or update on public.inventory_lines
  for each row execute function private.guard_lines_from_players();

insert into public.logged_commands (name, level, gm_only) values
  ('inventory.approve', 'simple', true),
  ('inventory.decline', 'simple', true),
  ('inventory.showAll', 'simple', true);

-- As in 20261023180000_m4_reveal.sql, plus bundles.
create or replace function private.copy_item_details() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.library_entries;
  whole_number constant text := '^[0-9]+$';
begin
  -- Once made, only the GM changes what a line says about its item (revealing a hidden field to its holder).
  if tg_op = 'UPDATE' and new.item_data is distinct from old.item_data
    and new.library_entry_id is not distinct from old.library_entry_id
    and (select auth.uid()) is not null and not private.is_gm(new.campaign_id) then
    raise exception 'Only the GM can change what an item says about itself.' using errcode = '42501';
  end if;
  if new.library_entry_id is not null
    and (tg_op = 'INSERT' or new.library_entry_id is distinct from old.library_entry_id) then
    select e.* into entry from public.library_entries e where e.id = new.library_entry_id;
    if entry.id is not null then
      -- Only an item, and only from setting rules this campaign uses.
      if entry.kind <> 'item' or not exists (
        select 1 from public.campaign_packs cp where cp.campaign_id = new.campaign_id and cp.pack_id = entry.pack_id
      ) then
        raise exception 'That item isn''t in this campaign''s setting rules.';
      end if;
      new.item_data := entry.data;
      new.name := entry.name;
      new.category := left(coalesce(entry.data ->> 'category', ''), 60);
      new.weight_coin := case when entry.data ->> 'weightCoin' ~ whole_number then (entry.data ->> 'weightCoin')::integer end;
      new.slots := case when entry.data ->> 'slots' ~ whole_number then (entry.data ->> 'slots')::integer end;
      new.stack := case when entry.data ->> 'stack' ~ whole_number and (entry.data ->> 'stack')::integer >= 1 then (entry.data ->> 'stack')::integer else 1 end;
      -- A bundle ("Torches (6)") arrives as its units ("Torch"); its weight is for the whole bundle.
      if entry.data ->> 'bundle' ~ whole_number and (entry.data ->> 'bundle')::integer > 1 then
        new.per_units := (entry.data ->> 'bundle')::integer;
        new.name := coalesce(nullif(trim(entry.data ->> 'unitName'), ''), entry.name);
      end if;
      new.source_pack_id := entry.pack_id;
      new.source_entry_id := entry.pack_entry_id;
      return new;
    end if;
    -- The entry is gone (its setting rules were updated or deleted): the line keeps the copy it carries.
  end if;
  -- A one-off, or a copy carried over: never anything its own gmOnly list hides.
  new.item_data := private.visible_part(new.item_data);
  if new.library_entry_id is null and tg_op = 'INSERT' and new.source_pack_id is null then
    new.source_entry_id := null;
  end if;
  return new;
end;
$$;
