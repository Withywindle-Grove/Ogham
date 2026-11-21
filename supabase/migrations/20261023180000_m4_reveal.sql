-- M4 step 5: revealing an item's hidden field to its holder (docs/05-features.md; 04 InventoryLine).
-- Adds a logged command; replaces one trigger function. Drops nothing.
-- The GM adds the field to what the line says about its item (item_data); nobody else may change item_data
-- once the line exists (players could otherwise write "revealed" fields in themselves).

insert into public.logged_commands (name, level, gm_only) values ('inventory.reveal', 'simple', true);

-- As in 20261023140000_m4_item_details.sql, plus: only the GM changes an existing line's item_data.
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
