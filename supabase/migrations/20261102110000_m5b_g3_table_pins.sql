-- M5b step g3 (docs/plans/m5b-g3-encounter-tables.md; M5 gate B2, ruled 2026-11-01; docs/05 "Encounter tables, full
-- screen"): the GM's pins for this session, and a row read from a table without a hit ("rolled by hand").
--   1. table_pins: a table the GM pinned in the Tables › library (prep). A pin belongs to the session it was made in,
--      or, made between sessions, to the next one; it ends with that session. Nothing is removed when a session
--      ends: a pin simply counts only while no session (not undone) has ended since it was made
--      (public.table_pins_now), so undoing End session brings the pins back. Unpinning marks it unpinned.
--   2. table_reads: a row the GM tapped on a table opened without a hit (from Explore's Encounter tables row):
--      the table, the row's range and its result. A hit's row is kept with the check's result, as before
--      (set_check_roll, check.setRoll).
--   3. What the app calls: pin_table, unpin_table (refused from an old copy), table_pins_now, read_table_by_hand.
--      The table must be one of the campaign's setting rules' tables. Each is an intent with a request id: a repeat
--      changes nothing.
--   4. Both are the GM's alone: tables never reach players' devices, so neither do pins or reads, nor their log
--      lines (no log audience function: the GM's only). Undo marks a made pin or read undone (never removed, hard
--      rule 4); undoing Unpin puts the pin back. Logged commands: tables.pin and tables.unpin (Verbose; prep, not
--      play), tables.readByHand (Simple, like a hit's row).
-- Adds two tables with their rules, triggers and policies, five functions and rows in logged_commands,
-- undoable_tables and undoable_makings. Replaces nothing; drops nothing; no rows are removed.

-- 1. The tables ------------------------------------------------------------------------------------------------------

create table public.table_pins (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The table entry's id in the setting rules.
  table_id text not null check (length(table_id) between 1 and 200),
  pinned_at timestamptz not null default now(),
  unpinned_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index table_pins_campaign on public.table_pins (campaign_id, pinned_at);

create table public.table_reads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expedition_id uuid references public.expeditions (id) on delete set null,
  table_id text not null check (length(table_id) between 1 and 200),
  -- The row's range as shown ("4–5"), and its result in words (with the tables it went through).
  roll text not null check (length(roll) between 1 and 20),
  row_text text not null check (length(row_text) between 1 and 1000),
  at_seconds bigint not null default 0 check (at_seconds >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index table_reads_campaign on public.table_reads (campaign_id, created_at desc);

alter table public.table_pins enable row level security;
alter table public.table_reads enable row level security;
grant select, insert, update on public.table_pins, public.table_reads to authenticated;
grant select, insert, update, delete on public.table_pins, public.table_reads to service_role;

-- The GM's alone: players never read them.
create policy "table pins: the GM reads" on public.table_pins
  for select to authenticated using (private.is_gm(campaign_id));
create policy "table pins: the GM pins" on public.table_pins
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "table pins: the GM unpins" on public.table_pins
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));
create policy "table reads: the GM reads" on public.table_reads
  for select to authenticated using (private.is_gm(campaign_id));
create policy "table reads: the GM records one" on public.table_reads
  for insert to authenticated with check (private.is_gm(campaign_id));
create policy "table reads: the GM undoes one" on public.table_reads
  for update to authenticated using (private.is_gm(campaign_id)) with check (private.is_gm(campaign_id));

-- 2. What the database decides, whatever a device sends ---------------------------------------------------------------

-- A pin starts now, made by whoever makes it. A change: only unpinning (and, by undo, undone or pinned again).
create function private.table_pin_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  new.table_id := trim(new.table_id);
  if tg_op = 'INSERT' then
    new.pinned_at := now();
    new.unpinned_at := null;
    new.undone := false;
    new.created_by := (select auth.uid());
  else
    new.campaign_id := old.campaign_id;
    new.table_id := old.table_id;
    new.pinned_at := old.pinned_at;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if not reverting then
      new.undone := old.undone;
      -- Unpinning sets the time once; only undo clears it.
      if old.unpinned_at is not null or new.unpinned_at is null then
        new.unpinned_at := old.unpinned_at;
      else
        new.unpinned_at := now();
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.table_pin_rules() from public, anon, authenticated;

-- A read is kept as made: where the clock was and the expedition under way; only undo changes it (marks it undone).
create function private.table_read_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    new.table_id := trim(new.table_id);
    new.roll := trim(new.roll);
    new.row_text := trim(new.row_text);
    select c.seconds into new.at_seconds from public.campaign_clocks c where c.campaign_id = new.campaign_id;
    new.at_seconds := coalesce(new.at_seconds, 0);
    select x.id into new.expedition_id from public.expeditions x
    where x.campaign_id = new.campaign_id and x.ended_at is null and not x.undone;
    new.undone := false;
    new.created_by := (select auth.uid());
  elsif not reverting then
    raise exception 'A row read from a table can only be undone.';
  else
    -- Undo changes only whether it's undone.
    new.campaign_id := old.campaign_id;
    new.expedition_id := old.expedition_id;
    new.table_id := old.table_id;
    new.roll := old.roll;
    new.row_text := old.row_text;
    new.at_seconds := old.at_seconds;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.table_read_rules() from public, anon, authenticated;

create trigger check_copy_version before insert or update on public.table_pins
  for each row execute function private.check_copy_version();
create trigger table_pin_rules before insert or update on public.table_pins
  for each row execute function private.table_pin_rules();
create trigger refuse_when_retired before insert or update or delete on public.table_pins
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or delete or update of unpinned_at, undone on public.table_pins
  for each row execute function private.log_change();

create trigger check_copy_version before insert or update on public.table_reads
  for each row execute function private.check_copy_version();
create trigger table_read_rules before insert or update on public.table_reads
  for each row execute function private.table_read_rules();
create trigger refuse_when_retired before insert or update or delete on public.table_reads
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or delete or update of undone on public.table_reads
  for each row execute function private.log_change();

-- 3. What the app calls ---------------------------------------------------------------------------------------------

-- Whether a table is one of the campaign's setting rules' tables (homebrew included).
create function private.campaign_has_table(campaign uuid, table_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_packs cp
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'table' and e.pack_entry_id = trim(table_id)
    where cp.campaign_id = campaign
  );
$$;
revoke execute on function private.campaign_has_table(uuid, text) from public, anon;
grant execute on function private.campaign_has_table(uuid, text) to authenticated, service_role;

-- The pins in play now: not undone, not unpinned, and made after the last session that ended (not undone). Oldest
-- first.
create function public.table_pins_now(campaign uuid) returns setof public.table_pins
language sql stable security invoker set search_path = '' as $$
  select p.* from public.table_pins p
  where p.campaign_id = campaign and not p.undone and p.unpinned_at is null
    and p.pinned_at > coalesce((
      select max(s.ended_at) from public.sessions s
      where s.campaign_id = campaign and not s.undone and s.ended_at is not null
    ), '-infinity'::timestamptz)
  order by p.pinned_at, p.id;
$$;

-- Pin a table for this session (or the next). A repeat gives back the pin it made; a table already pinned says so.
create function public.pin_table(campaign uuid, table_id text) returns public.table_pins
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('table_pins');
  found public.table_pins;
begin
  if made is not null then
    select * into found from public.table_pins p where p.id = made;
    return found;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if table_id is null or not private.campaign_has_table(campaign, table_id) then
    raise exception 'That table isn''t in your setting rules.';
  end if;
  if exists (select 1 from public.table_pins_now(campaign) p where p.table_id = trim(pin_table.table_id)) then
    raise exception 'That table is already pinned.';
  end if;
  insert into public.table_pins (campaign_id, table_id) values (campaign, trim(table_id)) returning * into found;
  return found;
end;
$$;

-- Unpin it. Refused from an old copy; a repeat changes nothing.
create function public.unpin_table(pin uuid, seen_version integer default null) returns public.table_pins
language plpgsql security invoker set search_path = '' as $$
declare
  found public.table_pins;
begin
  select * into found from public.table_pins p where p.id = pin;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That pin was undone.';
  end if;
  if found.unpinned_at is not null then
    return found;
  end if;
  update public.table_pins p set unpinned_at = now(), version = coalesce(seen_version, p.version)
  where p.id = pin
  returning * into found;
  return found;
end;
$$;

-- A row read from a table without a hit ("rolled by hand"). A repeat gives back the read it made.
create function public.read_table_by_hand(campaign uuid, table_id text, roll text, row_text text) returns public.table_reads
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('table_reads');
  found public.table_reads;
begin
  if made is not null then
    select * into found from public.table_reads r where r.id = made;
    return found;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if table_id is null or not private.campaign_has_table(campaign, table_id) then
    raise exception 'That table isn''t in your setting rules.';
  end if;
  if nullif(trim(coalesce(roll, '')), '') is null or nullif(trim(coalesce(row_text, '')), '') is null then
    raise exception 'Tap the row the dice showed.';
  end if;
  insert into public.table_reads (campaign_id, table_id, roll, row_text)
  values (campaign, trim(table_id), left(trim(roll), 20), left(trim(row_text), 1000))
  returning * into found;
  return found;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.table_pins_now(uuid)',
    'public.pin_table(uuid, text)',
    'public.unpin_table(uuid, integer)',
    'public.read_table_by_hand(uuid, text, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 4. Undo and the logged commands -----------------------------------------------------------------------------------

insert into public.undoable_tables (name) values ('table_pins'), ('table_reads');
insert into public.undoable_makings (name) values ('tables.pin'), ('tables.readByHand');

insert into public.logged_commands (name, level, gm_only) values
  ('tables.pin', 'verbose', true),
  ('tables.unpin', 'verbose', true),
  ('tables.readByHand', 'simple', true);
