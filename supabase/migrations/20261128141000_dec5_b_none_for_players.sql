-- dec5-gaps piece B (#190; G-27, ruling dg-3; docs/specs/dec5-gaps.md, Implementation Decisions, "Migrations" B): a
-- player reads "None here" at a place whose pack says `"encounterCheck": { "none": true }`.
--   public.encounter_check_for_players (both forms) gave a player only a deciding place's check that says
--   `replacesScheduled`. It now also gives a deciding place whose check says `none: true`, while the GM's switch
--   (place_rule_switches, 'encounterCheck', 'inForce') leaves it in force, as `checked = {"none": true}`: no when, no
--   chance, never the pack's note. A `none` that isn't `true` is no check at all (dg-1, as src/modules/expedition/
--   placeRules.ts reads it), so it gives no row. The place a player wasn't shown still reads by its shown name, as before.
-- Replaces one function body (the two-argument form; the one-argument form calls it and is restated unchanged). Same
-- signatures, same return columns, same security settings and grants. Adds no table, column, grant or row; drops,
-- renames and deletes nothing, and writes no stored row.

-- builds on: public.encounter_check_for_players from 20261122150000_c15f_reads_as_player.sql
create or replace function public.encounter_check_for_players(campaign uuid, as_player uuid)
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
    select distinct on (l.group_number) l.group_number, l.pack_id, l.shown_name, c.depth, c.entry,
      (c.entry).data -> 'encounterCheck' as ec
    from last_shown l
    cross join lateral private.place_chain(l.pack_id, l.pack_entry_id) c
    where l.pack_id is not null and jsonb_typeof((c.entry).data -> 'encounterCheck') = 'object'
    order by l.group_number, c.depth
  )
  select d.group_number,
    case when d.depth = 0 then d.shown_name else private.shown_place_name(campaign, d.group_number, d.pack_id, (d.entry).pack_entry_id, d.shown_name) end,
    case when (d.ec -> 'none') = 'true'::jsonb then jsonb_build_object('none', true)
    else jsonb_strip_nulls(jsonb_build_object(
      'when', d.ec -> 'when',
      'every', d.ec -> 'every',
      'chance', d.ec -> 'chance')) end
  from deciding d
  where exists (select 1 from public.campaign_packs cp where cp.campaign_id = campaign and cp.pack_id = d.pack_id)
    -- G-27 (dg-3): a "none" stands in for the setting's check; any other check only when it says it replaces it. A
    -- `none` that isn't `true` is no check at all.
    and ((d.ec -> 'none') = 'true'::jsonb or (not (d.ec ? 'none') and (d.ec -> 'replacesScheduled') = 'true'::jsonb))
    and coalesce(
      (select s.value from public.place_rule_switches s
       where s.campaign_id = campaign and s.pack_id = d.pack_id and s.entry_id = (d.entry).pack_entry_id
         and s.rule_id = 'encounterCheck' and s.which = 'inForce' and not s.undone),
      true)
  order by d.group_number;
$$;
revoke execute on function public.encounter_check_for_players(uuid, uuid) from public, anon;
grant execute on function public.encounter_check_for_players(uuid, uuid) to authenticated, service_role;

-- The reader's own form, unchanged: the form above with nobody named.
-- builds on: public.encounter_check_for_players from 20261122150000_c15f_reads_as_player.sql
create or replace function public.encounter_check_for_players(campaign uuid)
returns table (group_number integer, place_name text, checked jsonb)
language sql stable security definer set search_path = '' as $$
  select * from public.encounter_check_for_players(campaign, null::uuid);
$$;
revoke execute on function public.encounter_check_for_players(uuid) from public, anon;
grant execute on function public.encounter_check_for_players(uuid) to authenticated, service_role;
