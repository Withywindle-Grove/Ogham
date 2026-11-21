-- M4 fresh-session review and code health check fixes (2026-10-24; docs/health/M4.md). Replaces four functions
-- and adds five, plus triggers. Drops nothing and deletes no data. Pinned by supabase/tests/m4-review.test.ts.
--   1. A rules set's GM-only sections can't reach players through an optional rule's overrides (byOption).
--   2. A player can't refill visible charges by blanking the count first, or set a count on hidden charges.
--   3. A player's line can't claim setting rules it doesn't come from (to skip the GM's approval), and a player
--      can't change what a line is (name, weight, slots, stack, bundle share, links) after it's made.
--   4. A line, its hidden charges and its tier stay in their campaign.
--   5. Splitting a stack is one database step that copies everything (bundle share, hidden charges).
--   7. Whether a player's new line has hidden charges comes from the campaign's setting rules, not the device.
--
-- The order of the triggers on inventory_lines matters, and Postgres runs triggers of the same timing in name
-- order. Before insert or update, today:
--   check_inventory_line, copy_item_details (fills the line from its entry; must come before the guards, so a
--   player's setting-rules item is approved and a one-off waits), guard_charges, guard_lines_from_players,
--   keep_campaign, refuse_when_retired, stamp, unpin_when_handed_on (update only).
-- After: carry_contents, log_change, mark_spent. Renaming one changes the order: supabase/tests/m4-review.test.ts
-- lists them, so a rename fails a test first.

-- 1. What a player may see of a rules set's optional-rule overrides: each override without the GM-only sections
--    (monsters, magicItems except its charges, procedures, any section the rules set marks gmOnly, and any override
--    part marked gmOnly). `data` is the whole entry.
create function private.overrides_for_players(data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  with secret_sections as (
    select array['monsters', 'magicItems', 'procedures'] || coalesce(array(
      select e.key from jsonb_each(data) e where jsonb_typeof(e.value) = 'object' and (e.value -> 'gmOnly') = 'true'::jsonb
    ), '{}') as names
  )
  select coalesce(jsonb_object_agg(o.key,
      case when jsonb_typeof(o.value) = 'object' then
        (o.value - (select names from secret_sections) - coalesce(array(
          select p.key from jsonb_each(o.value) p where jsonb_typeof(p.value) = 'object' and (p.value -> 'gmOnly') = 'true'::jsonb
        ), '{}'))
        || case when jsonb_typeof(o.value -> 'magicItems' -> 'charges') = 'object'
             then jsonb_build_object('magicItems', jsonb_build_object('charges', o.value -> 'magicItems' -> 'charges'))
             else '{}'::jsonb end
      else o.value end), '{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(data -> 'byOption') = 'object' then data -> 'byOption' else '{}'::jsonb end) o;
$$;
grant execute on function private.overrides_for_players(jsonb) to authenticated, service_role;

-- As in 20261023160000_m4_rules_sets_readable.sql, plus byOption when its overrides hold anything GM-only (the
-- whole of it goes to the hidden part; players get it without the GM-only sections, below).
create or replace function private.hidden_keys(kind text, data jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select array(
    select distinct k from (
      select jsonb_array_elements_text(case when jsonb_typeof(data -> 'gmOnly') = 'array' then data -> 'gmOnly' else '[]'::jsonb end) as k
      union all
      select e.key from jsonb_each(case when kind = 'rulesSet' then data else '{}'::jsonb end) e
      where e.key in ('monsters', 'magicItems', 'procedures')
        or (jsonb_typeof(e.value) = 'object' and (e.value -> 'gmOnly') = 'true'::jsonb)
      union all
      select 'byOption' where kind = 'rulesSet' and jsonb_typeof(data -> 'byOption') = 'object'
        and private.overrides_for_players(data) is distinct from data -> 'byOption'
    ) keys
  );
$$;

-- As in 20261023200000_m4_charges.sql, plus the overrides without their GM-only sections.
create or replace function private.visible_of(kind text, data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select (data - private.hidden_keys(kind, data) - 'gmOnly')
    || case
         when kind = 'rulesSet' and jsonb_typeof(data -> 'magicItems' -> 'charges') = 'object'
           then jsonb_build_object('magicItems', jsonb_build_object('charges', data -> 'magicItems' -> 'charges'))
         else '{}'::jsonb
       end
    || case
         when kind = 'rulesSet' and 'byOption' = any (private.hidden_keys(kind, data))
           then jsonb_build_object('byOption', private.overrides_for_players(data))
         else '{}'::jsonb
       end;
$$;

-- Existing rules sets whose overrides hold GM-only sections: the whole overrides go with the hidden part, and
-- players keep the rest. Worked out on the whole entry (its hidden part added back); the split is paused, as
-- this isn't a change anyone made.
alter table public.library_entries disable trigger split_hidden_fields;
alter table public.library_entries disable trigger log_change;
alter table public.library_entries disable trigger refuse_when_retired;
with whole as (
  select e.id, e.pack_id, e.data || coalesce(s.data, '{}'::jsonb) as data
  from public.library_entries e left join public.library_entry_secrets s on s.id = e.id
  where e.kind = 'rulesSet' and jsonb_typeof(e.data -> 'byOption') = 'object'
), leaking as (
  select w.id, w.pack_id, w.data from whole w where private.overrides_for_players(w.data) is distinct from w.data -> 'byOption'
), kept as (
  insert into public.library_entry_secrets as s (id, pack_id, data)
  select l.id, l.pack_id, jsonb_build_object('byOption', l.data -> 'byOption') from leaking l
  on conflict (id) do update set data = s.data || excluded.data
  returning s.id
)
update public.library_entries e
  set data = jsonb_set(e.data, '{byOption}', private.overrides_for_players(l.data))
  from leaking l
  where e.id = l.id;
alter table public.library_entries enable trigger refuse_when_retired;
alter table public.library_entries enable trigger log_change;
alter table public.library_entries enable trigger split_hidden_fields;

-- 7. Whether a new line's charges are hidden, from the campaign's setting rules: the top rules set that says
--    (magicItems.charges.hidden), for an item that has charges (its own, or dice for its category). The top-level
--    switch only; an optional rule that changes it isn't read here (none known).
create function private.charges_hidden_for(campaign uuid, category text, item jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  with charge_rules as (
    select e.data -> 'magicItems' -> 'charges' as charges, cp.priority
    from public.campaign_packs cp
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'rulesSet'
    where cp.campaign_id = campaign and jsonb_typeof(e.data -> 'magicItems' -> 'charges') = 'object'
  )
  select coalesce(
    (select (r.charges ->> 'hidden')::boolean from charge_rules r where jsonb_typeof(r.charges -> 'hidden') = 'boolean'
     order by r.priority desc limit 1),
    false)
  and (
    jsonb_typeof(item -> 'charges') = 'object'
    or exists (select 1 from charge_rules r where jsonb_typeof(r.charges -> category) = 'string')
  );
$$;
grant execute on function private.charges_hidden_for(uuid, text, jsonb) to authenticated, service_role;

-- 2 and 7. As in 20261024090000_m4_charge_rolls.sql, plus: a player's new line gets its hidden-charges switch from
-- the setting rules; a count can't be blanked (that let any number be set "once" again); a player never sets a
-- count on hidden charges.
create or replace function private.guard_charges() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.charges_left is not null or new.charges_used <> 0 or new.spent_shown or new.last_roll is not null then
      raise exception 'Only the GM sets charges that way.' using errcode = '42501';
    end if;
    new.charges_hidden := private.charges_hidden_for(new.campaign_id, new.category, new.item_data);
    return new;
  end if;
  if (new.charges_left is distinct from old.charges_left
        and (new.charges_hidden or not coalesce(old.charges_left is null or new.charges_left = old.charges_left - 1, false)))
    or (new.charges_used <> old.charges_used and new.charges_used <> old.charges_used + 1)
    or new.charges_hidden is distinct from old.charges_hidden
    or new.spent_shown is distinct from old.spent_shown
    or (new.last_roll is distinct from old.last_roll and old.charges_left is not null) then
    raise exception 'Only the GM changes charges that way.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 3. As in 20261024120000_m4_add_item_rulings.sql, plus: a player's line that names an entry this campaign
--    doesn't have is refused (it used to keep the device's copy, approved).
create or replace function private.copy_item_details() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.library_entries;
  whole_number constant text := '^[0-9]+$';
begin
  -- Once made, only the GM changes what a line says about its item (revealing a hidden field to its holder).
  if tg_op = 'UPDATE' and new.item_data is distinct from old.item_data
    and new.library_entry_id is not distinct from old.library_entry_id
    and (select auth.uid()) is not null and not private.is_gm(new.campaign_id) then
    raise exception 'Only the GM can change what an item says about itself.' using errcode = '42501';
  end if;
  if new.library_entry_id is not null
    and (tg_op = 'INSERT' or new.library_entry_id is distinct from old.library_entry_id) then
    select e.* into entry from public.library_entries e where e.id = new.library_entry_id;
    if entry.id is not null then
      -- Only an item, and only from setting rules this campaign uses.
      if entry.kind <> 'item' or not exists (
        select 1 from public.campaign_packs cp where cp.campaign_id = new.campaign_id and cp.pack_id = entry.pack_id
      ) then
        raise exception 'That item isn''t in this campaign''s setting rules.';
      end if;
      new.item_data := entry.data;
      new.name := entry.name;
      new.category := left(coalesce(entry.data ->> 'category', ''), 60);
      new.weight_coin := case when entry.data ->> 'weightCoin' ~ whole_number then (entry.data ->> 'weightCoin')::integer end;
      new.slots := case when entry.data ->> 'slots' ~ whole_number then (entry.data ->> 'slots')::integer end;
      new.stack := case when entry.data ->> 'stack' ~ whole_number and (entry.data ->> 'stack')::integer >= 1 then (entry.data ->> 'stack')::integer else 1 end;
      -- A bundle ("Torches (6)") arrives as its units ("Torch"); its weight is for the whole bundle.
      if entry.data ->> 'bundle' ~ whole_number and (entry.data ->> 'bundle')::integer > 1 then
        new.per_units := (entry.data ->> 'bundle')::integer;
        new.name := coalesce(nullif(trim(entry.data ->> 'unitName'), ''), entry.name);
      end if;
      new.source_pack_id := entry.pack_id;
      new.source_entry_id := entry.pack_entry_id;
      return new;
    end if;
    -- The entry is gone (its setting rules were updated or deleted): the line keeps the copy it carries. A
    -- player's device never names an entry that isn't there.
    if (select auth.uid()) is not null and not private.is_gm(new.campaign_id)
      and nullif(current_setting('grimoire.reverting', true), '') is null then
      raise exception 'That item isn''t in this campaign''s setting rules.';
    end if;
  end if;
  -- A one-off, or a copy carried over: never anything its own gmOnly list hides.
  new.item_data := private.visible_part(new.item_data);
  if new.library_entry_id is null and tg_op = 'INSERT' and new.source_pack_id is null then
    new.source_entry_id := null;
  end if;
  return new;
end;
$$;

-- 3. As in 20261024120000_m4_add_item_rulings.sql, plus: a player's new line claims setting rules only through
--    its entry, or as a split of a line that has them (split_inventory_line below); and once made, a player
--    changes where a line is, how many and how it's worn, never what it is.
create or replace function private.guard_lines_from_players() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.how_got = 'given' then
      raise exception 'Only the GM gives items.' using errcode = '42501';
    end if;
    if new.library_entry_id is null and new.source_pack_id is not null
      and nullif(current_setting('grimoire.splitting', true), '') is null then
      raise exception 'That item isn''t in this campaign''s setting rules.' using errcode = '42501';
    end if;
    -- A one-off (from no setting rules) waits for the GM.
    if new.library_entry_id is null and new.source_pack_id is null then
      new.approval := 'pending';
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
  return new;
end;
$$;

-- 4. Rows stay in their campaign (moving one would be logged only in the new campaign).
create function private.keep_campaign() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'That stays in its campaign.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger keep_campaign before update on public.inventory_lines
  for each row execute function private.keep_campaign();
create trigger keep_campaign before update on public.inventory_line_secrets
  for each row execute function private.keep_campaign();
create trigger keep_campaign before update on public.carrier_loads
  for each row execute function private.keep_campaign();

-- 5. Part of a stack as its own line, in one step: the rest stays, and the copy keeps everything the line says
--    (bundle share, hidden charges, revealed fields, approval rules), made on the same carrier so the caller's
--    access rules check it like any other change. A GM's gift becomes "found" when a player splits it.
create function public.split_inventory_line(line uuid, how_many integer) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  source public.inventory_lines;
  made uuid;
begin
  select * into source from public.inventory_lines l where l.id = line for update;
  if source.id is null then
    raise exception 'That item isn''t there any more.';
  end if;
  if how_many is null or how_many < 1 or how_many >= source.qty then
    raise exception 'How many must be a whole number from 1 to %.', source.qty - 1;
  end if;
  perform set_config('grimoire.splitting', source.id::text, true);
  update public.inventory_lines set qty = source.qty - how_many where id = source.id;
  insert into public.inventory_lines (
    campaign_id, actor_id, location_id, library_entry_id, name, category, weight_coin, slots, stack, per_units,
    qty, how_got, cost, notes, item_data, source_pack_id, source_entry_id, charges_hidden, approval)
  values (
    source.campaign_id, source.actor_id, source.location_id, null, source.name, source.category, source.weight_coin,
    source.slots, source.stack, source.per_units, how_many,
    case when source.how_got = 'given' and not private.is_gm(source.campaign_id) then 'found' else source.how_got end,
    source.cost, source.notes, source.item_data, source.source_pack_id, source.source_entry_id, source.charges_hidden,
    source.approval)
  returning id into made;
  perform set_config('grimoire.splitting', '', true);
  return made;
end;
$$;
revoke execute on function public.split_inventory_line(uuid, integer) from public, anon;
grant execute on function public.split_inventory_line(uuid, integer) to authenticated, service_role;

-- The triggers on inventory_lines in the order they run, for the test that pins it (service role only).
create function public.inventory_line_triggers() returns table (name text, timing text)
language sql stable security invoker set search_path = '' as $$
  select t.tgname::text, case when (t.tgtype & 2) <> 0 then 'before' else 'after' end
  from pg_catalog.pg_trigger t
  where t.tgrelid = 'public.inventory_lines'::regclass and not t.tgisinternal
  order by 2 desc, 1;
$$;
revoke execute on function public.inventory_line_triggers() from public, anon, authenticated;
grant execute on function public.inventory_line_triggers() to service_role;
