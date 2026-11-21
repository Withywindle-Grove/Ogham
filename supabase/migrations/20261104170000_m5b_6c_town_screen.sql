-- M5b step 6c, the town screen (docs/plans/m5b-6-settlements.md "Step 6c"; ruled 2026-10-30, ST3 and ST12; bq3-1:
-- a place marked Safe or Hostile is a settlement place, design/rulings/m5b-builder-questions-3-2026-11-04.md).
--   1. places.town: what the GM has set for the places in a town (the setting's services and lodgings, by a key such
--      as "service:buy-gear" or "lodging:the drowned goat"): each entry's name and kind as the screen showed them,
--      whether players are shown it (Show players), and whether it's open (Open / Closed). A place in town nobody
--      touched has no entry (hidden, open). The column sits on public.places, which only the GM reads ("places: the
--      GM reads", 20261102100000), so a hidden place in town never reaches a player's device (hard rule 5). The
--      existing log_change trigger on places logs each change, so Undo puts the old value back.
--   2. private.town_visit: where a group is for the town screen: its current visit in the newest expedition, under
--      way or ended (after End expedition the party stays where it is, dt-2; in town and in Downtime the screen is
--      the last expedition's last place). A new expedition with no place yet: none.
--   3. public.scene_town: a player's view: for each of their groups at a settlement place, the place's name and the
--      places in town shown to players (name, kind, open), and nothing else (no hidden entry, no Safe or Hostile).
--   4. A group's signal (group_place_signals) ticks when a town its players are in changes (an entry shown, hidden,
--      opened or closed, or the place's safety), so their Scene reads it again.
--   5. Two logged_commands rows: town.showPlace and town.openPlace (Verbose, the GM's), as place.showPiece.
-- Adds one column, a check trigger, two functions, a trigger and two logged_commands rows. Replaces no function.
-- Drops nothing; no rows are removed, renamed or changed.

-- 1. -----------------------------------------------------------------------------------------------------------------

alter table public.places
  add column town jsonb not null default '{}'::jsonb
    check (jsonb_typeof(town) = 'object' and length(town::text) <= 40000);

comment on column public.places.town is
  'The places in town (ST3): { "<key>": { name, kind, shown, open } }, the GM''s; no entry: hidden and open.';

-- Each entry: a key of 1–200 characters; an object with a name (1–200), a kind (up to 40), shown and open (booleans).
create function private.check_place_town() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry record;
begin
  for entry in select key, value from jsonb_each(new.town) loop
    if length(entry.key) not between 1 and 200
      or jsonb_typeof(entry.value) is distinct from 'object'
      or jsonb_typeof(entry.value -> 'name') is distinct from 'string'
      or length(trim(entry.value ->> 'name')) not between 1 and 200
      or (entry.value ? 'kind' and (jsonb_typeof(entry.value -> 'kind') is distinct from 'string' or length(entry.value ->> 'kind') > 40))
      or jsonb_typeof(entry.value -> 'shown') is distinct from 'boolean'
      or jsonb_typeof(entry.value -> 'open') is distinct from 'boolean' then
      raise exception 'That place in town isn''t written right.';
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function private.check_place_town() from public, anon, authenticated;

create trigger check_place_town before insert or update of town on public.places
  for each row execute function private.check_place_town();

-- 2. -----------------------------------------------------------------------------------------------------------------

-- The group's visit the town screen reads: its current (not moved on) visit in the campaign's newest expedition that
-- wasn't undone, whether that expedition is under way or ended. Security invoker, as current_group_place.
create function private.town_visit(campaign uuid, group_no integer) returns public.group_places
language sql stable security invoker set search_path = '' as $$
  select gp.* from public.group_places gp
  where gp.campaign_id = campaign and gp.group_number = group_no and not gp.undone and not gp.moved_on
    and gp.expedition_id = (
      select x.id from public.expeditions x
      where x.campaign_id = campaign and not x.undone
      order by x.created_at desc, x.id desc
      limit 1
    )
  order by gp.created_at desc, gp.id desc
  limit 1;
$$;
-- Called only from the security-definer functions below.
revoke execute on function private.town_visit(uuid, integer) from public, anon, authenticated;

-- 3. -----------------------------------------------------------------------------------------------------------------

create function public.scene_town(campaign uuid)
returns table (group_number integer, place_name text, entry_key text, name text, kind text, open boolean)
language sql stable security definer set search_path = '' as $$
  select v.group_number, p.name, e.key, e.value ->> 'name', coalesce(e.value ->> 'kind', ''), (e.value ->> 'open')::boolean
  from public.party_groups g
  cross join lateral private.town_visit(g.campaign_id, g.number) v
  join public.places p on p.id = v.place_id and not p.undone and p.safety is not null
  cross join lateral jsonb_each(p.town) e
  where g.campaign_id = campaign and private.in_my_group(campaign, g.number)
    and (e.value ->> 'shown') = 'true'
  order by v.group_number, lower(e.value ->> 'name'), e.key;
$$;
revoke execute on function public.scene_town(uuid) from public, anon;
grant execute on function public.scene_town(uuid) to authenticated, service_role;

-- 4. -----------------------------------------------------------------------------------------------------------------

-- A town changed (its entries or its safety): every group whose town visit is there sees something else.
create function private.tick_town() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g record;
begin
  if old.town is distinct from new.town or old.safety is distinct from new.safety then
    for g in select pg.campaign_id, pg.number from public.party_groups pg where pg.campaign_id = new.campaign_id loop
      if (private.town_visit(g.campaign_id, g.number)).place_id is not distinct from new.id then
        perform private.tick_group(g.campaign_id, g.number);
      end if;
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.tick_town() from public, anon, authenticated;

create trigger tick_town after update of town, safety on public.places
  for each row execute function private.tick_town();

-- 5. -----------------------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('town.showPlace', 'verbose', true),
  ('town.openPlace', 'verbose', true);
