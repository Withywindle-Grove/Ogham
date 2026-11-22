-- K22a (docs/plans/k22-reveal.md; ruling docs/design/rulings/k22-reveal-2026-11-21.md; Francis's answers of
-- 2026-11-22: ⚑ 1 the database hides an untold fact, ⚑ 3 lines already in play stay as they are, ⚑ 4 a category's
-- `singular`, ⚑ 5 a pack's `looks` travels on the face, ⚑ 9 an unidentified line joins only the same entry with the same
-- facts told): an unidentified item's face, held by the database.
--
-- What it changes, plainly.
--   Four columns on public.inventory_lines: identified (default true, so every line already in play stays exactly as it
--     is), appears_as and noticed (words, may be empty), revealed_fields (the facts told on this line, default none).
--     No existing row is rewritten (⚑ 3 = a).
--   A line made from a setting-rules entry that starts unidentified (a category a rules set of the campaign marks
--     `unidentified: true`, or a cursed item: `cursed: true`, or a negative magic bonus) is stored as its face:
--     identified false; appears_as and noticed from the entry; its name the face (appears_as, else the category's
--     singular name); its item_data the entry's visible part less every hidden fact (the true name, a bonus, powers,
--     the curse, labelled hidden fields, visible fields that carry a fact in words (Bonus, Curse, Cursed, Charges,
--     Magic, Power, Powers), the item's own description, notes and source).
--   A patch that changes such an item's truth is the GM's alone, as a patch on a gmOnly field already is
--     (private.patch_hides_target_field, read by the library, a player's plain read, the log and a pack update's line).
--   An Undo of a tell is refused, with its reason, once part of the line was split off since (the part keeps the told
--     facts and the Undo can't reach it).
--   A player's read of such an entry gets the same face: public.campaign_library returns the face's name and data, and
--     the read rule on library_entries no longer lets a player's plain select reach the entry's row (it is read
--     through campaign_library). The GM's and the pack owner's reads are unchanged.
--   A split part keeps its line's face (public.split_inventory_line copies the four columns).
--   A same-name stack takes an unidentified or partly told thing only when it is the same entry with the same facts
--     told and the same words (⚑ 9 = b): public.join_added_line and public.move_into_stack check it.
--   Only the GM sets the four columns; a player's change or a player's new line with them set is refused (42501).
--   One bump of every campaign's seen stamp, so a device holding an old full copy of an entry fetches the face.
-- Read rules that change: "library entries: owner or campaigns using the pack read" (dropped and made again under its
--   own name): a player no longer reads an entry that starts unidentified in a campaign they play in (not as GM). And,
--   through private.patch_hides_target_field: a player no longer reads a patch that changes an unidentified item's
--   truth (in the library, by a plain read, in the log or a pack update's line).
-- Drops, renames or deletes no data.
--
-- builds on: private.copy_item_details from 20261024230000_m4_review_fixes.sql
-- builds on: public.split_inventory_line from 20261029160000_m5_intents.sql
-- builds on: public.join_added_line from 20261121120000_q2_stacks_join.sql
-- builds on: public.move_into_stack from 20261121120000_q2_stacks_join.sql
-- builds on: public.campaign_library from 20261115002000_dec_12e_rumours_gm_only.sql
-- builds on: private.patch_hides_target_field from 20261111110000_fix_hidden_data_cache_and_patches.sql

-- 1. The columns ---------------------------------------------------------------------------------------------------------

alter table public.inventory_lines
  add column identified boolean not null default true,
  add column appears_as text not null default '' check (char_length(appears_as) <= 200),
  add column noticed text not null default '' check (char_length(noticed) <= 2000),
  add column revealed_fields text[] not null default '{}' check (cardinality(revealed_fields) <= 200);

-- 2. Helpers ---------------------------------------------------------------------------------------------------------------

-- The categories any rules set of the campaign marks `unidentified: true` (07, itemCategories).
create function private.unidentified_categories(campaign uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct c ->> 'id'), '{}')
  from public.campaign_packs cp
  join public.library_entries r on r.pack_id = cp.pack_id and r.kind = 'rulesSet'
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(r.data -> 'itemCategories') = 'array' then r.data -> 'itemCategories' else '[]'::jsonb end) c
  where cp.campaign_id = campaign and jsonb_typeof(c) = 'object' and (c -> 'unidentified') = 'true'::jsonb
    and jsonb_typeof(c -> 'id') = 'string';
$$;
revoke execute on function private.unidentified_categories(uuid) from public, anon;
grant execute on function private.unidentified_categories(uuid) to authenticated, service_role;

-- Whether an item (its whole entry: visible part and hidden part) starts unidentified, given the campaign's
-- unidentified categories: in one of them, or cursed (`cursed: true`, or a negative magic bonus, as play.ts reads one).
create function private.is_masked(whole jsonb, unidentified text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce((whole -> 'cursed') = 'true'::jsonb, false)
    or coalesce(jsonb_typeof(whole #> '{weapon,magicBonus}') = 'number' and (whole #>> '{weapon,magicBonus}')::numeric < 0, false)
    or coalesce(jsonb_typeof(whole #> '{armour,magicBonus}') = 'number' and (whole #>> '{armour,magicBonus}')::numeric < 0, false)
    or coalesce(whole ->> 'category', '') = any (coalesce(unidentified, '{}'));
$$;
revoke execute on function private.is_masked(jsonb, text[]) from public, anon;
grant execute on function private.is_masked(jsonb, text[]) to authenticated, service_role;

create function private.starts_unidentified(campaign uuid, whole jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_masked(whole, private.unidentified_categories(campaign));
$$;
revoke execute on function private.starts_unidentified(uuid, jsonb) from public, anon;
grant execute on function private.starts_unidentified(uuid, jsonb) to authenticated, service_role;

-- An entry's whole data: its visible part with its hidden part laid over (the GM's view of it).
create function private.entry_whole(entry uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select e.data || coalesce((select s.data from public.library_entry_secrets s where s.id = e.id), '{}'::jsonb)
  from public.library_entries e where e.id = entry;
$$;
revoke execute on function private.entry_whole(uuid) from public, anon;
grant execute on function private.entry_whole(uuid) to authenticated, service_role;

-- A category's singular name (⚑ 4): the highest rules set's `singular` for it, else its `name` as given, else the id
-- tidied ("magic-misc" → "Magic misc"), else "Item".
create function private.category_singular(campaign uuid, category text) returns text
language sql stable security definer set search_path = '' as $$
  select left(coalesce(
    (select coalesce(nullif(btrim(c ->> 'singular'), ''), nullif(btrim(c ->> 'name'), ''))
     from public.campaign_packs cp
     join public.library_entries r on r.pack_id = cp.pack_id and r.kind = 'rulesSet'
     cross join lateral jsonb_array_elements(
       case when jsonb_typeof(r.data -> 'itemCategories') = 'array' then r.data -> 'itemCategories' else '[]'::jsonb end) c
     where cp.campaign_id = campaign and jsonb_typeof(c) = 'object' and c ->> 'id' = category
       and coalesce(nullif(btrim(c ->> 'singular'), ''), nullif(btrim(c ->> 'name'), '')) is not null
     order by cp.priority desc
     limit 1),
    nullif(upper(left(btrim(translate(coalesce(category, ''), '-_', '  ')), 1)) || substr(btrim(translate(coalesce(category, ''), '-_', '  ')), 2), ''),
    'Item'), 200);
$$;
revoke execute on function private.category_singular(uuid, text) from public, anon;
grant execute on function private.category_singular(uuid, text) to authenticated, service_role;

-- The custom fields a setting hides by label (07: `"fields.<label>"` in gmOnly; the whole `fields` block hidden hides
-- every label in it).
create function private.hidden_labels(whole jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select array(
    -- In code-point order, as the app's sort() puts them (src/modules/inventory/hiddenFacts.ts).
    select x.label collate "C" from (
      select substr(g, 8) as label
      from jsonb_array_elements_text(case when jsonb_typeof(whole -> 'gmOnly') = 'array' then whole -> 'gmOnly' else '[]'::jsonb end) g
      where g like 'fields.%' and length(g) > 7
      union
      select f.key from jsonb_each(case when jsonb_typeof(whole -> 'fields') = 'object' then whole -> 'fields' else '{}'::jsonb end) f
      where coalesce(whole -> 'gmOnly' ? 'fields', false)
    ) x
    order by 1
  );
$$;
revoke execute on function private.hidden_labels(jsonb) from public, anon;
grant execute on function private.hidden_labels(jsonb) to authenticated, service_role;

-- The custom fields a setting leaves visible that carry a hidden fact in words (07 lets `fields.Bonus` carry the bonus,
-- mw-1), by label, case and spaces aside: Bonus (the bonus), Curse and Cursed (the curse), Charges, Magic, Power and
-- Powers. They are off an unidentified item's face and come back with their fact (Power and Powers once every power is
-- told; any of them once nothing is left hidden). Review of #40, finding 4.
create function private.fact_fields(whole jsonb) returns table (label text, fact text)
language sql immutable set search_path = '' as $$
  select f.key,
    case lower(btrim(f.key))
      when 'bonus' then 'bonus'
      when 'curse' then 'cursed'
      when 'cursed' then 'cursed'
      when 'charges' then 'charges'
      when 'magic' then 'magic'
      else 'powers'
    end
  from jsonb_each(case when jsonb_typeof(whole -> 'fields') = 'object' then whole -> 'fields' else '{}'::jsonb end) f
  where lower(btrim(f.key)) in ('bonus', 'curse', 'cursed', 'charges', 'magic', 'power', 'powers');
$$;
revoke execute on function private.fact_fields(jsonb) from public, anon;
grant execute on function private.fact_fields(jsonb) to authenticated, service_role;

-- Whether an item is magic, for "That it's magic" (⚑ 6, read as written): a magic category (`magic` or `magic-…`, as
-- 07's forSale rule), or any item with a bonus or powers.
create function private.is_magic(whole jsonb, category text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(category, '') ~ '^magic(-|$)'
    or whole ? 'bonus'
    or coalesce(whole -> 'weapon' ? 'magicBonus' or whole -> 'weapon' ? 'bonusVs', false)
    or coalesce(whole -> 'armour' ? 'magicBonus' or whole -> 'armour' ? 'bonusVs', false)
    or coalesce(jsonb_typeof(whole -> 'properties') = 'array' and jsonb_array_length(whole -> 'properties') > 0, false)
    -- A bonus, magic or powers said in a visible field's words (review of #40, finding 4).
    or exists (select 1 from private.fact_fields(whole) ff where ff.fact in ('bonus', 'magic', 'powers'));
$$;
revoke execute on function private.is_magic(jsonb, text) from public, anon;
grant execute on function private.is_magic(jsonb, text) to authenticated, service_role;

-- The face's details: the entry's visible part less every hidden fact (the true name, a bonus, powers, the curse,
-- labelled hidden fields, the visible fields that carry a fact in words, the item's own words and source, its
-- one-unit and plural names), and less the two words that now live on the line's own columns. A pack's `looks` (⚑ 5)
-- stays: it is the look players see.
create function private.item_face_data(whole jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select f.d
    || case when jsonb_typeof(f.d -> 'weapon') = 'object'
         then jsonb_build_object('weapon', (f.d -> 'weapon') - 'magicBonus' - 'bonusVs') else '{}'::jsonb end
    || case when jsonb_typeof(f.d -> 'armour') = 'object'
         then jsonb_build_object('armour', (f.d -> 'armour') - 'magicBonus' - 'bonusVs') else '{}'::jsonb end
    || case when jsonb_typeof(f.d -> 'fields') = 'object'
         then jsonb_build_object('fields', (f.d -> 'fields') - private.hidden_labels(whole)
           - array(select ff.label from private.fact_fields(whole) ff)) else '{}'::jsonb end
  from (
    select private.visible_part(coalesce(whole, '{}'::jsonb))
      - array['name', 'bonus', 'cursed', 'properties', 'description', 'source', 'notes', 'appearsAs', 'noticed',
              'unitName', 'pluralName'] as d
  ) f;
$$;
revoke execute on function private.item_face_data(jsonb) from public, anon;
grant execute on function private.item_face_data(jsonb) to authenticated, service_role;

-- The face's name: what it appears as, else its category's singular name.
create function private.face_name(campaign uuid, appears text, category text) returns text
language sql stable security definer set search_path = '' as $$
  select left(coalesce(nullif(btrim(coalesce(appears, '')), ''), private.category_singular(campaign, category)), 200);
$$;
revoke execute on function private.face_name(uuid, text, text) from public, anon;
grant execute on function private.face_name(uuid, text, text) to authenticated, service_role;

-- The facts still hidden on a line, in the Reveal pop-up's order (k22-4; mirrored by
-- src/modules/inventory/hiddenFacts.ts): "magic" (an unidentified magic item, not told yet), "name" (not identified),
-- "bonus" (a part of the entry's bonus the line hasn't), "power:<n>" (each of the entry's powers, from 0, the line
-- hasn't), "cursed", "charges" (hidden charges), "fields.<label>" (each labelled hidden field the line hasn't). GM notes
-- are never a fact. `whole` is null when the entry is gone: only the line's own facts remain.
create function private.hidden_facts(
  identified boolean, revealed text[], data jsonb, charges_hidden boolean, category text, whole jsonb
) returns text[]
language sql immutable set search_path = '' as $$
  select array(
    select x.fact from (
      select 1 as o, 0::bigint as i, 'magic' as fact
      where not identified and whole is not null and private.is_magic(whole, category)
        and not ('magic' = any (coalesce(revealed, '{}')))
      union all
      select 2, 0, 'name' where not identified
      union all
      select 3, 0, 'bonus'
      where whole is not null and (exists (
        select 1 from (values (array['bonus']), (array['weapon', 'magicBonus']), (array['weapon', 'bonusVs']),
                              (array['armour', 'magicBonus']), (array['armour', 'bonusVs'])) p(path)
        where whole #> p.path is not null and coalesce(data, '{}'::jsonb) #> p.path is null)
        or exists (select 1 from private.fact_fields(whole) ff where ff.fact = 'bonus' and not coalesce(data -> 'fields' ? ff.label, false)))
      union all
      select 4, p.i, 'power:' || (p.i - 1)
      from jsonb_array_elements(case when jsonb_typeof(whole -> 'properties') = 'array' then whole -> 'properties' else '[]'::jsonb end)
        with ordinality p(v, i)
      where not coalesce(jsonb_typeof(data -> 'properties') = 'array' and (data -> 'properties') @> jsonb_build_array(p.v), false)
      union all
      select 5, 0, 'cursed'
      where ((whole -> 'cursed') = 'true'::jsonb and (data -> 'cursed') is distinct from 'true'::jsonb)
        or exists (select 1 from private.fact_fields(whole) ff where ff.fact = 'cursed' and not coalesce(data -> 'fields' ? ff.label, false))
      union all
      select 6, 0, 'charges' where charges_hidden
      union all
      select 7, h.i, 'fields.' || h.label
      from unnest(private.hidden_labels(whole)) with ordinality h(label, i)
      where coalesce(whole -> 'fields' ? h.label, false) and not coalesce(data -> 'fields' ? h.label, false)
    ) x
    order by x.o, x.i
  );
$$;
revoke execute on function private.hidden_facts(boolean, text[], jsonb, boolean, text, jsonb) from public, anon;
grant execute on function private.hidden_facts(boolean, text[], jsonb, boolean, text, jsonb) to authenticated, service_role;

-- Two lines may be one stack (⚑ 9 = b): both plain (identified, nothing told on them), or the same entry with the same
-- facts told and the same words. An unidentified line never joins a plain same-name stack.
create function private.same_face(a public.inventory_lines, b public.inventory_lines) returns boolean
language sql immutable set search_path = '' as $$
  select (a.identified and b.identified and cardinality(a.revealed_fields) = 0 and cardinality(b.revealed_fields) = 0)
    or (a.source_pack_id is not distinct from b.source_pack_id and a.source_entry_id is not distinct from b.source_entry_id
        and a.source_entry_id is not null
        and a.identified = b.identified
        and array(select distinct f from unnest(a.revealed_fields) f order by f) = array(select distinct f from unnest(b.revealed_fields) f order by f)
        and a.appears_as = b.appears_as and a.noticed = b.noticed);
$$;
revoke execute on function private.same_face(public.inventory_lines, public.inventory_lines) from public, anon;
grant execute on function private.same_face(public.inventory_lines, public.inventory_lines) to authenticated, service_role;

-- 3. Only the GM sets what players see of an item ---------------------------------------------------------------------
-- Named to run before copy_item_details (before-triggers run in name order), which then fills a setting-rules line's
-- four columns from its entry whatever the device sent. A split part copies its line's (grimoire.splitting), and an
-- Undo puts a line back as the log kept it (grimoire.reverting): a copy kept before these columns existed has none, so
-- they take their defaults (a NOT NULL check runs after this trigger).

-- One more check, on an Undo that takes told facts back (K22b; review of #40, finding 1): once part of the line was split
-- off since the tell (handed to someone, put in a bag, given out of the party), that part and its own log line carry the
-- told facts, which an Undo of the tell can't reach; the Undo is refused with its reason rather than leave a player's read
-- holding a fact the GM hid again.
create function private.check_face() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  told public.events;
begin
  new.identified := coalesce(new.identified, true);
  new.appears_as := coalesce(new.appears_as, '');
  new.noticed := coalesce(new.noticed, '');
  new.revealed_fields := coalesce(new.revealed_fields, '{}');
  if tg_op = 'UPDATE' and nullif(current_setting('grimoire.reverting', true), '') is not null
    and not (old.revealed_fields <@ new.revealed_fields) then
    select * into told from public.events e where e.id = current_setting('grimoire.reverting', true)::uuid;
    if told.type in ('inventory.tell', 'inventory.reveal') and told.target_id = new.id and exists (
      select 1 from public.events s
      where s.campaign_id = new.campaign_id and s.target_table = 'inventory_lines' and s.target_id = new.id
        and s.seq > told.seq and s.request_id is not null
        and s.before ? 'qty' and s.after ? 'qty' and (s.after ->> 'qty')::integer < (s.before ->> 'qty')::integer
        and exists (
          select 1 from public.events p
          where p.campaign_id = s.campaign_id and p.request_id = s.request_id and p.target_table = 'inventory_lines'
            and p.before is null and p.target_id is distinct from new.id)
    ) then
      raise exception 'Some of it was split off and handed on since, so what was told can''t be hidden again.';
    end if;
  end if;
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null
    or nullif(current_setting('grimoire.splitting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not new.identified or new.appears_as <> '' or new.noticed <> '' or cardinality(new.revealed_fields) > 0 then
      raise exception 'Only the GM changes what players see of an item.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.identified is distinct from old.identified or new.appears_as is distinct from old.appears_as
    or new.noticed is distinct from old.noticed or new.revealed_fields is distinct from old.revealed_fields then
    raise exception 'Only the GM changes what players see of an item.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_face() from public, anon, authenticated;

create trigger check_face before insert or update on public.inventory_lines
  for each row execute function private.check_face();

-- 4. The line's copy of its item --------------------------------------------------------------------------------------
-- As in 20261024230000_m4_review_fixes.sql, plus: a line made from an entry that starts unidentified in its campaign is
-- stored as its face (identified false, the face's name and details, the entry's appearsAs and noticed); any other is
-- identified with nothing told. Everything else is unchanged.

create or replace function private.copy_item_details() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.library_entries;
  whole jsonb;
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
      -- K22a: an item that starts unidentified arrives as its face; nothing of its truth is on the line.
      whole := entry.data || coalesce((select s.data from public.library_entry_secrets s where s.id = entry.id), '{}'::jsonb);
      new.revealed_fields := '{}';
      if private.starts_unidentified(new.campaign_id, whole) then
        new.identified := false;
        new.appears_as := left(btrim(coalesce(whole ->> 'appearsAs', '')), 200);
        new.noticed := left(btrim(coalesce(whole ->> 'noticed', '')), 2000);
        new.item_data := private.item_face_data(whole);
        new.name := private.face_name(new.campaign_id, new.appears_as, new.category);
      else
        new.identified := true;
        new.appears_as := '';
        new.noticed := '';
      end if;
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

-- 5. A split part keeps its line's face -------------------------------------------------------------------------------
-- As in 20261029160000_m5_intents.sql, plus the four columns copied onto the part.

create or replace function public.split_inventory_line(line uuid, how_many integer, seen_version integer default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  source public.inventory_lines;
  made uuid;
  tag jsonb := private.request_tag();
begin
  begin
    select e.target_id into made from public.events e
    where e.request_id = (tag ->> 'requestId')::uuid and e.request_part = (tag ->> 'part')::integer
      and e.target_table = 'inventory_lines' and e.before is null and e.actor_user_id is not distinct from (select auth.uid())
      and e.created_at < now()
    order by e.seq limit 1;
  exception when others then
    made := null;
  end;
  if made is not null then
    return made;
  end if;
  select * into source from public.inventory_lines l where l.id = line for update;
  if source.id is null then
    raise exception 'That item isn''t there any more.';
  end if;
  if seen_version is not null and seen_version <> source.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  if how_many is null or how_many < 1 or how_many >= source.qty then
    raise exception 'How many must be a whole number from 1 to %.', source.qty - 1;
  end if;
  perform set_config('grimoire.splitting', source.id::text, true);
  update public.inventory_lines set qty = source.qty - how_many where id = source.id;
  insert into public.inventory_lines (
    campaign_id, actor_id, location_id, library_entry_id, name, category, weight_coin, slots, stack, per_units,
    qty, how_got, cost, notes, item_data, source_pack_id, source_entry_id, charges_hidden, approval,
    identified, appears_as, noticed, revealed_fields)
  values (
    source.campaign_id, source.actor_id, source.location_id, null, source.name, source.category, source.weight_coin,
    source.slots, source.stack, source.per_units, how_many,
    case when source.how_got = 'given' and not private.is_gm(source.campaign_id) then 'found' else source.how_got end,
    source.cost, source.notes, source.item_data, source.source_pack_id, source.source_entry_id, source.charges_hidden,
    source.approval, source.identified, source.appears_as, source.noticed, source.revealed_fields)
  returning id into made;
  perform set_config('grimoire.splitting', '', true);
  return made;
end;
$$;

-- 6. Joining a stack (⚑ 9 = b) -----------------------------------------------------------------------------------------
-- As in 20261121120000_q2_stacks_join.sql, plus: the thing added is read as its line would be (its face when it starts
-- unidentified), and a stack takes it only when private.same_face says the two are one.

create or replace function public.join_added_line(
  campaign uuid, actor uuid, location uuid, container uuid, entry uuid, how_many integer, made_id uuid,
  how_got text default 'found', cost text default '', note text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  done boolean;
  joined uuid;
  item public.library_entries;
  item_name text;
  item_stack integer;
  target public.inventory_lines;
  whole jsonb;
  added public.inventory_lines;
begin
  select r.done, r.line into done, joined from private.request_join_done() r;
  if done then
    return joined;
  end if;
  if how_many is null or how_many < 1 or entry is null
    or coalesce(how_got, '') not in ('bought', 'found', 'given')
    or (how_got = 'given' and not private.is_gm(campaign))
    or exists (select 1 from public.inventory_lines l where l.id = made_id)
    or not private.may_change_carrier(campaign, actor, location) then
    return null;
  end if;
  select e.* into item from public.library_entries e where e.id = entry;
  if item.id is null or item.kind <> 'item' or (item.data ? 'charges')
    or not exists (select 1 from public.campaign_packs cp where cp.campaign_id = campaign and cp.pack_id = item.pack_id) then
    return null;
  end if;
  -- As private.copy_item_details names and counts the new line.
  item_name := item.name;
  if item.data ->> 'bundle' ~ '^[0-9]+$' and (item.data ->> 'bundle')::integer > 1 then
    item_name := coalesce(nullif(trim(item.data ->> 'unitName'), ''), item.name);
  end if;
  item_stack := case when item.data ->> 'stack' ~ '^[0-9]+$' then (item.data ->> 'stack')::integer else 1 end;
  -- Only a thing carried in numbers joins (sw-10): several to a slot (07's stack) or sold in a bundle (07's bundle).
  if item_stack <= 1 and not (item.data ->> 'bundle' ~ '^[0-9]+$' and (item.data ->> 'bundle')::integer > 1) then
    return null;
  end if;
  -- The line it would make, as private.copy_item_details would make it (K22a): its face when it starts unidentified.
  whole := item.data || coalesce((select s.data from public.library_entry_secrets s where s.id = item.id), '{}'::jsonb);
  added.source_pack_id := item.pack_id;
  added.source_entry_id := item.pack_entry_id;
  added.revealed_fields := '{}';
  if private.starts_unidentified(campaign, whole) then
    added.identified := false;
    added.appears_as := left(btrim(coalesce(whole ->> 'appearsAs', '')), 200);
    added.noticed := left(btrim(coalesce(whole ->> 'noticed', '')), 2000);
    item_name := private.face_name(campaign, added.appears_as, left(coalesce(item.data ->> 'category', ''), 60));
  else
    added.identified := true;
    added.appears_as := '';
    added.noticed := '';
  end if;
  select l.* into target from public.inventory_lines l
  where l.campaign_id = campaign and l.actor_id is not distinct from actor and l.location_id is not distinct from location
    and l.container_line_id is not distinct from container
    and private.same_stack_name(l.name, item_name)
    and (l.stack > 1 or l.per_units > 1)
    and private.stack_joinable(l)
    and private.same_face(l, added)
    -- A character still waiting for approval keeps its lines apart: creation's records count what each pick added.
    and (actor is null or exists (select 1 from public.actors a where a.id = actor and a.approval = 'approved'))
  order by l.created_at, l.id
  limit 1
  for update;
  if target.id is null then
    return null;
  end if;
  perform set_config('grimoire.event_reason', jsonb_build_object('join', jsonb_build_object(
    'howGot', how_got,
    'cost', case when how_got = 'bought' then left(btrim(coalesce(cost, '')), 100) else '' end,
    'note', left(btrim(coalesce(note, '')), 300)))::text, true);
  update public.inventory_lines l set qty = target.qty + how_many where l.id = target.id;
  perform set_config('grimoire.event_reason', '', true);
  return target.id;
end;
$$;

create or replace function public.move_into_stack(
  line uuid, how_many integer, to_actor uuid, to_location uuid, to_container uuid, seen_version integer default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  done boolean;
  joined uuid;
  source public.inventory_lines;
  target public.inventory_lines;
begin
  select r.done, r.line into done, joined from private.request_join_done() r;
  if done then
    return joined;
  end if;
  select l.* into source from public.inventory_lines l where l.id = move_into_stack.line for update;
  -- Anything amiss is left to the move itself, which says why.
  if source.id is null or how_many is null or how_many < 1 or how_many > source.qty
    or (seen_version is not null and seen_version <> source.version)
    or not private.may_change_carrier(source.campaign_id, source.actor_id, source.location_id)
    or not private.may_receive(source.campaign_id, to_actor, to_location) then
    return null;
  end if;
  -- A one-off keeps its own line; so does a container with something in it, and anything that isn't joinable.
  if (source.library_entry_id is null and source.source_pack_id is null)
    or not private.stack_joinable(source, true)
    or exists (select 1 from public.inventory_lines c where c.container_line_id = source.id) then
    return null;
  end if;
  select l.* into target from public.inventory_lines l
  where l.campaign_id = source.campaign_id and l.actor_id is not distinct from to_actor
    and l.location_id is not distinct from to_location and l.container_line_id is not distinct from to_container
    and l.id <> source.id
    and private.same_stack_name(l.name, source.name)
    and (l.stack > 1 or l.per_units > 1) and (source.stack > 1 or source.per_units > 1)
    and private.stack_joinable(l)
    and private.same_face(l, source)
    and (to_actor is null or exists (select 1 from public.actors a where a.id = to_actor and a.approval = 'approved'))
  order by l.created_at, l.id
  limit 1
  for update;
  if target.id is null then
    return null;
  end if;
  if how_many < source.qty then
    update public.inventory_lines l set qty = source.qty - how_many where l.id = source.id;
  end if;
  update public.inventory_lines l set qty = target.qty + how_many where l.id = target.id;
  if how_many = source.qty then
    delete from public.inventory_lines l where l.id = source.id;
  end if;
  return target.id;
end;
$$;

-- 7. A player's read of an entry: its face -------------------------------------------------------------------------------

-- Whether a player reads this entry only as its face somewhere: it starts unidentified in a campaign using its pack
-- that this person plays in (not as its GM).
create function private.entry_masked_for_me(entry uuid, pack uuid, data jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_packs cp
    where cp.pack_id = pack and private.is_member(cp.campaign_id) and not private.is_gm(cp.campaign_id)
      and private.is_masked(
        data || coalesce((select s.data from public.library_entry_secrets s where s.id = entry), '{}'::jsonb),
        private.unidentified_categories(cp.campaign_id))
  );
$$;
revoke execute on function private.entry_masked_for_me(uuid, uuid, jsonb) from public, anon;
grant execute on function private.entry_masked_for_me(uuid, uuid, jsonb) to authenticated, service_role;

-- As in 20261115002000_dec_12e_rumours_gm_only.sql, plus: a player (not the GM) gets an item that starts unidentified in
-- this campaign as its face (its face's name; its data the face's, with the entry's appearsAs and noticed). Which rows
-- are returned is unchanged.
create or replace function public.campaign_library(campaign uuid, packs uuid[] default null, after_id uuid default null, page_size integer default 1000)
returns table (id uuid, pack_id uuid, kind text, pack_entry_id text, name text, data jsonb)
language sql stable security definer set search_path = '' as $$
  with open_items as materialized (
    select o.item
    from private.items_open_in(campaign) o(item)
    where (select private.is_member(campaign)) and not (select private.is_gm(campaign))
  ), masking as materialized (
    select private.unidentified_categories(campaign) as categories
    where (select private.is_member(campaign)) and not (select private.is_gm(campaign))
  ), rows_read as (
    select e.id, e.pack_id, e.kind, e.pack_entry_id, e.name, e.data
    from public.campaign_packs cp
    join public.library_entries e on e.pack_id = cp.pack_id
    where cp.campaign_id = campaign
      and (select private.is_member(campaign))
      and (packs is null or cp.pack_id = any (packs))
      and (after_id is null or e.id > after_id)
      and (
        (select private.is_gm(campaign))
        or (private.player_facing_entry(e.kind, e.data)
          and case e.kind
            when 'item' then e.pack_entry_id in (select o.item from open_items o)
            when 'patch' then private.patch_open_in(campaign, e.pack_id, e.data)
            else true
          end)
        -- fs-1: a table the pack opens to players, never a rumours table (rm-3).
        or (e.kind = 'table' and (e.data -> 'gmOnly') = 'false'::jsonb and not private.is_rumours_table(e.data))
      )
    order by e.id
    limit least(greatest(coalesce(page_size, 1000), 1), 1000)
  )
  select r.id, r.pack_id, r.kind, r.pack_entry_id,
    case when f.masked then private.face_name(campaign, f.whole ->> 'appearsAs', r.data ->> 'category') else r.name end,
    case when f.masked then private.item_face_data(f.whole)
           || jsonb_strip_nulls(jsonb_build_object('appearsAs', f.whole -> 'appearsAs', 'noticed', f.whole -> 'noticed'))
         else r.data end
  from rows_read r
  left join lateral (
    select w.whole, private.is_masked(w.whole, m.categories) as masked
    from masking m
    cross join lateral (
      select r.data || coalesce((select s.data from public.library_entry_secrets s where s.id = r.id), '{}'::jsonb) as whole
    ) w
    where r.kind = 'item'
  ) f on true
  order by r.id;
$$;
revoke execute on function public.campaign_library(uuid, uuid[], uuid, integer) from public, anon;
grant execute on function public.campaign_library(uuid, uuid[], uuid, integer) to authenticated, service_role;

-- As in 20261115002000_dec_12e_rumours_gm_only.sql, plus: a player's plain select gets no item that starts unidentified
-- in a campaign they play in (its face comes through public.campaign_library). The owner's and the GM's reads, and every
-- other kind, are unchanged.
drop policy "library entries: owner or campaigns using the pack read" on public.library_entries;
create policy "library entries: owner or campaigns using the pack read" on public.library_entries
  for select to authenticated
  using (
    exists (select 1 from public.packs p where p.id = pack_id and p.owner_user_id = (select auth.uid()))
    or private.pack_in_my_campaign(pack_id, true)
    or (private.pack_in_my_campaign(pack_id) and private.player_facing_entry(kind, data)
        and case kind
          when 'item' then private.item_readable(pack_id, pack_entry_id) and not private.entry_masked_for_me(id, pack_id, data)
          when 'patch' then private.patch_open_to_me(pack_id, data)
          else true
        end)
    -- fs-1: a table the pack opens to players, never a rumours table (rm-3).
    or (private.pack_in_my_campaign(pack_id) and kind = 'table' and (data -> 'gmOnly') = 'false'::jsonb and not private.is_rumours_table(data))
  );

-- 7b. A patch on an unidentified item is masked like the item (review of #40, finding 3) ---------------------------------

-- Whether a patch changes something of an unidentified item's truth: a path at a fact (its name, bonus, curse, powers,
-- own words, source, notes, the words of its face, its one-unit and plural names), a weapon's or armour's magic bonus or
-- bonus against a foe (or the whole block), or a field that is hidden or carries a fact in words (or the whole fields).
create function private.patch_touches_face(patch jsonb, whole jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select exists (
    select 1
    from jsonb_object_keys(case when jsonb_typeof(patch -> 'change') = 'object' then patch -> 'change' else '{}'::jsonb end) p(path)
    cross join lateral (select btrim(p.path) as path, btrim(split_part(btrim(p.path), '.', 1)) as head) k
    where k.head in ('name', 'bonus', 'cursed', 'properties', 'description', 'source', 'notes', 'appearsAs', 'noticed', 'unitName', 'pluralName')
      or k.path in ('weapon', 'armour', 'fields')
      or k.path ~ '^(weapon|armour)\.(magicBonus|bonusVs)(\.|$)'
      or (k.head = 'fields' and (
        substr(k.path, 8) = any (private.hidden_labels(whole))
        or exists (select 1 from private.fact_fields(whole) ff where k.path = 'fields.' || ff.label or k.path like 'fields.' || ff.label || '.%')))
  );
$$;
revoke execute on function private.patch_touches_face(jsonb, jsonb) from public, anon;
grant execute on function private.patch_touches_face(jsonb, jsonb) to authenticated, service_role;

-- As in 20261111110000_fix_hidden_data_cache_and_patches.sql (D), plus: a patch is the GM's too when it changes the
-- truth of an item it may match that starts unidentified in a campaign using that item's pack. Its callers (the
-- campaign's library, a player's plain read, the log's readers, a pack update's line) then keep it from players, as
-- they keep a patch on a gmOnly field.
create or replace function private.patch_hides_target_field(patch_pack uuid, patch jsonb) returns boolean
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
  )
  -- K22a: a patch on an unidentified item's truth.
  or exists (
    select 1
    from target
    join public.library_entries e on target.kind = 'item' and e.kind = 'item'
      and (cardinality(target.ids) = 0 or e.pack_entry_id = any (target.ids))
    join alongside on alongside.pack_id = e.pack_id
    cross join lateral (
      select e.data || coalesce((select s.data from public.library_entry_secrets s where s.id = e.id), '{}'::jsonb) as whole
    ) w
    where private.patch_touches_face(patch, w.whole)
      and (target.category is null or w.whole ->> 'category' = target.category)
      and exists (
        select 1 from public.campaign_packs cp
        where cp.pack_id = e.pack_id and private.is_masked(w.whole, private.unidentified_categories(cp.campaign_id)))
  );
$$;

-- 8. Devices fetch the face ---------------------------------------------------------------------------------------------
-- One bump of every campaign's seen stamp: a device that stored an entry's full copy downloads it again, as its face.
select private.bump_seen_revs(array(select c.id from public.campaigns c));
