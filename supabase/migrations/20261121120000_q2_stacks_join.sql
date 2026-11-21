-- Q2 (fb-5; rulings fb5-1 to fb5-3, sw-1 to sw-7, sw-9 and sw-10: docs/design/rulings/tablet-feedback-2026-11-20.md,
-- stacks-and-reveal-2026-11-21.md, stacks-whole-line-join-2026-11-21.md): a stackable thing added, given or moved to a
-- same-name stack in the same place joins it instead of making a second line. Only things carried in numbers join
-- (sw-10, Francis's "No" to swords joining): an item several of which share a slot (07's `stack` above 1: arrows, coins)
-- or sold as a bundle (07's `bundle` above 1, kept on the line as `per_units`: torches, rations); a thing with a stack of
-- 1 never joins, on either side.
--
-- What it changes, plainly.
--   Adds two functions the app calls: public.join_added_line (inventory.add, before it makes a new line) and
--     public.move_into_stack (inventory.move, before it moves or splits a line). Each finds a stack that may take the
--     thing (same carrier; the same container, or both loose; a name that matches ignoring capitals and plural; an
--     approved, stackable line with no charges, not a light that is lit or partly burnt, and not on a character still
--     waiting for approval) and raises its count in one step. With none, they change nothing and the app goes on as
--     before. A request tried again (an offline retry) finds what it did the first time by its request id and adds
--     nothing twice.
--   Adds helpers: private.same_stack_name, private.stack_joinable, private.request_join_done, private.joined_left,
--     private.unjoin_line, private.undo_check_join, private.undo_unjoin.
--   Replaces private.undo_body (builds on the newest, below): Undo of a join takes back the added count while the stack
--     has at least that many above what it had; with fewer, what's left of the added part, and the undo says so
--     (sw-4, as the give's 5b); renamed, given on, identified or charges spent refuse with the reason. It lowers the
--     stack's count and deletes no line. A whole line a move merged in comes back as its own line, with what's left.
--   A joined add's price and the GM's note are kept on its own log line (its reason, as JSON), never on the stack.
-- Deletes data: a whole line given or moved onto a same-name stack is merged into it and removed; the log keeps its
--   full copy, and Undo makes it again (sw-9, Francis, 2026-11-21: "A"; the eighth exception to hard rule 4).
-- Drops, renames and removes nothing else; no read rule changes; no new logged command (the joins are logged as the
-- inventory.add and inventory.move they belong to).
--
-- builds on: private.undo_body from 20261111100000_fm1_group_log_audience.sql

-- 1. The name rule (fb5-1): capitals and plural aside ("torch", "Torch" and "Torches" are one name). -----------------

create function private.same_stack_name(a text, b text) returns boolean
language sql immutable set search_path = '' as $$
  select n.x <> '' and (
    n.x = n.y
    or n.x || 's' = n.y or n.y || 's' = n.x
    or n.x || 'es' = n.y or n.y || 'es' = n.x
    or (n.x ~ '[^aeiou]y$' and left(n.x, -1) || 'ies' = n.y)
    or (n.y ~ '[^aeiou]y$' and left(n.y, -1) || 'ies' = n.x))
  from (
    select regexp_replace(lower(btrim(coalesce(a, ''))), '\s+', ' ', 'g') as x,
           regexp_replace(lower(btrim(coalesce(b, ''))), '\s+', ' ', 'g') as y
  ) n
$$;
revoke execute on function private.same_stack_name(text, text) from public, anon;
grant execute on function private.same_stack_name(text, text) to authenticated, service_role;

-- 2. A line that may take part in a join -------------------------------------------------------------------------------
-- Approved; not worn or held (unless it is the one being moved, which a move takes off); not given away; no charges
-- (counted, hidden or in its item: each holds its own count); not a holder with fuel in it or waiting for fuel; and not
-- a light that is lit or partly burnt (sw-3). Everything here is on the line or the light row, which its readers see.

create function private.stack_joinable(line public.inventory_lines, moving boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select line.id is not null
    and line.approval = 'approved'
    and (moving or not line.equipped)
    and line.given_to is null
    and not line.charges_hidden and line.charges_left is null and line.charges_used = 0
    and not (coalesce(line.item_data, '{}'::jsonb) ? 'charges')
    and not line.needs_fuel and line.fuel_left_seconds is null
    and not exists (
      select 1 from public.character_lights c
      where c.line_id = line.id and (c.lit_at is not null or c.left_seconds is not null)
    )
$$;
revoke execute on function private.stack_joinable(public.inventory_lines, boolean) from public, anon;
grant execute on function private.stack_joinable(public.inventory_lines, boolean) to authenticated, service_role;

-- 3. A request tried again ---------------------------------------------------------------------------------------------
-- Whether this request (its id, from this person) already changed anything in an earlier transaction, and if it
-- joined a stack then, which line. The join functions run first in their command, so any earlier change of the same
-- request is an earlier try of the same command.

create function private.request_join_done(out done boolean, out line uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  tag jsonb := private.request_tag();
  request uuid;
begin
  done := false;
  line := null;
  begin
    request := (tag ->> 'requestId')::uuid;
  exception when others then
    return;
  end;
  if request is null then
    return;
  end if;
  done := exists (
    select 1 from public.events e
    where e.request_id = request and e.actor_user_id is not distinct from (select auth.uid()) and e.created_at < now()
  );
  if done then
    select e.target_id into line from public.events e
    where e.request_id = request and e.actor_user_id is not distinct from (select auth.uid()) and e.created_at < now()
      and e.target_table = 'inventory_lines' and e.before ? 'qty' and e.after ? 'qty'
      and (e.after ->> 'qty')::integer > (e.before ->> 'qty')::integer
    order by e.seq
    limit 1;
  end if;
end;
$$;
revoke execute on function private.request_join_done() from public, anon;
grant execute on function private.request_join_done() to authenticated, service_role;

-- 4. Joining on an add (sw-1) ------------------------------------------------------------------------------------------
-- Called by inventory.add before it makes a new line (made_id is the id that line would have). Returns the stack it
-- joined, or null (nothing changed: the app makes the line as before). Only an item from the setting rules joins, read
-- by its entry as the new line would be (a bundle as its units); a one-off keeps its own line (it may wait for the GM).
-- How the added thing was got, its price and the GM's note stay with the add, never on the stack: they are written on
-- the add's own log line (its reason, as JSON: {"join":{"howGot","cost","note"}}), which the log reads to say "bought
-- … (6 cp)" or "gave … : note" as for any add. Given is the GM's alone, as for a new line.

create function public.join_added_line(
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
  select l.* into target from public.inventory_lines l
  where l.campaign_id = campaign and l.actor_id is not distinct from actor and l.location_id is not distinct from location
    and l.container_line_id is not distinct from container
    and private.same_stack_name(l.name, item_name)
    and (l.stack > 1 or l.per_units > 1)
    and private.stack_joinable(l)
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
revoke execute on function public.join_added_line(uuid, uuid, uuid, uuid, uuid, integer, uuid, text, text, text) from public, anon;
grant execute on function public.join_added_line(uuid, uuid, uuid, uuid, uuid, integer, uuid, text, text, text) to authenticated, service_role;

-- 5. Joining on a give or a move (sw-6, sw-9) --------------------------------------------------------------------------
-- Called by inventory.move before it moves or splits. Returns the stack it joined, or null (nothing changed: the app
-- moves as before). Part of a stack: the source's count goes down and the stack's up (no line made). A whole line: its
-- count joins the stack and the line is removed; the log keeps its full copy and Undo makes it again (sw-9).
-- The person must be allowed to take from the source and hand to the destination, as for any move (the stack may be
-- on another character, whose lines the giver can't change otherwise).

create function public.move_into_stack(
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
revoke execute on function public.move_into_stack(uuid, integer, uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.move_into_stack(uuid, integer, uuid, uuid, uuid, integer) to authenticated, service_role;

-- 6. Undo of a join (sw-4) ---------------------------------------------------------------------------------------------

-- A join's event: an add's or a move's raise of a line's count.
create function private.is_join_event(e public.events) returns boolean
language sql immutable set search_path = '' as $$
  select e.type in ('inventory.add', 'inventory.move') and e.target_table = 'inventory_lines'
    and e.before ? 'qty' and e.after ? 'qty' and (e.after ->> 'qty')::integer > (e.before ->> 'qty')::integer
$$;
revoke execute on function private.is_join_event(public.events) from public, anon;
grant execute on function private.is_join_event(public.events) to authenticated, service_role;

-- What's left of the added part of a joined stack: the added count while the stack holds at least that many above what
-- it had, else what's above it (what was used since is counted from the added part, as the give's 5b counts it from
-- the given part, so the stack never goes below what it had and no line is removed). Refused, the reason naming it:
-- none left, the stack given on (or some of it), renamed, its charges spent or identified. Moved in its own pack, worn,
-- held, pinned or hidden from At hand is fine; more added since is fine.
create function private.joined_left(line uuid, joined_by uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  joined public.events;
  action_end bigint;
  had integer;
  added integer;
  holder text;
  now_line public.inventory_lines;
  later public.events;
  next_to jsonb;
  key text;
  left_part integer;
begin
  select * into joined from public.events e where e.id = joined_by;
  if joined.id is null or not private.is_join_event(joined) or joined.target_id is distinct from line
    or not (private.is_gm(joined.campaign_id) or joined.actor_user_id = (select auth.uid())) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  had := (joined.before ->> 'qty')::integer;
  added := (joined.after ->> 'qty')::integer - had;
  select max(e.seq) into action_end from public.events e
  where e.campaign_id = joined.campaign_id
    and (e.id = joined.id or (joined.request_id is not null and e.request_id = joined.request_id
                              and e.actor_user_id is not distinct from joined.actor_user_id));
  select * into now_line from public.inventory_lines l where l.id = line;
  holder := private.holder_name(now_line.actor_id, now_line.location_id);

  for later in
    select * from public.events e
    where e.campaign_id = joined.campaign_id and e.target_table = 'inventory_lines' and e.target_id = line
      and e.seq > action_end and e.reverts_event_id is null
      and not exists (select 1 from public.events r where r.reverts_event_id = e.id)
    order by e.seq
  loop
    if later.after is null then
      if later.type = 'inventory.giveAway' then
        raise exception '% gave them to %.', holder, coalesce(later.before ->> 'given_to', 'someone');
      end if;
      raise exception 'None of it is left, so nothing can come back.';
    end if;
    for key in select jsonb_object_keys(later.after) loop
      continue when key in ('updated_at', 'container_line_id', 'equipped', 'pinned', 'at_hand_hidden', 'mode_id');
      if key in ('actor_id', 'location_id') then
        raise exception '% gave them to %.', holder,
          private.holder_name((later.after ->> 'actor_id')::uuid, (later.after ->> 'location_id')::uuid);
      end if;
      if key = 'qty' and later.type in ('inventory.move', 'inventory.giveAway')
        and (later.after ->> 'qty')::integer < coalesce((later.before ->> 'qty')::integer, 0) then
        -- Part of it handed on: who got it is in the same action (a line handed over, or a stack it joined).
        select e.after into next_to from public.events e
        where e.campaign_id = later.campaign_id and later.request_id is not null and e.request_id = later.request_id
          and e.target_table = 'inventory_lines' and e.target_id <> line and e.after is not null
          and (e.after ? 'actor_id' or e.after ? 'location_id' or e.after ? 'given_to')
        order by e.seq desc limit 1;
        if next_to is null then
          select jsonb_build_object('actor_id', l.actor_id, 'location_id', l.location_id) into next_to
          from public.events e join public.inventory_lines l on l.id = e.target_id
          where e.campaign_id = later.campaign_id and later.request_id is not null and e.request_id = later.request_id
            and private.is_join_event(e) and e.target_id <> line
          order by e.seq desc limit 1;
        end if;
        -- Moved within the same pack (into a bag, or onto another stack there): not given on, only fewer left here
        -- (sw-4), counted below like any used.
        if not (next_to is not null and next_to ->> 'given_to' is null
                and (next_to ->> 'actor_id')::uuid is not distinct from now_line.actor_id
                and (next_to ->> 'location_id')::uuid is not distinct from now_line.location_id) then
          raise exception '% gave some to %.', holder,
            coalesce(next_to ->> 'given_to',
                     private.holder_name((next_to ->> 'actor_id')::uuid, (next_to ->> 'location_id')::uuid));
        end if;
      end if;
      continue when key = 'qty';
      if key = 'name' then
        raise exception '% renamed it since, so it can''t go back.', holder;
      end if;
      if key in ('charges_used', 'charges_left', 'spent', 'spent_shown') then
        raise exception '% used its charges since, so it can''t go back.', holder;
      end if;
      if key in ('item_data', 'charges_hidden') then
        raise exception 'It''s been identified since, so it can''t go back.';
      end if;
      raise exception 'It''s changed since, so it can''t go back.';
    end loop;
  end loop;

  if now_line.id is null or now_line.qty < 1 then
    raise exception 'None of it is left, so nothing can come back.';
  end if;
  left_part := least(added, now_line.qty - had);
  if left_part < 1 then
    raise exception 'None of it is left, so nothing can come back.';
  end if;
  return jsonb_build_object('left', left_part, 'of', added, 'name', now_line.name, 'by', holder);
end;
$$;
revoke execute on function private.joined_left(uuid, uuid) from public, anon;
grant execute on function private.joined_left(uuid, uuid) to authenticated, service_role;

-- Takes the added part back off a joined stack, only from inside an Undo of that join (grimoire.reverting names it), by
-- the GM or whoever joined it. The stack may be on another character, which the giver can't change otherwise. A count
-- only goes down to what the stack had: no line is removed.
create function private.unjoin_line(line uuid, joined_by uuid, how_many integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  joined public.events;
  changed integer;
begin
  select * into joined from public.events e where e.id = joined_by;
  if joined.id is null or not private.is_join_event(joined) or joined.target_id is distinct from line
    or nullif(current_setting('grimoire.reverting', true), '') is distinct from joined_by::text
    or not (private.is_gm(joined.campaign_id) or joined.actor_user_id = (select auth.uid())) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  update public.inventory_lines l set qty = l.qty - how_many
  where l.id = line and how_many >= 1 and l.qty - how_many >= 1;
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'That''s changed since. Undo the later change first.';
  end if;
end;
$$;
revoke execute on function private.unjoin_line(uuid, uuid, integer) from public, anon;
grant execute on function private.unjoin_line(uuid, uuid, integer) to authenticated, service_role;

-- The check: not undone already, and what's left of the added part (or the reason). What comes back is said
-- (grimoire.came_back), and a part moved from a stack gets back only what's left (grimoire.used, read by
-- private.unmove_line when it puts the source's count back).
create function private.undo_check_join(change public.events) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  came_back jsonb;
begin
  if exists (select 1 from public.events r where r.reverts_event_id = change.id) then
    raise exception 'That was already undone.';
  end if;
  came_back := private.joined_left(change.target_id, change.id);
  perform set_config('grimoire.came_back', came_back::text, true);
  perform set_config('grimoire.used', ((came_back ->> 'of')::integer - (came_back ->> 'left')::integer)::text, true);
end;
$$;
revoke execute on function private.undo_check_join(public.events) from public, anon;
grant execute on function private.undo_check_join(public.events) to authenticated, service_role;

-- The writes: a whole line a move merged in is made again, where it was, with what's left of it (logged against the
-- removal it reverses; sw-9), then the added part comes off each joined stack. A merged line goes back with the one
-- stack it joined (a move joins one): what's left is read from that stack before anything is written.
create function private.undo_unjoin(picked public.events, joins uuid[], merged uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  change public.events;
  joined public.events;
  join_count integer;
  left_part integer;
begin
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.after is null
      and e.target_id = any (merged)
      and (e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id))
    order by e.seq
  loop
    select count(*) into join_count from public.events e
    where e.campaign_id = change.campaign_id and private.is_join_event(e)
      and (e.id = change.id or (change.request_id is not null and e.request_id = change.request_id
                                and e.actor_user_id is not distinct from change.actor_user_id));
    if join_count <> 1 then
      raise exception 'A line merged into a stack goes back only with the one stack it joined.';
    end if;
    select * into joined from public.events e
    where e.campaign_id = change.campaign_id and private.is_join_event(e)
      and (e.id = change.id or (change.request_id is not null and e.request_id = change.request_id
                                and e.actor_user_id is not distinct from change.actor_user_id));
    left_part := (private.joined_left(joined.target_id, joined.id) ->> 'left')::integer;
    perform set_config('grimoire.reverting', change.id::text, true);
    insert into public.inventory_lines
      select * from jsonb_populate_record(null::public.inventory_lines, jsonb_set(change.before, '{qty}', to_jsonb(left_part)));
  end loop;
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.target_id = any (joins)
      and private.is_join_event(e)
      and (e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id))
    order by e.seq
  loop
    left_part := (private.joined_left(change.target_id, change.id) ->> 'left')::integer;
    perform set_config('grimoire.reverting', change.id::text, true);
    perform private.unjoin_line(change.target_id, change.id, left_part);
  end loop;
end;
$$;
revoke execute on function private.undo_unjoin(public.events, uuid[], uuid[]) from public, anon;
grant execute on function private.undo_unjoin(public.events, uuid[], uuid[]) to authenticated, service_role;

-- Undo: as in 20261111100000_fm1_group_log_audience.sql, plus a join's Undo (Q2): the stacks the action joined are
-- checked and written by the two functions above, never put back to the count they had (sw-4), and a line a whole move
-- merged in comes back with what's left of it. Everything else is unchanged.
create or replace function private.undo_body(event_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  picked public.events;
  change public.events;
  as_gm boolean;
  is_drop boolean;
  dropped uuid[];
  passing uuid[];
  splits uuid[];
  made uuid[];
  joins uuid[];
  merged uuid[];
begin
  perform set_config('grimoire.came_back', '', true);
  perform set_config('grimoire.used', '', true);
  select * into picked from public.events e where e.id = event_id;
  if picked.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  as_gm := private.is_gm(picked.campaign_id);
  -- Players: only their own change, and only an entry they can see.
  if not as_gm and not (
    private.is_member(picked.campaign_id)
    and picked.actor_user_id = (select auth.uid())
    and picked.reveal_at = 'now'
    and (
      picked.audience = 'all'
      or (picked.audience = 'owner' and picked.owner_user_id = (select auth.uid()))
      or (picked.audience = 'group' and coalesce((select auth.uid()) = any (picked.group_user_ids), false))
    )
  ) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  -- The deletions that can be undone (ruled 2026-10-25), listed in public.undoable_deletions.
  is_drop := exists (select 1 from public.undoable_deletions d where d.name = picked.type);
  select coalesce(array_agg(e.target_id), '{}') into dropped from public.events e
  where is_drop and e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.after is null
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));
  -- Lines this action both made and removed: nothing to put back.
  select coalesce(array_agg(e.target_id), '{}') into passing from public.events e
  where is_drop and e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.before is null
    and e.target_id = any (dropped)
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));
  dropped := array(select d from unnest(dropped) d where not (d = any (passing)));
  -- Part of a stack moved (given inside the party, or put somewhere): the lines the move made by splitting.
  -- Undo merges them back (ruled 2026-10-26, a named exception to hard rule 4) while they're untouched.
  select coalesce(array_agg(e.target_id), '{}') into splits from public.events e
  where picked.type = 'inventory.move' and e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines'
    and e.before is null and e.after is not null
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));
  -- A record the action made (a session, an expedition, a reminder, a check result, a status…): marked undone, never
  -- removed. Any undoable table whose rows can be marked undone counts (private.made_tables), so a later table
  -- needn't copy this function again.
  select coalesce(array_agg(e.target_id), '{}') into made from public.events e
  where exists (select 1 from public.undoable_makings m where m.name = picked.type)
    and e.campaign_id = picked.campaign_id and e.target_table = any (private.made_tables())
    and e.before is null and e.after is not null
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));
  -- Q2: the stacks an add or a move joined (a count raised), and the whole line a move merged into one (removed).
  select coalesce(array_agg(e.target_id), '{}') into joins from public.events e
  where e.campaign_id = picked.campaign_id and private.is_join_event(e)
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));
  select coalesce(array_agg(e.target_id), '{}') into merged from public.events e
  where picked.type = 'inventory.move' and cardinality(joins) > 0
    and e.campaign_id = picked.campaign_id and e.target_table = 'inventory_lines' and e.after is null
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));

  -- Check everything first: the action's changes are those sharing its request id AND its author.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id
      and (
        e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id)
      )
  loop
    if change.target_table in ('inventory_lines', 'inventory_line_secrets') and change.target_id = any (passing) then
      continue;
    end if;
    if change.target_table = 'inventory_lines' and change.target_id = any (splits) then
      if change.before is null then
        perform private.undo_check_split_part(picked, change);
      end if;
      continue;
    end if;
    if change.target_table = 'inventory_lines' and change.target_id = any (joins) and private.is_join_event(change) then
      perform private.undo_check_join(change);
      continue;
    end if;
    if change.target_table = 'inventory_lines' and change.target_id = any (merged) and change.after is null then
      if exists (select 1 from public.events r where r.reverts_event_id = change.id) then
        raise exception 'That was already undone.';
      end if;
      -- Back only where it was, and only if nothing has taken its place (as a drop).
      perform private.undo_check_drop(change, '{}',
        (select to_jsonb(t) from public.inventory_lines t where t.id = change.target_id));
      continue;
    end if;
    if change.target_id = any (made) and change.before is null then
      perform private.undo_check_made(change);
      continue;
    end if;
    perform private.undo_check_change(picked, change, as_gm, is_drop, dropped);
  end loop;
  -- A forced march whose points were spent since comes after what spent them.
  perform private.undo_check_march(picked);

  -- Then write: dropped lines back, split-off parts merged back, joined stacks' added part off and merged lines made
  -- again, made records marked undone, changed values put back.
  if is_drop then
    perform private.undo_restore_drops(picked, dropped);
  end if;
  perform private.undo_unsplit(picked, splits);
  perform private.undo_unjoin(picked, joins, merged);
  perform private.undo_mark_made(picked, made);
  -- The place rows a split or a Join up made: the GM's lines, so a player's undo must mark them with the owner's rights.
  perform private.undo_follow_places(picked);
  -- The joined stacks are left out of the put-back (written above).
  perform private.undo_put_back(picked, passing || joins, splits);
  perform set_config('grimoire.reverting', '', true);
end;
$$;
