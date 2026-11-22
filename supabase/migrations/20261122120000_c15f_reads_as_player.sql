-- The GM's view as the player reads the players' Scene as that player (row C15f of
-- docs/plans/test-feedback-2026-11-19.md; page 32, M3i; pg32-5; Francis's ruling a2, 2026-11-22).
--
-- The players' reads of the Scene answer for the reader's own characters' groups (private.in_my_group). In the GM's
-- view of Sam's Scene the reader is the GM, so they answered for the GM's own character's group, never Sam's. Each read
-- now has a second form that names whose reading it is, `as_player`:
--   * one gate, private.group_read_as: with nobody named, the reader's own groups, exactly as before; with a player
--     named, only when the caller is the campaign's GM AND that player (a member) has an approved, active character of
--     their own in the group. A player naming anyone reads nothing; another campaign's GM reads nothing;
--   * each two-argument form is its one-argument form's newest body with private.in_my_group swapped for the gate
--     (the "-- builds on:" lines name each body's file); the one-argument forms stay, now one line calling the new form
--     with nobody named, so there is one body for each read;
--   * nothing is dropped, renamed or deleted; no player can read anything new.
-- public.campaign_ways_on is unchanged: it already answers the GM for every group, as a player reads it.
-- public.party_moves is unchanged: only the log reads it, and the log in the view is the GM's own (listed for Francis).

-- 1. The gate --------------------------------------------------------------------------------------------------------
-- builds on: private.in_my_group from 20261031180000_m5_places_review.sql
create function private.group_read_as(campaign uuid, group_no integer, as_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when as_player is null then private.in_my_group(campaign, group_no)
    else private.is_gm(campaign)
      and exists (select 1 from public.members mb where mb.campaign_id = campaign and mb.user_id = as_player)
      and exists (
        select 1 from public.party_group_members m join public.actors a on a.id = m.actor_id
        where m.campaign_id = campaign and m.group_number = group_no
          and a.owner_type = 'user' and a.owner_user_id = as_player
          and a.approval = 'approved' and a.status = 'active'
      )
  end;
$$;
revoke execute on function private.group_read_as(uuid, integer, uuid) from public, anon, authenticated;

-- 2. The reads, each with its "as this player" form ------------------------------------------------------------------

-- builds on: public.scene_pieces from 20261113200000_players_never_get_link_ids.sql
create function public.scene_pieces(campaign uuid, as_player uuid) returns table (group_number integer, place_name text, piece_id uuid, kind text, body text, lead text)
language sql stable security definer set search_path = '' as $$
  select gp.group_number, coalesce(nullif(p.players_name, ''), p.name), pc.id, pc.kind, private.plain_link_text(pc.body), private.plain_link_text(pc.lead)
  from public.party_groups g
  cross join lateral private.current_group_place(g.campaign_id, g.number) gp
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where g.campaign_id = campaign and private.group_read_as(campaign, g.number, as_player)
  order by gp.group_number, s.shown_at, s.id;
$$;
revoke execute on function public.scene_pieces(uuid, uuid) from public, anon;
grant execute on function public.scene_pieces(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.scene_pieces(campaign uuid) returns table (group_number integer, place_name text, piece_id uuid, kind text, body text, lead text)
language sql stable security definer set search_path = '' as $$
  select * from public.scene_pieces(campaign, null::uuid);
$$;

-- builds on: public.known_places_campaign from 20261113200000_players_never_get_link_ids.sql
create function public.known_places_campaign(campaign uuid, as_player uuid)
returns table (expedition_id uuid, current boolean, expedition_started bigint, visit_id uuid, group_number integer, place_id uuid, place_name text, visited_at timestamptz, piece_id uuid, kind text, body text, lead text)
language sql stable security definer set search_path = '' as $$
  select x.id, x.ended_at is null, x.started_at, gp.id, gp.group_number, p.id, coalesce(nullif(p.players_name, ''), p.name), gp.created_at, pc.id, pc.kind, private.plain_link_text(pc.body), private.plain_link_text(pc.lead)
  from public.group_places gp
  join public.expeditions x on x.id = gp.expedition_id and not x.undone
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
  where gp.campaign_id = campaign and not gp.undone and private.group_read_as(campaign, gp.group_number, as_player)
  order by (x.ended_at is null) desc, x.created_at desc, gp.created_at, gp.id, s.shown_at, s.id;
$$;
revoke execute on function public.known_places_campaign(uuid, uuid) from public, anon;
grant execute on function public.known_places_campaign(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.known_places_campaign(campaign uuid)
returns table (expedition_id uuid, current boolean, expedition_started bigint, visit_id uuid, group_number integer, place_id uuid, place_name text, visited_at timestamptz, piece_id uuid, kind text, body text, lead text)
language sql stable security definer set search_path = '' as $$
  select * from public.known_places_campaign(campaign, null::uuid);
$$;

-- builds on: public.scene_pictures from 20261103201000_m5b_1b_picture_shown_on_its_own.sql
create function public.scene_pictures(campaign uuid, as_player uuid) returns table (group_number integer, asset_id uuid)
language sql stable security definer set search_path = '' as $$
  select distinct on (gp.group_number) gp.group_number, pc.asset_id
  from public.party_groups g
  cross join lateral private.current_group_place(g.campaign_id, g.number) gp
  join public.places p on p.id = gp.place_id and not p.undone
  join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone and pc.kind = 'picture' and pc.asset_id is not null
  where g.campaign_id = campaign and private.group_read_as(campaign, g.number, as_player)
  order by gp.group_number, s.shown_at desc, s.id desc;
$$;
revoke execute on function public.scene_pictures(uuid, uuid) from public, anon;
grant execute on function public.scene_pictures(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.scene_pictures(campaign uuid) returns table (group_number integer, asset_id uuid)
language sql stable security definer set search_path = '' as $$
  select * from public.scene_pictures(campaign, null::uuid);
$$;

-- builds on: public.place_card_for_players from 20261121230000_p4_players_place_card.sql
create function public.place_card_for_players(campaign uuid, as_player uuid)
returns table (group_number integer, kind text, at integer, place_id uuid, key text, name text, line text)
language sql stable security definer set search_path = '' as $$
  with here as (
    select g.number as group_number, gp.id as visit, p.id as place_id, p.pack_id, p.pack_entry_id, coalesce(p.pack_parent_id, '') as parent,
      coalesce(p.pack_key, '') as key, coalesce(nullif(p.players_name, ''), p.name) as name
    from public.party_groups g
    cross join lateral private.current_group_place(g.campaign_id, g.number) gp
    join public.places p on p.id = gp.place_id and not p.undone
    where g.campaign_id = campaign and private.group_read_as(campaign, g.number, as_player)
      and private.visit_shown(gp.id)
      -- A place of a pack no longer attached to the campaign sends nothing, as knowledge_for_players (local review of the
      -- P4 fixes, 1): since ppf-1 its Area's and Region's names come from the pack's entries.
      and (p.pack_id is null or exists (select 1 from public.campaign_packs cp where cp.campaign_id = g.campaign_id and cp.pack_id = p.pack_id))
  ),
  trail as (
    select h.group_number, c.depth, private.known_entry_name(campaign, h.group_number, h.pack_id, (c.entry).pack_entry_id) as name
    from here h
    cross join lateral private.place_chain(h.pack_id, h.pack_entry_id) c
    where h.pack_id is not null and c.depth > 0
  ),
  known as (
    select h.group_number, q.id as place_id, coalesce(q.pack_key, '') as key, coalesce(nullif(q.players_name, ''), q.name) as name,
      -- The first piece the group was shown there, on any visit of an expedition not undone, as known_places_campaign
      -- sends its pieces (ppf-4); never a picture, never one not shown.
      (select private.plain_link_text(pc.body)
       from public.group_places v
       join public.expeditions x on x.id = v.expedition_id and not x.undone
       join public.piece_shows s on s.group_place_id = v.id and s.shown and not s.undone
       join public.place_pieces pc on pc.id = s.piece_id and not pc.undone and pc.kind <> 'picture' and btrim(coalesce(pc.body, '')) <> ''
       where v.place_id = q.id and v.campaign_id = campaign and v.group_number = h.group_number and not v.undone
       order by s.shown_at, s.id
       limit 1) as line
    from here h
    join public.places q on q.campaign_id = campaign and not q.undone and q.pack_id = h.pack_id
      and coalesce(q.pack_parent_id, '') = h.parent and q.id <> h.place_id and q.pack_entry_id is distinct from h.pack_entry_id
    where h.pack_id is not null and h.parent <> ''
      and exists (
        select 1 from public.group_places v
        join public.expeditions x on x.id = v.expedition_id and not x.undone
        where v.place_id = q.id and v.campaign_id = campaign and v.group_number = h.group_number and not v.undone
          and private.visit_shown(v.id)
      )
  )
  select h.group_number, 'here', 0, h.place_id, h.key, h.name, null::text from here h
  union all
  select t.group_number, 'trail', (row_number() over (partition by t.group_number order by t.depth desc))::integer, null::uuid, null::text, t.name, null::text
  from trail t where t.name is not null
  union all
  select t.group_number, 'area', 0, null::uuid, null::text, t.name, null::text
  from trail t where t.depth = 1 and t.name is not null
  union all
  select k.group_number, 'known', (row_number() over (partition by k.group_number order by length(k.key), k.key, k.name, k.place_id))::integer, k.place_id, k.key, k.name, coalesce(k.line, '')
  from known k
  order by 1, 2, 3;
$$;
revoke execute on function public.place_card_for_players(uuid, uuid) from public, anon;
grant execute on function public.place_card_for_players(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.place_card_for_players(campaign uuid)
returns table (group_number integer, kind text, at integer, place_id uuid, key text, name text, line text)
language sql stable security definer set search_path = '' as $$
  select * from public.place_card_for_players(campaign, null::uuid);
$$;

-- builds on: public.knowledge_for_players from 20261121230000_p4_players_place_card.sql
create function public.knowledge_for_players(campaign uuid, as_player uuid)
returns table (group_number integer, share_id uuid, place_name text, heading text, body jsonb, shared_clock bigint)
language sql stable security definer set search_path = '' as $$
  with here as (
    select g.number as group_number, p.pack_id, p.pack_entry_id, coalesce(p.pack_parent_id, '') as parent,
      coalesce(nullif(p.players_name, ''), p.name) as name
    from public.party_groups g
    cross join lateral private.current_group_place(g.campaign_id, g.number) gp
    join public.places p on p.id = gp.place_id and not p.undone and p.pack_id is not null
    -- A pack no longer attached to the campaign sends nothing, as place_rules_for_players (review of P4).
    join public.campaign_packs cp on cp.campaign_id = g.campaign_id and cp.pack_id = p.pack_id
    where g.campaign_id = campaign and private.group_read_as(campaign, g.number, as_player)
      and private.visit_shown(gp.id)
  )
  select h.group_number, s.id,
    case when s.entry_id = h.pack_entry_id then h.name
      else coalesce(private.known_entry_name(campaign, h.group_number, s.pack_id, s.entry_id), h.name) end,
    private.plain_link_text(s.heading), private.plain_link_marks(s.body), s.shared_clock
  from here h
  join public.knowledge_shares s on s.campaign_id = campaign and s.group_number = h.group_number and s.pack_id = h.pack_id
    and s.shared and not s.undone
  where s.entry_id in (select (c.entry).pack_entry_id from private.place_chain(h.pack_id, h.pack_entry_id) c)
    or (h.parent <> '' and exists (
      select 1 from public.library_entries e
      where e.pack_id = s.pack_id and e.kind = 'location' and e.pack_entry_id = s.entry_id and (e.data ->> 'parentId') = h.parent
    ))
  order by h.group_number, s.shared_clock, s.updated_at, s.id;
$$;
revoke execute on function public.knowledge_for_players(uuid, uuid) from public, anon;
grant execute on function public.knowledge_for_players(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.knowledge_for_players(campaign uuid)
returns table (group_number integer, share_id uuid, place_name text, heading text, body jsonb, shared_clock bigint)
language sql stable security definer set search_path = '' as $$
  select * from public.knowledge_for_players(campaign, null::uuid);
$$;

-- builds on: public.place_rules_for_players from 20261113120000_dec_7_3_place_check_and_rules.sql
create function public.place_rules_for_players(campaign uuid, as_player uuid)
returns table (group_number integer, place_name text, name text, body jsonb, button text)
language sql stable security definer set search_path = '' as $$
  select gp.group_number,
    case when c.depth = 0 then coalesce(nullif(p.players_name, ''), p.name)
      else private.shown_place_name(g.campaign_id, gp.group_number, p.pack_id, (c.entry).pack_entry_id, coalesce(nullif(p.players_name, ''), p.name)) end,
    private.plain_link_text(r.value ->> 'name'), private.plain_link_marks(r.value -> 'text'), private.plain_link_text(coalesce(r.value ->> 'button', ''))
  from public.party_groups g
  cross join lateral private.current_group_place(g.campaign_id, g.number) gp
  join public.places p on p.id = gp.place_id and not p.undone and p.pack_id is not null
  join public.campaign_packs cp on cp.campaign_id = g.campaign_id and cp.pack_id = p.pack_id
  cross join lateral private.place_chain(p.pack_id, p.pack_entry_id) c
  cross join lateral jsonb_array_elements(case when jsonb_typeof((c.entry).data -> 'rules') = 'array' then (c.entry).data -> 'rules' else '[]'::jsonb end) with ordinality r(value, at)
  where g.campaign_id = campaign and private.group_read_as(campaign, g.number, as_player)
    and private.visit_shown(gp.id)
    and jsonb_typeof(r.value) = 'object'
    and coalesce(r.value ->> 'id', '') <> '' and coalesce(r.value ->> 'name', '') <> ''
    -- Never a rule the pack keeps for the GM, whatever a switch says (Francis's approved words); else open unless closed.
    and (r.value -> 'gmOnly') is distinct from 'true'::jsonb
    and coalesce(
      (select s.value from public.place_rule_switches s
       where s.campaign_id = g.campaign_id and s.pack_id = p.pack_id and s.entry_id = (c.entry).pack_entry_id
         and s.rule_id = r.value ->> 'id' and s.which = 'eye' and not s.undone),
      true
    )
  order by gp.group_number, c.depth, r.at;
$$;
revoke execute on function public.place_rules_for_players(uuid, uuid) from public, anon;
grant execute on function public.place_rules_for_players(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.place_rules_for_players(campaign uuid)
returns table (group_number integer, place_name text, name text, body jsonb, button text)
language sql stable security definer set search_path = '' as $$
  select * from public.place_rules_for_players(campaign, null::uuid);
$$;

-- builds on: public.encounter_check_for_players from 20261113120000_dec_7_3_place_check_and_rules.sql
create function public.encounter_check_for_players(campaign uuid, as_player uuid)
returns table (group_number integer, place_name text, checked jsonb)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select g.number from public.party_groups g
    where g.campaign_id = campaign and private.group_read_as(campaign, g.number, as_player)
  ),
  -- Each group's last place shown to it, in the expedition under way (mc-39b).
  last_shown as (
    select distinct on (gp.group_number) gp.group_number, p.pack_id, p.pack_entry_id, coalesce(nullif(p.players_name, ''), p.name) as shown_name
    from public.group_places gp
    join mine on mine.number = gp.group_number
    join public.expeditions x on x.id = gp.expedition_id and x.ended_at is null and not x.undone
    join public.places p on p.id = gp.place_id and not p.undone
    where gp.campaign_id = campaign and not gp.undone and private.visit_shown(gp.id)
    order by gp.group_number, gp.created_at desc, gp.id desc
  ),
  -- The nearest place in its chain with an encounter check decides (07: a child's own check wins).
  deciding as (
    select distinct on (l.group_number) l.group_number, l.pack_id, l.shown_name, c.depth, c.entry
    from last_shown l
    cross join lateral private.place_chain(l.pack_id, l.pack_entry_id) c
    where l.pack_id is not null and jsonb_typeof((c.entry).data -> 'encounterCheck') = 'object'
    order by l.group_number, c.depth
  )
  select d.group_number,
    case when d.depth = 0 then d.shown_name else private.shown_place_name(campaign, d.group_number, d.pack_id, (d.entry).pack_entry_id, d.shown_name) end,
    jsonb_strip_nulls(jsonb_build_object(
      'when', (d.entry).data #> '{encounterCheck,when}',
      'every', (d.entry).data #> '{encounterCheck,every}',
      'chance', (d.entry).data #> '{encounterCheck,chance}'))
  from deciding d
  where exists (select 1 from public.campaign_packs cp where cp.campaign_id = campaign and cp.pack_id = d.pack_id)
    and ((d.entry).data #> '{encounterCheck,replacesScheduled}') = 'true'::jsonb
    and coalesce(
      (select s.value from public.place_rule_switches s
       where s.campaign_id = campaign and s.pack_id = d.pack_id and s.entry_id = (d.entry).pack_entry_id
         and s.rule_id = 'encounterCheck' and s.which = 'inForce' and not s.undone),
      true)
  order by d.group_number;
$$;
revoke execute on function public.encounter_check_for_players(uuid, uuid) from public, anon;
grant execute on function public.encounter_check_for_players(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.encounter_check_for_players(campaign uuid)
returns table (group_number integer, place_name text, checked jsonb)
language sql stable security definer set search_path = '' as $$
  select * from public.encounter_check_for_players(campaign, null::uuid);
$$;

-- builds on: public.scene_town from 20261115004000_place_players_name.sql
create function public.scene_town(campaign uuid, as_player uuid)
returns table (group_number integer, place_name text, entry_key text, name text, kind text, open boolean)
language sql stable security definer set search_path = '' as $$
  select v.group_number, coalesce(nullif(p.players_name, ''), p.name), e.key, e.value ->> 'name', coalesce(e.value ->> 'kind', ''), (e.value ->> 'open')::boolean
  from public.party_groups g
  cross join lateral private.town_visit(g.campaign_id, g.number) v
  join public.places p on p.id = v.place_id and not p.undone and (p.safety is not null or p.settlement is not null)
  cross join lateral jsonb_each(p.town) e
  where g.campaign_id = campaign and private.group_read_as(campaign, g.number, as_player)
    and (e.value ->> 'shown') = 'true'
    -- The place itself is shown to this group: a piece of it shown on the visit.
    and exists (
      select 1 from public.piece_shows s
      join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
      where s.group_place_id = v.id and s.shown and not s.undone
    )
  order by v.group_number, lower(e.value ->> 'name'), e.key;
$$;
revoke execute on function public.scene_town(uuid, uuid) from public, anon;
grant execute on function public.scene_town(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.scene_town(campaign uuid)
returns table (group_number integer, place_name text, entry_key text, name text, kind text, open boolean)
language sql stable security definer set search_path = '' as $$
  select * from public.scene_town(campaign, null::uuid);
$$;

-- builds on: private.town_parts_for from 20261115130000_dec_3_w4b_w4c_place_in_town.sql
create function private.town_parts_for(campaign uuid, as_player uuid)
returns table (group_number integer, entry_key text, place_name text, piece_id uuid, kind text, body text, lead text, asset_id uuid, shown_at timestamptz, show_id uuid)
language sql stable security definer set search_path = '' as $$
  select v.group_number, 'place:' || p.pack_entry_id, coalesce(nullif(p.players_name, ''), p.name), pc.id, pc.kind, pc.body, pc.lead, pc.asset_id, s.shown_at, s.id
  from public.party_groups g
  cross join lateral private.town_visit(g.campaign_id, g.number) v
  join public.places t on t.id = v.place_id
  join public.town_piece_shows s on s.group_place_id = v.id and s.shown and not s.undone
  join public.place_pieces pc on pc.id = s.piece_id and not pc.undone and pc.kind <> 'person'
  join public.places p on p.id = pc.place_id
  where g.campaign_id = campaign and private.group_read_as(campaign, g.number, as_player)
    and private.town_part_of(p.id, v.id)
    and private.town_shown_now(s)
    and (t.town -> ('place:' || p.pack_entry_id) ->> 'shown') = 'true'
    and private.visit_shown(v.id);
$$;
revoke execute on function private.town_parts_for(uuid, uuid) from public, anon, authenticated;

-- builds on: private.town_pictures_for from 20261115130000_dec_3_w4b_w4c_place_in_town.sql
create function private.town_pictures_for(campaign uuid, as_player uuid)
returns table (group_number integer, entry_key text, asset_id uuid)
language sql stable security definer set search_path = '' as $$
  select distinct on (t.group_number, t.entry_key) t.group_number, t.entry_key, t.asset_id
  from private.town_parts_for(campaign, as_player) t
  where t.kind = 'picture' and t.asset_id is not null
  order by t.group_number, t.entry_key, t.shown_at desc, t.show_id desc;
$$;
revoke execute on function private.town_pictures_for(uuid, uuid) from public, anon, authenticated;

-- builds on: public.scene_town_pieces from 20261115130000_dec_3_w4b_w4c_place_in_town.sql
create function public.scene_town_pieces(campaign uuid, as_player uuid)
returns table (group_number integer, place_name text, piece_id uuid, kind text, body text, lead text, entry_key text)
language sql stable security definer set search_path = '' as $$
  select t.group_number, t.place_name, t.piece_id, t.kind, private.plain_link_text(t.body), private.plain_link_text(t.lead), t.entry_key
  from private.town_parts_for(campaign, as_player) t
  order by t.group_number, t.shown_at, t.show_id;
$$;
revoke execute on function public.scene_town_pieces(uuid, uuid) from public, anon;
grant execute on function public.scene_town_pieces(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.scene_town_pieces(campaign uuid)
returns table (group_number integer, place_name text, piece_id uuid, kind text, body text, lead text, entry_key text)
language sql stable security definer set search_path = '' as $$
  select * from public.scene_town_pieces(campaign, null::uuid);
$$;

-- builds on: public.scene_town_pictures from 20261115130000_dec_3_w4b_w4c_place_in_town.sql
create function public.scene_town_pictures(campaign uuid, as_player uuid)
returns table (group_number integer, entry_key text, asset_id uuid)
language sql stable security definer set search_path = '' as $$
  select t.group_number, t.entry_key, t.asset_id from private.town_pictures_for(campaign, as_player) t
  order by t.group_number, t.entry_key;
$$;
revoke execute on function public.scene_town_pictures(uuid, uuid) from public, anon;
grant execute on function public.scene_town_pictures(uuid, uuid) to authenticated, service_role;

-- The reader's own form, as before, now through the form above with nobody named.
create or replace function public.scene_town_pictures(campaign uuid)
returns table (group_number integer, entry_key text, asset_id uuid)
language sql stable security definer set search_path = '' as $$
  select * from public.scene_town_pictures(campaign, null::uuid);
$$;

