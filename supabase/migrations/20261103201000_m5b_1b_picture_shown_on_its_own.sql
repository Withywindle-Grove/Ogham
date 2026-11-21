-- M5b step 1 follow-up, fix forward on 20261103200000_m5b_1b_place_picture.sql (applied to the test project).
-- Francis's ruling of 2026-11-03 on its ⚑ (B; 05: a place's picture only once sent or revealed): a place's picture
-- reaches players only when the GM shows the picture itself, with its own eye like a piece; showing a piece no
-- longer reveals it. The picture is now a piece of the new kind 'picture', so it is shown and hidden per visit with
-- the pieces' own rows (public.piece_shows, place.showPiece / place.hidePiece), Hide all hides it, a return visit
-- brings it back when it was shown at the end of the last visit (gp-5, public.back_at_place), and a group sees only
-- what is shown on its own visit. No second system.
--   1. place_pieces gains `asset_id` (the picture's file, an asset of kind 'place'); its kind check gains 'picture'.
--      A picture piece always has a place picture of its own campaign, and stays a picture (a trigger).
--   2. public.set_place_picture(place, asset) (place.setPicture, now an intent): retires the place's picture piece if
--      it has one (its undone flag, as Remove this piece does) and, with an asset, adds a new picture piece,
--      hidden. Undo takes the new one back and brings the old one back (place.setPicture joins undoable_makings).
--   3. The reading rule follows the picture's own show: private.place_picture_shown_to_me and public.scene_pictures
--      are replaced (newest definitions: 20261103200000) to ask whether a picture piece with this asset is shown on
--      the reader's group's current visit.
--   places.image_asset_id (20261103110000) is no longer read or written by the app; the column and its trigger stay
--   (nothing is dropped). Pictures linked through it on the test project before this migration aren't shown.
-- Adds one column, one trigger function and its trigger, one function and one undoable_makings row; replaces the
-- check constraint on place_pieces.kind (dropped and added again with 'picture') and two functions. Drops no data; no
-- rows are removed, renamed or changed.

-- 1. A picture is a piece ----------------------------------------------------------------------------------------------

alter table public.place_pieces add column asset_id uuid references public.assets (id) on delete set null;
alter table public.place_pieces drop constraint place_pieces_kind_check;
alter table public.place_pieces add constraint place_pieces_kind_check
  check (kind in ('description', 'exit', 'person', 'clue', 'treasure', 'hazard', 'other', 'picture'));
create index place_pieces_asset on public.place_pieces (asset_id) where asset_id is not null;

-- A picture piece has a place picture of its own campaign and stays a picture; any other piece has no file. (The
-- asset can't change after it's made: private.place_piece_rules allows only kind, body, version and undone to.)
create function private.picture_piece_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (old.kind = 'picture') is distinct from (new.kind = 'picture') then
    raise exception 'A picture stays a picture.';
  end if;
  if new.kind = 'picture' then
    if tg_op = 'INSERT' and not exists (
      select 1 from public.assets a where a.id = new.asset_id and a.kind = 'place' and a.campaign_id = new.campaign_id
    ) then
      raise exception 'That picture can''t be this place''s picture.' using errcode = '42501';
    end if;
  elsif new.asset_id is not null then
    raise exception 'Only a picture has a file.';
  end if;
  return new;
end;
$$;
revoke execute on function private.picture_piece_rules() from public, anon, authenticated;

create trigger picture_piece_rules before insert or update of kind, asset_id on public.place_pieces
  for each row execute function private.picture_piece_rules();

-- 2. Setting the picture ------------------------------------------------------------------------------------------------

-- place.setPicture: the place's picture becomes this asset (hidden until the GM shows it), or (asset null) the place
-- has none. The old picture piece is retired by its flag, never deleted. The GM. A repeat changes nothing. Security
-- invoker: the GM's rules.
create function public.set_place_picture(place uuid, asset uuid) returns public.place_pieces
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('place_pieces');
  piece public.place_pieces;
  campaign uuid;
begin
  if made is not null then
    select * into piece from public.place_pieces pc where pc.id = made;
    return piece;
  end if;
  select p.campaign_id into campaign from public.places p where p.id = set_place_picture.place and not p.undone;
  if campaign is null or not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  update public.place_pieces pc set undone = true
  where pc.place_id = set_place_picture.place and pc.kind = 'picture' and not pc.undone
    and pc.asset_id is distinct from set_place_picture.asset;
  if asset is null then
    return null;
  end if;
  select * into piece from public.place_pieces pc
  where pc.place_id = set_place_picture.place and pc.kind = 'picture' and not pc.undone and pc.asset_id = set_place_picture.asset;
  if piece.id is not null then
    return piece;
  end if;
  insert into public.place_pieces (campaign_id, place_id, kind, body, position, asset_id)
  values (
    campaign, set_place_picture.place, 'picture', 'A picture',
    coalesce((select min(pc.position) - 1 from public.place_pieces pc where pc.place_id = set_place_picture.place), 0),
    set_place_picture.asset
  )
  returning * into piece;
  return piece;
end;
$$;
revoke execute on function public.set_place_picture(uuid, uuid) from public, anon;
grant execute on function public.set_place_picture(uuid, uuid) to authenticated, service_role;

-- Undo of place.setPicture marks the picture piece it made undone (and puts back the one it retired).
insert into public.undoable_makings (name) values ('place.setPicture');

-- 3. Who reads a place's picture -----------------------------------------------------------------------------------------

-- As in 20261103200000_m5b_1b_place_picture.sql, but by the picture's own show: is a picture piece with this asset
-- shown on the current visit of one of the reader's groups?
create or replace function private.place_picture_shown_to_me(asset uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.place_pieces pc
    join public.party_groups g on g.campaign_id = pc.campaign_id
    cross join lateral private.current_group_place(g.campaign_id, g.number) gp
    join public.piece_shows s on s.group_place_id = gp.id and s.piece_id = pc.id and s.shown and not s.undone
    where pc.asset_id = asset and pc.kind = 'picture' and not pc.undone and gp.place_id = pc.place_id
      and private.in_my_group(pc.campaign_id, g.number)
  );
$$;

-- As in 20261103200000_m5b_1b_place_picture.sql, but by the picture's own show: for each of the reader's groups, the
-- picture shown to it on its current visit (the newest shown, should there be more than one).
create or replace function public.scene_pictures(campaign uuid) returns table (group_number integer, asset_id uuid)
language sql stable security definer set search_path = '' as $$
  select distinct on (gp.group_number) gp.group_number, pc.asset_id
  from public.party_groups g
  cross join lateral private.current_group_place(g.campaign_id, g.number) gp
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone and pc.kind = 'picture' and pc.asset_id is not null
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
  order by gp.group_number, s.shown_at desc, s.id desc;
$$;
