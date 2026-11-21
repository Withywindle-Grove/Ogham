-- December dec-7, piece 3: a place's own check, and a place's rules open to players (docs/plans/
-- dec-7-linked-spots-screens.md, piece 3; rulings rg-4, pf-12b in docs/design/rulings/dec-pack-formats-2026-11-11.md;
-- rg-5, rg-5a, mc-39b in dec-mockup-rulings-2026-11-12.md; mc-51, pf-12d in dec-mockup-rulings-set2-2026-11-12.md;
-- src/modules/expedition/placeRules.ts holds the GM's side of the same rules).
--   A location (a region or a place in it) may carry `rules: [{ id, name, text, tableId?, button?, gmOnly? }]` and an
--   `encounterCheck` that may say `replacesScheduled: true` and `when: "eachMove"`. Both cover the places inside it
--   (the pack's `parentId`, same pack): the party at a spot reads its own rules and those of every place it sits in.
--   1. public.place_rule_switches: the GM's switches on a place's rules, by the pack's location and the rule's id:
--      `eye` (the rule open to the players, or closed; mc-51) and `inForce` (the stand-in check's toggle, kept under
--      the rule id 'encounterCheck'; rg-5). The GM's alone: the GM reads and keeps them; players read none. Changed only
--      through public.set_place_rule_switch (placeRule.eye, placeRule.inForce), each logged (the GM's lines, Simple)
--      and undone by the usual Undo (an update goes back; a first switch is marked undone: undoable_makings). Any
--      change ticks every group's signal, so players' screens read again at once. A switch must name a rule the
--      place has (`eye`) or a place with its own check (`inForce`).
--   2. public.place_rules_for_players(campaign): the narrow read (the stronger model). For each of the reader's groups
--      whose current place is shown to them (a piece of it shown on the visit, the rule scene_town follows), the rules
--      of that place and of the places it sits in, less every rule the pack marks `gmOnly` (never, whatever a switch
--      says; the GM can't open one: set_place_rule_switch refuses it) and every rule the GM closed. A closed rule's
--      name and text never leave the database for a player, and stop reaching them as soon as the eye closes. Link
--      marks become their labels or their ids' words, in the name, text and button (no ids sent), and a
--      rule's own id isn't sent either (the coordinator, 2026-11-13: within Francis's yes). A rule
--      of a place the group was never shown (a region the spot sits in) comes under the shown place's own name: no
--      name or id of an unshown place is sent (the lead's ruling on ⚑ b, 2026-11-13).
--   3. public.encounter_check_for_players(campaign): for each of the reader's groups, the check of the last place shown
--      to them (mc-39b: before a place is shown, the last shown place's check) when that check stands in for the
--      setting's (`replacesScheduled`, and the GM hasn't switched it off): when it's rolled and its chance only, never
--      its table, note or result. No row: the setting's own check is in force (players read it from the rules set).
-- Adds one table, its indexes, ten functions, four triggers, three policies, two logged_commands rows, one
-- undoable_tables row and two undoable_makings rows. Replaces no function. Drops, renames and deletes nothing, and
-- writes no existing row.

-- 1. The GM's switches -----------------------------------------------------------------------------------------------

create table public.place_rule_switches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The pack's location the rule belongs to (a pack attached to the campaign), and the rule's id in it.
  pack_id uuid not null references public.packs (id) on delete cascade,
  entry_id text not null check (entry_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  rule_id text not null check (rule_id ~ '^[A-Za-z0-9]+([-_][A-Za-z0-9]+)*$' and length(rule_id) <= 120),
  which text not null check (which in ('eye', 'inForce')),
  value boolean not null,
  -- For the log's words only (the GM's lines): the rule's and the place's names as the pack gives them.
  rule_name text not null default '',
  place_name text not null default '',
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (which <> 'inForce' or rule_id = 'encounterCheck')
);
create unique index place_rule_switches_one on public.place_rule_switches (campaign_id, pack_id, entry_id, rule_id, which) where not undone;
create index place_rule_switches_pack on public.place_rule_switches (pack_id);

alter table public.place_rule_switches enable row level security;
grant select, insert, update on public.place_rule_switches to authenticated;
grant select, insert, update, delete on public.place_rule_switches to service_role;

create policy "place rule switches: the GM reads" on public.place_rule_switches
  for select to authenticated using (private.is_gm(campaign_id));
create policy "place rule switches: the GM keeps them" on public.place_rule_switches
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "place rule switches: the GM keeps them, again" on public.place_rule_switches
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- A switch: on a location of a pack attached to the campaign, made by whoever sets it. A change: its value, or
-- undo's mark; nothing else.
create function private.place_rule_switch_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.campaign_packs cp where cp.campaign_id = new.campaign_id and cp.pack_id = new.pack_id)
      or not exists (select 1 from public.library_entries e where e.pack_id = new.pack_id and e.kind = 'location' and e.pack_entry_id = new.entry_id) then
      raise exception 'That place isn''t in an attached pack.';
    end if;
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That was undone.';
  end if;
  if (to_jsonb(new) - 'value' - 'undone' - 'updated_at') is distinct from (to_jsonb(old) - 'value' - 'undone' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.place_rule_switch_rules() from public, anon, authenticated;

create trigger place_rule_switch_rules before insert or update on public.place_rule_switches
  for each row execute function private.place_rule_switch_rules();
create trigger refuse_when_retired before insert or update or delete on public.place_rule_switches
  for each row execute function private.refuse_when_retired();
-- No private.log_audience_place_rule_switches: a table without one logs for the GM alone.
create trigger log_change after insert or update on public.place_rule_switches
  for each row execute function private.log_change();

-- A switch set, changed or undone: every group's players read again (their screens reload on the group's signal), so
-- a closed rule leaves their screen as it leaves the read. The signal carries no word of what changed.
create function private.tick_place_rule_switch() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  group_no integer;
begin
  if tg_op = 'INSERT' or old.value is distinct from new.value or old.undone is distinct from new.undone then
    for group_no in select g.number from public.party_groups g where g.campaign_id = new.campaign_id loop
      perform private.tick_group(new.campaign_id, group_no);
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.tick_place_rule_switch() from public, anon, authenticated;
create trigger tick_place_rule_switch after insert or update on public.place_rule_switches
  for each row execute function private.tick_place_rule_switch();

insert into public.undoable_tables (name) values ('place_rule_switches');
insert into public.undoable_makings (name) values ('placeRule.eye'), ('placeRule.inForce') on conflict do nothing;
insert into public.logged_commands (name, level, gm_only) values
  ('placeRule.eye', 'simple', true),
  ('placeRule.inForce', 'simple', true);

-- placeRule.eye and placeRule.inForce: one switch set to a value. The GM. A repeat changes nothing. The rule's and the
-- place's names are read from the pack's entry for the log's words.
create function public.set_place_rule_switch(campaign uuid, pack uuid, entry_id text, rule_id text, which text, value boolean)
returns public.place_rule_switches
language plpgsql security invoker set search_path = '' as $$
declare
  entry public.library_entries;
  row_now public.place_rule_switches;
  name_of_rule text;
  the_rule jsonb;
begin
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if which is null or which not in ('eye', 'inForce') or value is null or rule_id is null then
    raise exception 'That isn''t a switch on a rule.';
  end if;
  select * into entry from public.library_entries e where e.pack_id = pack and e.kind = 'location' and e.pack_entry_id = entry_id;
  if entry.id is null or not exists (select 1 from public.campaign_packs cp where cp.campaign_id = campaign and cp.pack_id = pack) then
    raise exception 'That place isn''t in an attached pack.';
  end if;
  if which = 'inForce' then
    if jsonb_typeof(entry.data -> 'encounterCheck') is distinct from 'object' then
      raise exception 'That place has no encounter check of its own.';
    end if;
    name_of_rule := coalesce(nullif(trim(entry.data #>> '{encounterCheck,name}'), ''), 'Encounter check');
  else
    select r into the_rule
    from jsonb_array_elements(case when jsonb_typeof(entry.data -> 'rules') = 'array' then entry.data -> 'rules' else '[]'::jsonb end) r
    where jsonb_typeof(r) = 'object' and r ->> 'id' = set_place_rule_switch.rule_id
    limit 1;
    if the_rule is null then
      raise exception 'That rule isn''t in that place.';
    end if;
    -- A rule the pack keeps for the GM is never opened to players (Francis: "never a rule the pack marks GM-only").
    if value and (the_rule -> 'gmOnly') = 'true'::jsonb then
      raise exception 'The book keeps this for the GM: players never see it.';
    end if;
    name_of_rule := coalesce(the_rule ->> 'name', '');
  end if;
  select * into row_now from public.place_rule_switches s
  where s.campaign_id = campaign and s.pack_id = pack and s.entry_id = set_place_rule_switch.entry_id
    and s.rule_id = set_place_rule_switch.rule_id and s.which = set_place_rule_switch.which and not s.undone;
  if row_now.id is null then
    insert into public.place_rule_switches (campaign_id, pack_id, entry_id, rule_id, which, value, rule_name, place_name)
    values (campaign, pack, entry_id, rule_id, which, value, left(coalesce(name_of_rule, ''), 200), left(coalesce(entry.name, ''), 200))
    returning * into row_now;
  elsif row_now.value is distinct from value then
    update public.place_rule_switches s set value = set_place_rule_switch.value where s.id = row_now.id
    returning * into row_now;
  end if;
  return row_now;
end;
$$;
revoke execute on function public.set_place_rule_switch(uuid, uuid, text, text, text, boolean) from public, anon;
grant execute on function public.set_place_rule_switch(uuid, uuid, text, text, text, boolean) to authenticated, service_role;

-- 2. What players read: the place's rules ------------------------------------------------------------------------------

-- The place a visit stands at and every place it sits in, nearest first (depth 0 is the place), in the pack the place
-- came from; at most 12 deep, so a loop in a pack ends.
create function private.place_chain(pack uuid, entry_id text)
returns table (depth integer, entry public.library_entries)
language sql stable security definer set search_path = '' as $$
  with recursive up as (
    select 0 as depth, e from public.library_entries e
    where e.pack_id = pack and e.kind = 'location' and e.pack_entry_id = entry_id
    union all
    select up.depth + 1, p from up
    join public.library_entries p on p.pack_id = pack and p.kind = 'location' and p.pack_entry_id = (up.e).data ->> 'parentId'
    where up.depth < 11
  )
  select up.depth, up.e from up;
$$;
revoke execute on function private.place_chain(uuid, text) from public, anon, authenticated;

-- A place is shown to a group's visit when a piece of it is shown on that visit (the rule of scene_pieces and
-- scene_town).
create function private.visit_shown(visit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.piece_shows s
    join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
    where s.group_place_id = visit and s.shown and not s.undone
  );
$$;
revoke execute on function private.visit_shown(uuid) from public, anon, authenticated;

-- A pack's link marks, as the app's plainLinks does (src/modules/library/linkMarks.ts): `[[kind:id|label]]` becomes its
-- label; `[[kind:id]]` or `[[kind:pack:id]]` (or an empty label) becomes the id's words, the pack dropped and dashes
-- and underscores as spaces, so no id is ever sent (review of a5e54923). A mark's parts never hold a quote or a
-- backslash, so a mark never spans two JSON strings; anything still shaped like a mark after 200 is dropped.
create function private.plain_link_text(body text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  found text[];
  target text;
  done text := body;
  n integer := 0;
begin
  if done is null then
    return null;
  end if;
  done := regexp_replace(done, '\[\[([A-Za-z]+:[^]|"\\]+)\|\s*\]\]', '[[\1]]', 'g');
  done := regexp_replace(done, '\[\[[A-Za-z]+:[^]|"\\]+\|\s*([^]"\\]*[^]"\\[:space:]])\s*\]\]', '\1', 'g');
  loop
    found := regexp_match(done, '\[\[([A-Za-z]+):([^]|"\\]+)\]\]');
    exit when found is null or n >= 200;
    target := found[2];
    if position(':' in target) > 0 then
      target := substr(target, position(':' in target) + 1);
    end if;
    done := replace(done, '[[' || found[1] || ':' || found[2] || ']]', btrim(regexp_replace(btrim(target), '[-_]+', ' ', 'g')));
    n := n + 1;
  end loop;
  return regexp_replace(done, '\[\[[^]"\\]*\]\]', '', 'g');
end;
$$;
revoke execute on function private.plain_link_text(text) from public, anon, authenticated;

create function private.plain_link_marks(body jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when body is null then null else private.plain_link_text(body::text)::jsonb end;
$$;
revoke execute on function private.plain_link_marks(jsonb) from public, anon, authenticated;

-- The name players see for a rule's or a check's place (the lead's ruling on ⚑ b, 2026-11-13; hard rule 5): a place
-- the group has been shown (a visit of that group to a place made from that entry, with a piece shown) by its players'
-- name; any other place, such as a region the shown place sits in but the group was never shown, under the shown
-- place's own name (`shown_name`), so nothing of an unshown place (its name or id) leaves the database.
create function private.shown_place_name(campaign uuid, group_no integer, pack uuid, entry_id text, shown_name text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select coalesce(nullif(p.players_name, ''), p.name) from public.places p
     join public.group_places gp on gp.place_id = p.id and gp.group_number = group_no and not gp.undone
     where p.campaign_id = campaign and p.pack_id = pack and p.pack_entry_id = entry_id and not p.undone
       and private.visit_shown(gp.id)
     order by gp.created_at desc limit 1),
    shown_name, '');
$$;
revoke execute on function private.shown_place_name(uuid, integer, uuid, text, text) from public, anon, authenticated;

create function public.place_rules_for_players(campaign uuid)
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
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
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
revoke execute on function public.place_rules_for_players(uuid) from public, anon;
grant execute on function public.place_rules_for_players(uuid) to authenticated, service_role;

-- 3. What players read: the check in force -----------------------------------------------------------------------------

create function public.encounter_check_for_players(campaign uuid)
returns table (group_number integer, place_name text, checked jsonb)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select g.number from public.party_groups g
    where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
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
revoke execute on function public.encounter_check_for_players(uuid) from public, anon;
grant execute on function public.encounter_check_for_players(uuid) to authenticated, service_role;
