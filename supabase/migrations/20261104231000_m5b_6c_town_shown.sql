-- The town is shown before its places (fresh-session security review of 2026-11-04, finding 2; ruled B by Francis
-- through Design, 2026-11-04; docs/05 Town, docs/09).
--   public.scene_town (20261104170000_m5b_6c_town_screen.sql) gave a player the town's name and its shown entries as
--   soon as one entry was shown, even when the place itself hadn't been shown to that group (no piece of it shown on
--   the visit: the rule the place line, the pictures and the known places follow since M5b g2). Now the town's name
--   and entries reach players only once the place is shown: a piece of it shown on the group's visit.
--   The app shows the town in the same tap as the first entry (the description piece, one request: one log line,
--   one Undo), so town.showPlace joins public.undoable_makings (the made piece_shows row is marked undone by Undo).
-- Replaces one function (public.scene_town, newest in 20261104170000). Adds one undoable_makings row. Drops,
-- renames and deletes no data.

create or replace function public.scene_town(campaign uuid)
returns table (group_number integer, place_name text, entry_key text, name text, kind text, open boolean)
language sql stable security definer set search_path = '' as $$
  select v.group_number, p.name, e.key, e.value ->> 'name', coalesce(e.value ->> 'kind', ''), (e.value ->> 'open')::boolean
  from public.party_groups g
  cross join lateral private.town_visit(g.campaign_id, g.number) v
  join public.places p on p.id = v.place_id and not p.undone and p.safety is not null
  cross join lateral jsonb_each(p.town) e
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
    and (e.value ->> 'shown') = 'true'
    -- The place itself is shown to this group: a piece of it shown on the visit.
    and exists (
      select 1 from public.piece_shows s
      join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
      where s.group_place_id = v.id and s.shown and not s.undone
    )
  order by v.group_number, lower(e.value ->> 'name'), e.key;
$$;

insert into public.undoable_makings (name) values ('town.showPlace') on conflict do nothing;
