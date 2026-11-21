-- W12: a shop's stock for the day, the record (December, the whole town; docs/plans/dec-3-the-whole-town.md row W12;
-- brief docs/plans/briefs/dec-3-w12-day-stock-brief.md; rulings tn-4 to tn-8, ap-13, ap-14, mc-73, mc-74 in
-- docs/design/rulings/dec-town-stock-2026-11-14.md and dec-town-ask-card-2026-11-14.md; Francis's yes w12-1, 2026-11-14:
-- "A new record holds each shop's stock for the day. You read and write all of it. A player reads only the lines
-- switched on (in stock today), never the ones off or undecided. It adds a table and removes nothing." Yes; and w12-2,
-- 2026-11-15: a thing with no availability at all is in stock by default).
--   1. shop_stock: the GM's answer for one thing at one shop on one campaign day: `in`, `out` or `undecided`. A shop is
--      a `buy` service of the rules set (its id); a thing is an item for sale (its pack id); the day is the campaign
--      clock's day as the app counts it (readClock(...).day, src/modules/expedition/clock.ts; day 1 is the clock's
--      first). No row means the default, computed from the item's `availability` (on the device by stockDefault,
--      src/modules/requests/shopStock.ts; here by private.stock_default, the same rules), never stored. A new day has
--      no rows, so it reads clean; yesterday's rows stay (nothing is deleted, hard rule 4).
--      WHO MAY READ IT (new; Francis's yes w12-1): the GM reads every row. A member of the campaign who is not its GM
--      reads only a live row whose answer is `in`. Nobody else reads anything. Never written straight through the
--      API: only set_shop_stock and reset_shop_stock write it, and an Undo by the GM puts it back.
--   2. set_shop_stock (stock.set): the GM sets one thing `in` or `out` for a shop on a day. A row already there that
--      day is changed (Undo puts the answer back, undecided included); none there makes one (Undo marks it undone, and
--      the thing reads as its default again).
--   3. reset_shop_stock (stock.reset): the GM puts the listed things (the device sends every thing with a chance) back
--      to `undecided` for a shop on a day: each such row that day is changed (Undo puts every answer back). A thing with
--      no row is already undecided by its default and is left alone. Returns how many rows changed.
--   4. private.stock_default: what a thing reads as before the GM answers, from its `availability` and the town's size
--      (the same rules as stockDefault; w12-2: no availability is in; tn-6: sold by size in a town of unknown size is
--      undecided, before any chance; words trimmed as JavaScript trims them, private.stock_trim).
--      public.shop_stock_default_check: the same, for the service role only (the database test's parity check).
--      shop_stock_in: the players' reader. The server works out the answer in force
--      itself, never from the device: for each item for sale in the campaign (the version that wins there, as
--      private.items_open_in picks it), a live row that day wins (in is in; out or undecided is not), else the
--      default (read from the item's whole availability, its GM-only part included; only ids come back). No place
--      carries a size the reader can use yet, so the size is unknown (sold by size: undecided). The
--      device's `offered` list only narrows what comes back; it never adds. It never returns a thing that is out or
--      undecided, its id, or a count of them.
--   5. The log: the GM's lines alone (no log_audience_shop_stock: private.log_audience reads 'gm'). Whether a player
--      reads the line of a thing coming in is not ruled (the brief's item 6, raised as a flag). logged_commands gains
--      stock.set and stock.reset (simple, the GM's); undoable_makings gains stock.set; undoable_tables gains shop_stock.
-- Adds one table with its rules, triggers and policies, six functions (set_shop_stock, reset_shop_stock,
-- private.stock_trim, private.stock_default, shop_stock_default_check, shop_stock_in) and rows in the app's command lists. Replaces
-- no function; drops, renames and deletes no data; no existing row changes.

-- 1. The record -------------------------------------------------------------------------------------------------------

create table public.shop_stock (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The shop: a `buy` service's id in the rules set (settlement.services).
  service_id text not null check (length(service_id) between 1 and 200),
  -- The thing: the item's pack id.
  item_id text not null check (length(item_id) between 1 and 200),
  -- The campaign day (day 1 is the clock's first).
  day integer not null check (day >= 1),
  answer text not null check (answer in ('in', 'out', 'undecided')),
  undone boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One live answer for a thing at a shop on a day.
create unique index shop_stock_once on public.shop_stock (campaign_id, service_id, item_id, day) where not undone;
create index shop_stock_day on public.shop_stock (campaign_id, service_id, day) where not undone;

alter table public.shop_stock enable row level security;
grant select, update on public.shop_stock to authenticated;
grant select, insert, update, delete on public.shop_stock to service_role;

create policy "shop stock: the GM, and players a thing in stock" on public.shop_stock
  for select to authenticated using (
    private.is_gm(campaign_id)
    or (private.is_member(campaign_id) and answer = 'in' and not undone)
  );
-- An undo by the GM (the log's undo runs as the person undoing).
create policy "shop stock: an undo by the GM" on public.shop_stock
  for update to authenticated
  using (private.is_gm(campaign_id))
  with check (private.is_gm(campaign_id));

-- What may change after a row is made: its answer (through the functions or an undo), and its undone
-- mark (only by an undo).
create function private.shop_stock_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if old.undone and not reverting then
    raise exception 'That was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.service_id is distinct from old.service_id
    or new.item_id is distinct from old.item_id or new.day is distinct from old.day
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'That can''t be changed.';
  end if;
  if not reverting and new.undone <> old.undone then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.shop_stock_rules() from public, anon, authenticated;

-- Security invoker on purpose (as private.hook_sends_by_functions): a write straight through the API is refused unless
-- it is an undo putting things back; the functions below run as the database, so theirs pass.
create function private.shop_stock_by_functions() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and nullif(current_setting('grimoire.reverting', true), '') is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger shop_stock_rules before insert or update on public.shop_stock
  for each row execute function private.shop_stock_rules();
create trigger shop_stock_by_functions before insert or update on public.shop_stock
  for each row execute function private.shop_stock_by_functions();
create trigger refuse_when_retired before insert or update or delete on public.shop_stock
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.shop_stock
  for each row execute function private.log_change();

insert into public.undoable_tables (name) values ('shop_stock');

-- 2. Setting one thing ------------------------------------------------------------------------------------------------

-- stock.set: the GM sets a thing in or out at a shop on a day. A repeat of the same request changes nothing.
create function public.set_shop_stock(campaign uuid, service text, item text, on_day integer, answer text)
returns public.shop_stock
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('shop_stock');
  kept public.shop_stock;
begin
  if made is not null then
    select * into kept from public.shop_stock s where s.id = made;
    return kept;
  end if;
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if set_shop_stock.answer is null or set_shop_stock.answer not in ('in', 'out') then
    raise exception 'Set it in stock or not in stock.';
  end if;
  if length(coalesce(service, '')) not between 1 and 200 or length(coalesce(item, '')) not between 1 and 200 then
    raise exception 'That shop or thing isn''t known.';
  end if;
  if on_day is null or on_day < 1 then
    raise exception 'That day isn''t on the campaign''s clock.';
  end if;
  update public.shop_stock s
  set answer = set_shop_stock.answer
  where s.campaign_id = campaign and s.service_id = service and s.item_id = item and s.day = on_day and not s.undone
  returning * into kept;
  if kept.id is not null then
    return kept;
  end if;
  begin
    insert into public.shop_stock (campaign_id, service_id, item_id, day, answer)
    values (campaign, service, item, on_day, set_shop_stock.answer)
    returning * into kept;
  exception when unique_violation then
    -- Two sets of the thing in the same moment: the later one changes the row the first made.
    update public.shop_stock s
    set answer = set_shop_stock.answer
    where s.campaign_id = campaign and s.service_id = service and s.item_id = item and s.day = on_day and not s.undone
    returning * into kept;
  end;
  return kept;
end;
$$;
revoke execute on function public.set_shop_stock(uuid, text, text, integer, text) from public, anon;
grant execute on function public.set_shop_stock(uuid, text, text, integer, text) to authenticated, service_role;

-- 3. Reset ------------------------------------------------------------------------------------------------------------

-- stock.reset: the listed things (every thing with a chance, as the GM's device reads them) back to undecided at a shop
-- on a day. Only rows that day change; a thing with no row is left as it is. How many rows changed.
create function public.reset_shop_stock(campaign uuid, service text, on_day integer, items text[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  changed integer;
begin
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if on_day is null or on_day < 1 then
    raise exception 'That day isn''t on the campaign''s clock.';
  end if;
  if coalesce(array_length(items, 1), 0) > 2000 then
    raise exception 'That''s too many things at once.';
  end if;
  update public.shop_stock s
  set answer = 'undecided'
  where s.campaign_id = campaign and s.service_id = service and s.day = on_day and not s.undone
    and s.answer <> 'undecided' and s.item_id = any (coalesce(items, '{}'));
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke execute on function public.reset_shop_stock(uuid, text, integer, text[]) from public, anon;
grant execute on function public.reset_shop_stock(uuid, text, integer, text[]) to authenticated, service_role;

-- 4. What a player reads ----------------------------------------------------------------------------------------------

-- What a thing reads as before the GM answers: as stockDefault (src/modules/requests/shopStock.ts), kept in step by
-- supabase/tests/dec-3-w12-shop-stock.test.ts. `town_size` null or '': not known.
--   no availability (or nothing in it): in (w12-2);
--   sold by size (`where`): size unknown, undecided (tn-6, before any chance); size not listed, out; size listed and
--     no chance, in;
--   a chance: "always" in, anything else ("3-in-6") undecided;
--   only a rarity or a note: undecided.
-- Words are trimmed as JavaScript's trim() does (private.stock_trim), so the two read the same text alike.

-- Trims what JavaScript's String.prototype.trim() trims: white space (tab, line feed, vertical tab, form feed, carriage
-- return, space, no-break space, the other Unicode space separators, the byte order mark) and line terminators.
create function private.stock_trim(value text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    coalesce(value, ''),
    E'^[\\t\\n\\u000b\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+|[\\t\\n\\u000b\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+$',
    '', 'g');
$$;
revoke execute on function private.stock_trim(text) from public, anon;
grant execute on function private.stock_trim(text) to authenticated, service_role;

create function private.stock_default(availability jsonb, town_size text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  a jsonb := case when jsonb_typeof(availability) = 'object' then availability end;
  sizes text[];
  chance text;
  rarity text;
  note text;
  size text := lower(private.stock_trim(coalesce(town_size, '')));
begin
  if a is null then
    return 'in';
  end if;
  sizes := array(
    select lower(private.stock_trim(w #>> '{}'))
    from jsonb_array_elements(case when jsonb_typeof(a -> 'where') = 'array' then a -> 'where' else '[]'::jsonb end) w
    where jsonb_typeof(w) = 'string' and private.stock_trim(w #>> '{}') <> ''
  );
  chance := case when jsonb_typeof(a -> 'chance') = 'string' then private.stock_trim(a ->> 'chance') else '' end;
  rarity := case when jsonb_typeof(a -> 'rarity') = 'string' then private.stock_trim(a ->> 'rarity') else '' end;
  note := case when jsonb_typeof(a -> 'note') = 'string' then private.stock_trim(a ->> 'note') else '' end;
  if cardinality(sizes) = 0 and chance = '' and rarity = '' and note = '' then
    return 'in';
  end if;
  if cardinality(sizes) > 0 then
    if size = '' then
      return 'undecided';
    end if;
    if not (size = any (sizes)) then
      return 'out';
    end if;
    if chance = '' then
      return 'in';
    end if;
  end if;
  if chance <> '' then
    return case when lower(chance) = 'always' then 'in' else 'undecided' end;
  end if;
  return 'undecided';
end;
$$;
revoke execute on function private.stock_default(jsonb, text) from public, anon;
grant execute on function private.stock_default(jsonb, text) to authenticated, service_role;

-- private.stock_default as the service role may call it through the API: the database test's parity check only (the
-- API serves the public schema alone). Nobody signed in, and no visitor, may call it.
create function public.shop_stock_default_check(availability jsonb, town_size text default null) returns text
language sql immutable set search_path = '' as $$
  select private.stock_default(availability, town_size);
$$;
revoke execute on function public.shop_stock_default_check(jsonb, text) from public, anon, authenticated;
grant execute on function public.shop_stock_default_check(jsonb, text) to service_role;

-- The things in stock at a shop on a day, for a member of the campaign; nothing for anyone else. Worked out here:
-- each item for sale in the campaign (its winning version, ordered as private.items_open_in orders them), the day's
-- live row if there is one (in is in; out and undecided are not), else private.stock_default with the town's size
-- unknown (no place size reaches this reader yet). `offered` (null: no narrowing) only narrows the answer to those
-- ids; an id that isn't an item for sale here comes back as nothing.
--   The default reads the item's WHOLE availability, its hidden part included (library_entry_secrets, merged over the
--   readable part as the GM's read does, withHiddenFields): an availability a pack keeps GM-only still decides. Only
--   ids of things in come back, never the availability itself, so nothing hidden reaches a player. Whether it is for
--   sale is read from the whole entry too, so a GM-only `forSale: false` keeps it off the players' list.
--   `offered` is capped at 2000 ids, as reset_shop_stock's list is.
create function public.shop_stock_in(campaign uuid, service text, on_day integer, offered text[] default null)
returns table (item_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(cardinality(offered), 0) > 2000 then
    raise exception 'That''s too many things at once.';
  end if;
  return query
  with winners as (
    select distinct on (e.pack_entry_id) e.pack_entry_id as item, e.data || coalesce(h.data, '{}'::jsonb) as whole
    from public.campaign_packs cp
    join public.packs p on p.id = cp.pack_id
    left join public.campaign_pack_secrets s on s.id = cp.id
    join public.library_entries e on e.pack_id = cp.pack_id and e.kind = 'item'
    left join public.library_entry_secrets h on h.id = e.id
    where cp.campaign_id = shop_stock_in.campaign
      and (select private.is_member(shop_stock_in.campaign))
      and (shop_stock_in.offered is null or e.pack_entry_id = any (shop_stock_in.offered))
    order by e.pack_entry_id, coalesce(s.overrides ? ('item:' || e.pack_entry_id), false) desc, (p.kind = 'homebrew') desc,
      cp.priority desc, cp.pack_id::text
  )
  select w.item
  from winners w
  left join public.shop_stock r
    on r.campaign_id = shop_stock_in.campaign and r.service_id = shop_stock_in.service and r.day = shop_stock_in.on_day
      and not r.undone and r.item_id = w.item
  where private.for_sale(w.whole)
    and coalesce(r.answer, private.stock_default(w.whole -> 'availability', null)) = 'in'
  order by w.item;
end;
$$;
revoke execute on function public.shop_stock_in(uuid, text, integer, text[]) from public, anon;
grant execute on function public.shop_stock_in(uuid, text, integer, text[]) to authenticated, service_role;

-- 5. Logged-command rows and undo -------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('stock.set', 'simple', true), ('stock.reset', 'simple', true);
-- A first answer makes a row: Undo marks it undone (the thing reads as its default again).
insert into public.undoable_makings (name) values ('stock.set');
