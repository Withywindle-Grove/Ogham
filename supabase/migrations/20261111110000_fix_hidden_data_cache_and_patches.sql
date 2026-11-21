-- Look-back reviews of #554 and #437, approved by Francis 2026-11-10 (hard rule 5; docs/03 "Setting rules", docs/07
-- "Who reads a patch"; status docs/status/2026-11-11-m5b-hidden-data-cache-and-patches.md).
--   A. A player's stored copy of a pack counts as current while that pack's content stamp and the campaign's seen
--      stamp are unchanged, but whether a player may read an item in one pack depends on rows in OTHER packs (the
--      winning copy's "for sale", a kit that lists it; and, since C and D below, the item a patch names and the
--      hidden fields of the entries a patch matches). Now a change to such a row also bumps the seen stamp of every
--      campaign it can reach.
--   B. private.item_readable honours a reveal (and a sale, and a kit) from ANY campaign the reader shares the pack
--      with, but a change in campaign A bumped only A's stamp. Now it bumps every campaign that shares a pack with A.
--      (Scoping item_readable to one campaign is a ⚑ for Francis, unruled; not done here.)
--   C. A patch naming items reached players who may not read those items (its name carries the item's id). Now a
--      patch whose match names items by id reaches a player only when the player may read every one of them; a
--      category-only match stays player-facing.
--   D. A patch changing a hidden field of a player-facing kind (a rules set's monsters, magicItems, procedures or
--      gmReference; an entry's gmOnly list or a field it lists) reached players. Now such a patch is the GM's.
--   E. A patch with no match kind made private.player_facing_entry NULL: the log line fell to everyone and a pack
--      update dropped it from both lines. Now it is false: the GM's.
-- Replaces: private.player_facing_entry, private.log_audience_library_entries and public.import_pack (newest in
-- 20261104230000_fix_review_2026_11_04.sql), the read policy on library_entries (same file), and the trigger
-- functions private.bump_seen_rev (20261107120000_perf_pack_stamps.sql) and private.bump_pack_content_rev (newest in
-- 20261107121000_perf_pack_stamps_guard.sql). Adds seven functions. Drops, renames and deletes no data; no rows written.

-- 1. Who reads a patch (C, D, E) -------------------------------------------------------------------------------------

-- The ids a patch's match names, trimmed, blanks left out (as the app reads them: none means the whole kind).
create function private.patch_ids(data jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array(
    select btrim(i.id)
    from jsonb_array_elements_text(case when jsonb_typeof(data -> 'match' -> 'ids') = 'array' then data -> 'match' -> 'ids' else '[]'::jsonb end) i(id)
    where btrim(i.id) <> ''
  ), '{}');
$$;
revoke execute on function private.patch_ids(jsonb) from public, anon;
grant execute on function private.patch_ids(jsonb) to authenticated, service_role;

-- The first key of each path a patch changes ("armour.ac" -> "armour"), trimmed as the app trims the path.
create function private.patch_heads(data jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array(
    select distinct btrim(split_part(btrim(p.path), '.', 1))
    from jsonb_object_keys(case when jsonb_typeof(data -> 'change') = 'object' then data -> 'change' else '{}'::jsonb end) p(path)
  ), '{}');
$$;
revoke execute on function private.patch_heads(jsonb) from public, anon;
grant execute on function private.patch_heads(jsonb) to authenticated, service_role;

-- Is this whole entry one players read: a player-facing kind, and for a patch, one whose match names such a kind and
-- that changes nothing a kind keeps from players whatever the entry says (an entry's gmOnly list; a rules set's
-- GM-only sections). E: a missing kind or match kind is false, never NULL.
create or replace function private.player_facing_entry(kind text, data jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(private.player_facing(kind), false)
    and (kind <> 'patch' or (
      coalesce(private.player_facing(data -> 'match' ->> 'kind'), false)
      and not ('gmOnly' = any (private.patch_heads(data)))
      and not (data -> 'match' ->> 'kind' = 'rulesSet'
        and private.patch_heads(data) && array['monsters', 'magicItems', 'procedures', 'gmReference'])
    ));
$$;

-- D: whether a path a patch changes starts at a field an entry it may match keeps hidden (private.hidden_keys on the
-- whole entry, its hidden part added back). The entries it may match: of the kind it names (its category, on the
-- entry or under one of its byOption choices, when it names one; its ids when it names some) in the patch's own pack
-- and every pack attached alongside it in any campaign. For a kind other than a rules set, hidden_keys is the
-- entry's gmOnly list alone, read here without the call.
-- (Parameters named patch_pack and patch: inside the query a library entry's own `data` column would win over a
-- parameter named data.)
create function private.patch_hides_target_field(patch_pack uuid, patch jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  with target as (
    select patch -> 'match' ->> 'kind' as kind,
      private.patch_heads(patch) as heads,
      private.patch_ids(patch) as ids,
      nullif(btrim(case when jsonb_typeof(patch -> 'match' -> 'category') = 'string' then patch -> 'match' ->> 'category' else '' end), '') as category
  ), alongside as (
    select patch_pack as pack_id
    union
    select other.pack_id
    from public.campaign_packs mine
    join public.campaign_packs other on other.campaign_id = mine.campaign_id
    where mine.pack_id = patch_pack
  )
  select exists (
    select 1
    from target
    join public.library_entries e on e.kind = target.kind
      and (cardinality(target.ids) = 0 or e.pack_entry_id = any (target.ids))
    join alongside on alongside.pack_id = e.pack_id
    -- Only an entry with a hidden part can keep a field hidden (private.visible_of moves gmOnly and every hidden
    -- section there), so the others are never merged. The category is still read on the whole entry: it may itself
    -- be one of the hidden fields.
    join public.library_entry_secrets s on s.id = e.id
    cross join lateral (select e.data || s.data as whole) w
    where (target.category is null or w.whole ->> 'category' = target.category
        or exists (select 1 from jsonb_each(case when jsonb_typeof(w.whole -> 'byOption') = 'object' then w.whole -> 'byOption' else '{}'::jsonb end) o
                   where jsonb_typeof(o.value) = 'object' and o.value ->> 'category' = target.category))
      and target.heads && case
        when e.kind = 'rulesSet' then private.hidden_keys(e.kind, w.whole)
        else coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(w.whole -> 'gmOnly') = 'array' then w.whole -> 'gmOnly' else '[]'::jsonb end)), '{}')
      end
  );
$$;
revoke execute on function private.patch_hides_target_field(uuid, jsonb) from public, anon;
grant execute on function private.patch_hides_target_field(uuid, jsonb) to authenticated, service_role;

-- C and D for the person reading: a patch naming items by id reaches them only when they may read every one of
-- those items (private.item_readable, as for each item itself); and never when it changes a field an entry it may
-- match keeps hidden.
create function private.patch_open_to_me(patch_pack uuid, patch jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when patch -> 'match' ->> 'kind' = 'item'
      and exists (select 1 from unnest(private.patch_ids(patch)) i(id) where not private.item_readable(patch_pack, i.id))
    then false
    else not private.patch_hides_target_field(patch_pack, patch)
  end;
$$;
revoke execute on function private.patch_open_to_me(uuid, jsonb) from public, anon;
grant execute on function private.patch_open_to_me(uuid, jsonb) to authenticated, service_role;

-- C and D for the log and a pack update's line, as items are there (an item not for sale is the GM's to tell): a
-- patch naming items by id is everyone's only when the pack is attached somewhere and every one of those items is
-- for sale in every campaign it is attached to; and never when it changes a field an entry it may match keeps hidden.
create function private.patch_open_to_all(patch_pack uuid, patch jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when patch -> 'match' ->> 'kind' = 'item' and cardinality(private.patch_ids(patch)) > 0
      and (not exists (select 1 from public.campaign_packs cp where cp.pack_id = patch_pack)
        or exists (select 1 from public.campaign_packs cp cross join unnest(private.patch_ids(patch)) i(id)
                   where cp.pack_id = patch_pack and not private.item_for_sale_in(cp.campaign_id, i.id)))
    then false
    else not private.patch_hides_target_field(patch_pack, patch)
  end;
$$;
revoke execute on function private.patch_open_to_all(uuid, jsonb) from public, anon;
grant execute on function private.patch_open_to_all(uuid, jsonb) to authenticated, service_role;

-- The read rule: as in 20261104230000_fix_review_2026_11_04.sql, plus a patch's targets (C, D) for players.
drop policy "library entries: owner or campaigns using the pack read" on public.library_entries;
create policy "library entries: owner or campaigns using the pack read" on public.library_entries
  for select to authenticated
  using (
    exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
    or private.pack_in_my_campaign(pack_id, true)
    or (private.pack_in_my_campaign(pack_id) and private.player_facing_entry(kind, data)
        and case kind
          when 'item' then private.item_readable(pack_id, pack_entry_id)
          when 'patch' then private.patch_open_to_me(pack_id, data)
          else true
        end)
    -- fs-1: a table the pack opens to players.
    or (private.pack_in_my_campaign(pack_id) and kind = 'table' and (data -> 'gmOnly') = 'false'::jsonb)
  );

-- The log: as in 20261104230000_fix_review_2026_11_04.sql, plus a patch's targets (C, D); E through
-- player_facing_entry. The kind and the patch's targets are checked on the row before AND after (local review of
-- #629): a GM-only patch edited to open would otherwise log its old hidden targets in `before` to everyone, so the
-- line is everyone's only while the entry is theirs before and after (as a reminder's line is). An item's sale stays
-- read on the row as it is now (an item put on sale is announced).
create or replace function private.log_audience_library_entries(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select case
    when exists (
      select 1 from (values (old_row), (new_row)) v(r)
      where v.r is not null
        and (not private.player_facing_entry(v.r ->> 'kind', v.r -> 'data')
          or (v.r ->> 'kind' = 'patch' and not private.patch_open_to_all((v.r ->> 'pack_id')::uuid, v.r -> 'data'))))
      then 'gm'
    when r ->> 'kind' = 'item' and not private.for_sale(r -> 'data') then 'gm'
    else 'all'
  end, null::uuid
  from (select coalesce(new_row, old_row) as r) x;
$$;

-- Import: as in 20261104230000_fix_review_2026_11_04.sql, but a patch is filed with the players' changes only when
-- private.patch_open_to_all says so too (C, D); E through player_facing_entry.
create or replace function public.import_pack(meta jsonb, entries jsonb, replace_pack_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  pack uuid;
  was public.packs;
  diff jsonb;
begin
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) = 0 then
    raise exception 'A pack needs at least one entry.';
  end if;
  if replace_pack_id is null then
    insert into public.packs (name, version, kind, format_version, source, notes, extra_meta)
    values (meta ->> 'name', coalesce(meta ->> 'version', ''), coalesce(meta ->> 'kind', 'setting'),
            coalesce((meta ->> 'format_version')::integer, 1), coalesce(meta ->> 'source', ''), coalesce(meta ->> 'notes', ''),
            coalesce(meta -> 'extra', '{}'::jsonb))
    returning id into pack;
  else
    -- What changes, worked out before anything is written (against whole entries, hidden fields included):
    -- for players, only what they can see; the rest for the GM. Logged in each campaign using the pack.
    select * into was from public.packs p where p.id = replace_pack_id;
    with incoming as (
      select n ->> 'kind' as kind, n ->> 'pack_entry_id' as entry_id, n ->> 'name' as name, coalesce(n -> 'data', '{}'::jsonb) as data, at
      from jsonb_array_elements(entries) with ordinality as t(n, at)
    ), current_entries as (
      select e.kind, e.pack_entry_id as entry_id, e.name, e.data as visible, e.data || coalesce(s.data, '{}'::jsonb) as whole
      from public.library_entries e left join public.library_entry_secrets s on s.id = e.id
      where e.pack_id = replace_pack_id
    ), compared as (
      select i.kind, i.name, i.at,
        case
          when not private.player_facing_entry(i.kind, i.data) then false
          when i.kind = 'item' then private.for_sale(i.data)
          when i.kind = 'patch' then private.patch_open_to_all(replace_pack_id, i.data)
          else true
        end as for_players,
        case
          when c.entry_id is null then 'added'
          when c.name is distinct from i.name or c.visible is distinct from private.visible_of(i.kind, i.data) then 'changed'
          when c.whole is distinct from i.data then 'changed-hidden'
        end as what
      from incoming i left join current_entries c on c.kind = i.kind and c.entry_id = i.entry_id
      union all
      select c.kind, c.name, 1000000,
        case
          when not private.player_facing_entry(c.kind, c.visible) then false
          when c.kind = 'item' then private.for_sale(c.visible)
          when c.kind = 'patch' then private.patch_open_to_all(replace_pack_id, c.whole)
          else true
        end,
        'removed'
      from current_entries c
      where not exists (select 1 from incoming i where i.kind = c.kind and i.entry_id = c.entry_id)
    )
    select jsonb_build_object(
      'added', coalesce(jsonb_agg(name order by at, name) filter (where what = 'added' and for_players), '[]'),
      'changed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'changed' and for_players), '[]'),
      'removed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'removed' and for_players), '[]'),
      'gm_added', coalesce(jsonb_agg(name order by at, name) filter (where what = 'added' and not for_players), '[]'),
      'gm_changed', coalesce(jsonb_agg(name order by at, name)
        filter (where what = 'changed-hidden' or (what = 'changed' and not for_players)), '[]'),
      'gm_removed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'removed' and not for_players), '[]')
    ) into diff
    from compared where what is not null;

    update public.packs
    set name = meta ->> 'name', version = coalesce(meta ->> 'version', ''), kind = coalesce(meta ->> 'kind', 'setting'),
        format_version = coalesce((meta ->> 'format_version')::integer, 1), source = coalesce(meta ->> 'source', ''),
        notes = coalesce(meta ->> 'notes', ''), extra_meta = coalesce(meta -> 'extra', '{}'::jsonb)
    where id = replace_pack_id
    returning id into pack;
    if pack is null then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    -- Entries no longer in the file go; the rest are replaced or added below.
    delete from public.library_entries e
    where e.pack_id = pack
      and not exists (
        select 1 from jsonb_array_elements(entries) n
        where n ->> 'kind' = e.kind and n ->> 'pack_entry_id' = e.pack_entry_id
      );
  end if;

  insert into public.library_entries (pack_id, kind, pack_entry_id, name, data)
  select pack, n ->> 'kind', n ->> 'pack_entry_id', n ->> 'name', coalesce(n -> 'data', '{}'::jsonb)
  from jsonb_array_elements(entries) n
  on conflict (pack_id, kind, pack_entry_id) do update set name = excluded.name, data = excluded.data;

  if replace_pack_id is not null and was.campaign_id is null then
    perform private.log_pack_update(pack, was.version, coalesce(meta ->> 'version', ''), meta ->> 'name', diff);
  end if;
  return pack;
end;
$$;

-- 2. The seen stamp reaches every campaign a change can open or close things in (A, B) ------------------------------

-- These campaigns, and every campaign that attaches a pack one of them attaches.
create function private.campaigns_sharing_packs(first_campaigns uuid[]) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array(
    select u.id from unnest(first_campaigns) u(id) where u.id is not null
    union
    select other.campaign_id
    from public.campaign_packs mine
    join public.campaign_packs other on other.pack_id = mine.pack_id
    where mine.campaign_id = any (first_campaigns)
  ), '{}');
$$;
revoke execute on function private.campaigns_sharing_packs(uuid[]) from public, anon, authenticated;

-- One bump for each of these campaigns that still exists (a campaign being deleted gets no row back). In campaign
-- order, so two writes reaching the same campaigns take their row locks in the same order and can't deadlock.
create function private.bump_seen_revs(reached uuid[]) returns void
language sql security definer set search_path = '' as $$
  insert into public.campaign_rules_revs (campaign_id, seen_rev)
  select k.id, 1 from public.campaigns k where k.id = any (reached) order by k.id
  on conflict (campaign_id) do update set seen_rev = public.campaign_rules_revs.seen_rev + 1;
$$;
revoke execute on function private.bump_seen_revs(uuid[]) from public, anon, authenticated;

-- B. As in 20261107120000_perf_pack_stamps.sql, but a change in a campaign bumps every campaign that shares a pack
-- with it; and a link made, changed or gone also bumps every campaign that attaches that pack (once the link is gone,
-- the campaign it joined no longer finds them through it).
create or replace function private.bump_seen_rev() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'campaign_packs' then
    perform private.bump_seen_revs(
      private.campaigns_sharing_packs(array(select distinct c.campaign_id from changed c))
      || array(select distinct cp.campaign_id from public.campaign_packs cp where cp.pack_id in (select c.pack_id from changed c)));
  else
    perform private.bump_seen_revs(private.campaigns_sharing_packs(array(select distinct c.campaign_id from changed c)));
  end if;
  return null;
end;
$$;

-- A. As in 20261107121000_perf_pack_stamps_guard.sql, plus: when the changed rows are of a kind other packs' rows
-- read (an item: its "for sale", and the patches naming it; a starting kit: the items it lists; any kind a patch in
-- a campaign attaching the pack matches: its hidden fields), every campaign attaching the pack, and every campaign
-- sharing a pack with one of those, gets a seen bump. A change to anything else moves only the pack's own stamp.
create or replace function private.bump_pack_content_rev() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reached uuid[];
begin
  perform set_config('grimoire.bump_content_rev', 'on', true);
  update public.packs p set content_rev = p.content_rev + 1
  where p.id in (select distinct c.pack_id from changed c);
  perform set_config('grimoire.bump_content_rev', '', true);

  if tg_table_name = 'library_entries' then
    select array_agg(distinct cp.campaign_id) into reached
    from (select distinct c.pack_id, c.kind from changed c) ch
    join public.campaign_packs cp on cp.pack_id = ch.pack_id
    where ch.kind in ('item', 'startingKit')
      or exists (
        select 1 from public.campaign_packs alongside
        join public.library_entries t on t.pack_id = alongside.pack_id and t.kind = 'patch'
        where alongside.campaign_id = cp.campaign_id and t.data -> 'match' ->> 'kind' = ch.kind
      );
  else
    -- The hidden part: its entry says which kind it is (an entry deleted with it bumped through library_entries).
    select array_agg(distinct cp.campaign_id) into reached
    from (select distinct e.pack_id, e.kind from changed c join public.library_entries e on e.id = c.id) ch
    join public.campaign_packs cp on cp.pack_id = ch.pack_id
    where ch.kind in ('item', 'startingKit')
      or exists (
        select 1 from public.campaign_packs alongside
        join public.library_entries t on t.pack_id = alongside.pack_id and t.kind = 'patch'
        where alongside.campaign_id = cp.campaign_id and t.data -> 'match' ->> 'kind' = ch.kind
      );
  end if;
  if reached is not null then
    perform private.bump_seen_revs(private.campaigns_sharing_packs(reached));
  end if;
  return null;
end;
$$;
