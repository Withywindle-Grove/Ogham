-- M4 step 2: inventory, the Party stash and rolls (docs/04-data-model.md; docs/09-decisions-log.md, 2026-10-23).
-- Adds tables and functions; drops nothing.
--   locations        one Party stash per campaign (made with the campaign); nobody adds or removes them yet.
--   inventory_lines  items on a character or in the stash. Each line keeps its own copy of the item (name,
--                    category, weight, slots, stack); library_entry_id only says where it came from, with no
--                    foreign key, so updating or deleting setting rules never touches a sheet.
--   rolls            every dice result someone typed in: dice, result, who, how (manual). Never changed.
-- The log: lines are seen like the character carrying them (a waiting character's only by its player and the
-- GM). Undo: the tables it may put back are now rows in public.undoable_tables, like logged_commands.

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('stash', 'place')),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create unique index locations_one_stash on public.locations (campaign_id) where kind = 'stash';
alter table public.locations enable row level security;
grant select on public.locations to authenticated;
grant select, insert, update, delete on public.locations to service_role;
create policy "locations: members read" on public.locations
  for select to authenticated using (private.is_member(campaign_id));

create function private.make_party_stash() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.locations (campaign_id, kind, name) values (new.id, 'stash', 'Party stash');
  return null;
end;
$$;
create trigger make_party_stash after insert on public.campaigns
  for each row execute function private.make_party_stash();
insert into public.locations (campaign_id, kind, name) select c.id, 'stash', 'Party stash' from public.campaigns c;

create table public.inventory_lines (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  actor_id uuid references public.actors (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  library_entry_id uuid,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default '' check (char_length(category) <= 60),
  weight_coin integer check (weight_coin >= 0),
  slots integer check (slots >= 0),
  stack integer not null default 1 check (stack >= 1),
  qty integer not null default 1 check (qty >= 1),
  container_line_id uuid references public.inventory_lines (id) on delete set null,
  equipped boolean not null default false,
  how_got text not null check (how_got in ('bought', 'found', 'given')),
  cost text not null default '' check (char_length(cost) <= 60),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(actor_id, location_id) = 1),
  check (container_line_id is distinct from id)
);
create index inventory_lines_campaign_idx on public.inventory_lines (campaign_id);
create index inventory_lines_actor_idx on public.inventory_lines (actor_id);
create index inventory_lines_location_idx on public.inventory_lines (location_id);
create index inventory_lines_container_idx on public.inventory_lines (container_line_id);

-- May the signed-in person put items on, or take them off, this carrier? (The app's mayChangeCarrier.)
create function private.may_change_carrier(campaign uuid, actor uuid, location uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_gm(campaign)
    or (
      private.is_member(campaign)
      and (
        exists (select 1 from public.locations l where l.id = location and l.campaign_id = campaign)
        or exists (
          select 1 from public.actors a
          where a.id = actor and a.campaign_id = campaign and a.owner_type = 'user'
            and a.owner_user_id = (select auth.uid()) and a.status <> 'archived'
        )
      )
    );
$$;

-- May the signed-in person hand an item to this carrier? The stash, or an approved character still in play
-- (any, for the GM), in their own campaign.
create function private.may_receive(campaign uuid, actor uuid, location uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member(campaign)
    and (
      exists (select 1 from public.locations l where l.id = location and l.campaign_id = campaign)
      or exists (
        select 1 from public.actors a
        where a.id = actor and a.campaign_id = campaign
          and (private.is_gm(campaign) or (a.approval = 'approved' and a.status <> 'archived'))
      )
    );
$$;
grant execute on function private.may_change_carrier(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function private.may_receive(uuid, uuid, uuid) to authenticated, service_role;

alter table public.inventory_lines enable row level security;
grant select, insert, update, delete on public.inventory_lines to authenticated, service_role;
create policy "inventory lines: read like the carrier" on public.inventory_lines
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and (
        location_id is not null
        or exists (
          select 1 from public.actors a
          where a.id = actor_id
            and (a.approval = 'approved' or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid())))
        )
      )
    )
  );
create policy "inventory lines: add to a carrier you may change" on public.inventory_lines
  for insert to authenticated
  with check (private.may_change_carrier(campaign_id, actor_id, location_id));
create policy "inventory lines: change, or hand on, what you may change" on public.inventory_lines
  for update to authenticated
  using (private.may_change_carrier(campaign_id, actor_id, location_id))
  with check (private.may_change_carrier(campaign_id, actor_id, location_id) or private.may_receive(campaign_id, actor_id, location_id));
create policy "inventory lines: remove from a carrier you may change" on public.inventory_lines
  for delete to authenticated
  using (private.may_change_carrier(campaign_id, actor_id, location_id));

-- A line's carrier is in its campaign, and a container it sits in is on the same carrier.
create function private.check_inventory_line() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_id is not null
    and not exists (select 1 from public.actors a where a.id = new.actor_id and a.campaign_id = new.campaign_id) then
    raise exception 'That character isn''t in this campaign.';
  end if;
  if new.location_id is not null
    and not exists (select 1 from public.locations l where l.id = new.location_id and l.campaign_id = new.campaign_id) then
    raise exception 'That place isn''t in this campaign.';
  end if;
  if new.container_line_id is not null and not exists (
    select 1 from public.inventory_lines c
    where c.id = new.container_line_id
      and c.actor_id is not distinct from new.actor_id and c.location_id is not distinct from new.location_id
  ) then
    raise exception 'A container holds only what the same carrier carries.';
  end if;
  return new;
end;
$$;
create trigger check_inventory_line before insert or update on public.inventory_lines
  for each row execute function private.check_inventory_line();

-- A container that changes hands takes what's in it along.
create function private.carry_contents() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.location_id is distinct from old.location_id then
    update public.inventory_lines set actor_id = new.actor_id, location_id = new.location_id
    where container_line_id = new.id;
  end if;
  return null;
end;
$$;
create trigger carry_contents after update on public.inventory_lines
  for each row execute function private.carry_contents();

create trigger stamp before insert or update on public.inventory_lines for each row execute function private.stamp_row();
create trigger log_change after insert or update or delete on public.inventory_lines
  for each row execute function private.log_change();
create trigger refuse_when_retired before insert or update or delete on public.inventory_lines
  for each row execute function private.refuse_when_retired();

create table public.rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  expression text not null check (char_length(expression) between 1 and 40),
  result integer not null,
  purpose text not null check (purpose in ('hp', 'charges', 'initiative', 'table', 'money')),
  gm_only boolean not null default false,
  method text not null default 'manual' check (method in ('manual', 'digital')),
  entered_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index rolls_campaign_idx on public.rolls (campaign_id);
alter table public.rolls enable row level security;
grant select, insert on public.rolls to authenticated;
grant select, insert, update, delete on public.rolls to service_role;
create policy "rolls: read, GM-only ones by the GM" on public.rolls
  for select to authenticated
  using (private.is_gm(campaign_id) or (private.is_member(campaign_id) and not gm_only));
create policy "rolls: members enter their own; GM-only ones the GM" on public.rolls
  for insert to authenticated
  with check (
    entered_by = (select auth.uid()) and method = 'manual'
    and (private.is_gm(campaign_id) or (private.is_member(campaign_id) and not gm_only))
  );
create trigger refuse_when_retired before insert or update or delete on public.rolls
  for each row execute function private.refuse_when_retired();

insert into public.logged_commands (name, level, gm_only) values
  ('inventory.add', 'simple', false),
  ('inventory.remove', 'simple', false),
  ('inventory.setQty', 'verbose', false),
  ('inventory.equip', 'simple', false),
  ('inventory.move', 'simple', false);

create table public.undoable_tables (name text primary key);
alter table public.undoable_tables enable row level security;
grant select on public.undoable_tables to authenticated;
grant select, insert, update, delete on public.undoable_tables to service_role;
create policy "undoable tables: everyone signed in reads" on public.undoable_tables
  for select to authenticated using (true);
insert into public.undoable_tables (name) values
  ('campaigns'), ('members'), ('invites'), ('companies'), ('field_definitions'), ('assets'), ('actors'),
  ('actor_secrets'), ('notes'), ('campaign_packs'), ('library_entries'), ('campaign_pack_secrets'),
  ('library_entry_secrets'), ('inventory_lines');

-- The log: as in 20261023100000_m3_health.sql, plus things a character carries, seen like the character.
create or replace function private.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  this_row jsonb := coalesce(new_row, old_row);
  campaign uuid;
  before_values jsonb := old_row;
  after_values jsonb := new_row;
  key text;
  tag jsonb;
  event_type text;
  event_level text;
  command_gm_only boolean;
  carrier_approval text;
  carrier_owner_type text;
  carrier_owner uuid;
  is_fiat boolean := false;
  why text;
  request uuid;
  who_sees text := 'all';
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

  -- Who may see it: like the rows themselves.
  if tg_table_name = 'notes' then
    -- A note carries its own audience (copied from the entry it was added to).
    who_sees := this_row ->> 'audience';
    owner := (this_row ->> 'owner_user_id')::uuid;
  elsif tg_table_name in ('invites', 'actor_secrets', 'campaign_pack_secrets', 'library_entry_secrets') then
    who_sees := 'gm';
  elsif tg_table_name = 'library_entries'
    and not private.player_facing(this_row ->> 'kind') then
    -- Like reading the entries: stat blocks, tables, treasure and the rest are the GM's.
    who_sees := 'gm';
  elsif tg_table_name = 'assets' and this_row ->> 'kind' not in ('portrait', 'sigil') then
    who_sees := 'gm';
  elsif tg_table_name <> 'actors' and this_row ? 'actor_id' and this_row ->> 'actor_id' is not null then
    -- Something a character carries or owns (inventory lines, from M4): seen like the character itself.
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
  elsif tg_table_name = 'actors'
    and coalesce(new_row ->> 'approval', '') <> 'approved'
    and coalesce(old_row ->> 'approval', '') <> 'approved' then
    if this_row ->> 'owner_type' = 'user' then
      who_sees := 'owner';
      owner := (this_row ->> 'owner_user_id')::uuid;
    else
      who_sees := 'gm';
    end if;
  end if;

  -- The command's tag, if the request has one. A broken tag just means a plain name.
  begin
    tag := convert_from(
      decode(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-grimoire-command', 'base64'),
      'UTF8'
    )::jsonb;
    request := (tag ->> 'requestId')::uuid;
  exception when others then
    tag := null;
    request := null;
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
    fiat, reason, audience, owner_user_id, request_id, reverts_event_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, request, reverting
  );
  return null;
end;
$$;

-- Undo: as in 20261022200000_m3_cleanup.sql, reading the tables it may put back from public.undoable_tables.
create or replace function private.undo_body(event_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  picked public.events;
  change public.events;
  current_row jsonb;
  key text;
  assignments text;
  id_column text;
  as_gm boolean;
  changed_rows integer;
begin
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
    and (picked.audience = 'all' or (picked.audience = 'owner' and picked.owner_user_id = (select auth.uid())))
  ) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
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
    if change.before is null or change.after is null then
      raise exception 'Making or deleting things can''t be undone.';
    end if;
    if not exists (select 1 from public.undoable_tables u where u.name = change.target_table) then
      raise exception 'That can''t be undone.';
    end if;
    if exists (select 1 from public.events r where r.reverts_event_id = change.id) then
      raise exception 'That was already undone.';
    end if;
    id_column := case when change.target_table = 'actor_secrets' then 'actor_id' else 'id' end;
    -- Locked until the undo finishes, so nothing slips in between the check and the write.
    execute format('select to_jsonb(t) from public.%I t where t.%I = $1 for update', change.target_table, id_column)
      into current_row using change.target_id;
    if current_row is null then
      if as_gm then
        raise exception 'That''s changed since. Undo the later change first.';
      end if;
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    for key in select jsonb_object_keys(change.after) loop
      if (current_row -> key) is distinct from (change.after -> key) then
        raise exception 'That''s changed since. Undo the later change first.';
      end if;
    end loop;
  end loop;

  -- Then put the values back, newest change first, each linked to the event it reverses.
  for change in
    select * from public.events e
    where e.campaign_id = picked.campaign_id
      and (
        e.id = picked.id
        or (picked.request_id is not null and e.request_id = picked.request_id
            and e.actor_user_id is not distinct from picked.actor_user_id)
      )
    order by e.seq desc
  loop
    id_column := case when change.target_table = 'actor_secrets' then 'actor_id' else 'id' end;
    select string_agg(format('%I = r.%I', k, k), ', ') into assignments from jsonb_object_keys(change.before) k;
    perform set_config('grimoire.reverting', change.id::text, true);
    execute format(
      'update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.%I = $2',
      change.target_table, assignments, change.target_table, id_column
    ) using change.before, change.target_id;
    get diagnostics changed_rows = row_count;
    if changed_rows <> 1 then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
  end loop;
  perform set_config('grimoire.reverting', '', true);
end;
$$;
