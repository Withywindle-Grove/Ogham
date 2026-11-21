-- M5b step 3, part 2, fix forward on 20261103140000_m5b_3_secret_requests.sql (Francis's ruling of 2026-11-03 on the
-- plan's Departures item 12, relayed by the coordinator: What we know lists the places shown to the player's groups
-- across the whole campaign, the current expedition's open and the earlier ones' folded, until M8b's location
-- browser takes it over). public.known_places (applied to the test project) reads the expedition under way only and
-- stays as it is; this adds a sibling over every expedition, each row saying whether it is the current one.
-- Same hiding: only the reader's groups' shown pieces (private.in_my_group), a hidden piece drops out, nothing of an
-- undone visit, place, piece or expedition. The GM reads none here (the GM has the place cards).
-- Adds one function. Replaces nothing; drops nothing; no rows are removed, renamed or changed.

create function public.known_places_campaign(campaign uuid)
returns table (expedition_id uuid, current boolean, expedition_started bigint, visit_id uuid, group_number integer, place_id uuid, place_name text, visited_at timestamptz, piece_id uuid, kind text, body text)
language sql stable security definer set search_path = '' as $$
  select x.id, x.ended_at is null, x.started_at, gp.id, gp.group_number, p.id, p.name, gp.created_at, pc.id, pc.kind, pc.body
  from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id and not x.undone
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where gp.campaign_id = campaign and not gp.undone and private.in_my_group(campaign, gp.group_number)
  order by (x.ended_at is null) desc, x.created_at desc, gp.created_at, gp.id, s.shown_at, s.id;
$$;
revoke execute on function public.known_places_campaign(uuid) from public, anon;
grant execute on function public.known_places_campaign(uuid) to authenticated, service_role;
