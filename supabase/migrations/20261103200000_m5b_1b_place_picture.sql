-- M5b step 1 follow-up, build order 7 (docs/plans/m5b-1-travel.md; ruled 2026-11-03, m5b-1 ⚑ 2: the location view's
-- picture is a campaign homebrew image uploaded from the GM's device; Drive images come in M8b). A place's picture is
-- an asset of the new kind 'place' (not 'map': What we know lists revealed maps, and a place's picture isn't one),
-- kept in the campaign-files bucket like every other campaign file, linked by places.image_asset_id (20261103110000).
--   1. assets.kind gains 'place'.
--   2. Hidden means hidden (hard rule 5): the GM reads every place picture; a player reads one only while the place
--      is shown to their group, the same test public.scene_pieces makes (the group's current place, on the
--      expedition under way, with at least one piece shown on this visit). A player of another group, a player
--      before anything is shown, and anyone outside the campaign read nothing: not the asset row, not the file.
--   3. public.scene_pictures(campaign): for each of the reader's groups shown its place, the picture's asset id (the
--      device asks the bucket for a link; the bucket asks private.can_read_file, which now knows place pictures).
--   4. A place's picture must be a 'place' asset of the place's own campaign (a trigger).
-- Replaces private.can_read_file (newest definition: 20261019120000_m1_core_tables.sql) and the policy
-- "assets: read by visibility" (same file; dropped and made again at once, with the place rule added), and the check
-- constraint on assets.kind (dropped and added again with 'place'). Adds two functions, one trigger function and
-- its trigger, and two logged_commands rows. Drops no data; no rows are removed, renamed or changed.

-- 1. The new kind ----------------------------------------------------------------------------------------------------

alter table public.assets drop constraint assets_kind_check;
alter table public.assets add constraint assets_kind_check check (kind in ('portrait', 'sigil', 'handout', 'map', 'place'));

-- 2. Who reads a place's picture ---------------------------------------------------------------------------------------

-- Is this asset the picture of a place one of the reader's groups is at now, with a piece shown to it on this visit?
create function private.place_picture_shown_to_me(asset uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.places p
    join public.party_groups g on g.campaign_id = p.campaign_id
    cross join lateral private.current_group_place(g.campaign_id, g.number) gp
    where p.image_asset_id = asset and not p.undone and gp.place_id = p.id
      and private.in_my_group(p.campaign_id, g.number)
      and exists (
        select 1 from public.piece_shows s
        join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
        where s.group_place_id = gp.id and s.shown and not s.undone
      )
  );
$$;
revoke execute on function private.place_picture_shown_to_me(uuid) from public, anon;
grant execute on function private.place_picture_shown_to_me(uuid) to authenticated, service_role;

-- As in 20261019120000_m1_core_tables.sql, plus: a place's picture while the place is shown to the reader's group.
create or replace function private.can_read_file(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assets a
    where a.storage_path = path
      and (
        private.is_gm(a.campaign_id)
        or (
          private.is_member(a.campaign_id)
          and (
            (a.kind <> 'place' and (a.visibility = 'all' or (a.visibility = 'users' and (select auth.uid()) = any (a.visible_to))))
            or (a.kind = 'place' and private.place_picture_shown_to_me(a.id))
          )
        )
      )
  );
$$;

drop policy "assets: read by visibility" on public.assets;
create policy "assets: read by visibility" on public.assets
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and (
        (kind <> 'place' and (visibility = 'all' or (visibility = 'users' and (select auth.uid()) = any (visible_to))))
        or (kind = 'place' and private.place_picture_shown_to_me(id))
      )
    )
  );

-- 3. What a player's screen asks for ----------------------------------------------------------------------------------

-- For each of the reader's groups: its current place's picture, when the place has one and a piece is shown to the
-- group on this visit. Nothing else about the place. The GM reads none here (the GM has the place cards).
create function public.scene_pictures(campaign uuid) returns table (group_number integer, asset_id uuid)
language sql stable security definer set search_path = '' as $$
  select gp.group_number, p.image_asset_id
  from public.party_groups g
  cross join lateral private.current_group_place(g.campaign_id, g.number) gp
  join public.places p on p.id = gp.place_id and not p.undone and p.image_asset_id is not null
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
    and exists (
      select 1 from public.piece_shows s
      join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
      where s.group_place_id = gp.id and s.shown and not s.undone
    )
  order by gp.group_number;
$$;
revoke execute on function public.scene_pictures(uuid) from public, anon;
grant execute on function public.scene_pictures(uuid) to authenticated, service_role;

-- 4. A place's picture is a place picture of its own campaign -------------------------------------------------------

create function private.check_place_picture() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.image_asset_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.image_asset_id is not distinct from old.image_asset_id then
    return new;
  end if;
  if not exists (
    select 1 from public.assets a
    where a.id = new.image_asset_id and a.kind = 'place' and a.campaign_id = new.campaign_id
  ) then
    raise exception 'That picture can''t be this place''s picture.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_place_picture() from public, anon, authenticated;

create trigger check_place_picture before insert or update of image_asset_id on public.places
  for each row execute function private.check_place_picture();

-- 5. The commands ----------------------------------------------------------------------------------------------------

-- place.addPicture uploads a picture (the asset row and its file); place.setPicture links it to the place, or takes
-- it off (Undo puts the one before back). Both the GM's, in the Verbose log like place.edit.
insert into public.logged_commands (name, level, gm_only) values
  ('place.addPicture', 'verbose', true),
  ('place.setPicture', 'verbose', true);
