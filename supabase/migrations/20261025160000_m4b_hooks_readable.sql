-- M4b step 1: hooks run on the player's device (ruled 2026-10-23; docs/07 "Who sees what"). Campaign members
-- can now read XP tables and hooks; stat blocks, tables, treasure types, item secrets and the rules set's GM-only
-- sections stay the GM's. Every place that lists the player-facing kinds changes together:
--   private.player_facing (the reading rule and the log's audience), the exception columns' checks (a GM's
--   per-entry exception for a player-facing kind sits where players read), and import_pack's update lines.
-- Existing exceptions for XP tables and hooks move from the GM-only column to the readable one (re-filed, not a
-- change anyone made: not logged, and allowed in a retired campaign). Drops nothing.

create or replace function private.player_facing(kind text) returns boolean
language sql immutable set search_path = '' as $$
  select kind in ('class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet', 'xpTable', 'hook');
$$;

alter table public.campaign_packs drop constraint campaign_packs_overrides_player_facing;
alter table public.campaign_pack_secrets drop constraint campaign_pack_secrets_overrides_gm_only;

alter table public.campaign_packs disable trigger user;
alter table public.campaign_pack_secrets disable trigger user;
update public.campaign_packs cp
set overrides = cp.overrides || moving.found
from (
  select s.id, jsonb_object_agg(o.key, o.value) as found
  from public.campaign_pack_secrets s, jsonb_each(s.overrides) o
  where o.key like 'xpTable:%' or o.key like 'hook:%'
  group by s.id
) moving
where moving.id = cp.id;
update public.campaign_pack_secrets s
set overrides = (
  select coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb) from jsonb_each(s.overrides) o
  where not (o.key like 'xpTable:%' or o.key like 'hook:%')
)
where exists (select 1 from jsonb_each(s.overrides) o where o.key like 'xpTable:%' or o.key like 'hook:%');
alter table public.campaign_pack_secrets enable trigger user;
alter table public.campaign_packs enable trigger user;

alter table public.campaign_packs add constraint campaign_packs_overrides_player_facing
  check (not jsonb_path_exists(overrides, '$.keyvalue() ? (!(@.key like_regex "^(class|race|item|spell|spellList|condition|lightType|startingKit|option|rulesSet|xpTable|hook):"))'));
alter table public.campaign_pack_secrets add constraint campaign_pack_secrets_overrides_gm_only
  check (not jsonb_path_exists(overrides, '$.keyvalue() ? (@.key like_regex "^(class|race|item|spell|spellList|condition|lightType|startingKit|option|rulesSet|xpTable|hook):")'));

-- Import: as in 20261023160000_m4_rules_sets_readable.sql, with XP tables and hooks in players' update lines.
create or replace function public.import_pack(meta jsonb, entries jsonb, replace_pack_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  pack uuid;
  player_facing constant text[] := array['class', 'race', 'item', 'spell', 'spellList', 'condition', 'lightType', 'startingKit', 'option', 'rulesSet', 'xpTable', 'hook'];
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
          when c.entry_id is null then 'added'
          when c.name is distinct from i.name or c.visible is distinct from private.visible_of(i.kind, i.data) then 'changed'
          when c.whole is distinct from i.data then 'changed-hidden'
        end as what
      from incoming i left join current_entries c on c.kind = i.kind and c.entry_id = i.entry_id
      union all
      select c.kind, c.name, 1000000, 'removed' from current_entries c
      where not exists (select 1 from incoming i where i.kind = c.kind and i.entry_id = c.entry_id)
    )
    select jsonb_build_object(
      'added', coalesce(jsonb_agg(name order by at, name) filter (where what = 'added' and kind = any (player_facing)), '[]'),
      'changed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'changed' and kind = any (player_facing)), '[]'),
      'removed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'removed' and kind = any (player_facing)), '[]'),
      'gm_added', coalesce(jsonb_agg(name order by at, name) filter (where what = 'added' and not kind = any (player_facing)), '[]'),
      'gm_changed', coalesce(jsonb_agg(name order by at, name)
        filter (where what = 'changed-hidden' or (what = 'changed' and not kind = any (player_facing))), '[]'),
      'gm_removed', coalesce(jsonb_agg(name order by at, name) filter (where what = 'removed' and not kind = any (player_facing)), '[]')
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
