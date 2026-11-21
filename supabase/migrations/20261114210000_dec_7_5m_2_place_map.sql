-- A place's map (dec-7 piece 5m-2; docs/plans/dec-7-5-place-page-and-map.md; 07 Adventure packs §9; mc-32; mockup
-- december/11, frames 2c and 4d, approved by Francis 2026-11-13, pg-1). The pack names a map for a place (a library
-- entry of kind `map`, 5m-1); the GM picks the file once from their device and the app stores a smaller copy as the
-- campaign's own map asset (kind 'map', visibility 'gm': the GM's alone, by the assets' read rule as it stands). A
-- place the GM made by hand may take one the same way.
--   1. places.map_asset_id: the place's map, an asset of kind 'map' of the place's own campaign (a trigger); null: none
--      tied. Set by place.setMap as an ordinary logged change of the place (Undo puts the one before back, as for
--      place.edit; places is already in undoable_tables). The asset row and its file are made by place.addMap, as
--      place.addPicture makes a picture's: making a file isn't undone, nothing is deleted once it's in.
--   2. Two logged commands, the GM's, in the Verbose log like place.addPicture and place.setPicture.
-- Who reads what is unchanged: places is read by the GM alone ("places: the GM reads", 20261102100000), so the new
-- column reaches no player; the map asset is read by the GM, and by members only once its visibility is 'all' or
-- names them (20261103200000's rule, untouched; sharing is piece 5m-3). No policy, no definer read and no read
-- function is added or replaced; private.place_rules (newest: 20261106150000_m8b_0_places_settlement.sql) is not
-- replaced: the new column may change, as the description may.
-- Adds one column, one index, one trigger function and its trigger, and two logged_commands rows. Drops, renames and
-- deletes no data; no rows changed.

-- 1. The tie -----------------------------------------------------------------------------------------------------------

alter table public.places add column map_asset_id uuid references public.assets (id) on delete set null;

comment on column public.places.map_asset_id is
  'The place''s map (dec-7 5m-2): the campaign''s copy of a picture, an asset of kind map, the GM''s until shared. Null: none.';

create index places_map_asset on public.places (map_asset_id) where map_asset_id is not null;

-- A place's map is a map of its own campaign. Null (none, or Undo taking it off) always passes; an unchanged value too.
create function private.check_place_map() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.map_asset_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.map_asset_id is not distinct from old.map_asset_id then
    return new;
  end if;
  if not exists (
    select 1 from public.assets a
    where a.id = new.map_asset_id and a.kind = 'map' and a.campaign_id = new.campaign_id
  ) then
    raise exception 'That picture can''t be this place''s map.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_place_map() from public, anon, authenticated;

create trigger check_place_map before insert or update of map_asset_id on public.places
  for each row execute function private.check_place_map();

-- 2. The commands ------------------------------------------------------------------------------------------------------

-- place.addMap uploads the map's copy (the asset row and its file); place.setMap ties it to the place, or takes it off
-- (Undo puts the one before back). Both the GM's.
insert into public.logged_commands (name, level, gm_only) values
  ('place.addMap', 'verbose', true),
  ('place.setMap', 'verbose', true);
