-- M4b, discovery first (ruled 2026-10-25; docs/04 KnownItem, 05 "What players' devices get", 07 "Who sees what"):
-- players' devices get a setting-rules item only if it's for sale or known to the party, and knowledge stays once
-- learned. Enforced here, in the entries' reading rule.
--   known_items: one row per item the party knows in a campaign (the item's id in its setting rules). Written by
--     the database when a line of that item is held in the party: on an approved character a player or the party
--     owns (so also when the GM hands it out), or in the Party stash; and when a character holding it is approved.
--     Never removed, so it stays known after the item leaves the party. Members read it; nobody writes it directly.
--     revealed_facts is kept for unidentified items, which aren't built yet: nothing writes it.
--   For sale: as the app says (07 forSale): the item's own forSale, else everything but the magic categories,
--     decided on the version that wins in that campaign (the same order as the app: the GM's exception, then
--     homebrew, then priority).
--   The log: a homebrew item that isn't for sale is the GM's, and an updated pack's items that aren't for sale go
--     in the GM's update line.
--   Existing campaigns: the items their party holds now, or held before (from the log), are known from the start.
-- Add-only: a table, five functions, two triggers; the entries' reading rule, the log and the import are replaced.
-- known_items rows are added, none changed or removed. Drops no data.

create table public.known_items (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 200),
  revealed_facts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(revealed_facts) = 'array' and pg_column_size(revealed_facts) <= 4000),
  known_since timestamptz not null default now(),
  primary key (campaign_id, item_id)
);
alter table public.known_items enable row level security;
grant select on public.known_items to authenticated;
grant select, insert, update, delete on public.known_items to service_role;
create policy "known items: campaign members read" on public.known_items
  for select to authenticated using (private.is_member(campaign_id));

-- 07 forSale: the item's own say, else everything but the magic categories ("magic" or "magic-…").
create function private.for_sale(data jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(data -> 'forSale') = 'boolean' then (data ->> 'forSale')::boolean
    else coalesce(data ->> 'category', '') !~ '(^|-)magic(-|$)'
  end;
$$;
revoke execute on function private.for_sale(jsonb) from public, anon;
grant execute on function private.for_sale(jsonb) to authenticated, service_role;

-- Whether an item is for sale in a campaign: decided on the version that wins there (as src/modules/library/stack.ts:
-- the GM's exception first, then the homebrew layer, then the higher priority).
create function private.item_for_sale_in(campaign uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select private.for_sale(e.data)
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'item' and e.pack_entry_id = item
    where cp.campaign_id = campaign
    order by cp.overrides ? ('item:' || item) desc, (p.kind = 'homebrew') desc, cp.priority desc, cp.pack_id::text
    limit 1
  ), false);
$$;
revoke execute on function private.item_for_sale_in(uuid, text) from public, anon;
grant execute on function private.item_for_sale_in(uuid, text) to authenticated, service_role;

-- Whether the signed-in member may read a pack's item: in a campaign of theirs using the pack, it's known to the
-- party or for sale.
create function private.item_readable(pack uuid, item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_packs cp
    where cp.pack_id = pack and private.is_member(cp.campaign_id)
      and (
        exists (select 1 from public.known_items k where k.campaign_id = cp.campaign_id and k.item_id = item)
        or private.item_for_sale_in(cp.campaign_id, item)
      )
  );
$$;
revoke execute on function private.item_readable(uuid, text) from public, anon;
grant execute on function private.item_readable(uuid, text) to authenticated, service_role;

-- As in 20261023160000_m4_rules_sets_readable.sql, but players get an item only if it's known or for sale.
drop policy "library entries: owner or campaigns using the pack read" on public.library_entries;
create policy "library entries: owner or campaigns using the pack read" on public.library_entries
  for select to authenticated
  using (
    exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
    or private.pack_in_my_campaign(pack_id, true)
    or (private.pack_in_my_campaign(pack_id) and private.player_facing(kind)
        and (kind <> 'item' or private.item_readable(pack_id, pack_entry_id)))
  );

-- Held in the party: on an approved character a player or the party owns, or in the Party stash.
create function private.held_by_party(actor uuid, place uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (place is not null and exists (select 1 from public.locations l where l.id = place and l.kind = 'stash'))
    or (actor is not null and exists (
      select 1 from public.actors a where a.id = actor and a.approval = 'approved' and a.owner_type in ('user', 'party')
    ));
$$;
revoke execute on function private.held_by_party(uuid, uuid) from public, anon;
grant execute on function private.held_by_party(uuid, uuid) to authenticated, service_role;

-- A line of a setting-rules item held in the party: the party knows the item from now on.
create function private.learn_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source_entry_id is not null and private.held_by_party(new.actor_id, new.location_id) then
    insert into public.known_items (campaign_id, item_id) values (new.campaign_id, new.source_entry_id)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger learn_item after insert or update of actor_id, location_id, source_entry_id on public.inventory_lines
  for each row execute function private.learn_item();

-- A character approved with gear already on it (a starting kit): the party knows those items now.
create function private.learn_items_on_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.approval = 'approved' and old.approval is distinct from 'approved' and new.owner_type in ('user', 'party') then
    insert into public.known_items (campaign_id, item_id)
    select distinct l.campaign_id, l.source_entry_id from public.inventory_lines l
    where l.actor_id = new.id and l.source_entry_id is not null
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger learn_items_on_approval after update of approval on public.actors
  for each row execute function private.learn_items_on_approval();

-- Existing campaigns: what the party holds now, and what it held before (a line's making, in the log).
insert into public.known_items (campaign_id, item_id, known_since)
select l.campaign_id, l.source_entry_id, min(l.created_at) from public.inventory_lines l
where l.source_entry_id is not null and private.held_by_party(l.actor_id, l.location_id)
group by l.campaign_id, l.source_entry_id
on conflict do nothing;
insert into public.known_items (campaign_id, item_id, known_since)
select e.campaign_id, e.after ->> 'source_entry_id', min(e.created_at) from public.events e
where e.target_table = 'inventory_lines' and e.before is null and e.after ->> 'source_entry_id' is not null
  and char_length(e.after ->> 'source_entry_id') <= 200
  and private.held_by_party((e.after ->> 'actor_id')::uuid, (e.after ->> 'location_id')::uuid)
group by e.campaign_id, e.after ->> 'source_entry_id'
on conflict do nothing;

-- The log: as in 20261023200000_m4_charges.sql, but a homebrew item that isn't for sale is logged for the GM only.
create or replace function private.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  this_row jsonb := coalesce(new_row, old_row);
  campaign uuid;
  before_values jsonb := old_row;
  after_values jsonb := new_row;
  key text;
  tag jsonb;
  event_type text;
  event_level text;
  command_gm_only boolean;
  carrier_approval text;
  carrier_owner_type text;
  carrier_owner uuid;
  is_fiat boolean := false;
  why text;
  request uuid;
  who_sees text := 'all';
  owner uuid;
  reverting uuid := nullif(current_setting('grimoire.reverting', true), '')::uuid;
begin
  -- Which campaign it belongs to.
  if tg_table_name = 'campaigns' then
    campaign := (this_row ->> 'id')::uuid;
  elsif tg_table_name = 'actor_secrets' then
    select a.campaign_id into campaign from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
  elsif tg_table_name in ('library_entries', 'library_entry_secrets') then
    -- Only a campaign's own homebrew is logged (in that campaign); library packs belong to no campaign.
    select p.campaign_id into campaign from public.packs p where p.id = (this_row ->> 'pack_id')::uuid;
  else
    campaign := (this_row ->> 'campaign_id')::uuid;
  end if;
  -- A campaign being deleted takes its events with it; don't log the rows that go with it.
  if campaign is null or not exists (select 1 from public.campaigns c where c.id = campaign) then
    return null;
  end if;

  -- For a change, keep only the values that changed; a change that changes nothing isn't logged.
  if tg_op = 'UPDATE' then
    before_values := '{}'::jsonb;
    after_values := '{}'::jsonb;
    for key in select jsonb_object_keys(new_row) loop
      if key <> 'updated_at' and (old_row -> key) is distinct from (new_row -> key) then
        before_values := before_values || jsonb_build_object(key, old_row -> key);
        after_values := after_values || jsonb_build_object(key, new_row -> key);
      end if;
    end loop;
    if after_values = '{}'::jsonb then
      return null;
    end if;
  end if;

  -- Who may see it: like the rows themselves.
  if tg_table_name = 'notes' then
    -- A note carries its own audience (copied from the entry it was added to).
    who_sees := this_row ->> 'audience';
    owner := (this_row ->> 'owner_user_id')::uuid;
  elsif tg_table_name in ('invites', 'actor_secrets', 'campaign_pack_secrets', 'library_entry_secrets', 'inventory_line_secrets') then
    who_sees := 'gm';
  elsif tg_table_name = 'library_entries'
    and (not private.player_facing(this_row ->> 'kind')
         or (this_row ->> 'kind' = 'item' and not private.for_sale(this_row -> 'data'))) then
    -- Like reading the entries: stat blocks, tables, treasure and the rest are the GM's; so is an item that isn't
    -- for sale (players may know it, but its changes are the GM's to tell).
    who_sees := 'gm';
  elsif tg_table_name = 'assets' and this_row ->> 'kind' not in ('portrait', 'sigil') then
    who_sees := 'gm';
  elsif tg_table_name <> 'actors' and this_row ? 'actor_id' and this_row ->> 'actor_id' is not null then
    -- Something a character carries or owns (inventory lines, from M4): seen like the character itself.
    select a.approval, a.owner_type, a.owner_user_id into carrier_approval, carrier_owner_type, carrier_owner
    from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
    if coalesce(carrier_approval, '') <> 'approved' then
      if carrier_owner_type = 'user' then
        who_sees := 'owner';
        owner := carrier_owner;
      else
        who_sees := 'gm';
      end if;
    end if;
  elsif tg_table_name = 'actors'
    and coalesce(new_row ->> 'approval', '') <> 'approved'
    and coalesce(old_row ->> 'approval', '') <> 'approved' then
    if this_row ->> 'owner_type' = 'user' then
      who_sees := 'owner';
      owner := (this_row ->> 'owner_user_id')::uuid;
    else
      who_sees := 'gm';
    end if;
  end if;

  -- The command's tag, if the request has one. A broken tag just means a plain name.
  begin
    tag := convert_from(
      decode(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-grimoire-command', 'base64'),
      'UTF8'
    )::jsonb;
    request := (tag ->> 'requestId')::uuid;
  exception when others then
    tag := null;
    request := null;
  end;
  -- The database names the entry: only the commands in public.logged_commands count (GM-only ones only for
  -- the GM), at the log level listed there. Anything else gets a plain name like "actors.update".
  event_type := tag ->> 'type';
  select c.level, c.gm_only into event_level, command_gm_only from public.logged_commands c where c.name = event_type;
  if event_level is null
    or (command_gm_only and not private.is_gm(campaign))
    -- Setting rules leaving the campaign because their owner deleted them: nothing else carries that name.
    or (event_type = 'library.delete' and not (tg_table_name = 'campaign_packs' and tg_op = 'DELETE')) then
    event_type := tg_table_name || '.' || lower(tg_op);
    event_level := 'verbose';
  end if;
  -- Only the GM's changes can be fiat; a player's claim is ignored.
  if coalesce(tag ->> 'fiat', 'false') = 'true' and private.is_gm(campaign) then
    is_fiat := true;
    why := nullif(left(trim(tag ->> 'reason'), 500), '');
  end if;

  -- An undo (undo_request) links to the event it reverses, at that event's log level.
  if reverting is not null then
    select e.level into event_level from public.events e where e.id = reverting;
  end if;

  insert into public.events (
    campaign_id, type, level, actor_user_id, target_table, target_id, before, after,
    fiat, reason, audience, owner_user_id, request_id, reverts_event_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, request, reverting
  );
  return null;
end;
$$;


-- Import: as in 20261025160000_m4b_hooks_readable.sql, but an updated pack's items that aren't for sale are listed
-- in the GM's update line, not the players'.
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

