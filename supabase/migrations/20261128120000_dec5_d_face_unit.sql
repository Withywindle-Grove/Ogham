-- dec5-gaps piece D (#191; spec docs/specs/dec5-gaps.md, "Migrations" item D; ruling dg-7, hard rule 5): an
-- unidentified item hides its count's unit.
--
-- What it changes, plainly.
--   Replaces private.item_face_data: the face of an unidentified item (the line's copy, and a player's read of the
--     library entry) keeps its `charges` without `unit` and `units`, so "doses" can't tell a player a thing is a potion.
--     Everything else on the face is as before.
--   Replaces public.tell_item: a tell of "charges", or of "name" while the line's copy keeps a `charges` object, lays
--     the entry's `unit` and `units` back onto the line's `charges`. Everything else in it is as before.
-- No table, column, grant, read rule or stored row changes: lines already made keep the copy they carry. Drops, renames
-- or deletes no data.

-- builds on: private.item_face_data from 20261122100000_k22_unidentified_face.sql
-- As in 20261122100000_k22_unidentified_face.sql, plus the `charges` clause.
create or replace function private.item_face_data(whole jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select f.d
    || case when jsonb_typeof(f.d -> 'weapon') = 'object'
         then jsonb_build_object('weapon', (f.d -> 'weapon') - 'magicBonus' - 'bonusVs') else '{}'::jsonb end
    || case when jsonb_typeof(f.d -> 'armour') = 'object'
         then jsonb_build_object('armour', (f.d -> 'armour') - 'magicBonus' - 'bonusVs') else '{}'::jsonb end
    || case when jsonb_typeof(f.d -> 'fields') = 'object'
         then jsonb_build_object('fields', (f.d -> 'fields') - private.hidden_labels(whole)
           - array(select ff.label from private.fact_fields(whole) ff)) else '{}'::jsonb end
    || case when jsonb_typeof(f.d -> 'charges') = 'object'
         then jsonb_build_object('charges', (f.d -> 'charges') - 'unit' - 'units') else '{}'::jsonb end
  from (
    select private.visible_part(coalesce(whole, '{}'::jsonb))
      - array['name', 'bonus', 'cursed', 'properties', 'description', 'source', 'notes', 'appearsAs', 'noticed',
              'unitName', 'pluralName'] as d
  ) f;
$$;
revoke execute on function private.item_face_data(jsonb) from public, anon;
grant execute on function private.item_face_data(jsonb) to authenticated, service_role;

-- builds on: public.tell_item from 20261122110000_k22_tell.sql
-- As in 20261122110000_k22_tell.sql, plus the count's unit (dec5-gaps D) before new_revealed.
create or replace function public.tell_item(line uuid, facts text[], seen_version integer default null) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  l public.inventory_lines;
  entry public.library_entries;
  whole jsonb;
  true_name text;
  hidden text[];
  told text[];
  remaining text[];
  data jsonb;
  block text;
  part jsonb;
  label text;
  fact text;
  total integer;
  new_name text;
  new_identified boolean;
  new_revealed text[];
  charges_shown boolean := false;
  left_now integer;
begin
  select * into l from public.inventory_lines x where x.id = tell_item.line for update;
  if l.id is null or not private.is_gm(l.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if seen_version is not null and seen_version <> l.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  -- The line's own entry, as the GM has it: its visible part with its hidden part laid over.
  select e.* into entry from public.library_entries e
  where e.kind = 'item' and e.pack_id = l.source_pack_id and e.pack_entry_id = l.source_entry_id;
  if entry.id is not null then
    whole := private.entry_whole(entry.id);
    true_name := entry.name;
    if l.per_units > 1 then
      true_name := coalesce(nullif(btrim(whole ->> 'unitName'), ''), entry.name);
    end if;
  end if;
  hidden := private.hidden_facts(l.identified, l.revealed_fields, l.item_data, l.charges_hidden, l.category, whole);
  if facts is null or cardinality(facts) = 0 or cardinality(facts) > 200 then
    raise exception 'There''s nothing like that to tell.';
  end if;
  foreach fact in array facts loop
    if coalesce(fact, '') !~ '^(everything|magic|name|bonus|cursed|charges|power:[0-9]+|fields\..+)$' then
      raise exception 'There''s nothing like that to tell.';
    end if;
  end loop;
  if 'everything' = any (facts) then
    told := hidden;
  else
    -- Told already (or by a retry of this same request): nothing changes twice.
    told := array(select h from unnest(hidden) h where h = any (facts));
  end if;
  if cardinality(told) = 0 then
    return 0;
  end if;
  -- Pick 6: on a magic item, telling any fact tells "That it's magic" too.
  if 'magic' = any (hidden) and not ('magic' = any (told)) then
    told := array['magic'] || told;
  end if;

  data := l.item_data;
  new_name := l.name;
  new_identified := l.identified;
  if 'name' = any (told) then
    if true_name is null then
      raise exception 'Its setting rules are gone, so its name can''t be told.';
    end if;
    new_name := left(true_name, 200);
    new_identified := true;
    data := data || jsonb_strip_nulls(jsonb_build_object('unitName', whole -> 'unitName', 'pluralName', whole -> 'pluralName'));
  end if;
  if 'bonus' = any (told) then
    if whole ? 'bonus' then
      data := data || jsonb_build_object('bonus', whole -> 'bonus');
    end if;
    foreach block in array array['weapon', 'armour'] loop
      select coalesce(jsonb_object_agg(k, whole -> block -> k), '{}'::jsonb) into part
      from unnest(array['magicBonus', 'bonusVs']) k
      where jsonb_typeof(whole -> block) = 'object' and (whole -> block) ? k;
      if part <> '{}'::jsonb then
        data := data || jsonb_build_object(block,
          (case when jsonb_typeof(data -> block) = 'object' then data -> block else '{}'::jsonb end) || part);
      end if;
    end loop;
  end if;
  if 'cursed' = any (told) and whole ? 'cursed' then
    data := data || jsonb_build_object('cursed', whole -> 'cursed');
  end if;
  if exists (select 1 from unnest(told) t where t like 'power:%') then
    -- The entry's powers that are told now or were on the line, in the entry's order (pick 9: one fact per power).
    data := data || jsonb_build_object('properties', (
      select coalesce(jsonb_agg(p.v order by p.i), '[]'::jsonb)
      from jsonb_array_elements(whole -> 'properties') with ordinality p(v, i)
      where ('power:' || (p.i - 1)) = any (told)
        or coalesce(jsonb_typeof(data -> 'properties') = 'array' and (data -> 'properties') @> jsonb_build_array(p.v), false)));
  end if;
  for label in select substr(t, 8) from unnest(told) t where t like 'fields.%' loop
    data := data || jsonb_build_object('fields',
      (case when jsonb_typeof(data -> 'fields') = 'object' then data -> 'fields' else '{}'::jsonb end)
      || jsonb_build_object(label, whole -> 'fields' -> label));
  end loop;
  if 'charges' = any (told) then
    select s.charges_total into total from public.inventory_line_secrets s where s.id = l.id;
    if total is null then
      raise exception 'Set its charges first, then tell them.';
    end if;
    charges_shown := true;
    left_now := greatest(total - l.charges_used, 0);
  end if;
  -- dec5-gaps D (dg-7): a tell of the charges, or of the true name while the line's copy keeps its charges, brings the
  -- count's unit back from the entry.
  if jsonb_typeof(whole -> 'charges') = 'object'
    and ('charges' = any (told) or ('name' = any (told) and jsonb_typeof(data -> 'charges') = 'object')) then
    part := jsonb_strip_nulls(jsonb_build_object('unit', whole -> 'charges' -> 'unit', 'units', whole -> 'charges' -> 'units'));
    if part <> '{}'::jsonb then
      data := data || jsonb_build_object('charges',
        (case when jsonb_typeof(data -> 'charges') = 'object' then data -> 'charges' else '{}'::jsonb end) || part);
    end if;
  end if;
  new_revealed := l.revealed_fields || array(select t from unnest(told) t where not (t = any (l.revealed_fields)));
  -- A visible field that carries a fact in words (Bonus, Curse…) comes back with its fact (review of #40, finding 4).
  for label in select ff.label from private.fact_fields(whole) ff where ff.fact = any (told) loop
    data := data || jsonb_build_object('fields',
      (case when jsonb_typeof(data -> 'fields') = 'object' then data -> 'fields' else '{}'::jsonb end)
      || jsonb_build_object(label, whole -> 'fields' -> label));
  end loop;
  remaining := private.hidden_facts(new_identified, new_revealed, data, l.charges_hidden and not charges_shown, l.category, whole);
  -- Power and Powers once every power is told; every such field once nothing is left hidden.
  for label in
    select ff.label from private.fact_fields(whole) ff
    where cardinality(remaining) = 0 or (ff.fact = 'powers' and not exists (select 1 from unnest(remaining) r where r like 'power:%'))
  loop
    data := data || jsonb_build_object('fields',
      (case when jsonb_typeof(data -> 'fields') = 'object' then data -> 'fields' else '{}'::jsonb end)
      || jsonb_build_object(label, whole -> 'fields' -> label));
  end loop;
  -- Nothing left hidden: the item's own words, notes (unless they are the GM's) and source follow (pick 11).
  if cardinality(remaining) = 0 and whole is not null then
    data := data || jsonb_strip_nulls(jsonb_build_object(
      'description', whole -> 'description',
      'source', whole -> 'source',
      'notes', case when coalesce(whole -> 'gmOnly' ? 'notes', false) then null else whole -> 'notes' end));
  end if;

  update public.inventory_lines x set
    name = new_name,
    identified = new_identified,
    item_data = data,
    revealed_fields = new_revealed,
    charges_hidden = case when charges_shown then false else x.charges_hidden end,
    charges_left = case when charges_shown then left_now else x.charges_left end,
    spent_shown = case when charges_shown then false else x.spent_shown end
  where x.id = l.id;
  return cardinality(told);
end;
$$;
revoke execute on function public.tell_item(uuid, text[], integer) from public, anon;
grant execute on function public.tell_item(uuid, text[], integer) to authenticated, service_role;
