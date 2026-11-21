-- December step 6, piece (a): the purse's data and its read rule (docs/plans/dec-6-purse.md; ruling pk-6 in
-- docs/design/rulings/pack-rework-rulings-2026-11-11.md; docs/03 "See a character's personal purse"; hard rules 5
-- and 8).
--   1. public.purses: one row per character and hireling, and one for each campaign's Party stash, made by the
--      database with them (and now for those there are, empty). `coins` is a map from a coin's short name, as the
--      campaign's setting names its coins (the rules set's `currency[].key`, docs/07), to a whole number, never
--      below zero. The database checks the shape, not the names: the app offers the setting's coins.
--   2. Who reads a purse (row-level security; hidden means hidden):
--        the Party stash's coin: every member of the campaign;
--        a character's purse: its owner (a hireling's owner is its employer, so the employer reads it, like its
--          pack) and the GM (never another person's draft, like the draft's gear);
--        other players: nothing, except while the character is Down or dead (ruled 2026-10-29): then every member
--          reads it, and it closes again by itself when the character recovers;
--        anyone outside the campaign: nothing.
--      Down has no stored state yet (M6 brings it). Until then it is what the app already shows as Down: an
--      approved character in play whose HP is at or under the setting's `death.at` (the top rules set that says
--      it, optional rules applied); with no `death.at`, only "dead" opens a purse. The whole test is one function,
--      private.is_down_or_dead, for M6 to replace.
--   3. Nobody writes a purse from a device yet: no insert, update or delete rule, and no grant. Piece (b) brings
--      the commands (their functions, their logged_commands rows and the Undo list's row) and their tests.
--   4. The log: a change to a purse is logged like any other table's (private.log_change). Its lines are the owner's
--      and the GM's (the GM's alone for a party's or the GM's own character); the stash's coin lines are everyone's.
--      A line never shows an amount to someone who can't read that purse. Making the empty row isn't logged.
-- Adds one table, one index, seven functions, six triggers and one policy. Replaces no function. Drops, renames
-- and deletes nothing, and changes no existing row: it only adds one empty purse row for each existing character,
-- hireling and Party stash.

-- 1. The table ---------------------------------------------------------------------------------------------------------

create table public.purses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- Whose it is: a character or a hireling, or the Party stash. Exactly one.
  actor_id uuid unique references public.actors (id) on delete cascade,
  location_id uuid unique references public.locations (id) on delete cascade,
  -- Coin by denomination: { "<coin's short name>": <whole number, 0 or more> }. A coin that isn't there counts 0.
  coins jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(actor_id, location_id) = 1)
);
create index purses_campaign on public.purses (campaign_id);

alter table public.purses enable row level security;
-- Reading only: devices change a purse through the commands' functions (piece b), never the table.
grant select on public.purses to authenticated;
grant select, insert, update, delete on public.purses to service_role;

-- A purse's coins: an object of short names to whole numbers from 0 to 999,999,999, thirty coins at the most.
create function private.is_coin_map(coins jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(coins) = 'object', false)
    and not exists (
      select 1
      from jsonb_each(case when jsonb_typeof(coins) = 'object' then coins else '{}'::jsonb end) c
      where length(c.key) not between 1 and 40
        or c.key <> btrim(c.key)
        or jsonb_typeof(c.value) <> 'number'
        or (c.value #>> '{}') !~ '^\d{1,9}$'
    )
    and (
      select count(*)
      from jsonb_object_keys(case when jsonb_typeof(coins) = 'object' then coins else '{}'::jsonb end)
    ) <= 30;
$$;
revoke execute on function private.is_coin_map(jsonb) from public, anon, authenticated;

-- 2. Who reads a purse -------------------------------------------------------------------------------------------------

-- The HP at which the campaign's setting marks a character Down: `death.at` of the top rules set that says it
-- (src/modules/characters/hp.ts, downAtOf), optional rules applied; null when none says.
create function private.down_at(campaign uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select (s.rules -> 'death' ->> 'at')::integer
  from jsonb_array_elements(private.campaign_rules_sets(campaign)) with ordinality as s(rules, place)
  where jsonb_typeof(s.rules -> 'death' -> 'at') = 'number'
    and (s.rules -> 'death' ->> 'at') ~ '^-?\d{1,9}$'
  order by s.place desc
  limit 1;
$$;
revoke execute on function private.down_at(uuid) from public, anon, authenticated;

-- Down or dead (ruled 2026-10-29; docs/03, the named exception to hard rule 5): an approved character or hireling
-- that is dead, or in play (active or benched) with HP at or under the setting's Down mark. M6's stored Down state
-- replaces this function; the rule that calls it stays.
create function private.is_down_or_dead(actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.actors a
    where a.id = actor and a.kind in ('pc', 'hireling') and a.approval = 'approved'
      and (
        a.status = 'dead'
        or (
          a.status in ('active', 'benched') and a.hp_current is not null
          and a.hp_current <= private.down_at(a.campaign_id)
        )
      )
  );
$$;
revoke execute on function private.is_down_or_dead(uuid) from public, anon, authenticated;

-- May the signed-in person read this purse? The stash's: any member. A character's: its owner (a hireling's
-- employer is its owner); the GM, except another person's draft; and any member while it is Down or dead.
create function private.may_read_purse(campaign uuid, actor uuid, location uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when actor is null then location is not null and private.is_member(campaign)
    else
      (private.is_gm(campaign) and not private.is_others_draft(actor))
      or (
        private.is_member(campaign)
        and exists (
          select 1 from public.actors a
          where a.id = actor and a.campaign_id = campaign
            and (
              (a.owner_type = 'user' and a.owner_user_id = (select auth.uid()))
              or private.is_down_or_dead(a.id)
            )
        )
      )
  end;
$$;
revoke execute on function private.may_read_purse(uuid, uuid, uuid) from public, anon;
grant execute on function private.may_read_purse(uuid, uuid, uuid) to authenticated, service_role;

create policy "purses: owner and GM, all for the stash and the Down or dead" on public.purses
  for select to authenticated using (private.may_read_purse(campaign_id, actor_id, location_id));

-- 3. A purse with every character, hireling and Party stash ---------------------------------------------------------------

create function private.make_character_purse() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('pc', 'hireling') then
    insert into public.purses (campaign_id, actor_id) values (new.campaign_id, new.id) on conflict (actor_id) do nothing;
  end if;
  return null;
end;
$$;
revoke execute on function private.make_character_purse() from public, anon, authenticated;
create trigger make_character_purse after insert on public.actors
  for each row execute function private.make_character_purse();

create function private.make_stash_purse() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'stash' then
    insert into public.purses (campaign_id, location_id) values (new.campaign_id, new.id) on conflict (location_id) do nothing;
  end if;
  return null;
end;
$$;
revoke execute on function private.make_stash_purse() from public, anon, authenticated;
create trigger make_stash_purse after insert on public.locations
  for each row execute function private.make_stash_purse();

-- For those there are: one empty purse each (before the triggers below, so a retired campaign's get theirs too).
insert into public.purses (campaign_id, actor_id)
  select a.campaign_id, a.id from public.actors a where a.kind in ('pc', 'hireling')
  on conflict (actor_id) do nothing;
insert into public.purses (campaign_id, location_id)
  select l.campaign_id, l.id from public.locations l where l.kind = 'stash'
  on conflict (location_id) do nothing;

-- 4. What the database decides, whatever is sent ---------------------------------------------------------------------------

-- Whose purse it is never changes; only a character, a hireling or the Party stash of the same campaign has one;
-- coin is whole numbers, never below zero.
create function private.purse_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.campaign_id is distinct from old.campaign_id
      or new.actor_id is distinct from old.actor_id or new.location_id is distinct from old.location_id then
      raise exception 'That can''t be changed.';
    end if;
  else
    if new.actor_id is not null and not exists (
      select 1 from public.actors a
      where a.id = new.actor_id and a.campaign_id = new.campaign_id and a.kind in ('pc', 'hireling')
    ) then
      raise exception 'Only a character or a hireling of this campaign has a purse.' using errcode = '23514';
    end if;
    if new.location_id is not null and not exists (
      select 1 from public.locations l
      where l.id = new.location_id and l.campaign_id = new.campaign_id and l.kind = 'stash'
    ) then
      raise exception 'Only the Party stash holds coin.' using errcode = '23514';
    end if;
  end if;
  if not private.is_coin_map(new.coins) then
    raise exception 'Coin is counted in whole numbers, never below zero.' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.purse_rules() from public, anon, authenticated;

-- Copy versions first (by name), as for the clock and the lights. Changes are logged; the making isn't (the
-- database makes the row), and a purse goes only with its character or its campaign.
create trigger check_copy_version before insert or update on public.purses
  for each row execute function private.check_copy_version();
create trigger purse_rules before insert or update on public.purses
  for each row execute function private.purse_rules();
create trigger refuse_when_retired before insert or update or delete on public.purses
  for each row execute function private.refuse_when_retired();
create trigger log_change after update on public.purses
  for each row execute function private.log_change();

-- 5. Who sees a purse's log lines ------------------------------------------------------------------------------------------

-- The stash's coin: everyone in the campaign. A character's purse: its owner and the GM (the GM reads every line);
-- a party's or the GM's own character's: the GM alone. Never wider while the character is Down or dead: a take
-- from an open purse shows on the taker's own purse line (piece b), not on this one.
create function private.log_audience_purses(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
  carrier_owner_type text;
  carrier_owner uuid;
begin
  owner := null;
  if this_row ->> 'actor_id' is null then
    who_sees := case when this_row ->> 'location_id' is null then 'gm' else 'all' end;
    return;
  end if;
  select a.owner_type, a.owner_user_id into carrier_owner_type, carrier_owner
  from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
  if carrier_owner_type = 'user' and carrier_owner is not null then
    who_sees := 'owner';
    owner := carrier_owner;
  else
    who_sees := 'gm';
  end if;
end;
$$;
revoke execute on function private.log_audience_purses(jsonb, jsonb) from public, anon, authenticated;
