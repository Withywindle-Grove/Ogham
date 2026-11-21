-- M4 step 5: charges, and the load's tier line (ruled 2026-10-23; docs/04, 05, 07). Adds columns, two tables,
-- triggers and logged commands; replaces the log function and the rules-set split's visible part. Drops nothing.
--
-- Charges. Visible: inventory_lines.charges_left; the holder sets it once (from the roll) and spends one at a
-- time. Hidden (the pack's magicItems.charges.hidden): the starting total is the GM's alone, in
-- inventory_line_secrets; the line counts uses (charges_used), so the holder can always use one; when the uses
-- reach the total the database marks it spent there (a GM-only log line); the holder learns when the GM sets
-- spent_shown. Only the GM sets hidden totals, recharges, or reveals spent; an undo may put values back.
-- The tier line: carrier_loads keeps each character's last tier, written by a device (the load-bar engine
-- works it out); a change is logged as "<name> is now <tier>". The access rules check who and which carrier.
-- Players' devices now receive a rules set's magicItems.charges (the switch, the dice, the rechargeable default);
-- the rest of magicItems stays GM-only.

alter table public.inventory_lines
  add column charges_left integer check (charges_left >= 0),
  add column charges_hidden boolean not null default false,
  add column charges_used integer not null default 0 check (charges_used >= 0),
  add column spent_shown boolean not null default false;

-- What a player may change about charges: set visible ones once, spend one at a time, count a use; nothing else.
create function private.guard_charges() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.charges_left is not null or new.charges_used <> 0 or new.spent_shown then
      raise exception 'Only the GM sets charges that way.' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.charges_left is distinct from old.charges_left and not (old.charges_left is null or new.charges_left = old.charges_left - 1))
    or (new.charges_used <> old.charges_used and new.charges_used <> old.charges_used + 1)
    or new.charges_hidden is distinct from old.charges_hidden
    or new.spent_shown is distinct from old.spent_shown then
    raise exception 'Only the GM changes charges that way.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_charges before insert or update on public.inventory_lines
  for each row execute function private.guard_charges();

create table public.inventory_line_secrets (
  id uuid primary key references public.inventory_lines (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  charges_total integer check (charges_total >= 0),
  spent boolean not null default false
);
create index inventory_line_secrets_campaign_idx on public.inventory_line_secrets (campaign_id);
alter table public.inventory_line_secrets enable row level security;
grant select, insert, update, delete on public.inventory_line_secrets to authenticated, service_role;
create policy "inventory line secrets: the GM" on public.inventory_line_secrets
  for all to authenticated
  using (private.is_gm(campaign_id))
  with check (
    private.is_gm(campaign_id)
    and exists (select 1 from public.inventory_lines l where l.id = inventory_line_secrets.id and l.campaign_id = inventory_line_secrets.campaign_id)
  );
create trigger log_change after insert or update or delete on public.inventory_line_secrets
  for each row execute function private.log_change();
create trigger refuse_when_retired before insert or update or delete on public.inventory_line_secrets
  for each row execute function private.refuse_when_retired();

-- Hidden charges: when the uses reach the GM's total, it's spent (the GM's quiet note, logged for the GM only).
create function private.mark_spent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.charges_hidden and new.charges_used > old.charges_used then
    update public.inventory_line_secrets s set spent = true
    where s.id = new.id and not s.spent and s.charges_total is not null and new.charges_used >= s.charges_total;
  end if;
  return null;
end;
$$;
create trigger mark_spent after update on public.inventory_lines
  for each row execute function private.mark_spent();

create table public.carrier_loads (
  actor_id uuid primary key references public.actors (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  tier text not null check (char_length(tier) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.carrier_loads enable row level security;
grant select, insert, update on public.carrier_loads to authenticated;
grant select, insert, update, delete on public.carrier_loads to service_role;
create policy "carrier loads: read like the character" on public.carrier_loads
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and exists (
        select 1 from public.actors a
        where a.id = actor_id and (a.approval = 'approved' or (a.owner_type = 'user' and a.owner_user_id = (select auth.uid())))
      )
    )
  );
create policy "carrier loads: who may change the carrier" on public.carrier_loads
  for insert to authenticated with check (private.may_change_carrier(campaign_id, actor_id, null));
create policy "carrier loads: who may change the carrier, again" on public.carrier_loads
  for update to authenticated
  using (private.may_change_carrier(campaign_id, actor_id, null))
  with check (private.may_change_carrier(campaign_id, actor_id, null));
create trigger log_change after insert or update or delete on public.carrier_loads
  for each row execute function private.log_change();
create trigger refuse_when_retired before insert or update or delete on public.carrier_loads
  for each row execute function private.refuse_when_retired();

insert into public.logged_commands (name, level, gm_only) values
  ('inventory.setCharges', 'simple', false),
  ('inventory.useCharge', 'simple', false),
  ('inventory.recharge', 'simple', true),
  ('inventory.revealSpent', 'simple', true),
  ('load.tier', 'simple', false);
insert into public.undoable_tables (name) values ('inventory_line_secrets');

-- What a player may see of an entry: as in 20261023160000_m4_rules_sets_readable.sql, plus a rules set's
-- magicItems.charges (ruled 2026-10-23: the switch, the dice per kind and the rechargeable default).
create or replace function private.visible_of(kind text, data jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select (data - private.hidden_keys(kind, data) - 'gmOnly')
    || case
         when kind = 'rulesSet' and jsonb_typeof(data -> 'magicItems' -> 'charges') = 'object'
           then jsonb_build_object('magicItems', jsonb_build_object('charges', data -> 'magicItems' -> 'charges'))
         else '{}'::jsonb
       end;
$$;

-- Existing rules sets: put their magicItems.charges back where players read (from the hidden part). The split
-- is paused so the rest of magicItems stays where it is; the fix isn't a change anyone made.
alter table public.library_entries disable trigger split_hidden_fields;
alter table public.library_entries disable trigger log_change;
alter table public.library_entries disable trigger refuse_when_retired;
update public.library_entries e
  set data = e.data || jsonb_build_object('magicItems', jsonb_build_object('charges', s.data -> 'magicItems' -> 'charges'))
  from public.library_entry_secrets s
  where s.id = e.id and e.kind = 'rulesSet' and jsonb_typeof(s.data -> 'magicItems' -> 'charges') = 'object';
alter table public.library_entries enable trigger refuse_when_retired;
alter table public.library_entries enable trigger log_change;
alter table public.library_entries enable trigger split_hidden_fields;

-- The log: as in 20261023120000_m4_inventory.sql, with the hidden charge totals the GM's.
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
  elsif tg_table_name in ('invites', 'actor_secrets', 'campaign_pack_secrets', 'library_entry_secrets', 'inventory_line_secrets') then
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
