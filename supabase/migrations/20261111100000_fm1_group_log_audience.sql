-- fm-1 (docs/plans/m5b-fm-1.md; ruled by Francis 2026-11-10, option A, and ⚑ 1 "yes"): a travel group's log lines are
-- read by that group's players and the GM, and the player who forced the march can undo it.
-- Until now an event's audience was 'all', 'gm' or 'owner'; travel lines had no audience function, so they were the
-- GM's alone and a player had no line for their own forced march.
--   1. events gain the audience 'group', with `group_number` (which group) and `group_user_ids`: the players who had an
--      approved, active character in that group WHEN THE LINE WAS WRITTEN. They and the GM read it ("everyone who was
--      there"). Group numbers are used again by the next split (20261030230000_m5_party_groups.sql), so reading by
--      "who is in group 2 now" would hand an earlier group's travel to other people; the list on the line never changes.
--   2. A table's audience function may say 'group' and give the group and its readers (two more OUT columns, group_no
--      and readers); private.log_group reads them, and private.log_change writes them. A 'group' line without readers
--      stays the GM's (never the other way round).
--   3. travel_groups gets its audience function: the lines of the five travel commands (travel.dayStart, travel.move,
--      travel.setBudget, travel.forceMarch, travel.spendDay) and of their undos are the group's. Every other change to
--      the row (an activity's cost, a secret activity the GM accepted, an untagged write) stays the GM's, as before:
--      "players see nothing until the GM narrates" (docs/05, Activities).
--   4. The reading rule (private.event_readable, one more argument) and the events policy that uses it.
--   5. Notes follow, as they always have ("a note added to a log entry gets that entry's audience"): a note on a
--      group's line is read by that line's readers and the GM.
--   6. Undo: a player may undo their own change on a group line they read. A forced march writes rows a player can't
--      write (travel_groups is the GM's to update; an arrival moves the group's place), so the player's undo of their
--      own forced march runs with the database's rights, as force_march itself does (private.undo_own_march): only the
--      caller's own travel.forceMarch line, only while they are still in that group, only when the request holds
--      nothing but a march's own tables. And a forced march whose points were spent since is refused for everyone
--      ("That's changed since. Undo the later change first."): before, with nothing owed at the march, the undo went
--      through and left more spent than the day had.
--   7. The place a group is entering is the GM's until it has been shown (fm-1 ⚑ 2, the database way; the #528
--      look-back). Until now travel_groups.pending_place_name held the GM's own name for that place (the typed name, or
--      places.name of a place picked from a pack) and pending_place_id its id, and the group's players read that row
--      whole: a member could read the GM's name of a place not yet shown to them, from the Move… until the group
--      arrived. Now the GM's name and the id live in a GM-only side row, travel_group_secrets (one per travel row, as
--      status_secrets is to a status), and travel_groups.pending_place_name holds only what that group's players may
--      read: the players' name of the place (places.players_name, else its name) when one of its pieces has been shown
--      to that group on a visit (what What we know lists), else nothing. pending_place_id is no longer filled. The
--      group's travel lines carry the same row, so they never hold the GM's name either.
-- Old travel lines are NOT changed: they stay the GM's (opening them would widen who reads existing data).
--
-- What it changes, plainly. Adds two columns to events and one to notes (all empty for every existing row) and
-- replaces the audience check on each with one that also allows 'group' (plus checks tying the new columns to it).
-- Adds private.group_readers, private.log_group, private.log_audience_travel_groups, private.undo_check_march,
-- private.undo_own_march and a ten-argument private.event_readable. Replaces, each from its newest definition:
-- private.log_change (20261030161000_m5_light.sql), private.prepare_note (20261101120000_m5_review_fixes.sql),
-- private.guard_note_update (20261029190000_m5_note_reveal.sql), private.undo_body
-- (20261101121000_m5_review_split_undo.sql), public.undo_request (20261021160000_m2_undo_as_caller.sql), and the
-- policies "events: read what you may see" (20261101120000) and "notes: read what you may see" (20261029190000).
-- Drops and remakes two FUNCTIONS whose argument or result lists change (no data): private.log_audience_notes
-- (newest: 20261029160000_m5_intents.sql) and the nine-argument private.event_readable.
-- For 7: adds one table (travel_group_secrets) with its rules, policies and triggers, three functions and a row in
-- undoable_tables; replaces private.pay_owed, public.travel_move and private.group_goes_to_id from their newest
-- definitions (all three: 20261106140000_m8b_0_places_from_packs.sql); replaces the travel row's "owed and entering go
-- together" check with a looser one (the name may now be empty while points are owed).
-- DATA IT MOVES (needs Francis's OK in plain words before it is applied anywhere): for every travel row, the place
-- being entered (pending_place_name, pending_place_id) is COPIED into travel_group_secrets; then, on travel_groups,
-- pending_place_id is EMPTIED and pending_place_name is REPLACED by the players' name when the place has been shown
-- to that group, else EMPTIED. Nothing is lost: the GM's copy is in the new table. No table or column is dropped; no
-- row is deleted.

-- 1. The new audience on events ---------------------------------------------------------------------------------------

alter table public.events
  add column group_number integer, -- for audience 'group': which group of the party
  add column group_user_ids uuid[]; -- for audience 'group': the players in it when the line was written (and the GM)
alter table public.events drop constraint events_audience_check;
alter table public.events
  add constraint events_audience_check check (audience in ('all', 'gm', 'owner', 'group')),
  add constraint events_group_readers_check check ((audience = 'group') = (group_user_ids is not null)),
  add constraint events_group_number_check check (group_number is null or audience = 'group');

-- The players in a group now: those with an approved, active character (or hireling) of their own in it. The same
-- people private.in_my_group answers yes to.
create function private.group_readers(campaign uuid, group_no integer) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct a.owner_user_id), '{}'::uuid[])
  from public.party_group_members m join public.actors a on a.id = m.actor_id
  where m.campaign_id = campaign and m.group_number = group_no
    and a.owner_type = 'user' and a.owner_user_id is not null
    and a.approval = 'approved' and a.status = 'active';
$$;
revoke execute on function private.group_readers(uuid, integer) from public, anon, authenticated;

-- 2. The log's audience step passes the group through -----------------------------------------------------------------

-- The group and the readers a table's audience function gives for a 'group' line (its OUT columns group_no and
-- readers). A table whose function has none, or fails, gives nothing: private.log_change then keeps the line the GM's.
create function private.log_group(table_name text, old_row jsonb, new_row jsonb, out group_no integer, out readers uuid[])
language plpgsql stable security definer set search_path = '' as $$
begin
  execute format('select a.group_no, a.readers from private.%I($1, $2) a', 'log_audience_' || table_name)
    into group_no, readers using old_row, new_row;
exception when others then
  group_no := null;
  readers := null;
end;
$$;
revoke execute on function private.log_group(text, jsonb, jsonb) from public, anon, authenticated;

-- The log: as in 20261030161000_m5_light.sql, plus: a line for a group ('group') carries the group's number and the
-- players in it now (private.log_group); without them it is the GM's.
create or replace function private.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'version' end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'version' end;
  this_row jsonb := coalesce(new_row, old_row);
  campaign uuid;
  before_values jsonb := old_row;
  after_values jsonb := new_row;
  key text;
  tag jsonb;
  event_type text;
  event_level text;
  command_gm_only boolean;
  is_fiat boolean := false;
  why text;
  request uuid;
  part integer;
  who_sees text;
  owner uuid;
  group_no integer;
  readers uuid[];
  reveal text;
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

  -- Who may see it: like the rows themselves (the table's own function); and when (now, or at Downtime).
  select a.who_sees, a.owner into who_sees, owner from private.log_audience(tg_table_name, old_row, new_row) a;
  -- A group's line: which group, and the players in it now, who alone read it with the GM.
  if who_sees = 'group' then
    select g.group_no, g.readers into group_no, readers from private.log_group(tg_table_name, old_row, new_row) g;
    if readers is null then
      who_sees := 'gm';
      group_no := null;
    end if;
  end if;
  reveal := private.log_reveal(tg_table_name, old_row, new_row);

  -- The command's tag, if the request has one. A broken tag just means a plain name.
  tag := private.request_tag();
  begin
    request := (tag ->> 'requestId')::uuid;
    part := (tag ->> 'part')::integer;
  exception when others then
    request := null;
    part := null;
  end;
  -- The database names the entry: only the commands in public.logged_commands count (GM-only ones only for
  -- the GM), at the log level listed there. Anything else gets a plain name like "actors.update".
  event_type := coalesce(nullif(current_setting('grimoire.event_type', true), ''), tag ->> 'type');
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
    fiat, reason, audience, owner_user_id, group_number, group_user_ids, reveal_at, request_id, request_part, reverts_event_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, group_no, readers, reveal, request, part, reverting
  );
  return null;
end;
$$;

-- 3. The travel row's lines -------------------------------------------------------------------------------------------

-- A group's travel lines: the five travel commands' own lines, and their undos, are that group's (its players now, and
-- the GM). Anything else that changes the row stays the GM's, as every travel line was before: an activity's cost
-- (its own line is the activity's), a secret activity the GM accepted, an untagged write. The command's name is the
-- one the request gives (or the database's own part name); a GM-only name a player's request claims changes nothing
-- a player may not already read, since only the group's own players are ever added.
create function private.log_audience_travel_groups(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid, out group_no integer, out readers uuid[])
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
  command text := coalesce(nullif(current_setting('grimoire.event_type', true), ''), private.request_tag() ->> 'type');
  reverting uuid := nullif(current_setting('grimoire.reverting', true), '')::uuid;
begin
  who_sees := 'gm';
  owner := null;
  group_no := null;
  readers := null;
  if reverting is not null then
    -- An undo's line follows the line it reverses.
    if not exists (select 1 from public.events e where e.id = reverting and e.audience = 'group') then
      return;
    end if;
  elsif command is null
    or command not in ('travel.dayStart', 'travel.move', 'travel.setBudget', 'travel.forceMarch', 'travel.spendDay') then
    return;
  end if;
  who_sees := 'group';
  group_no := (this_row ->> 'group_number')::integer;
  readers := private.group_readers((this_row ->> 'campaign_id')::uuid, group_no);
end;
$$;
revoke execute on function private.log_audience_travel_groups(jsonb, jsonb) from public, anon, authenticated;

-- 4. Reading the log --------------------------------------------------------------------------------------------------

-- May the caller read this log entry: as in 20261101120000_m5_review_fixes.sql, plus a group's line for the players
-- who were in the group when it was written.
create function private.event_readable(campaign uuid, target_table text, target_id uuid, after jsonb, before jsonb, reveal_at text, seq bigint, audience text, owner_user_id uuid, group_user_ids uuid[])
returns boolean
language sql stable security definer set search_path = '' as $$
  select (private.is_gm(campaign) and not private.is_others_draft_event(target_table, target_id, coalesce(after, before)))
    or (
      private.is_member(campaign)
      and (
        reveal_at = 'now'
        or private.revealed_by_downtime(campaign, seq)
        or (target_table = 'check_results' and private.check_result_revealed(target_id))
      )
      and (
        audience = 'all'
        or (audience = 'owner' and owner_user_id = (select auth.uid()))
        or (audience = 'group' and coalesce((select auth.uid()) = any (group_user_ids), false))
      )
    );
$$;
revoke execute on function private.event_readable(uuid, text, uuid, jsonb, jsonb, text, bigint, text, uuid, uuid[]) from public, anon;
grant execute on function private.event_readable(uuid, text, uuid, jsonb, jsonb, text, bigint, text, uuid, uuid[]) to authenticated, service_role;

drop policy "events: read what you may see" on public.events;
create policy "events: read what you may see" on public.events
  for select to authenticated
  using (private.event_readable(campaign_id, target_table, target_id, after, before, reveal_at, seq, audience, owner_user_id, group_user_ids));

-- 5. Notes on a group's line ------------------------------------------------------------------------------------------

alter table public.notes add column group_user_ids uuid[]; -- for audience 'group': copied from the entry it is on
alter table public.notes drop constraint notes_audience_check;
alter table public.notes
  add constraint notes_audience_check check (audience in ('all', 'gm', 'owner', 'group')),
  add constraint notes_group_readers_check check ((audience = 'group') = (group_user_ids is not null));

-- As in 20261101120000_m5_review_fixes.sql, plus: a note on a group's line takes that line's readers. With a note
-- about a character still its player's own, the stricter wins as before: that player alone if they read the line,
-- else the GM.
create or replace function private.prepare_note() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.events;
  about public.actors;
begin
  new.audience := 'all';
  new.owner_user_id := null;
  new.group_user_ids := null;
  new.reveal_at := 'now';
  if new.about_actor_id is not null then
    select * into about from public.actors a where a.id = new.about_actor_id and a.campaign_id = new.campaign_id;
    if about.id is null then
      raise exception 'That character isn''t in this campaign.' using errcode = '42501';
    end if;
    -- Like who may see the character itself (and its log entries).
    if about.approval <> 'approved' then
      if about.owner_type = 'user' then
        new.audience := 'owner';
        new.owner_user_id := about.owner_user_id;
      else
        new.audience := 'gm';
      end if;
    end if;
  end if;
  if new.annotates_event_id is not null then
    select * into entry from public.events e where e.id = new.annotates_event_id;
    if entry.id is null or entry.campaign_id <> new.campaign_id
      or not private.event_readable(entry.campaign_id, entry.target_table, entry.target_id, entry.after, entry.before, entry.reveal_at, entry.seq, entry.audience, entry.owner_user_id, entry.group_user_ids) then
      raise exception 'That log entry isn''t in this campaign.' using errcode = '42501';
    end if;
    -- The character and the entry: the stricter wins.
    if entry.audience = 'gm' or new.audience = 'gm'
      or (entry.audience = 'owner' and new.audience = 'owner' and entry.owner_user_id is distinct from new.owner_user_id)
      or (entry.audience = 'group' and new.audience = 'owner' and not coalesce(new.owner_user_id = any (entry.group_user_ids), false)) then
      new.audience := 'gm';
      new.owner_user_id := null;
    elsif entry.audience = 'owner' then
      new.audience := 'owner';
      new.owner_user_id := entry.owner_user_id;
    elsif entry.audience = 'group' and new.audience = 'all' then
      new.audience := 'group';
      new.group_user_ids := entry.group_user_ids;
    end if;
    new.reveal_at := entry.reveal_at;
  end if;
  return new;
end;
$$;

-- The nine-argument reading function has no callers left (the policy and prepare_note use the new one).
drop function private.event_readable(uuid, text, uuid, jsonb, jsonb, text, bigint, text, uuid);

-- As in 20261029190000_m5_note_reveal.sql, plus the readers: only a note's text changes.
create or replace function private.guard_note_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.campaign_id is distinct from old.campaign_id
    or new.about_actor_id is distinct from old.about_actor_id
    or new.annotates_event_id is distinct from old.annotates_event_id
    or new.audience is distinct from old.audience
    or new.owner_user_id is distinct from old.owner_user_id
    or new.group_user_ids is distinct from old.group_user_ids
    or new.reveal_at is distinct from old.reveal_at then
    raise exception 'Only a note''s text can change.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- As in 20261029190000_m5_note_reveal.sql, plus a note on a group's line for that line's readers.
drop policy "notes: read what you may see" on public.notes;
create policy "notes: read what you may see" on public.notes
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and (
        audience = 'all'
        or (audience = 'owner' and owner_user_id = (select auth.uid()))
        or (audience = 'group' and coalesce((select auth.uid()) = any (group_user_ids), false))
      )
      and (reveal_at = 'now' or private.event_revealed(annotates_event_id))
    )
  );

-- A note carries its own audience (copied from the entry it was added to): as in 20261029160000_m5_intents.sql, plus
-- the readers of a note on a group's line. Dropped and remade because its result gains two columns.
drop function private.log_audience_notes(jsonb, jsonb);
create function private.log_audience_notes(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid, out group_no integer, out readers uuid[])
language sql stable set search_path = '' as $$
  select coalesce(new_row, old_row) ->> 'audience', (coalesce(new_row, old_row) ->> 'owner_user_id')::uuid, null::integer,
    case when coalesce(new_row, old_row) ->> 'audience' = 'group'
      then array(select jsonb_array_elements_text(coalesce(new_row, old_row) -> 'group_user_ids'))::uuid[]
    end;
$$;
revoke execute on function private.log_audience_notes(jsonb, jsonb) from public, anon, authenticated;

-- 6. Undo -------------------------------------------------------------------------------------------------------------

-- A forced march whose points were spent since can't be taken back before what spent them: a later change to the
-- same travel row that changed `spent` and still stands (not an undo, not undone). The march's own line holds only
-- the total and the forced count, so the usual "nothing changed since" check doesn't see a Move… made after it.
create function private.undo_check_march(picked public.events) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  last_seq bigint;
  travel_row uuid;
begin
  if picked.type <> 'travel.forceMarch' then
    return;
  end if;
  -- The march's changes (its request's, by its author), and the travel row among them (the line picked may be the
  -- place an arrival set).
  select max(e.seq), (array_agg(e.target_id) filter (where e.target_table = 'travel_groups'))[1]
  into last_seq, travel_row
  from public.events e
  where e.campaign_id = picked.campaign_id
    and (e.id = picked.id
      or (picked.request_id is not null and e.request_id = picked.request_id
          and e.actor_user_id is not distinct from picked.actor_user_id));
  if travel_row is null then
    return;
  end if;
  if exists (
    select 1 from public.events l
    where l.campaign_id = picked.campaign_id and l.target_table = 'travel_groups' and l.target_id = travel_row
      and l.seq > last_seq and l.reverts_event_id is null
      and l.after is not null and jsonb_exists(l.after, 'spent')
      and not exists (select 1 from public.events r where r.reverts_event_id = l.id)
  ) then
    raise exception 'That''s changed since. Undo the later change first.';
  end if;
end;
$$;
revoke execute on function private.undo_check_march(public.events) from public, anon;
grant execute on function private.undo_check_march(public.events) to authenticated, service_role;

-- As in 20261101121000_m5_review_split_undo.sql, plus: a player may undo their own change on a group's line they
-- read, and a forced march whose points were spent since is refused (private.undo_check_march).
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
    if change.target_id = any (made) and change.before is null then
      perform private.undo_check_made(change);
      continue;
    end if;
    perform private.undo_check_change(picked, change, as_gm, is_drop, dropped);
  end loop;
  -- A forced march whose points were spent since comes after what spent them.
  perform private.undo_check_march(picked);

  -- Then write: dropped lines back, split-off parts merged back, made records marked undone, changed values put back.
  if is_drop then
    perform private.undo_restore_drops(picked, dropped);
  end if;
  perform private.undo_unsplit(picked, splits);
  perform private.undo_mark_made(picked, made);
  -- The place rows a split or a Join up made: the GM's lines, so a player's undo must mark them with the owner's rights.
  perform private.undo_follow_places(picked);
  perform private.undo_put_back(picked, passing, splits);
  perform set_config('grimoire.reverting', '', true);
end;
$$;

-- A player's undo of their own forced march, with the database's rights (as public.force_march runs: a player can't
-- write the travel row, nor the group's place an arrival moved). Only the caller's own travel.forceMarch line on a
-- travel row, read as one of that group's players, while they are still in the group; and only when everything the
-- request wrote is in a march's own tables, so nothing else sharing a request id can ride along. The checks and the
-- writes are private.undo_body's, unchanged.
create function private.undo_own_march(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  picked public.events;
begin
  select * into picked from public.events e where e.id = event_id;
  if picked.id is null
    or picked.type <> 'travel.forceMarch' or picked.target_table <> 'travel_groups' or picked.audience <> 'group'
    or picked.actor_user_id is distinct from (select auth.uid())
    or not coalesce((select auth.uid()) = any (picked.group_user_ids), false)
    or not coalesce(private.in_my_group(picked.campaign_id, picked.group_number), false) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.events e
    where e.campaign_id = picked.campaign_id
      and picked.request_id is not null and e.request_id = picked.request_id
      and e.actor_user_id is not distinct from picked.actor_user_id
      and e.target_table not in ('travel_groups', 'travel_group_secrets', 'group_places', 'places', 'place_notes')
  ) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.undo_body(event_id);
end;
$$;
revoke execute on function private.undo_own_march(uuid) from public, anon;
grant execute on function private.undo_own_march(uuid) to authenticated, service_role;

-- As in 20261021160000_m2_undo_as_caller.sql, plus: a player's own forced march goes through private.undo_own_march.
create or replace function public.undo_request(event_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  picked public.events;
begin
  -- Only an entry this person can see (the events reading rule applies here).
  select * into picked from public.events e where e.id = event_id;
  if picked.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if private.is_gm(picked.campaign_id) then
    perform private.undo_as_gm(event_id);
  elsif picked.type = 'travel.forceMarch' and picked.target_table = 'travel_groups' and picked.audience = 'group' then
    perform private.undo_own_march(event_id);
  else
    perform private.undo_body(event_id);
  end if;
end;
$$;

-- 7. The place a group is entering is the GM's until it has been shown ------------------------------------------------

-- The GM's own part of a travel row: the place the group is entering as the GM names it (the name typed, or the
-- place's own name), and the place itself when one was picked. One row per travel row, made with it. Only the GM
-- reads it; the functions below keep it.
create table public.travel_group_secrets (
  id uuid primary key references public.travel_groups (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  pending_place_name text check (pending_place_name is null or length(pending_place_name) between 1 and 200),
  pending_place_id uuid references public.places (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index travel_group_secrets_campaign on public.travel_group_secrets (campaign_id);

-- Every travel row there is gets its GM's part, with the place it is entering as the row holds it today (a copy; before
-- the table's triggers exist, so a retired campaign's rows are copied too and nothing is logged).
insert into public.travel_group_secrets (id, campaign_id, pending_place_name, pending_place_id)
select t.id, t.campaign_id, t.pending_place_name, t.pending_place_id from public.travel_groups t;

alter table public.travel_group_secrets enable row level security;
grant select, update on public.travel_group_secrets to authenticated;
grant select, insert, update, delete on public.travel_group_secrets to service_role;

create policy "travel secrets: the GM reads" on public.travel_group_secrets
  for select to authenticated using (private.is_gm(campaign_id));
create policy "travel secrets: the GM keeps them" on public.travel_group_secrets
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- Whose row it is never changes; a blank name is no name.
create function private.travel_group_secret_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.campaign_id is distinct from old.campaign_id) then
    raise exception 'That can''t be changed.';
  end if;
  new.pending_place_name := nullif(trim(coalesce(new.pending_place_name, '')), '');
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.travel_group_secret_rules() from public, anon, authenticated;

-- Its making isn't logged (it comes with the travel row); its changes are, for the GM only (no log_audience function
-- of its own: hidden means hidden).
create trigger travel_group_secret_rules before insert or update on public.travel_group_secrets
  for each row execute function private.travel_group_secret_rules();
create trigger refuse_when_retired before insert or update or delete on public.travel_group_secrets
  for each row execute function private.refuse_when_retired();
create trigger log_change after update on public.travel_group_secrets
  for each row execute function private.log_change();

-- A new travel row gets its GM's part at once.
create function private.make_travel_group_secret() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.travel_group_secrets (id, campaign_id) values (new.id, new.campaign_id) on conflict (id) do nothing;
  return null;
end;
$$;
revoke execute on function private.make_travel_group_secret() from public, anon, authenticated;
create trigger make_travel_group_secret after insert on public.travel_groups
  for each row execute function private.make_travel_group_secret();

-- What a group's players may read of the place it is entering: that place's players' name (places.players_name, else
-- its name), and only when one of its pieces has been shown to that group on a visit (what What we know lists,
-- public.known_places_campaign); otherwise nothing. A typed name finds its place as private.place_named does, without
-- making one. Runs as the database (the GM's Move… and a player's forced march both come through here).
create function private.entering_name_for_players(campaign uuid, group_no integer, place uuid, place_name text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  which uuid := place;
  said text;
begin
  if which is null then
    if place_name is null or length(trim(place_name)) = 0 then
      return null;
    end if;
    select p.id into which from public.places p
    where p.campaign_id = campaign and lower(p.name) = lower(trim(place_name)) and not p.undone and p.pack_entry_id is null
    limit 1;
    if which is null then
      select min(p.id::text)::uuid into which from public.places p
      where p.campaign_id = campaign and lower(p.name) = lower(trim(place_name)) and not p.undone and p.pack_entry_id is not null
      having count(*) = 1;
    end if;
  end if;
  if which is null then
    return null;
  end if;
  select coalesce(nullif(p.players_name, ''), p.name) into said
  from public.places p
  where p.id = which and p.campaign_id = campaign and not p.undone
    and exists (
      select 1 from public.group_places gp
      join public.expeditions x on x.id = gp.expedition_id and not x.undone
      join public.piece_shows s on s.group_place_id = gp.id and s.shown and not s.undone
      join public.place_pieces pc on pc.id = s.piece_id and not pc.undone
      where gp.place_id = p.id and gp.campaign_id = campaign and gp.group_number = group_no and not gp.undone
    );
  return said;
end;
$$;
revoke execute on function private.entering_name_for_players(uuid, integer, uuid, text) from public, anon;
grant execute on function private.entering_name_for_players(uuid, integer, uuid, text) to authenticated, service_role;

-- "Owed and entering go together" (20261103110000_m5b_1_travel.sql) required a place, a terrain or a route whenever
-- points were owed. The place's name may now be empty for the players while points are owed, so the rule becomes:
-- what the group is entering is only there while points are owed.
alter table public.travel_groups drop constraint travel_groups_check;

-- The rows in play: the players' part keeps only what that group's players may read (the GM's copy was taken above).
-- Not logged and not versioned (nothing happened in play; a retired campaign's and an undone row's are emptied too),
-- so the table's own triggers are paused for this one statement.
alter table public.travel_groups disable trigger user;
update public.travel_groups t
set pending_place_name = private.entering_name_for_players(t.campaign_id, t.group_number, t.pending_place_id, t.pending_place_name),
    pending_place_id = null
where t.pending_place_name is not null or t.pending_place_id is not null;
set constraints all immediate;
alter table public.travel_groups enable trigger user;

alter table public.travel_groups
  add constraint travel_groups_entering_check
  check (pending_owed is not null or (pending_terrain_id is null and pending_route_id is null and pending_place_id is null and pending_place_name is null));

-- A travel line written before this migration holds the GM's own name for the place in the travel row's values, and
-- its Undo would put that name back where the group's players read it (and not in the GM's part, which the line never
-- knew). So an Undo may give the players' part a place only when the same action also changed the GM's part: every
-- Move… and arrival does from now on; no older line can. The older line's Undo is refused whole.
create function private.travel_group_old_place_undo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting uuid := nullif(current_setting('grimoire.reverting', true), '')::uuid;
begin
  if reverting is not null
    and (new.pending_place_name is distinct from old.pending_place_name or new.pending_place_id is distinct from old.pending_place_id)
    and (new.pending_place_name is not null or new.pending_place_id is not null)
    and not exists (
      select 1 from public.events e
      join public.events k on k.request_id = e.request_id and k.target_table = 'travel_group_secrets' and k.target_id = e.target_id
      where e.id = reverting and e.request_id is not null
    ) then
    raise exception 'That can''t be undone.';
  end if;
  return new;
end;
$$;
revoke execute on function private.travel_group_old_place_undo() from public, anon, authenticated;
create trigger travel_group_old_place_undo before update on public.travel_groups
  for each row execute function private.travel_group_old_place_undo();

-- As in 20261106140000_m8b_0_places_from_packs.sql, plus: a place that has been undone since is no place (the group
-- arrives somewhere unnamed, as it would with no name).
create or replace function private.group_goes_to_id(campaign uuid, group_no integer, place uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  trip uuid;
  row_now public.group_places;
  there uuid := place;
begin
  select x.id into trip from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone;
  if trip is null then
    return;
  end if;
  if there is not null and not exists (select 1 from public.places p where p.id = there and p.campaign_id = campaign and not p.undone) then
    there := null;
  end if;
  row_now := private.current_group_place(campaign, group_no);
  if row_now.id is not null and row_now.place_id is not distinct from there then
    return;
  end if;
  if row_now.id is not null then
    update public.group_places gp set moved_on = true where gp.id = row_now.id;
  end if;
  insert into public.group_places (campaign_id, expedition_id, group_number, place_id) values (campaign, trip, group_no, there);
end;
$$;

-- As in 20261106140000_m8b_0_places_from_packs.sql, but the place being entered is read from, and cleared in, the GM's
-- part of the row (travel_group_secrets); the players' part is cleared with it.
create or replace function private.pay_owed(row_now public.travel_groups, points integer) returns public.travel_groups
language plpgsql security definer set search_path = '' as $$
declare
  paid integer := least(coalesce(row_now.pending_owed, 0), greatest(points, 0));
  left_owed integer := coalesce(row_now.pending_owed, 0) - paid;
  paid_row public.travel_groups;
  entering public.travel_group_secrets;
begin
  if row_now.pending_owed is null then
    return row_now;
  end if;
  if left_owed > 0 then
    update public.travel_groups t set spent = t.spent + paid, pending_owed = left_owed where t.id = row_now.id returning * into paid_row;
    return paid_row;
  end if;
  select * into entering from public.travel_group_secrets s where s.id = row_now.id;
  update public.travel_groups t
  set spent = t.spent + paid, terrain_id = t.pending_terrain_id, route_id = t.pending_route_id,
      pending_place_name = null, pending_place_id = null, pending_terrain_id = null, pending_route_id = null, pending_owed = null
  where t.id = row_now.id returning * into paid_row;
  update public.travel_group_secrets s set pending_place_name = null, pending_place_id = null where s.id = row_now.id;
  if entering.pending_place_id is not null then
    perform private.group_goes_to_id(row_now.campaign_id, row_now.group_number, entering.pending_place_id);
  else
    perform private.group_goes_to(row_now.campaign_id, row_now.group_number, entering.pending_place_name);
  end if;
  return paid_row;
end;
$$;

-- As in 20261106140000_m8b_0_places_from_packs.sql, but the place being entered goes to the GM's part of the row
-- (travel_group_secrets), and the players' part gets only what that group's players may read of it
-- (private.entering_name_for_players): never the GM's name for a place not yet shown to them.
create or replace function public.travel_move(campaign uuid, group_no integer, cost integer, terrain_id text default null, route_id text default null,
  place_name text default null, place_id uuid default null, seen_version integer default null)
returns public.travel_groups
language plpgsql security invoker set search_path = '' as $$
declare
  done uuid[] := private.request_targets('travel_groups');
  row_now public.travel_groups;
  name_now text := nullif(trim(coalesce(place_name, '')), '');
  pay integer;
  owed integer;
begin
  if cardinality(done) > 0 then
    select * into row_now from public.travel_groups t where t.id = done[1];
    return row_now;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if cost is null or cost < 0 or cost > 100000 then
    raise exception 'A whole cost, 0 or more, is needed.';
  end if;
  if place_id is not null then
    select p.name into name_now from public.places p where p.id = place_id and p.campaign_id = campaign and not p.undone;
    if name_now is null then
      raise exception 'That place isn''t in this campaign.';
    end if;
  end if;
  row_now := private.travel_row(campaign, group_no);
  pay := least(greatest(row_now.total - row_now.spent, 0), cost);
  owed := cost - pay;
  if owed > 0 then
    update public.travel_groups t
    set spent = t.spent + pay, version = coalesce(seen_version, t.version),
        pending_place_name = private.entering_name_for_players(campaign, group_no, travel_move.place_id, name_now),
        pending_place_id = null, pending_terrain_id = travel_move.terrain_id, pending_route_id = travel_move.route_id, pending_owed = owed
    where t.id = row_now.id returning * into row_now;
    update public.travel_group_secrets s set pending_place_name = name_now, pending_place_id = travel_move.place_id where s.id = row_now.id;
    return row_now;
  end if;
  update public.travel_groups t
  set spent = t.spent + pay, version = coalesce(seen_version, t.version),
      terrain_id = travel_move.terrain_id, route_id = travel_move.route_id,
      pending_place_name = null, pending_place_id = null, pending_terrain_id = null, pending_route_id = null, pending_owed = null
  where t.id = row_now.id returning * into row_now;
  update public.travel_group_secrets s set pending_place_name = null, pending_place_id = null where s.id = row_now.id;
  if place_id is not null then
    perform private.group_goes_to_id(campaign, group_no, place_id);
  else
    perform private.group_goes_to(campaign, group_no, name_now);
  end if;
  return row_now;
end;
$$;

-- The GM's part of the row is put back by Undo with the rest of a Move… or an arrival.
insert into public.undoable_tables (name) values ('travel_group_secrets');
