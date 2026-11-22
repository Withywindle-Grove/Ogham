-- K22b (docs/plans/k22-reveal.md; ruling docs/design/rulings/k22-reveal-2026-11-21.md, k22-4 to k22-6, k22-9, k22-10;
-- picks 3, 6, 9): the GM tells a hidden fact, and edits what players see of an item; who reads those lines.
--
-- What it changes, plainly.
--   Adds public.tell_item (inventory.tell): the GM tells facts still hidden on a line, or every one ("everything").
--     The database copies the told values from the entry and its hidden part onto the line, never from a device; adds
--     them to the line's revealed_fields; sets identified and the true name when the name is told; tells "That it's
--     magic" with any other fact on a magic item (pick 6); "charges" shows the hidden count as inventory.revealCharges
--     does; once nothing is left hidden, the item's own words and source follow. One change to the line: one log line,
--     undone by the log's own Undo (k22-6), which puts the line back as it was.
--   Adds public.edit_item_look (inventory.editLook, k22-1): the GM changes appears_as and noticed (and, while the item is
--     unidentified, the face's name).
--   Both refuse anyone but the campaign's GM (42501); a tell of a fact already told changes nothing (a retry).
--   Two rows in public.logged_commands: inventory.tell and inventory.editLook.
--   An index on events.reverts_event_id (the new read rule looks an undo up by it).
-- Read rules that change: the policy "events: read what you may see" on public.events (dropped and made again under its
--   own name): a player (not the GM) no longer reads (1) an inventory.tell or inventory.reveal while an Undo of it
--   stands (once that Undo is itself undone, the line is theirs again), (2) that Undo's own line and the Undo of that
--   Undo, (3) any inventory.editLook line (pick 3), or (4) the Undo of one. The GM reads all of them. Nothing is
--   deleted: the events stay (hard rule 4; k22-10). private.event_readable is unchanged; the policy calls it as before
--   and adds the new check beside it.
-- Drops, renames or deletes no data; no existing function is replaced.

-- 1. The tell --------------------------------------------------------------------------------------------------------------

-- Returns how many facts it told (0: nothing was hidden of those asked, and nothing changed).
-- `facts`: the facts to tell, each an id private.hidden_facts gives, or ["everything"]. Those told already are skipped
-- (a retry changes nothing twice); all of them in one change to the line, so one log line and one Undo (the old
-- per-field "Reveal …" button, inventory.reveal, tells through here too while K2 isn't built: review of #40, finding 5).
create function public.tell_item(line uuid, facts text[], seen_version integer default null) returns integer
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

-- 2. What players see (k22-1) ----------------------------------------------------------------------------------------------

create function public.edit_item_look(line uuid, appears_as text, noticed text, seen_version integer default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  l public.inventory_lines;
  appears text := left(btrim(coalesce(edit_item_look.appears_as, '')), 200);
  notice text := left(btrim(coalesce(edit_item_look.noticed, '')), 2000);
begin
  select * into l from public.inventory_lines x where x.id = edit_item_look.line for update;
  if l.id is null or not private.is_gm(l.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if seen_version is not null and seen_version <> l.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  update public.inventory_lines x set
    appears_as = appears,
    noticed = notice,
    -- While unidentified the name is the face (k22-3: empty falls back to the category's singular name).
    name = case when x.identified then x.name else private.face_name(x.campaign_id, appears, x.category) end
  where x.id = l.id;
end;
$$;
revoke execute on function public.edit_item_look(uuid, text, text, integer) from public, anon;
grant execute on function public.edit_item_look(uuid, text, text, integer) to authenticated, service_role;

insert into public.logged_commands (name, level, gm_only) values
  ('inventory.tell', 'simple', true),
  ('inventory.editLook', 'simple', true);

-- 3. Who reads the lines (pick 3, k22-10) -----------------------------------------------------------------------------------

create index events_reverts_idx on public.events (reverts_event_id) where reverts_event_id is not null;

-- A line the GM alone reads, whoever else reads its row: a look edit (pick 3); a tell (or an inventory.reveal, which
-- tells through public.tell_item) while an Undo of it stands (k22-10); and the Undo of either, and the Undo of that Undo.
-- A tell whose Undo was itself undone is told again, so its line is the players' again (review of #40, finding 7). Reads
-- the log as the database owner (the events read rule calls it).
create function private.gm_only_event(campaign uuid, event_type text, event_id uuid, reverts uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.is_gm(campaign) and (
    event_type = 'inventory.editLook'
    or (event_type in ('inventory.tell', 'inventory.reveal') and exists (
      select 1 from public.events r
      where r.reverts_event_id = event_id
        and not exists (select 1 from public.events rr where rr.reverts_event_id = r.id)))
    or (reverts is not null and exists (
      select 1 from public.events o
      where o.id = reverts and (
        o.type in ('inventory.tell', 'inventory.reveal', 'inventory.editLook')
        or (o.reverts_event_id is not null and exists (
          select 1 from public.events oo
          where oo.id = o.reverts_event_id and oo.type in ('inventory.tell', 'inventory.reveal', 'inventory.editLook'))))))
  );
$$;
revoke execute on function private.gm_only_event(uuid, text, uuid, uuid) from public, anon;
grant execute on function private.gm_only_event(uuid, text, uuid, uuid) to authenticated, service_role;

-- As in 20261111100000_fm1_group_log_audience.sql, plus private.gm_only_event.
drop policy "events: read what you may see" on public.events;
create policy "events: read what you may see" on public.events
  for select to authenticated
  using (
    private.event_readable(campaign_id, target_table, target_id, after, before, reveal_at, seq, audience, owner_user_id, group_user_ids)
    and not private.gm_only_event(campaign_id, type, id, reverts_event_id)
  );
