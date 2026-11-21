-- M5 step 10: starting and the clock (docs/05 "Expeditions, time and light"; docs/06 "Dungeon play"; ruled
-- 2026-10-30, DG1 and DG3).
--   1. expedition_places: where an expedition started (Start expedition's optional Where?: a recent place, or a
--      typed name), with the mode it started in, so "recent places" can offer it again and pick its mode. One row per
--      expedition at most. Only the GM reads it (DG9: the place is the GM's until Show players; hidden means hidden),
--      so its log lines are the GM's too (no log_audience function of its own). Places per group, with Show players,
--      come in step 11; this is the minimal start place until then.
--   2. start_expedition takes the optional place (a third argument, default none): the same request writes the
--      expedition and its place, and Undo of the start marks both undone (made records, private.made_tables).
--   3. Check now (DG3): an ad-hoc wandering check at any time, recorded like a check (record_check) under its own
--      logged command, check.now (Simple); the regular schedule carries on. Undo marks its result undone.
-- Drops and remakes public.start_expedition (newest copy in 20261029170000_m5_clock.sql) with one more argument
-- (functions only). Adds one table, its rules, triggers and policies, and logged-command rows. Drops nothing; no
-- rows are removed.

-- 1. Where an expedition started ---------------------------------------------------------------------------------

create table public.expedition_places (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid not null unique references public.expeditions (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  -- The exploration mode the expedition started in (Recent places picks it again).
  mode text not null check (length(trim(mode)) between 1 and 200),
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expedition_places_campaign on public.expedition_places (campaign_id, created_at desc) where not undone;

alter table public.expedition_places enable row level security;
grant select, insert, update on public.expedition_places to authenticated;
grant select, insert, update, delete on public.expedition_places to service_role;

-- The GM's alone: players never receive it (DG9).
create policy "expedition places: the GM reads" on public.expedition_places
  for select to authenticated using (private.is_gm(campaign_id));
create policy "expedition places: the GM keeps them" on public.expedition_places
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "expedition places: the GM keeps them, again" on public.expedition_places
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- A new place: trimmed, made by whoever starts the expedition, in the expedition's campaign. A change: only undo's
-- mark (undone) may change; an undone place stays as it is.
create function private.expedition_place_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.expeditions x where x.id = new.expedition_id and x.campaign_id = new.campaign_id) then
      raise exception 'That expedition isn''t in this campaign.';
    end if;
    new.name := trim(new.name);
    new.mode := trim(new.mode);
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone then
    raise exception 'That place was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.name is distinct from old.name or new.mode is distinct from old.mode or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.expedition_place_rules() from public, anon, authenticated;

create trigger expedition_place_rules before insert or update on public.expedition_places
  for each row execute function private.expedition_place_rules();
create trigger refuse_when_retired before insert or update or delete on public.expedition_places
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.expedition_places
  for each row execute function private.log_change();

-- Undo of the start marks it undone (it has an `undone` column, so private.made_tables counts it).
insert into public.undoable_tables (name) values ('expedition_places');

-- 2. Start expedition, with an optional place --------------------------------------------------------------------

drop function public.start_expedition(uuid, text);

-- As in 20261029170000_m5_clock.sql, plus the optional place: blank or missing means none.
create function public.start_expedition(campaign uuid, mode_id text, place_name text default null) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('expeditions');
  expedition public.expeditions;
begin
  if made is not null then
    select * into expedition from public.expeditions x where x.id = made;
    return expedition;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if exists (select 1 from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone) then
    raise exception 'An expedition is already under way. End it first.';
  end if;
  if place_name is not null and length(trim(place_name)) > 200 then
    raise exception 'A place''s name is at most 200 characters.';
  end if;
  insert into public.expeditions (campaign_id, mode) values (campaign, trim(mode_id)) returning * into expedition;
  if place_name is not null and length(trim(place_name)) > 0 then
    insert into public.expedition_places (campaign_id, expedition_id, name, mode)
    values (campaign, expedition.id, trim(place_name), expedition.mode);
  end if;
  update public.campaigns c set mode = 'adventure' where c.id = campaign and c.mode <> 'adventure';
  return expedition;
end;
$$;
revoke execute on function public.start_expedition(uuid, text, text) from public, anon;
grant execute on function public.start_expedition(uuid, text, text) to authenticated, service_role;

-- 3. Logged-command rows ----------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('check.now', 'simple', true);
-- Its result is made like a check's, so undo marks it undone.
insert into public.undoable_makings (name) values ('check.now');
