-- M5 step 7 fix: a burnt-out holder (a lantern) needs a refill until it gets one, whichever light is current
-- (docs/05 "Expeditions, time and light": a holder stays and is refilled with one fuel item; ruled M5-9).
-- Before, the "needs a refill" state lived only on the character's light row, so switching to a torch and back lit
-- the empty lantern for its whole length without using any fuel. Now it sticks to the item line itself:
--   1. inventory_lines.needs_fuel (false by default): set when a holder burns out with the clock (and Keep lit didn't
--      relight it), cleared by a refill. It goes wherever the line goes (given to someone, put in the stash).
--   2. light_light refuses a line that needs fuel ("It burnt out. Refill it first."), as it already did for the
--      current light.
--   3. refill_light clears it; refill_and_light (new) refills a holder that isn't the current light and lights it
--      (the Light picker's "Refill and light"), logged as light.refill like Refill.
--   4. burn_lights marks a holder that burnt out (in the time move's request, so undoing the move clears it again).
-- Replaces public.light_light, public.refill_light and private.burn_lights (their only, newest copies are in
-- 20261030161000_m5_light.sql). Adds a column and a function. Drops nothing; no rows are removed or changed.

alter table public.inventory_lines add column needs_fuel boolean not null default false;

-- As in 20261030161000_m5_light.sql, plus: refused for a line that needs fuel (it burnt out and wasn't refilled).
create or replace function public.light_light(
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
  if carried.needs_fuel
    or (found.lit_at is null and found.out_at is not null and found.line_id = line and found.fuel_item is not null) then
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

-- As in 20261030161000_m5_light.sql, plus: the holder's line no longer needs fuel.
create or replace function public.refill_light(actor uuid, seen_version integer default null) returns public.character_lights
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
  update public.inventory_lines l set needs_fuel = false where l.id = found.line_id and l.needs_fuel;
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

-- Refill and light: a holder in the carrier's pack that isn't the light they're using now (it burnt out earlier, and
-- they lit something else since) uses one fuel item and becomes their light, lit for its whole length at the clock's
-- time. The device works out the light type's lengths, as for Light. Refused when the line isn't the character's,
-- for a light without fuel, and when the pack has none. A repeat changes nothing.
create function public.refill_and_light(
  actor uuid,
  line uuid,
  light_type text,
  light_name text,
  burn_seconds bigint,
  warn_seconds bigint,
  fuel_item text,
  seen_version integer default null
) returns public.character_lights
language plpgsql security invoker set search_path = '' as $$
declare
  found public.character_lights := private.light_of(actor);
  carried public.inventory_lines;
  fuel uuid;
begin
  if private.repeated_request('character_lights', found.id) then
    return found;
  end if;
  if light_type is null or length(trim(light_type)) not between 1 and 200 or light_name is null or length(trim(light_name)) not between 1 and 200 then
    raise exception 'Which light?';
  end if;
  if burn_seconds is null or burn_seconds < 1 or (warn_seconds is not null and warn_seconds < 0)
    or fuel_item is null or length(trim(fuel_item)) not between 1 and 200 then
    raise exception 'That light doesn''t take fuel.';
  end if;
  select * into carried from public.inventory_lines l where l.id = line;
  if carried.id is null or carried.actor_id is distinct from actor or carried.approval <> 'approved' or carried.qty < 1 then
    raise exception 'That light isn''t in their pack any more.';
  end if;
  if found.lit_at is not null and found.line_id = line then
    raise exception 'That light is already lit.';
  end if;
  fuel := private.fuel_line(actor, trim(fuel_item));
  if fuel is null then
    raise exception 'There''s no fuel left in their pack.';
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  perform private.use_one(fuel);
  update public.inventory_lines l set needs_fuel = false where l.id = line and l.needs_fuel;
  update public.character_lights l
  set line_id = line, type_id = trim(light_type), name = trim(light_name), lit_at = private.clock_now(l.campaign_id),
    burn_seconds = refill_and_light.burn_seconds, full_seconds = refill_and_light.burn_seconds,
    warn_seconds = refill_and_light.warn_seconds, left_seconds = null, consumed = false,
    fuel_item = trim(refill_and_light.fuel_item), out_at = null,
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
revoke execute on function public.refill_and_light(uuid, uuid, text, text, bigint, bigint, text, integer) from public, anon;
grant execute on function public.refill_and_light(uuid, uuid, text, text, bigint, bigint, text, integer) to authenticated, service_role;

-- As in 20261030161000_m5_light.sql, plus: a holder that burns out and isn't relit needs fuel (marked on its line).
create or replace function private.burn_lights(campaign uuid, from_at bigint, to_at bigint) returns void
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
      if not light.consumed and light.fuel_item is not null and light.line_id is not null then
        update public.inventory_lines l set needs_fuel = true where l.id = light.line_id and not l.needs_fuel;
      end if;
    end if;
  end loop;
  perform set_config('grimoire.event_type', '', true);
end;
$$;
