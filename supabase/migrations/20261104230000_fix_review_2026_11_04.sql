-- Fresh-session security review of the 2026-11-04 migrations (findings 1 and 3; docs/09 2026-11-04 [perm], [items]).
--   1. Hard rule 5. 20261104150000_m5b_patches_kind.sql made every `patch` entry player-facing, but a patch's match
--      may name a GM-only kind (a stat block's hit dice, a table, a location, a GM reference panel): the patch then
--      carried that entry's name ("<byOption> · statBlock bog-lurker") and figures to players. Now a patch is
--      player-facing only when the kind it matches is: private.player_facing_entry(kind, data) says so for a whole
--      entry, and the read rule on library_entries, the log's audience for an entry's changes and import_pack's
--      "what changed" line for players all ask it. A patch on a GM-only kind reaches only the GM (docs/07, patches).
--   3. 20261104140000_m5b_0c_creation_one_offs.sql: a one-off moved between two of a player's own unapproved
--      characters landed pending; the other character's own approval covers it, so it stays approved.
-- Replaces one policy (newest in 20261102260000_m5b_0c_tables_players_read.sql), and three functions:
-- private.log_audience_library_entries (20261029160000_m5_intents.sql), public.import_pack
-- (20261104150000_m5b_patches_kind.sql) and private.guard_lines_from_players (20261104140000). Adds one function.
-- Drops, renames and deletes no data; no rows written.

-- 1. -----------------------------------------------------------------------------------------------------------------

-- Is this whole entry one players read: a player-facing kind, and for a patch, one whose match names such a kind?
create function private.player_facing_entry(kind text, data jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select private.player_facing(kind) and (kind <> 'patch' or private.player_facing(data -> 'match' ->> 'kind'));
$$;
grant execute on function private.player_facing_entry(text, jsonb) to authenticated, service_role;

drop policy "library entries: owner or campaigns using the pack read" on public.library_entries;
create policy "library entries: owner or campaigns using the pack read" on public.library_entries
  for select to authenticated
  using (
    exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
    or private.pack_in_my_campaign(pack_id, true)
    or (private.pack_in_my_campaign(pack_id) and private.player_facing_entry(kind, data)
        and (kind <> 'item' or private.item_readable(pack_id, pack_entry_id)))
    -- fs-1: a table the pack opens to players.
    or (private.pack_in_my_campaign(pack_id) and kind = 'table' and (data -> 'gmOnly') = 'false'::jsonb)
  );

-- Like reading the entries: stat blocks, tables, treasure, a patch on one of those and the rest are the GM's; so is
-- an item that isn't for sale (players may know it, but its changes are the GM's to tell).
create or replace function private.log_audience_library_entries(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select case
    when not private.player_facing_entry(coalesce(new_row, old_row) ->> 'kind', coalesce(new_row, old_row) -> 'data')
      or (coalesce(new_row, old_row) ->> 'kind' = 'item' and not private.for_sale(coalesce(new_row, old_row) -> 'data'))
    then 'gm' else 'all' end, null::uuid;
$$;

-- Import: as in 20261104150000_m5b_patches_kind.sql, but each entry's side (players' or the GM's) comes from
-- private.player_facing_entry, so a patch on a GM-only kind is filed with the GM's changes.
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
        private.player_facing_entry(i.kind, i.data) and not (i.kind = 'item' and not private.for_sale(i.data)) as for_players,
        case
          when c.entry_id is null then 'added'
          when c.name is distinct from i.name or c.visible is distinct from private.visible_of(i.kind, i.data) then 'changed'
          when c.whole is distinct from i.data then 'changed-hidden'
        end as what
      from incoming i left join current_entries c on c.kind = i.kind and c.entry_id = i.entry_id
      union all
      select c.kind, c.name, 1000000,
        private.player_facing_entry(c.kind, c.visible) and not (c.kind = 'item' and not private.for_sale(c.visible)), 'removed'
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

-- 3. -----------------------------------------------------------------------------------------------------------------

-- As in 20261104140000_m5b_0c_creation_one_offs.sql, with one more branch on a move: a one-off leaving one of the
-- player's own unapproved characters for another of them stays approved (that character's approval covers it too).
create or replace function private.guard_lines_from_players() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  splitting text := nullif(current_setting('grimoire.splitting', true), '');
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.how_got = 'given' then
      raise exception 'Only the GM gives items.' using errcode = '42501';
    end if;
    if new.library_entry_id is null and new.source_pack_id is not null and splitting is null then
      raise exception 'That item isn''t in this campaign''s setting rules.' using errcode = '42501';
    end if;
    -- Part of a stack split off (public.split_inventory_line): it is what the stack was, approved or waiting.
    if splitting is not null then
      new.approval := coalesce((select l.approval from public.inventory_lines l where l.id::text = splitting), 'pending');
      return new;
    end if;
    -- A one-off (from no setting rules) waits for the GM, unless the campaign says one-offs don't need approval,
    -- or it goes on a character of the player's own that isn't approved yet (the character's approval covers it).
    if new.library_entry_id is null and new.source_pack_id is null then
      new.approval := case
        when private.is_own_unapproved_character(new.actor_id) then 'approved'
        when (select c.settings -> 'oneOffApproval' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then 'approved'
        else 'pending'
      end;
    end if;
    return new;
  end if;
  if new.approval is distinct from old.approval or new.how_got is distinct from old.how_got then
    raise exception 'Only the GM approves items.' using errcode = '42501';
  end if;
  if new.name is distinct from old.name or new.category is distinct from old.category
    or new.weight_coin is distinct from old.weight_coin or new.slots is distinct from old.slots
    or new.stack is distinct from old.stack or new.per_units is distinct from old.per_units
    or new.library_entry_id is distinct from old.library_entry_id
    or new.source_pack_id is distinct from old.source_pack_id or new.source_entry_id is distinct from old.source_entry_id then
    raise exception 'Only the GM changes what an item is.' using errcode = '42501';
  end if;
  -- Magic armour's base is picked once; after that only the GM changes it.
  if new.base_armour_id is distinct from old.base_armour_id and old.base_armour_id is not null then
    raise exception 'Only the GM changes the base armour once it''s chosen.' using errcode = '42501';
  end if;
  -- A one-off leaving a character of the player's own that isn't approved yet waits again where it lands, unless it
  -- lands on another such character of theirs.
  if new.actor_id is distinct from old.actor_id and old.actor_id is not null
    and new.library_entry_id is null and new.source_pack_id is null
    and private.is_own_unapproved_character(old.actor_id) then
    new.approval := case
      when private.is_own_unapproved_character(new.actor_id) then 'approved'
      when (select c.settings -> 'oneOffApproval' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then 'approved'
      else 'pending'
    end;
  end if;
  return new;
end;
$$;
