-- M4 step 3: what an inventory line keeps of its item (docs/04-data-model.md; docs/09-decisions-log.md, 2026-10-23).
-- Adds columns and a trigger; drops nothing.
-- item_data: everything a player may see of the item (slot, hands, armour type, weapon tags, material, container,
-- charges, notes, properties, source…), for equip warnings, the load and tap-for-detail. For an item from the
-- setting rules the database fills it in (with the name, category, weight, slots and stack) from the entry itself,
-- never from the device: entries hold only what players may see (hidden fields live in library_entry_secrets).
-- source_pack_id and source_entry_id point back to where it came from, with no foreign key, for looking details up
-- or a later "refresh from setting rules".

alter table public.inventory_lines
  add column item_data jsonb not null default '{}'::jsonb check (jsonb_typeof(item_data) = 'object'),
  add column source_pack_id uuid,
  add column source_entry_id text check (char_length(source_entry_id) <= 200);

create function private.copy_item_details() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.library_entries;
  whole_number constant text := '^[0-9]+$';
begin
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
create trigger copy_item_details before insert or update on public.inventory_lines
  for each row execute function private.copy_item_details();
