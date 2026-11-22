-- The players' place card (plan dec-9-the-players-scene, row P4; rulings p4s-1 and p4s-2 in
-- docs/design/rulings/p4-sitting-2026-11-20.md; p2p-24 in scene-point-to-point-2026-11-18.md; mc-35). Francis's yes,
-- 2026-11-20: "Yes, send them" (p4s-1) and "Yes, build it for the 5th" (p4s-2). Add-only. Changed in place before it was
-- applied anywhere, as ruled on #1097's ⚑ (docs/design/rulings/p4-p2-flags-2026-11-20.md): an Area's or Region's name
-- counts as shown once the group was shown a place inside it (ppf-1, "Shown with a Location"); each known Location
-- carries its first shown piece (ppf-4, "As drawn: first shown piece").
--   1. public.knowledge_shares: the GM's eye on a section of a place's Knowledge (frame 7b of page 01, approved
--      2026-11-12). One row per group, place of a pack and section (its place in the pack's `gm.sections`): shared or
--      not, and the campaign clock when it was last shared ("Shared, turn 9."). The section's heading and words are
--      copied from the pack when it is shared, so a player's read never reaches into the GM's pack entry. The GM's alone
--      to read and keep; players read none of it directly. Changed only through public.set_knowledge_share
--      (placeKnowledge.eye, the GM's line, Simple), undone by the usual Undo (an update goes back; a first share is
--      marked undone: undoable_makings). A change ticks that group's signal, so its players read again at once.
--   2. public.place_card_for_players(campaign): the narrow read p4s-1 rules. For each of the reader's groups whose
--      current place is shown to them (a piece of it shown on the visit, the rule of scene_pieces and
--      place_rules_for_players), of a pack still attached to the campaign (or made by hand), and only then:
--        'here'  the place's number from the pack (its `key`; '' for none) and its name as players know it;
--        'trail' each place it sits in (an Area, a Region) whose name counts as shown to this group, by
--                private.known_entry_name: a place made from that entry that the group was shown (the rule of
--                private.shown_place_name, the lead's ruling on ⚑ b, 2026-11-13), or, since ppf-1 (2026-11-20), any
--                place inside it that the group was shown. One whose name doesn't count as shown is left out, not
--                replaced, and sends nothing (no name, no id, not that it exists); `at` counts only the ones sent, from
--                the top, so no gap hints at a level left out;
--        'area'  the place it sits in directly (its Area), once more, by the same rule: the right card's heading;
--        'known' the other places of the same Area (the same pack and parent) this group has been shown on an
--                expedition not undone (as known_places_campaign), each with its
--                number, its name, its campaign place id (the id known_places_campaign already sends with its
--                pieces) and `line`: the first piece the group was shown there, its words as known_places_campaign
--                sends them (ppf-4, PL1b's second line; nothing new is sent). A Location never shown to the group sends
--                nothing. Numbers can show gaps: the accepted hint of p4s-1.
--   3. public.knowledge_for_players(campaign): for each of the reader's groups whose current place is shown, the
--      sections the GM has shared with that group of the place it is at, of the places it sits in, and of the other
--      places of its Area (p2p-24: "What everyone knows" keeps what the party has learned of the Area): the heading and
--      words as copied when shared, with link marks as their labels (no id sent), the clock when shared, and the
--      place's name as players know it (private.known_entry_name; a place whose name doesn't count as shown comes under
--      the current place's name, rp-4). An
--      unshared section, a section shared with another group, and a share taken back or undone send nothing.
-- Adds one table, its two indexes, three policies, six functions, four triggers, one logged_commands row, one
-- undoable_tables row and one undoable_makings row. Replaces no function. Drops, renames and deletes nothing, and
-- writes no existing row.

-- 1. The GM's eye on a section of Knowledge ---------------------------------------------------------------------------

create table public.knowledge_shares (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  group_number integer not null check (group_number >= 1),
  -- The pack's location the section belongs to (a pack attached to the campaign), and the section's place in its
  -- `gm.sections` (counted from 0, as the pack lists them).
  pack_id uuid not null references public.packs (id) on delete cascade,
  entry_id text not null check (entry_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  section_at integer not null check (section_at >= 0 and section_at < 500),
  -- The section as the pack gave it when shared: its heading, and its `text` (plain words or `{ blocks }`, pf-18).
  heading text not null default '' check (length(heading) <= 1000),
  body jsonb,
  shared boolean not null,
  -- The campaign clock (seconds) when it was last shared: the "Shared, turn N." line.
  shared_clock bigint not null default 0 check (shared_clock >= 0),
  -- For the log's words only (the GM's lines): the place's name as the pack gives it.
  place_name text not null default '',
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index knowledge_shares_one on public.knowledge_shares (campaign_id, group_number, pack_id, entry_id, section_at) where not undone;
create index knowledge_shares_pack on public.knowledge_shares (pack_id);

alter table public.knowledge_shares enable row level security;
grant select, insert, update on public.knowledge_shares to authenticated;
grant select, insert, update, delete on public.knowledge_shares to service_role;

create policy "knowledge shares: the GM reads" on public.knowledge_shares
  for select to authenticated using (private.is_gm(campaign_id));
create policy "knowledge shares: the GM keeps them" on public.knowledge_shares
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "knowledge shares: the GM keeps them, again" on public.knowledge_shares
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- A share: on a location of a pack attached to the campaign, for one of its groups, made by whoever sets it. A change:
-- shared, its clock, or Undo's mark; nothing else.
create function private.knowledge_share_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.campaign_packs cp where cp.campaign_id = new.campaign_id and cp.pack_id = new.pack_id)
      or not exists (select 1 from public.library_entries e where e.pack_id = new.pack_id and e.kind = 'location' and e.pack_entry_id = new.entry_id) then
      raise exception 'That place isn''t in an attached pack.';
    end if;
    if not exists (select 1 from public.party_groups g where g.campaign_id = new.campaign_id and g.number = new.group_number) then
      raise exception 'There is no such group.';
    end if;
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That was undone.';
  end if;
  if (to_jsonb(new) - 'shared' - 'shared_clock' - 'undone' - 'updated_at') is distinct from (to_jsonb(old) - 'shared' - 'shared_clock' - 'undone' - 'updated_at') then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.knowledge_share_rules() from public, anon, authenticated;

create trigger knowledge_share_rules before insert or update on public.knowledge_shares
  for each row execute function private.knowledge_share_rules();
create trigger refuse_when_retired before insert or update or delete on public.knowledge_shares
  for each row execute function private.refuse_when_retired();
-- No private.log_audience_knowledge_shares: a table without one logs for the GM alone (the copied words are the GM's
-- until shared, and the line says nothing a player needs).
create trigger log_change after insert or update on public.knowledge_shares
  for each row execute function private.log_change();

-- A share set, taken back or undone: that group's players read again (their screens reload on the group's signal). The
-- signal carries no word of what changed.
create function private.tick_knowledge_share() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.shared is distinct from new.shared or old.undone is distinct from new.undone or old.shared_clock is distinct from new.shared_clock then
    perform private.tick_group(new.campaign_id, new.group_number);
  end if;
  return null;
end;
$$;
revoke execute on function private.tick_knowledge_share() from public, anon, authenticated;
create trigger tick_knowledge_share after insert or update on public.knowledge_shares
  for each row execute function private.tick_knowledge_share();

insert into public.undoable_tables (name) values ('knowledge_shares');
insert into public.undoable_makings (name) values ('placeKnowledge.eye') on conflict do nothing;
insert into public.logged_commands (name, level, gm_only) values ('placeKnowledge.eye', 'simple', true);

-- placeKnowledge.eye: one section shared with one group, or taken back. The GM. A repeat changes nothing; sharing again
-- after taking it back copies the pack's words again and keeps the new clock. The section is read from the pack's entry
-- here, never sent by the app.
create function public.set_knowledge_share(campaign uuid, group_no integer, pack uuid, entry_id text, section_at integer, share boolean)
returns public.knowledge_shares
language plpgsql security invoker set search_path = '' as $$
declare
  entry public.library_entries;
  section jsonb;
  clock_now bigint;
  row_now public.knowledge_shares;
begin
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if share is null or group_no is null or section_at is null or section_at < 0 then
    raise exception 'That isn''t a section to share.';
  end if;
  select * into entry from public.library_entries e where e.pack_id = pack and e.kind = 'location' and e.pack_entry_id = set_knowledge_share.entry_id;
  if entry.id is null or not exists (select 1 from public.campaign_packs cp where cp.campaign_id = campaign and cp.pack_id = pack) then
    raise exception 'That place isn''t in an attached pack.';
  end if;
  if not exists (select 1 from public.party_groups g where g.campaign_id = campaign and g.number = group_no) then
    raise exception 'There is no such group.';
  end if;
  section := case when jsonb_typeof(entry.data #> '{gm,sections}') = 'array' then entry.data #> '{gm,sections}' -> section_at end;
  if section is null or jsonb_typeof(section) <> 'object' then
    raise exception 'That section isn''t in that place''s knowledge.';
  end if;
  select c.seconds into clock_now from public.campaign_clocks c where c.campaign_id = campaign;
  select * into row_now from public.knowledge_shares s
  where s.campaign_id = campaign and s.group_number = group_no and s.pack_id = pack and s.entry_id = set_knowledge_share.entry_id
    and s.section_at = set_knowledge_share.section_at and not s.undone;
  if row_now.id is null then
    if not share then
      return null;
    end if;
    insert into public.knowledge_shares (campaign_id, group_number, pack_id, entry_id, section_at, heading, body, shared, shared_clock, place_name)
    values (campaign, group_no, pack, entry_id, section_at, left(coalesce(section ->> 'heading', ''), 1000), section -> 'text', true, coalesce(clock_now, 0), left(coalesce(entry.name, ''), 200))
    returning * into row_now;
  elsif row_now.shared is distinct from share then
    -- Taking it back keeps the copy (the GM's alone while unshared); sharing again takes the pack's words and clock now.
    if share then
      update public.knowledge_shares s set shared = true, shared_clock = coalesce(clock_now, 0)
      where s.id = row_now.id
      returning * into row_now;
    else
      update public.knowledge_shares s set shared = false where s.id = row_now.id
      returning * into row_now;
    end if;
  end if;
  return row_now;
end;
$$;
revoke execute on function public.set_knowledge_share(uuid, integer, uuid, text, integer, boolean) from public, anon;
grant execute on function public.set_knowledge_share(uuid, integer, uuid, text, integer, boolean) to authenticated, service_role;

-- 2. What players read: the place card ---------------------------------------------------------------------------------

-- The name of a pack's place as players know it, when it counts as shown to this group; null otherwise (no stand-in).
-- It counts as shown when the group was shown a place made from it (private.shown_place_name's rule: its players'
-- name, else its name), or (ppf-1, 2026-11-20: "Shown with a Location") a place inside it, at any depth, made from the
-- same pack: the pack's name for players (`playerView.name`, as a place made from it would take, else its name). An
-- Area or Region with no shown place inside it sends nothing.
create function private.known_entry_name(campaign uuid, group_no integer, pack uuid, entry_id text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    nullif(private.shown_place_name(campaign, group_no, pack, entry_id, null), ''),
    (select coalesce(nullif(btrim(left(e.data #>> '{playerView,name}', 200)), ''), e.name)
     from public.library_entries e
     where e.pack_id = pack and e.kind = 'location' and e.pack_entry_id = known_entry_name.entry_id
       and exists (
         select 1 from public.places q
         join public.group_places v on v.place_id = q.id and v.campaign_id = campaign and v.group_number = group_no and not v.undone
         where q.campaign_id = campaign and q.pack_id = pack and not q.undone and q.pack_entry_id is distinct from known_entry_name.entry_id
           and private.visit_shown(v.id)
           and exists (select 1 from private.place_chain(pack, q.pack_entry_id) c where c.depth > 0 and (c.entry).pack_entry_id = known_entry_name.entry_id)
       )
     limit 1));
$$;
revoke execute on function private.known_entry_name(uuid, integer, uuid, text) from public, anon, authenticated;

create function public.place_card_for_players(campaign uuid)
returns table (group_number integer, kind text, at integer, place_id uuid, key text, name text, line text)
language sql stable security definer set search_path = '' as $$
  with here as (
    select g.number as group_number, gp.id as visit, p.id as place_id, p.pack_id, p.pack_entry_id, coalesce(p.pack_parent_id, '') as parent,
      coalesce(p.pack_key, '') as key, coalesce(nullif(p.players_name, ''), p.name) as name
    from public.party_groups g
    cross join lateral private.current_group_place(g.campaign_id, g.number) gp
    join public.places p on p.id = gp.place_id and not p.undone
    where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
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
revoke execute on function public.place_card_for_players(uuid) from public, anon;
grant execute on function public.place_card_for_players(uuid) to authenticated, service_role;

-- 3. What players read: the knowledge shared ---------------------------------------------------------------------------

create function public.knowledge_for_players(campaign uuid)
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
    where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
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
revoke execute on function public.knowledge_for_players(uuid) from public, anon;
grant execute on function public.knowledge_for_players(uuid) to authenticated, service_role;
