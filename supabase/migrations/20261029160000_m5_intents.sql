-- M5 step 4: shared-state foundations (docs/02 "Foundation 1", "Offline"; docs/health/M4.md items 3, 11, 12; M4b
-- item 8 and 11). Four parts:
--   1. Copy versions: inventory lines (a character's Pack and the Party stash) carry a version number. The database
--      raises it on every real change. A save that names the version it was made from is refused when the line has
--      changed since (code GR409, "That's changed since. Here's the latest."); a save that names none is applied
--      as before. Ruled technical: stale saves are refused by copy version (2026-10-29).
--   2. Request ids: each request of a command now says which of the command's requests it is (`part`, in the
--      x-grimoire-command tag; kept in events.request_part). A request repeated with the same id and part (an
--      offline retry after a lost answer) changes nothing and writes no event: a repeated change gives back the
--      line as it is, a repeated split gives back the part it made. Older tags (no part) work as before.
--   3. Who sees each log line: one small function per table (private.log_audience_<table>), found by name, instead
--      of one copied block inside private.log_change. A table with no function of its own logs for the GM only
--      (hidden means hidden). Behaviour is the same for every existing table (supabase/tests/m5-intents.test.ts
--      compares each one with the M4b block, kept below as public.log_audience_check for that test only).
--   4. "<name> is now <tier>": worked out and written once by the database, when a change to a character's items
--      ends with the load in another tier (at the end of the change, so a split or a whole container counts once,
--      and two devices make one line). The load is worked out like src/modules/inventory/encumbrance.ts, from the
--      campaign's setting rules (stacked, optional rules applied) and its encumbrance mode. Devices no longer write
--      carrier_loads.
--
-- What it changes, plainly. Adds: inventory_lines.version, events.request_part, 25 functions, two triggers.
-- Replaces: private.log_change (same lines, same audiences; the version number is left out of the log) and
--   public.split_inventory_line (drops the two-argument version and makes it again with an optional third, the
--   version it was split from; callers that pass two still work).
-- Drops: carrier_loads' log trigger (the database writes the tier line itself now), and the two rules that let
--   devices insert or change carrier_loads, with those grants. No rows are removed; carrier_loads keeps every row,
--   and characters with items but no row get one (their current tier, written quietly, no log line).

-- 1. Copy versions -------------------------------------------------------------------------------------------------

alter table public.inventory_lines add column version integer not null default 1 check (version >= 1);
alter table public.events add column request_part integer check (request_part is null or request_part >= 0);

-- The command's tag on this request, or null (a broken tag is no tag).
create function private.request_tag() returns jsonb
language plpgsql stable set search_path = '' as $$
begin
  return convert_from(
    decode(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-grimoire-command', 'base64'),
    'UTF8'
  )::jsonb;
exception when others then
  return null;
end;
$$;
revoke execute on function private.request_tag() from public, anon;
grant execute on function private.request_tag() to authenticated, service_role;

-- Whether this request (its id and part, from this person) already changed this row in an earlier transaction: a
-- repeat. Only tags that say which part they are count (older devices' tags don't).
create function private.repeated_request(target_table text, target uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  tag jsonb := private.request_tag();
  request uuid;
  part integer;
begin
  begin
    request := (tag ->> 'requestId')::uuid;
    part := (tag ->> 'part')::integer;
  exception when others then
    return false;
  end;
  if request is null or part is null or target is null then
    return false;
  end if;
  return exists (
    select 1 from public.events e
    where e.request_id = request and e.request_part = part and e.target_table = repeated_request.target_table
      and e.target_id = target and e.actor_user_id is not distinct from (select auth.uid())
      and e.created_at < now()
  );
end;
$$;
revoke execute on function private.repeated_request(text, uuid) from public, anon;
grant execute on function private.repeated_request(text, uuid) to authenticated, service_role;

-- Runs first of the line's triggers (by name). A new line starts at version 1. A change: a repeat of a request
-- already applied changes nothing; a save naming an older version is refused; a real change raises the version.
create function private.check_copy_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    return new;
  end if;
  if private.repeated_request(tg_table_name, old.id) then
    return old;
  end if;
  if new.version is distinct from old.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  if (to_jsonb(new) - 'updated_at' - 'version') is distinct from (to_jsonb(old) - 'updated_at' - 'version') then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;
revoke execute on function private.check_copy_version() from public, anon, authenticated;
create trigger check_copy_version before insert or update on public.inventory_lines
  for each row execute function private.check_copy_version();

-- As in 20261024230000_m4_review_fixes.sql, plus: refused when the line changed since `seen_version` (if given),
-- and a repeated request gives back the part it made the first time.
drop function public.split_inventory_line(uuid, integer);
create function public.split_inventory_line(line uuid, how_many integer, seen_version integer default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
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
revoke execute on function public.split_inventory_line(uuid, integer, integer) from public, anon;
grant execute on function public.split_inventory_line(uuid, integer, integer) to authenticated, service_role;

-- 3. Who sees each log line: one function per table ---------------------------------------------------------------
-- Each takes the row before and after (null for a creation or a deletion) and says who sees the line: 'all', 'gm',
-- or 'owner' with the player. A new table adds private.log_audience_<its name>(jsonb, jsonb).

-- Something a character carries or owns: seen like the character (its player and the GM until it's approved).
create function private.audience_of_character(actor uuid, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  carrier_approval text;
  carrier_owner_type text;
  carrier_owner uuid;
begin
  who_sees := 'all';
  owner := null;
  if actor is null then
    return;
  end if;
  select a.approval, a.owner_type, a.owner_user_id into carrier_approval, carrier_owner_type, carrier_owner
  from public.actors a where a.id = actor;
  if coalesce(carrier_approval, '') <> 'approved' then
    if carrier_owner_type = 'user' then
      who_sees := 'owner';
      owner := carrier_owner;
    else
      who_sees := 'gm';
    end if;
  end if;
end;
$$;

create function private.log_audience_everyone(out who_sees text, out owner uuid)
language sql immutable set search_path = '' as $$ select 'all'::text, null::uuid; $$;
create function private.log_audience_gm_only(out who_sees text, out owner uuid)
language sql immutable set search_path = '' as $$ select 'gm'::text, null::uuid; $$;

create function private.log_audience_campaigns(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
create function private.log_audience_members(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
create function private.log_audience_companies(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
create function private.log_audience_field_definitions(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
create function private.log_audience_campaign_packs(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;

create function private.log_audience_invites(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_gm_only(); $$;
create function private.log_audience_actor_secrets(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_gm_only(); $$;
create function private.log_audience_campaign_pack_secrets(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_gm_only(); $$;
create function private.log_audience_library_entry_secrets(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_gm_only(); $$;
create function private.log_audience_inventory_line_secrets(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_gm_only(); $$;

-- A note carries its own audience (copied from the entry it was added to).
create function private.log_audience_notes(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select coalesce(new_row, old_row) ->> 'audience', (coalesce(new_row, old_row) ->> 'owner_user_id')::uuid;
$$;

-- Like reading the entries: stat blocks, tables, treasure and the rest are the GM's; so is an item that isn't for
-- sale (players may know it, but its changes are the GM's to tell).
create function private.log_audience_library_entries(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select case
    when not private.player_facing(coalesce(new_row, old_row) ->> 'kind')
      or (coalesce(new_row, old_row) ->> 'kind' = 'item' and not private.for_sale(coalesce(new_row, old_row) -> 'data'))
    then 'gm' else 'all' end, null::uuid;
$$;

-- Portraits and sigils are everyone's; other files are the GM's.
create function private.log_audience_assets(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select case when coalesce(new_row, old_row) ->> 'kind' not in ('portrait', 'sigil') then 'gm' else 'all' end, null::uuid;
$$;

-- A character's changes are its player's and the GM's until it's approved (or a party or GM character's, the GM's).
create function private.log_audience_actors(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select
    case
      when coalesce(new_row ->> 'approval', '') <> 'approved' and coalesce(old_row ->> 'approval', '') <> 'approved'
      then case when coalesce(new_row, old_row) ->> 'owner_type' = 'user' then 'owner' else 'gm' end
      else 'all'
    end,
    case
      when coalesce(new_row ->> 'approval', '') <> 'approved' and coalesce(old_row ->> 'approval', '') <> 'approved'
        and coalesce(new_row, old_row) ->> 'owner_type' = 'user'
      then (coalesce(new_row, old_row) ->> 'owner_user_id')::uuid
    end;
$$;

-- What a character carries or owns: seen like the character itself.
create function private.log_audience_inventory_lines(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select * from private.audience_of_character((coalesce(new_row, old_row) ->> 'actor_id')::uuid);
$$;
create function private.log_audience_carrier_loads(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select * from private.audience_of_character((coalesce(new_row, old_row) ->> 'actor_id')::uuid);
$$;
create function private.log_audience_character_layouts(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select * from private.audience_of_character((coalesce(new_row, old_row) ->> 'actor_id')::uuid);
$$;
create function private.log_audience_character_play(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select * from private.audience_of_character((coalesce(new_row, old_row) ->> 'actor_id')::uuid);
$$;
create function private.log_audience_company_invitations(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select * from private.audience_of_character((coalesce(new_row, old_row) ->> 'actor_id')::uuid);
$$;

-- Who sees a table's log line: its own function; a table without one logs for the GM only.
create function private.log_audience(table_name text, old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if to_regprocedure(format('private.%I(jsonb, jsonb)', 'log_audience_' || table_name)) is null then
    who_sees := 'gm';
    owner := null;
    return;
  end if;
  execute format('select a.who_sees, a.owner from private.%I($1, $2) a', 'log_audience_' || table_name)
    into who_sees, owner using old_row, new_row;
end;
$$;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and (p.proname like 'log_audience%' or p.proname = 'audience_of_character')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- The log: as in 20261028100000_m4b_known_items.sql, but who sees it comes from the table's own function, the version
-- number is left out (it isn't something anyone changed, and undo never puts it back), and the request's part is kept.
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

  -- Who may see it: like the rows themselves (the table's own function).
  select a.who_sees, a.owner into who_sees, owner from private.log_audience(tg_table_name, old_row, new_row) a;

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
    fiat, reason, audience, owner_user_id, request_id, request_part, reverts_event_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, request, part, reverting
  );
  return null;
end;
$$;

-- For supabase/tests/m5-intents.test.ts only (the service key): who sees a line by each table's function now, and by
-- the one block private.log_change had until this migration (copied unchanged from 20261028100000), side by side.
create function public.log_audience_check(table_name text, old_row jsonb, new_row jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
  carrier_approval text;
  carrier_owner_type text;
  carrier_owner uuid;
  who_sees text := 'all';
  owner uuid;
  now_sees text;
  now_owner uuid;
begin
  if table_name = 'notes' then
    who_sees := this_row ->> 'audience';
    owner := (this_row ->> 'owner_user_id')::uuid;
  elsif table_name in ('invites', 'actor_secrets', 'campaign_pack_secrets', 'library_entry_secrets', 'inventory_line_secrets') then
    who_sees := 'gm';
  elsif table_name = 'library_entries'
    and (not private.player_facing(this_row ->> 'kind')
         or (this_row ->> 'kind' = 'item' and not private.for_sale(this_row -> 'data'))) then
    who_sees := 'gm';
  elsif table_name = 'assets' and this_row ->> 'kind' not in ('portrait', 'sigil') then
    who_sees := 'gm';
  elsif table_name <> 'actors' and this_row ? 'actor_id' and this_row ->> 'actor_id' is not null then
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
  elsif table_name = 'actors'
    and coalesce(new_row ->> 'approval', '') <> 'approved'
    and coalesce(old_row ->> 'approval', '') <> 'approved' then
    if this_row ->> 'owner_type' = 'user' then
      who_sees := 'owner';
      owner := (this_row ->> 'owner_user_id')::uuid;
    else
      who_sees := 'gm';
    end if;
  end if;
  select a.who_sees, a.owner into now_sees, now_owner from private.log_audience(table_name, old_row, new_row) a;
  return jsonb_build_object(
    'before', jsonb_build_object('audience', who_sees, 'owner', owner),
    'now', jsonb_build_object('audience', now_sees, 'owner', now_owner)
  );
end;
$$;
revoke execute on function public.log_audience_check(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.log_audience_check(text, jsonb, jsonb) to service_role;

-- 4. The tier line, written once by the database --------------------------------------------------------------------
-- The setting rules' encumbrance, as src/app/campaignSetting.ts and src/modules/library (options.ts, stack.ts)
-- combine it: each rules set with its pack's optional rules applied, lowest in the stack first, each one higher
-- filling in only what it says.

-- Deep merge, b over a: objects merge; anything else replaces (options.ts and encumbrance.ts `merge`).
create function private.jsonb_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  merged jsonb;
  k text;
  v jsonb;
begin
  if a is null or b is null or jsonb_typeof(a) <> 'object' or jsonb_typeof(b) <> 'object' then
    return b;
  end if;
  merged := a;
  for k, v in select e.key, e.value from jsonb_each(b) e loop
    merged := merged || jsonb_build_object(k, case when merged ? k then private.jsonb_merge(merged -> k, v) else v end);
  end loop;
  return merged;
end;
$$;

-- Each `byOption` override ("option=choice") whose choice was made, merged over the base (options.ts applyChoices).
create function private.apply_choices(base jsonb, by_option jsonb, choices jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  resolved jsonb := base;
  k text;
  v jsonb;
begin
  if jsonb_typeof(by_option) = 'object' then
    for k, v in select e.key, e.value from jsonb_each(by_option) e loop
      if position('=' in k) > 0 and split_part(k, '=', 1) <> ''
        and choices ->> split_part(k, '=', 1) = split_part(k, '=', 2) then
        resolved := private.jsonb_merge(resolved, v);
      end if;
    end loop;
  end if;
  return resolved;
end;
$$;

-- A section as the campaign uses it: inner sections first; `{ default, byOption }` stands for a plain value
-- (options.ts resolveSection).
create function private.resolve_section(section jsonb, choices jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  inner_values jsonb := '{}'::jsonb;
  k text;
  v jsonb;
  plain boolean;
begin
  for k, v in select e.key, e.value from jsonb_each(section - 'byOption') e loop
    inner_values := inner_values || jsonb_build_object(k, case when jsonb_typeof(v) = 'object' then private.resolve_section(v, choices) else v end);
  end loop;
  plain := (select count(*) from jsonb_object_keys(inner_values)) = 1 and inner_values ? 'default'
    and jsonb_typeof(inner_values -> 'default') <> 'object' and section ? 'byOption';
  return private.apply_choices(case when plain then inner_values -> 'default' else inner_values end, section -> 'byOption', choices);
end;
$$;

-- A rules set's encumbrance section after the optional rules chosen (options.ts resolveRules), or null.
create function private.resolved_encumbrance(rules_set jsonb, choices jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  with_top jsonb := private.apply_choices(rules_set - 'byOption', rules_set -> 'byOption', choices);
begin
  if jsonb_typeof(with_top -> 'encumbrance') = 'object' then
    return private.resolve_section(with_top -> 'encumbrance', choices);
  end if;
  return null;
end;
$$;

-- The campaign's encumbrance rules, combined: one rules set per id (the GM's exception, then the homebrew layer,
-- then the higher priority, as stack.ts), lowest pack first, each merged over the ones below (campaignSetting.ts).
create function private.campaign_encumbrance(campaign uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  combined jsonb := '{}'::jsonb;
  section jsonb;
begin
  for section in
    with links as (
      select cp.pack_id, cp.priority, (p.kind = 'homebrew') as homebrew, coalesce(cp.overrides, '{}'::jsonb) as overrides,
        coalesce(cp.option_choices, '{}'::jsonb) as choices
      from public.campaign_packs cp join public.packs p on p.id = cp.pack_id
      where cp.campaign_id = campaign
    ), entries as (
      select e.id, e.pack_entry_id, e.data, l.pack_id, l.priority, l.homebrew, l.choices,
        l.overrides ? ('rulesSet:' || e.pack_entry_id) as preferred,
        min(e.id::text) over (partition by e.pack_entry_id) as first_seen
      from public.library_entries e join links l on l.pack_id = e.pack_id
      where e.kind = 'rulesSet'
    ), winners as (
      select distinct on (en.pack_entry_id) en.*
      from entries en
      order by en.pack_entry_id, en.preferred desc, en.homebrew desc, en.priority desc, en.pack_id::text
    )
    select private.resolved_encumbrance(w.data, w.choices)
    from winners w
    order by w.homebrew, w.priority, w.pack_id::text desc, w.first_seen
  loop
    if jsonb_typeof(section) = 'object' then
      combined := private.jsonb_merge(combined, section);
    end if;
  end loop;
  return combined;
end;
$$;

-- A whole number 0 or more, or null (encumbrance.ts wholeOrNull).
create function private.whole_or_null(value jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'number' and value::text::numeric >= 0
    and value::text::numeric = trunc(value::text::numeric) then value::text::numeric end;
$$;

-- A mode's tiers: valid ones (a whole max, a label), lightest first (encumbrance.ts readTiers).
create function private.load_tiers(value jsonb, max_key text) returns table (label text, max_value numeric, at bigint)
language sql immutable set search_path = '' as $$
  select t.tier ->> 'label', private.whole_or_null(t.tier -> max_key), t.at
  from jsonb_array_elements(case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end) with ordinality as t(tier, at)
  where jsonb_typeof(t.tier) = 'object' and private.whole_or_null(t.tier -> max_key) is not null
    and jsonb_typeof(t.tier -> 'label') = 'string' and t.tier ->> 'label' <> '';
$$;

-- A character's lines as the load sees them (encumbrance.ts toLoadLine): approved and carried (not in the setting's
-- separate categories, or not an animal or vehicle), with the container block; `counted` is false inside a bag with a
-- fixed weight, at any depth (countedLines). No character: no lines.
create function private.load_lines(actor uuid, separate text[])
returns table (id uuid, category text, qty numeric, weight numeric, slots numeric, stack numeric, per_units numeric,
  equipped boolean, armour_type text, cap_coin numeric, cap_slots numeric, fixed numeric, is_container boolean, counted boolean)
language sql stable security definer set search_path = '' as $$
  with recursive lines as (
    select l.id, l.container_line_id as container, l.category, l.qty::numeric as qty, l.weight_coin::numeric as weight,
      l.slots::numeric as slots, l.stack::numeric as stack, l.per_units::numeric as per_units, l.equipped,
      case when jsonb_typeof(d.data -> 'armourType') = 'string' and d.data ->> 'armourType' <> 'chosen' then d.data ->> 'armourType' end as armour_type,
      private.whole_or_null(b.block -> 'capacityCoin') as cap_coin,
      private.whole_or_null(b.block -> 'capacitySlots') as cap_slots,
      private.whole_or_null(b.block -> 'fixedWeightCoin') as fixed
    from public.inventory_lines l
    cross join lateral (select case when jsonb_typeof(l.item_data) = 'object' then l.item_data else '{}'::jsonb end as data) d
    cross join lateral (select
      (case when jsonb_typeof(d.data -> 'container') = 'object' then d.data -> 'container' else '{}'::jsonb end)
      || (case when d.data ? 'fixedWeightCoin' then jsonb_build_object('fixedWeightCoin', d.data -> 'fixedWeightCoin') else '{}'::jsonb end) as block) b
    where actor is not null and l.actor_id = actor and l.approval = 'approved'
      and not (case when cardinality(separate) > 0 then l.category = any (separate)
               else coalesce(jsonb_typeof(d.data -> 'animal') = 'object' or jsonb_typeof(d.data -> 'vehicle') = 'object', false) end)
  ), up as (
    select ln.id as line, ln.container as at, array[ln.id] as seen from lines ln where ln.container is not null
    union all
    select up.line, p.container, up.seen || p.id
    from up join lines p on p.id = up.at
    where p.container is not null and not (p.id = any (up.seen))
  )
  select ln.id, ln.category, ln.qty, ln.weight, ln.slots, ln.stack, ln.per_units, ln.equipped, ln.armour_type,
    ln.cap_coin, ln.cap_slots, ln.fixed, coalesce(ln.cap_coin, ln.cap_slots, ln.fixed) is not null,
    not exists (select 1 from up join lines p on p.id = up.at where up.line = ln.id and p.fixed is not null)
  from lines ln;
$$;

-- What the tier line says for a character's load now: the tier's label, the over-max words, "Move …" in armour
-- mode, or '' when there's nothing to say (packHelpers.ts tierWords over encumbrance.ts carriedLoad). With no
-- character, the words for an empty load.
create function private.load_tier_words(campaign uuid, actor uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  raw jsonb := private.campaign_encumbrance(campaign);
  enc_mode text;
  separate text[];
  adds boolean := raw ->> 'containers' = 'add';
  total numeric;
  added numeric := 0;
  hard_max numeric;
  last_max numeric;
  tier_label text;
  is_over boolean;
  over_words text;
  coin jsonb := raw -> 'coin';
  slot jsonb := raw -> 'slot';
  armour jsonb := raw -> 'armour';
  misc boolean;
  worn text;
  carries boolean;
  movement text;
begin
  select case when c.settings -> 'encumbrance' ->> 'mode' in ('none', 'armour', 'coin', 'slot')
    then c.settings -> 'encumbrance' ->> 'mode' else 'none' end
  into enc_mode from public.campaigns c where c.id = campaign;
  if enc_mode is null or enc_mode = 'none' then
    return '';
  end if;
  select coalesce(array_agg(s.value #>> '{}'), '{}') into separate
  from jsonb_array_elements(case when jsonb_typeof(raw -> 'separateCategories') = 'array' then raw -> 'separateCategories' else '[]'::jsonb end) s
  where jsonb_typeof(s.value) = 'string';

  if enc_mode = 'slot' and jsonb_typeof(slot) = 'object' then
    select coalesce(sum(coalesce(l.slots, 0) * ceil(l.qty / greatest(1, l.stack))), 0) into total from private.load_lines(actor, separate) l where l.counted;
    if adds then
      select coalesce(sum(coalesce(l.cap_slots, 0) * l.qty), 0) into added from private.load_lines(actor, separate) l where l.counted and l.is_container and l.fixed is null;
    end if;
    select max(t.max_value) into last_max from private.load_tiers(slot -> 'tiers', 'maxSlots') t;
    hard_max := last_max + added;
    over_words := case when jsonb_typeof(slot -> 'overMax') = 'string' then slot ->> 'overMax' else '' end;
    select t.label into tier_label from private.load_tiers(slot -> 'tiers', 'maxSlots') t
    where total <= t.max_value + added order by t.max_value, t.at limit 1;
    is_over := hard_max is not null and total > hard_max;
  elsif enc_mode = 'coin' and jsonb_typeof(coin) = 'object' then
    select exists (
      select 1 from private.load_lines(actor, separate) l
      where l.counted and l.weight is null and l.fixed is null
        and l.category in (select jsonb_array_elements_text(
          case when jsonb_typeof(coin -> 'miscGearCategories') = 'array' then coin -> 'miscGearCategories' else '[]'::jsonb end))
    ) into misc;
    select coalesce(sum(case when l.fixed is not null then l.fixed * l.qty
      else round(coalesce(l.weight, 0) * l.qty / greatest(1, l.per_units)) end), 0)
    into total from private.load_lines(actor, separate) l where l.counted;
    if misc then
      total := total + coalesce(private.whole_or_null(coin -> 'miscGearCoin'), 0);
    end if;
    if adds then
      select coalesce(sum(coalesce(l.cap_coin, 0) * l.qty), 0) into added from private.load_lines(actor, separate) l where l.counted and l.is_container and l.fixed is null;
    end if;
    hard_max := private.whole_or_null(coin -> 'maxLoadCoin') + added;
    over_words := case when jsonb_typeof(coin -> 'overMax') = 'string' then coin ->> 'overMax' else '' end;
    select t.label into tier_label from private.load_tiers(coin -> 'tiers', 'max') t
    where total <= t.max_value + added order by t.max_value, t.at limit 1;
    is_over := case when hard_max is not null then total > hard_max
      else tier_label is null and exists (select 1 from private.load_tiers(coin -> 'tiers', 'max')) end;
  elsif enc_mode = 'armour' and jsonb_typeof(armour) = 'object' then
    select coalesce(sum(coalesce(l.weight, private.whole_or_null(raw -> 'treasureWeights' -> l.category), 0) * l.qty), 0),
      count(*) > 0
    into total, carries
    from private.load_lines(actor, separate) l
    where l.counted and jsonb_typeof(raw -> 'treasureWeights') = 'object' and (raw -> 'treasureWeights') ? l.category;
    -- The heaviest armour worn, through the pack's map ("none" when nothing maps).
    select coalesce((
      select r.row_name from (
        select case when jsonb_typeof(armour -> 'armourTypes' -> l.armour_type) = 'string' then armour -> 'armourTypes' ->> l.armour_type else '' end as row_name
        from private.load_lines(actor, separate) l where l.equipped and l.armour_type is not null
      ) r
      where r.row_name in ('light', 'heavy')
      order by array_position(array['none', 'light', 'heavy'], r.row_name) desc limit 1
    ), 'none') into worn;
    select case when carries then
        case when jsonb_typeof(m.value -> 'withTreasure') = 'string' then m.value ->> 'withTreasure' else '' end
      else case when jsonb_typeof(m.value -> 'withoutTreasure') = 'string' then m.value ->> 'withoutTreasure' else '' end end
    into movement
    from jsonb_array_elements(case when jsonb_typeof(armour -> 'movement') = 'array' then armour -> 'movement' else '[]'::jsonb end)
      with ordinality as m(value, at)
    where jsonb_typeof(m.value) = 'object'
      and (case when jsonb_typeof(m.value -> 'armour') = 'string' then m.value ->> 'armour' else '' end) = worn
    order by m.at limit 1;
    hard_max := private.whole_or_null(armour -> 'maxLoadCoin');
    is_over := hard_max is not null and total > hard_max;
    if is_over then
      return 'Over the limit';
    end if;
    return case when coalesce(movement, '') <> '' then 'Move ' || movement else '' end;
  else
    return '';
  end if;

  if is_over then
    return coalesce(nullif(over_words, ''), 'Over the limit');
  end if;
  return coalesce(tier_label, '');
end;
$$;

-- A character's tier, worked out again; when it differs from the last one, the line "<name> is now <tier>" is
-- written once. The character's row is locked first, so two changes at once write one line between them. A
-- character's first tier is written quietly when it's what an empty pack would say.
create function private.record_load_tier(actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  campaign uuid;
  was text;
  tier text;
  who_sees text;
  owner uuid;
  line_level text;
begin
  select a.campaign_id into campaign from public.actors a where a.id = actor;
  if campaign is null or not exists (select 1 from public.campaigns c where c.id = campaign) then
    return;
  end if;
  insert into public.carrier_loads (actor_id, campaign_id, tier)
  values (actor, campaign, left(private.load_tier_words(campaign, null), 60))
  on conflict (actor_id) do nothing;
  select c.tier into was from public.carrier_loads c where c.actor_id = actor for update;
  tier := left(private.load_tier_words(campaign, actor), 60);
  if tier = '' or tier = was then
    return;
  end if;
  update public.carrier_loads set tier = record_load_tier.tier where actor_id = actor;
  select a.who_sees, a.owner into who_sees, owner
  from private.log_audience('carrier_loads', null, jsonb_build_object('actor_id', actor)) a;
  select c.level into line_level from public.logged_commands c where c.name = 'load.tier';
  insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, before, after, audience, owner_user_id)
  values (campaign, 'load.tier', coalesce(line_level, 'simple'), (select auth.uid()), 'carrier_loads', actor,
    jsonb_build_object('tier', was), jsonb_build_object('tier', tier), who_sees, owner);
end;
$$;
revoke execute on function private.record_load_tier(uuid) from public, anon, authenticated;

-- At the end of a change to a character's items (deferred, so a split, a whole container or an undo counts once).
create function private.settle_load_tier() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- A fault here must never stop items being saved: the change stands, without its tier line.
  begin
    if tg_op in ('UPDATE', 'DELETE') and old.actor_id is not null then
      perform private.record_load_tier(old.actor_id);
    end if;
    if tg_op in ('INSERT', 'UPDATE') and new.actor_id is not null
      and (tg_op = 'INSERT' or new.actor_id is distinct from old.actor_id) then
      perform private.record_load_tier(new.actor_id);
    end if;
  exception when others then
    raise warning 'The tier line was skipped: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke execute on function private.settle_load_tier() from public, anon, authenticated;
create constraint trigger settle_load_tier after insert or update or delete on public.inventory_lines
  deferrable initially deferred
  for each row execute function private.settle_load_tier();

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('jsonb_merge', 'apply_choices', 'resolve_section', 'resolved_encumbrance',
      'campaign_encumbrance', 'whole_or_null', 'load_tiers', 'load_lines', 'load_tier_words')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- Devices no longer write the tier: the database does, and logs it itself.
drop trigger log_change on public.carrier_loads;
drop policy "carrier loads: who may change the carrier" on public.carrier_loads;
drop policy "carrier loads: who may change the carrier, again" on public.carrier_loads;
revoke insert, update on public.carrier_loads from authenticated;

-- Characters with items and no tier yet: their tier now, quietly (no log line).
do $$
declare
  a record;
begin
  for a in
    select distinct l.actor_id, l.campaign_id from public.inventory_lines l
    where l.actor_id is not null and not exists (select 1 from public.carrier_loads c where c.actor_id = l.actor_id)
  loop
    begin
      insert into public.carrier_loads (actor_id, campaign_id, tier)
      values (a.actor_id, a.campaign_id, left(private.load_tier_words(a.campaign_id, a.actor_id), 60))
      on conflict (actor_id) do nothing;
    exception when others then
      raise notice 'No tier for %: %', a.actor_id, sqlerrm;
    end;
  end loop;
end;
$$;
