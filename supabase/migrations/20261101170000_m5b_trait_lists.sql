-- M5b step 0b part B, trait lists at creation (design/rulings/m5b-0-weapon-skills-and-traits-2026-11-01.md §4;
-- docs/04 Actors: traitLists; docs/07 Sheet, skills, effects and options). Ruled Now by Francis, 2026-11-01.
--   1. traitList is a kind of library entry (a pack's `traitLists`: backgrounds, affiliations, signs…), and players
--      read it like classes and races: private.player_facing says so, and so does the import's "what changed" line.
--      The read rule itself (the policy on library_entries) isn't touched: it already asks private.player_facing.
--      A trait list's gmOnly fields are split off like any other kind's (private.split_hidden_fields).
--   2. A campaign field keeps its `from` (the trait list it offers): field_definitions.from_list, the list's id.
--      A list field then needs choices OR a from_list; its type and key stay fixed as before.
--   3. Fields already made from a sheet layout whose field has a `from` get theirs now, matched by key, and become
--      list fields (they were made as text, since they had no choices). Re-filed, not a change anyone made: not
--      logged, allowed in a retired campaign. What players typed in them stays as it is (shown as typed).
-- Drops and deletes no data. Replaces two functions (player_facing from 20261025160000_m4b_hooks_readable.sql,
-- import_pack from 20261028100000_m4b_known_items.sql), replaces one check constraint, adds one column.

-- 1. The kind.
alter table public.library_entries drop constraint library_entries_kind_check;
alter table public.library_entries add constraint library_entries_kind_check check (kind in (
  'fieldTemplate', 'item', 'class', 'xpTable', 'rulesSet', 'condition', 'lightType', 'statBlock', 'table',
  'calendar', 'option', 'race', 'spell', 'spellList', 'treasureType', 'startingKit', 'hook', 'traitList'
));

create or replace function private.player_facing(kind text) returns boolean
language sql immutable set search_path = '' as $$
  select kind in ('class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet', 'xpTable', 'hook', 'traitList');
$$;

-- Import: as in 20261028100000_m4b_known_items.sql, with trait lists among the kinds players read.
create or replace function public.import_pack(meta jsonb, entries jsonb, replace_pack_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  pack uuid;
  player_facing constant text[] := array['class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet', 'xpTable', 'hook', 'traitList'];
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

-- 2. The field's `from`: the id of the trait list it offers (07: type "list", from "<traitList id>").
alter table public.field_definitions
  add column from_list text check (from_list is null or (char_length(from_list) <= 80 and from_list ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));

-- A list has choices or a trait list; nothing else has either (the unnamed check from 20261019210000, found by
-- what it says rather than by a guessed name).
do $$
declare
  found text;
begin
  select conname into found
  from pg_constraint
  where conrelid = 'public.field_definitions'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%cardinality(choices)%';
  if found is not null then
    execute format('alter table public.field_definitions drop constraint %I', found);
  end if;
end;
$$;
alter table public.field_definitions add constraint field_definitions_list_has_choices
  check ((type = 'list') = (cardinality(choices) > 0 or from_list is not null));

-- 3. Fields made from a layout whose field has a `from`, matched by key: they get it now and become lists.
alter table public.field_definitions disable trigger user;
update public.field_definitions fd
set from_list = found.from_list, type = 'list'
from (
  select distinct on (cp.campaign_id, f ->> 'key') cp.campaign_id, f ->> 'key' as key, f ->> 'from' as from_list
  from public.campaign_packs cp
  join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'fieldTemplate'
  cross join lateral jsonb_array_elements(case when jsonb_typeof(e.data -> 'fields') = 'array' then e.data -> 'fields' else '[]'::jsonb end) f
  where lower(f ->> 'type') = 'list' and jsonb_typeof(f -> 'from') = 'string'
    and char_length(f ->> 'from') between 1 and 80 and (f ->> 'from') ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  order by cp.campaign_id, f ->> 'key', cp.priority desc
) found
where fd.campaign_id = found.campaign_id and fd.key = found.key and fd.from_list is null
  and fd.type in ('text', 'list') and cardinality(fd.choices) = 0;
alter table public.field_definitions enable trigger user;
