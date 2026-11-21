-- M5b step 0c, follow-up B to slices 3–7 (design/rulings/m5b-0c-creation-followups-2026-11-02.md, cf-5; docs/07
-- "Who sees what"; the plan's Departures, slice 6, scope check 1).
--   Sheet layouts (kind fieldTemplate) become a player-facing kind: a layout holds field names, kinds, lists and
--   `fill` marks, nothing secret, and a player's device needs it for a per-race list (a field's `from` as a pattern,
--   "backgrounds-{race}") and a field's own option gate. The read rule on library_entries, the log's audience, the
--   campaign's exceptions and the exceptions' check all ask private.player_facing, so that one function carries the
--   change; import_pack keeps its own copy of the list (its "what changed" line for players), updated the same way.
--   A layout's gmOnly fields, if a pack ever writes some, are split off like any other kind's (split_hidden_fields).
-- Replaces two functions (both from 20261101170000_m5b_trait_lists.sql). Drops, renames and deletes no data; no rows
-- written.

create or replace function private.player_facing(kind text) returns boolean
language sql immutable set search_path = '' as $$
  select kind in ('class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet', 'xpTable', 'hook', 'traitList', 'fieldTemplate');
$$;

-- Import: as in 20261101170000_m5b_trait_lists.sql, with sheet layouts among the kinds players read.
create or replace function public.import_pack(meta jsonb, entries jsonb, replace_pack_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  pack uuid;
  player_facing constant text[] := array['class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet', 'xpTable', 'hook', 'traitList', 'fieldTemplate'];
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
      select i.kind, i.name, i.at, i.kind = 'item' and not private.for_sale(i.data) as hidden_item,
        case
          when c.entry_id is null then 'added'
          when c.name is distinct from i.name or c.visible is distinct from private.visible_of(i.kind, i.data) then 'changed'
          when c.whole is distinct from i.data then 'changed-hidden'
        end as what
      from incoming i left join current_entries c on c.kind = i.kind and c.entry_id = i.entry_id
      union all
      select c.kind, c.name, 1000000, c.kind = 'item' and not private.for_sale(c.visible), 'removed' from current_entries c
      where not exists (select 1 from incoming i where i.kind = c.kind and i.entry_id = c.entry_id)
    )
    select jsonb_build_object(
      'added', coalesce(jsonb_agg(name order by at, name) filter (where what = 'added' and kind = any (player_facing) and not hidden_item), '[]'),
      'changed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'changed' and kind = any (player_facing) and not hidden_item), '[]'),
      'removed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'removed' and kind = any (player_facing) and not hidden_item), '[]'),
      'gm_added', coalesce(jsonb_agg(name order by at, name) filter (where what = 'added' and (not kind = any (player_facing) or hidden_item)), '[]'),
      'gm_changed', coalesce(jsonb_agg(name order by at, name)
        filter (where what = 'changed-hidden' or (what = 'changed' and (not kind = any (player_facing) or hidden_item))), '[]'),
      'gm_removed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'removed' and (not kind = any (player_facing) or hidden_item)), '[]')
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
