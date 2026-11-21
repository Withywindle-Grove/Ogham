-- M5b step g2b, fix forward (the first test run on the test project): "the place's most recent visit" (gp-5) is the
-- one that ended last, and a visit still under way hasn't ended: a group there now shows what the room shows. The
-- first copy (20261102320000_m5b_g2b_pieces_follow_up.sql) took the visit made last, so after a split the group
-- that left and came back got its own old visit's shows rather than what the party there had shown or hidden since.
-- Replaces public.back_at_place (newest copy: 20261102320000). Drops, renames and deletes nothing; writes no rows.

-- As in 20261102320000_m5b_g2b_pieces_follow_up.sql, but the earlier visit is picked by: still there (not moved on)
-- first, then the one left last (its updated_at, set when moved_on flipped), then the newest.
create or replace function public.back_at_place(visit uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  here public.group_places;
  last_visit public.group_places;
  shown integer;
begin
  select * into here from public.group_places gp where gp.id = visit;
  if here.id is null or not private.is_gm(here.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if here.place_id is null then
    return 0;
  end if;
  if here.undone or here.moved_on or (private.current_group_place(here.campaign_id, here.group_number)).id is distinct from here.id then
    raise exception 'That group has moved on from there.';
  end if;
  if exists (select 1 from public.piece_shows s where s.group_place_id = visit and not s.undone) then
    select count(*) into shown from public.piece_shows s where s.group_place_id = visit and s.shown and not s.undone;
    return shown;
  end if;
  select gp.* into last_visit from public.group_places gp
  where gp.campaign_id = here.campaign_id and gp.place_id = here.place_id and gp.id <> here.id and not gp.undone
    and (gp.created_at, gp.id) < (here.created_at, here.id)
  order by gp.moved_on, gp.updated_at desc, gp.created_at desc, gp.id desc
  limit 1;
  if last_visit.id is null then
    return 0;
  end if;
  insert into public.piece_shows (campaign_id, group_place_id, piece_id, group_number, shown, shown_at)
  select here.campaign_id, here.id, s.piece_id, here.group_number, true, s.shown_at
  from public.piece_shows s
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where s.group_place_id = last_visit.id and s.shown and not s.undone
  order by s.shown_at, s.id;
  get diagnostics shown = row_count;
  return shown;
end;
$$;
