-- M5 step 8: marching order (docs/04 "MarchingOrder"; docs/05 "Expeditions, time and light"; docs/03 "Set marching
-- order"; ruled M5-6, 2026-10-25: rows of 1–3, presets, GM lock, "Players can reorder marching order", default Yes).
--   1. marching_orders: one row per campaign, made with it (and now for the campaigns there are, empty): the rows
--      front to back, each 1–3 characters (actor ids) side by side; the named presets ("Save as…", at most 12); the
--      preset last used (null after a move by hand); locked (the GM's fiat). Members read it; changes go through the
--      functions below, and the rules here decide whatever a device sends: the GM always may; a player only while
--      "Players can reorder marching order" is on and it isn't locked; only the GM locks it. A save from an old copy
--      is refused (copy version, GR409: "That's changed since. Here's the latest."), so two devices moving at once
--      never lose a move silently; a repeated request changes nothing.
--   2. What the app calls: set_marching_order (a move: hold to drag, join the row ahead, a row of their own),
--      use_marching_preset, save_marching_preset and lock_marching_order.
--   3. Logged (everyone sees the lines; undoable): marching.set and marching.usePreset (Simple: every move is
--      logged), marching.savePreset (Verbose), marching.lock (Simple, the GM's).
-- Adds a table, its rules, triggers and policies, and functions. Drops nothing; no rows are removed or changed.

-- 1. The table -------------------------------------------------------------------------------------------------------

create table public.marching_orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.campaigns (id) on delete cascade,
  -- Front to back: [["<actor id>", …], …], each row 1–3 characters side by side.
  rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows) = 'array'),
  -- Named saved orders: [{ "name": "Tunnel", "rows": [[…], …] }, …].
  presets jsonb not null default '[]'::jsonb check (jsonb_typeof(presets) = 'array' and jsonb_array_length(presets) <= 12),
  -- The preset the order was last set from (null once someone moves it by hand), for the log.
  last_preset text check (last_preset is null or length(trim(last_preset)) between 1 and 60),
  locked boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marching_orders enable row level security;
grant select, update on public.marching_orders to authenticated;
grant select, insert, update, delete on public.marching_orders to service_role;

-- Members read it (the whole party sees the order); members may try to change it: the rules below decide.
create policy "marching orders: members read" on public.marching_orders
  for select to authenticated using (private.is_member(campaign_id));
create policy "marching orders: members change it, as the rules allow" on public.marching_orders
  for update to authenticated using (private.is_member(campaign_id)) with check (private.is_member(campaign_id));

-- Rows as stored: an array of rows, each 1–3 distinct ids (no id twice in the whole order); with `campaign`, each an
-- actor of that campaign that marches (a character or a hireling).
create function private.marching_rows_ok(campaign uuid, given jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select jsonb_typeof(given) = 'array'
    and jsonb_array_length(given) <= 200
    and not exists (
      select 1 from jsonb_array_elements(given) r(row_ids)
      where jsonb_typeof(r.row_ids) <> 'array' or jsonb_array_length(r.row_ids) not between 1 and 3
        or exists (select 1 from jsonb_array_elements(r.row_ids) x(id) where jsonb_typeof(x.id) <> 'string')
    )
    and (
      select count(*) = count(distinct x.id)
      from jsonb_array_elements(given) r(row_ids), jsonb_array_elements_text(r.row_ids) x(id)
    )
    and (
      campaign is null
      or not exists (
        select 1 from jsonb_array_elements(given) r(row_ids), jsonb_array_elements_text(r.row_ids) x(id)
        where not exists (
          select 1 from public.actors a
          where a.id::text = x.id and a.campaign_id = campaign and a.kind in ('pc', 'hireling')
        )
      )
    );
$$;
revoke execute on function private.marching_rows_ok(uuid, jsonb) from public, anon, authenticated;

-- What the database decides, whatever a device sends.
create function private.marching_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  preset jsonb;
begin
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'That can''t be changed.';
  end if;
  if not private.is_gm(new.campaign_id) then
    if new.locked is distinct from old.locked then
      raise exception 'Only the GM locks the marching order.' using errcode = '42501';
    end if;
    if old.locked then
      raise exception 'The GM has locked the marching order.' using errcode = '42501';
    end if;
    if (select c.settings -> 'playersReorderMarching' from public.campaigns c where c.id = new.campaign_id) = 'false'::jsonb then
      raise exception 'Only the GM sets the marching order in this campaign.' using errcode = '42501';
    end if;
  end if;
  -- An undo puts back what was there (a character in it may have left since); anything else is checked.
  if not reverting then
    if new.rows is distinct from old.rows and not private.marching_rows_ok(new.campaign_id, new.rows) then
      raise exception 'Each row holds 1 to 3 of the party, each once.';
    end if;
    if new.presets is distinct from old.presets then
      for preset in select p from jsonb_array_elements(new.presets) p loop
        if jsonb_typeof(preset) <> 'object' or jsonb_typeof(preset -> 'name') <> 'string'
          or length(trim(preset ->> 'name')) not between 1 and 60 or not private.marching_rows_ok(null, preset -> 'rows') then
          raise exception 'A saved order needs a name (up to 60 characters) and rows of 1 to 3.';
        end if;
      end loop;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.marching_rules() from public, anon, authenticated;

-- Every campaign has its marching order, made with it (and now for the campaigns there are, empty).
create function private.make_marching_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.marching_orders (campaign_id) values (new.id) on conflict (campaign_id) do nothing;
  return null;
end;
$$;
revoke execute on function private.make_marching_order() from public, anon, authenticated;
create trigger make_marching_order after insert on public.campaigns
  for each row execute function private.make_marching_order();
insert into public.marching_orders (campaign_id) select c.id from public.campaigns c on conflict (campaign_id) do nothing;

-- Copy versions first (by name), as for the clock. Changes are logged; the making isn't (the database makes it).
create trigger check_copy_version before insert or update on public.marching_orders
  for each row execute function private.check_copy_version();
create trigger marching_rules before update on public.marching_orders
  for each row execute function private.marching_rules();
create trigger refuse_when_retired before insert or update or delete on public.marching_orders
  for each row execute function private.refuse_when_retired();
create trigger log_change after update on public.marching_orders
  for each row execute function private.log_change();

-- 2. What the app calls ---------------------------------------------------------------------------------------------

-- The campaign's order for a change, or a refusal for someone outside it.
create function private.marching_of(campaign uuid) returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders;
begin
  select * into found from public.marching_orders m where m.campaign_id = campaign;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;
revoke execute on function private.marching_of(uuid) from public, anon;
grant execute on function private.marching_of(uuid) to authenticated, service_role;

-- A move: the order is now these rows (front to back). Refused from an old copy; a repeat changes nothing.
create function public.set_marching_order(campaign uuid, new_rows jsonb, seen_version integer default null)
returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders := private.marching_of(campaign);
begin
  if private.repeated_request('marching_orders', found.id) then
    return found;
  end if;
  update public.marching_orders m
  set rows = coalesce(new_rows, '[]'::jsonb), last_preset = null, version = coalesce(seen_version, m.version)
  where m.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Use a preset: the order is that saved order, leaving out anyone no longer in the campaign.
create function public.use_marching_preset(campaign uuid, preset_name text, seen_version integer default null)
returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders := private.marching_of(campaign);
  preset jsonb;
  kept jsonb;
begin
  if private.repeated_request('marching_orders', found.id) then
    return found;
  end if;
  select p into preset from jsonb_array_elements(found.presets) p
  where lower(trim(p ->> 'name')) = lower(trim(coalesce(preset_name, '')))
  limit 1;
  if preset is null then
    raise exception 'That saved order isn''t there any more.';
  end if;
  select coalesce(jsonb_agg(k.ids order by k.pos), '[]'::jsonb) into kept from (
    select r.pos, jsonb_agg(x.id order by x.pos) as ids
    from jsonb_array_elements(preset -> 'rows') with ordinality r(row_ids, pos)
    cross join lateral jsonb_array_elements(r.row_ids) with ordinality x(id, pos)
    where exists (
      select 1 from public.actors a
      where a.id::text = x.id #>> '{}' and a.campaign_id = campaign and a.kind in ('pc', 'hireling')
    )
    group by r.pos
  ) k;
  update public.marching_orders m
  set rows = kept, last_preset = trim(preset ->> 'name'), version = coalesce(seen_version, m.version)
  where m.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Save as…: the order as it is now, under a name (the same name, any case, is replaced). At most 12.
create function public.save_marching_preset(campaign uuid, preset_name text, seen_version integer default null)
returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders := private.marching_of(campaign);
  named text := trim(coalesce(preset_name, ''));
  others jsonb;
begin
  if private.repeated_request('marching_orders', found.id) then
    return found;
  end if;
  if length(named) not between 1 and 60 then
    raise exception 'Give the saved order a name (up to 60 characters).';
  end if;
  if jsonb_array_length(found.rows) = 0 then
    raise exception 'There''s no order to save yet.';
  end if;
  select coalesce(jsonb_agg(q.p order by q.pos), '[]'::jsonb) into others
  from jsonb_array_elements(found.presets) with ordinality q(p, pos)
  where lower(trim(q.p ->> 'name')) <> lower(named);
  if jsonb_array_length(others) >= 12 then
    raise exception 'There are 12 saved orders already. Replace one by saving under its name.';
  end if;
  update public.marching_orders m
  set presets = others || jsonb_build_array(jsonb_build_object('name', named, 'rows', m.rows)),
    version = coalesce(seen_version, m.version)
  where m.id = found.id
  returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;

-- Lock or unlock (the GM's fiat): while locked, only the GM moves it.
create function public.lock_marching_order(campaign uuid, lock_it boolean, seen_version integer default null)
returns public.marching_orders
language plpgsql security invoker set search_path = '' as $$
declare
  found public.marching_orders := private.marching_of(campaign);
begin
  if lock_it is null then
    raise exception 'Lock it or not?';
  end if;
  if not private.is_gm(campaign) then
    raise exception 'Only the GM locks the marching order.' using errcode = '42501';
  end if;
  update public.marching_orders m
  set locked = lock_it, version = coalesce(seen_version, m.version)
  where m.id = found.id
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
    'public.set_marching_order(uuid, jsonb, integer)', 'public.use_marching_preset(uuid, text, integer)',
    'public.save_marching_preset(uuid, text, integer)', 'public.lock_marching_order(uuid, boolean, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- 3. The log, undo and the logged commands --------------------------------------------------------------------------

-- Everyone in the campaign sees the marching order's lines.
create function private.log_audience_marching_orders(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language sql stable set search_path = '' as $$ select * from private.log_audience_everyone(); $$;
revoke execute on function private.log_audience_marching_orders(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('marching_orders');

insert into public.logged_commands (name, level, gm_only) values
  ('marching.set', 'simple', false),
  ('marching.usePreset', 'simple', false),
  ('marching.savePreset', 'verbose', false),
  ('marching.lock', 'simple', true);
