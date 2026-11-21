-- M5 step 7: light (docs/04 "LightSource"; docs/05 "Expeditions, time and light", "Items leaving play"; docs/07
-- lightTypes; ruled M5-8, M5-9, 2026-10-25, 2026-10-26, 2026-10-29 D29 and the Set time… rulings of 2026-10-29).
--   1. character_lights: one row per character (and hireling), made by the database with it: the light they're
--      using now (the item line it burns from, its light type and name), when it was lit on the campaign clock and
--      how long it burns from then (null: it never runs out), when it warns, the light type's full length, the time
--      a doused light had left (it goes on from there when the same light is lit again), whether it's used up when
--      it burns out (`consumed`) or holds a fuel item (`fuel_item`), Keep lit (off by default), and when it last
--      burnt out. Read like the character (every member sees an approved character's light: marching order); the
--      owner or the GM changes it, through the functions below. Its changes are logged; its making isn't.
--   2. What the app calls: light_light (Light, and "Light another"), douse_light (Put out), keep_light_lit (the Keep
--      lit switch) and refill_light (Refill: one fuel item from the carrier's own pack, the timer starts again).
--   3. Lights burn with the clock, in the same request that moves it (so its log line and its Undo are the time
--      move's): advance_clock (Next turn, +N, Advance by…, Downtime) and set_clock forwards burn out every light whose
--      time ran out. A used-up light leaves play: its stack loses one, the line goes with the last (hard rule 4's
--      named exception: the log keeps a copy, and undoing the time move brings it back). With Keep lit on, the
--      light is lit again at once from the carrier's own pack (another of the same light, or one fuel item), as many
--      times as the jump needs. Each light's burnout is logged as light.burnOut (Simple: "light burnouts" are in the
--      simple log), grouped with the time move. Set time… backwards gives lights their time back up to their full
--      length; burnt-out lights stay gone (ruled 2026-10-29).
--   4. The log can name a database-made part of an action (grimoire.event_type), so the burnouts inside a Next turn
--      (logged Verbose) still reach the Simple log. Replaces private.log_change (the newest copy is in
--      20261029180000_m5_reminders.sql): the same, plus that one line.
--   5. Undo: the time moves, light.burnOut and light.refill can bring back a line they removed (public.undoable_
--      deletions); character_lights is undoable. Logged-command rows.
-- Replaces public.advance_clock and public.set_clock (newest copies in 20261029170000_m5_clock.sql) and
-- private.log_change. Adds a table, its rules, triggers and policies, and functions. Drops nothing; no rows are
-- removed. Every existing character and hireling gets a light row, unlit.

-- 1. The table -------------------------------------------------------------------------------------------------------

create table public.character_lights (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null unique references public.actors (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The item line it burns from. Kept after it burns out (that line may be gone: the log keeps its copy).
  line_id uuid,
  -- The setting rules' light type (lightTypes[].id) and the light's name ("Torch").
  type_id text check (type_id is null or length(trim(type_id)) between 1 and 200),
  name text not null default '' check (length(name) <= 200),
  -- On the campaign clock (seconds): when it was lit (null: not lit), and how long it burns from then (null: it
  -- never runs out).
  lit_at bigint check (lit_at is null or lit_at >= 0),
  burn_seconds bigint check (burn_seconds is null or burn_seconds > 0),
  -- The light type's whole length (a relight, a refill and Keep lit start from it), and when it warns.
  full_seconds bigint check (full_seconds is null or full_seconds > 0),
  warn_seconds bigint check (warn_seconds is null or warn_seconds >= 0),
  -- A doused light's time left: lit again (the same line), it burns on from there.
  left_seconds bigint check (left_seconds is null or left_seconds > 0),
  consumed boolean not null default false,
  fuel_item text check (fuel_item is null or length(trim(fuel_item)) between 1 and 200),
  keep_lit boolean not null default false,
  -- When it last burnt out, on the campaign clock (null once it's lit again).
  out_at bigint check (out_at is null or out_at >= 0),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index character_lights_campaign on public.character_lights (campaign_id);

alter table public.character_lights enable row level security;
grant select, update on public.character_lights to authenticated;
grant select, insert, update, delete on public.character_lights to service_role;

-- Read like the character (as character_play): members see approved characters' lights, the owner their own draft's.
create policy "character lights: read like the character" on public.character_lights
  for select to authenticated
  using (
    exists (
      select 1 from public.actors a
      where a.id = actor_id and a.campaign_id = character_lights.campaign_id
        and (
          (private.is_gm(a.campaign_id) and not private.is_others_draft(a.id))
          or (private.is_member(a.campaign_id) and (a.approval = 'approved' or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid()))))
        )
    )
  );
-- The owner (their own approved character) or the GM (any approved character): 03, "Light / douse a light source".
create policy "character lights: the owner or the GM" on public.character_lights
  for update to authenticated using (private.may_play(campaign_id, actor_id)) with check (private.may_play(campaign_id, actor_id));

-- What the database decides, whatever a device sends: whose light it is never changes.
create function private.light_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.campaign_id is distinct from old.campaign_id then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.light_rules() from public, anon, authenticated;

-- Every character and hireling has its light row, made with it (and now for those there are), unlit.
create function private.make_character_light() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('pc', 'hireling') then
    insert into public.character_lights (actor_id, campaign_id) values (new.id, new.campaign_id) on conflict (actor_id) do nothing;
  end if;
  return null;
end;
$$;
revoke execute on function private.make_character_light() from public, anon, authenticated;
create trigger make_character_light after insert on public.actors
  for each row execute function private.make_character_light();
insert into public.character_lights (actor_id, campaign_id)
  select a.id, a.campaign_id from public.actors a where a.kind in ('pc', 'hireling')
  on conflict (actor_id) do nothing;

-- Copy versions first (by name), as for the clock. Changes are logged; the making isn't (the database makes it).
create trigger check_copy_version before insert or update on public.character_lights
  for each row execute function private.check_copy_version();
create trigger light_rules before update on public.character_lights
  for each row execute function private.light_rules();
create trigger refuse_when_retired before insert or update or delete on public.character_lights
  for each row execute function private.refuse_when_retired();
create trigger log_change after update on public.character_lights
  for each row execute function private.log_change();

-- 2. What the app calls ---------------------------------------------------------------------------------------------

-- One of a line used up (a light burnt out, a fuel item used): the stack loses one; the line goes with the last.
create function private.use_one(line uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.inventory_lines l set qty = l.qty - 1 where l.id = line and l.qty > 1;
  if not found then
    delete from public.inventory_lines l where l.id = line;
  end if;
end;
$$;
revoke execute on function private.use_one(uuid) from public, anon;
grant execute on function private.use_one(uuid) to authenticated, service_role;

-- Another of the same light in the carrier's own pack: the same line while some is left, else another line whose
-- item is that light type; null when there's none.
create function private.light_line_left(actor uuid, line uuid, light_type text) returns uuid
language sql stable security invoker set search_path = '' as $$
  select l.id from public.inventory_lines l
  where l.actor_id = actor and l.approval = 'approved' and l.qty >= 1
    and (l.id = line or (light_type is not null and l.item_data ->> 'lightTypeId' = light_type))
  order by l.id = line desc, l.created_at, l.id
  limit 1;
$$;
revoke execute on function private.light_line_left(uuid, uuid, text) from public, anon;
grant execute on function private.light_line_left(uuid, uuid, text) to authenticated, service_role;

-- A fuel item (07 lightTypes[].fuel: the item's id in the setting rules) in the carrier's own pack; null when none.
create function private.fuel_line(actor uuid, fuel text) returns uuid
language sql stable security invoker set search_path = '' as $$
  select l.id from public.inventory_lines l
  where l.actor_id = actor and l.approval = 'approved' and l.qty >= 1 and fuel is not null and l.source_entry_id = fuel
  order by l.created_at, l.id
  limit 1;
$$;
revoke execute on function private.fuel_line(uuid, text) from public, anon;
grant execute on function private.fuel_line(uuid, text) to authenticated, service_role;

-- The light row of a character this person may light (the owner, or the GM), or a refusal.
create function private.light_of(actor uuid) returns public.character_lights
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_lights;
begin
  select * into found from public.character_lights l where l.actor_id = actor;
  if found.id is null or not private.may_play(found.campaign_id, actor) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;
revoke execute on function private.light_of(uuid) from public, anon;
grant execute on function private.light_of(uuid) to authenticated, service_role;

-- Where the campaign's clock is now (0 when it has none yet).
create function private.clock_now(campaign uuid) returns bigint
language sql stable security invoker set search_path = '' as $$
  select coalesce((select c.seconds from public.campaign_clocks c where c.campaign_id = campaign), 0);
$$;
revoke execute on function private.clock_now(uuid) from public, anon;
grant execute on function private.clock_now(uuid) to authenticated, service_role;

-- Light (and "Light another"): the character's light is now this line, lit at the clock's time. The device works out
-- the light type's lengths from the setting rules (a formula from the caster's level; 07 lightTypes). The same
-- light doused earlier burns on from its time left. Refused when the line isn't the character's (approved, at least
-- one left), when that light is lit already, and for a holder that burnt out until it's refilled. Refused from an
-- old copy; a repeat changes nothing.
create function public.light_light(
  actor uuid,
  line uuid,
  light_type text,
  light_name text,
  burn_seconds bigint,
  warn_seconds bigint,
  consumed boolean,
  fuel_item text,
  seen_version integer default null
) returns public.character_lights
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_lights := private.light_of(actor);
  carried public.inventory_lines;
  burn bigint := burn_seconds;
begin
  if private.repeated_request('character_lights', found.id) then
    return found;
  end if;
  if light_type is null or length(trim(light_type)) not between 1 and 200 or light_name is null or length(trim(light_name)) not between 1 and 200 then
    raise exception 'Which light?';
  end if;
  if (burn_seconds is not null and burn_seconds < 1) or (warn_seconds is not null and warn_seconds < 0) then
    raise exception 'A light burns for a whole amount of time above 0.';
  end if;
  select * into carried from public.inventory_lines l where l.id = line;
  if carried.id is null or carried.actor_id is distinct from actor or carried.approval <> 'approved' or carried.qty < 1 then
    raise exception 'That light isn''t in their pack any more.';
  end if;
  if found.lit_at is not null and found.line_id = line then
    raise exception 'That light is already lit.';
  end if;
  if found.lit_at is null and found.out_at is not null and found.line_id = line and found.fuel_item is not null then
    raise exception 'It burnt out. Refill it first.';
  end if;
  if found.line_id = line and found.type_id = trim(light_type) and found.left_seconds is not null then
    burn := found.left_seconds;
  end if;
  update public.character_lights l
  set line_id = line, type_id = trim(light_type), name = trim(light_name), lit_at = private.clock_now(l.campaign_id),
    burn_seconds = burn, full_seconds = light_light.burn_seconds, warn_seconds = light_light.warn_seconds,
    left_seconds = null, consumed = coalesce(light_light.consumed, false),
    fuel_item = nullif(trim(coalesce(light_light.fuel_item, '')), ''), out_at = null,
    keep_lit = case when l.type_id is distinct from trim(light_type) then false else l.keep_lit end,
    version = coalesce(seen_version, l.version)
  where l.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Put out: the light stops burning and keeps its time left. Refused when it isn't lit (a repeat gives it back).
create function public.douse_light(actor uuid, seen_version integer default null) returns public.character_lights
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_lights := private.light_of(actor);
  left_now bigint;
begin
  if private.repeated_request('character_lights', found.id) then
    return found;
  end if;
  if found.lit_at is null then
    raise exception 'That light isn''t lit.';
  end if;
  left_now := case when found.burn_seconds is null then null
    else greatest(1, found.lit_at + found.burn_seconds - private.clock_now(found.campaign_id)) end;
  update public.character_lights l
  set lit_at = null, left_seconds = left_now, version = coalesce(seen_version, l.version)
  where l.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Keep lit (per light, off by default): at burnout it's lit again from the carrier's own pack, and logged.
create function public.keep_light_lit(actor uuid, keep boolean, seen_version integer default null) returns public.character_lights
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_lights := private.light_of(actor);
begin
  if keep is null then
    raise exception 'Keep it lit or not?';
  end if;
  update public.character_lights l
  set keep_lit = keep, version = coalesce(seen_version, l.version)
  where l.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Refill: a holder (a lantern) uses one fuel item from its carrier's own pack and burns its whole length again from
-- now. Refused for a light without fuel, and when the pack has none ("Out of oil" on the device). A repeat changes
-- nothing.
create function public.refill_light(actor uuid, seen_version integer default null) returns public.character_lights
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_lights := private.light_of(actor);
  fuel uuid;
begin
  if private.repeated_request('character_lights', found.id) then
    return found;
  end if;
  if found.fuel_item is null or found.line_id is null or found.full_seconds is null then
    raise exception 'That light doesn''t take fuel.';
  end if;
  if not exists (
    select 1 from public.inventory_lines l
    where l.id = found.line_id and l.actor_id = actor and l.approval = 'approved' and l.qty >= 1
  ) then
    raise exception 'That light isn''t in their pack any more.';
  end if;
  fuel := private.fuel_line(actor, found.fuel_item);
  if fuel is null then
    raise exception 'There''s no fuel left in their pack.';
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  perform private.use_one(fuel);
  update public.character_lights l
  set lit_at = private.clock_now(l.campaign_id), burn_seconds = l.full_seconds, left_seconds = null, out_at = null,
    version = coalesce(seen_version, l.version)
  where l.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.light_light(uuid, uuid, text, text, bigint, bigint, boolean, text, integer)',
    'public.douse_light(uuid, integer)', 'public.keep_light_lit(uuid, boolean, integer)', 'public.refill_light(uuid, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 3. Lights burn with the clock --------------------------------------------------------------------------------------

-- Every lit light in the campaign whose time ran out between `from_at` and `to_at` burns out: a used-up light loses
-- one of its stack (the line goes with the last); with Keep lit on it's lit again from the carrier's own pack, as many
-- times as the jump needs. Logged as light.burnOut, in the time move's request. Runs as whoever moves the clock (the
-- GM), so the access rules apply.
create function private.burn_lights(campaign uuid, from_at bigint, to_at bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  light public.character_lights;
  ends bigint;
  next_line uuid;
  relit boolean;
  rounds integer;
begin
  if from_at is null or to_at is null or to_at <= from_at then
    return;
  end if;
  perform set_config('grimoire.event_type', 'light.burnOut', true);
  for light in
    select * from public.character_lights l
    where l.campaign_id = campaign and l.lit_at is not null and l.burn_seconds is not null
      and l.lit_at + l.burn_seconds <= to_at
    order by l.lit_at + l.burn_seconds, l.actor_id
    for update
  loop
    ends := light.lit_at + light.burn_seconds;
    rounds := 0;
    loop
      rounds := rounds + 1;
      relit := false;
      if light.consumed and light.line_id is not null then
        perform private.use_one(light.line_id);
      end if;
      if light.keep_lit and light.full_seconds is not null then
        if light.consumed then
          next_line := private.light_line_left(light.actor_id, light.line_id, light.type_id);
          if next_line is not null then
            light.line_id := next_line;
            relit := true;
          end if;
        elsif light.fuel_item is not null and exists (
          select 1 from public.inventory_lines l where l.id = light.line_id and l.actor_id = light.actor_id and l.qty >= 1
        ) then
          next_line := private.fuel_line(light.actor_id, light.fuel_item);
          if next_line is not null then
            perform private.use_one(next_line);
            relit := true;
          end if;
        end if;
      end if;
      exit when not relit or ends + light.full_seconds > to_at or rounds >= 1000;
      ends := ends + light.full_seconds;
    end loop;
    if relit then
      update public.character_lights l
      set lit_at = ends, burn_seconds = l.full_seconds, line_id = light.line_id, left_seconds = null, out_at = null
      where l.id = light.id;
    else
      update public.character_lights l set lit_at = null, left_seconds = null, out_at = ends where l.id = light.id;
    end if;
  end loop;
  perform set_config('grimoire.event_type', '', true);
end;
$$;
revoke execute on function private.burn_lights(uuid, bigint, bigint) from public, anon;
grant execute on function private.burn_lights(uuid, bigint, bigint) to authenticated, service_role;

-- As in 20261029170000_m5_clock.sql, plus the lights burning down with it.
create or replace function public.advance_clock(campaign uuid, by_seconds bigint, seen_version integer default null)
returns public.campaign_clocks
language plpgsql security invoker set search_path = '' as $$
declare
  clock public.campaign_clocks;
  from_at bigint;
begin
  if by_seconds is null or by_seconds < 1 then
    raise exception 'Move the clock on by a whole amount above 0.';
  end if;
  select c.seconds into from_at from public.campaign_clocks c where c.campaign_id = campaign;
  update public.campaign_clocks c
  set seconds = c.seconds + by_seconds, version = coalesce(seen_version, c.version)
  where c.campaign_id = campaign
  returning * into clock;
  if clock.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.burn_lights(campaign, from_at, clock.seconds);
  return clock;
end;
$$;

-- As in 20261029170000_m5_clock.sql, plus the lights: forwards they burn as the clock passes; backwards they get
-- their time back, up to their whole length (a light lit after the new time starts again from it), and burnt-out
-- lights stay gone (ruled 2026-10-29).
create or replace function public.set_clock(campaign uuid, to_seconds bigint, seen_version integer default null)
returns public.campaign_clocks
language plpgsql security invoker set search_path = '' as $$
declare
  clock public.campaign_clocks;
  from_at bigint;
begin
  if to_seconds is null or to_seconds < 0 then
    raise exception 'The time can''t be before the clock started.';
  end if;
  select c.seconds into from_at from public.campaign_clocks c where c.campaign_id = campaign;
  update public.campaign_clocks c
  set seconds = to_seconds, version = coalesce(seen_version, c.version)
  where c.campaign_id = campaign
  returning * into clock;
  if clock.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if clock.seconds > from_at then
    perform private.burn_lights(campaign, from_at, clock.seconds);
  elsif clock.seconds < from_at then
    update public.character_lights l set lit_at = clock.seconds
    where l.campaign_id = campaign and l.lit_at is not null and l.lit_at > clock.seconds;
  end if;
  return clock;
end;
$$;

-- 4. The log names a database-made part of an action -----------------------------------------------------------------

-- The log: as in 20261029180000_m5_reminders.sql, plus: a part of an action the database makes itself can carry its
-- own command name (grimoire.event_type, set for the length of that part; light.burnOut inside a time move).
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
    fiat, reason, audience, owner_user_id, reveal_at, request_id, request_part, reverts_event_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, reveal, request, part, reverting
  );
  return null;
end;
$$;


-- 5. Who sees the log lines, undo, and the logged commands -----------------------------------------------------------

-- A light's lines: seen like the character.
create function private.log_audience_character_lights(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$
  select * from private.audience_of_character((coalesce(new_row, old_row) ->> 'actor_id')::uuid);
$$;
revoke execute on function private.log_audience_character_lights(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('character_lights');
-- A burnt-out light or the last fuel item leaves play (hard rule 4's named exception): undoing the time move, or the
-- refill, brings the line back.
insert into public.undoable_deletions (name) values
  ('time.advance'), ('time.advanceBy'), ('time.set'), ('time.downtime'), ('light.burnOut'), ('light.refill');

insert into public.logged_commands (name, level, gm_only) values
  ('light.light', 'verbose', false),
  ('light.douse', 'verbose', false),
  ('light.keepLit', 'verbose', false),
  ('light.refill', 'simple', false),
  ('light.burnOut', 'simple', true);
