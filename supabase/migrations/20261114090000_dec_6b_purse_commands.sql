-- December step 6, piece (b): the purse commands (docs/plans/dec-6-purse.md; ruling pk-6 in
-- docs/design/rulings/pack-rework-rulings-2026-11-11.md; docs/03 "Adjust personal purse" and "Take from a Down or dead
-- character's pack or purse"; hard rules 3, 4, 5 and 8). Builds on 20261111160000_dec_6a_purse_data.sql.
--   1. Five functions, the only way a device changes a purse (the table still has no write grant or rule):
--        public.purse_add     the GM gives coin to a character's purse or the Party stash      (purse.add, GM only)
--        public.purse_remove  the GM takes coin from either, out of play                       (purse.remove, GM only)
--        public.purse_spend   a player spends from their own character's purse, out of play,
--                             with a few optional words on what for                            (purse.spend)
--        public.purse_give    a player gives from their own character's purse to another
--                             character or to the Party stash                                  (purse.give)
--        public.purse_take    a player takes from the Party stash, or from a Down or dead
--                             character's purse (ruled 2026-10-29), into their own character's;
--                             the GM takes from any purse into any character's                 (purse.take)
--      Each checks who is asking first, on an unlocked read (refused with "You don't have permission to do that.",
--      42501), and locks the purses only once allowed. Each then needs the request's id (the app's tagged requests carry
--      one; refused without it) and names its own log lines (grimoire.event_type), never trusting the device's header for
--      either. Amounts are whole numbers of 1 or more, by coin. A purse never goes below zero: refused with "<Name> has
--      <n> <coin>." (code GR422; the app prints the setting's coin name; the stash is "The stash"), and never above
--      999,999,999 of a coin: "<Name> can't hold more than 999,999,999 <coin>." (code GR423) where the one acting can read
--      that purse; to a giver who can't read the receiver's, "That give didn't go through. Nothing changed." (code GR424;
--      the lead, 2026-11-13). An archived character's purse follows its pack: only the GM changes it. The same request
--      sent again changes nothing.
--   2. The few words a spend is for are kept in its log line's reason (private.log_change reads grimoire.event_reason,
--      set only by these functions). Only a GM ruling set the reason before. A give's or a take's lines keep the other
--      side there instead ("with:<character id>" or "with:stash"), so each reads in the approved words (pu-7) without
--      its reader reading the other purse. A purse function's own words win over a ruling's reason.
--   3. Undo: purses join public.undoable_tables. A move between two purses changes both, and the giver may not read
--      the purse it reached (nor its log line), so a player's Undo of their own purse.spend, purse.give or purse.take
--      runs as the database (private.undo_coin_as_author), as the GM's always has. Every coin Undo, the player's and
--      the GM's alike (private.undo_as_gm, replaced for this), is held to private.coin_action_lines: the action must be
--      exactly what these functions make (its request id; no reversal line in it; every line on a purse and of the
--      same type; a spend, add or remove one line; a give or take exactly two lines on two purses, balancing coin by
--      coin), so Undo never makes or loses coin. An Undo of coin can't itself be undone. For a player, also as the purses are now: their own side still theirs and in play, a give's
--      receiver still open to coin, a take's purse still open to them. Then private.undo_coin_checked locks the purses
--      in one order, files the reversal lines under the database's own request id (log_change reads
--      grimoire.request_id), and afterwards requires that exactly the checked lines were reversed. The usual checks
--      hold ("That's changed since. Undo the later change first."; "That was already undone."). public.undo_request is
--      replaced to send a player's coin lines this way.
--   4. The five commands' rows in public.logged_commands.
-- Who may read what is unchanged: no read rule is added or replaced, and nothing a function returns or refuses says
-- what an unreadable purse holds. Two small signals remain, inherent to a give, awaiting Francis's word through the
-- lead: a giver learns that a give was refused (GR424, nothing more), and that an Undo of their give was refused
-- because the receiver's purse changed since.
-- Replaces private.log_change (newest: 20261030161000_m5_light.sql), and public.undo_request and private.undo_as_gm
-- (newest of both: 20261021160000_m2_undo_as_caller.sql); adds eighteen functions and six rows. Drops, renames and
-- deletes nothing.

-- 1. The log keeps a spend's words ------------------------------------------------------------------------------------------

-- As in 20261030161000_m5_light.sql, plus: a purse function's few words (grimoire.event_reason) become the line's
-- reason when the line isn't a GM ruling with its own.
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
  -- December step 6b: a coin Undo files its reversal lines under an id of its own (grimoire.request_id, set only by
  -- the database's undo), never under one the device sends.
  if nullif(current_setting('grimoire.request_id', true), '') is not null then
    request := current_setting('grimoire.request_id', true)::uuid;
  end if;
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
  -- December step 6b: a purse function's own words (what a spend was for; a move's other side, "with:…") win over a
  -- ruling's reason, so a ruling can't overwrite the side a move's line names. Set only by those functions.
  why := coalesce(nullif(left(trim(coalesce(current_setting('grimoire.event_reason', true), '')), 500), ''), why);

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

-- 2. The helpers ---------------------------------------------------------------------------------------------------------------

-- A purse of the campaign, found by its character (or hireling) or by its Party stash, not locked: the functions check
-- who is asking on this read first, and lock only once allowed (so nobody holds locks on purses they may not touch).
-- Null when there is none (the caller then refuses as for anything it may not touch).
create function private.purse_of(campaign uuid, actor uuid, location uuid) returns public.purses
language sql stable security definer set search_path = '' as $$
  select p.* from public.purses p
  where p.campaign_id = campaign
    and num_nonnulls(actor, location) = 1
    and (p.actor_id = actor or p.location_id = location);
$$;
revoke execute on function private.purse_of(uuid, uuid, uuid) from public, anon, authenticated;

-- Locks these purses, in the same order every time (by id), so two moves crossing can't wait on each other.
create function private.lock_purses(ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.purses p where p.id = any (ids) order by p.id for update;
end;
$$;
revoke execute on function private.lock_purses(uuid[]) from public, anon, authenticated;

-- A purse as it is now (read again once locked, so a change counts from what it holds at that moment).
create function private.purse_now(purse uuid) returns public.purses
language sql stable security definer set search_path = '' as $$
  select p.* from public.purses p where p.id = purse;
$$;
revoke execute on function private.purse_now(uuid) from public, anon, authenticated;

-- Every purse function starts here, after its rights check: the request must carry its request id and part (the app's
-- tagged requests always do), and the log names the line after the function itself, never after the device's header
-- (grimoire.event_type, as the clock's and the statuses' functions do). So a line's type and its action are the
-- server's: Undo can trust them.
create function private.begin_coin_action(command text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  tag jsonb := private.request_tag();
  request uuid;
  part integer;
begin
  begin
    request := (tag ->> 'requestId')::uuid;
    part := (tag ->> 'part')::integer;
  exception when others then
    request := null;
  end;
  if request is null or part is null then
    raise exception 'That change needs its request id. Try again from the app.' using errcode = '22023';
  end if;
  perform set_config('grimoire.event_type', command, true);
end;
$$;
revoke execute on function private.begin_coin_action(text) from public, anon, authenticated;

-- And ends here: the name and the words are for this function's lines only.
create function private.end_coin_action() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('grimoire.event_type', '', true);
  perform set_config('grimoire.event_reason', '', true);
end;
$$;
revoke execute on function private.end_coin_action() from public, anon, authenticated;

-- Is this the signed-in person's own character's (or hireling's) purse, still in play? (A hireling's owner is its
-- employer.) Approved only (never a draft or one waiting); an archived character's purse follows its pack: only the GM
-- changes it.
create function private.owns_purse(p public.purses) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.actor_id is not null and private.is_member(p.campaign_id) and exists (
    select 1 from public.actors a
    where a.id = p.actor_id and a.owner_type = 'user' and a.owner_user_id = (select auth.uid())
      and a.status <> 'archived' and a.approval = 'approved'
  );
$$;
revoke execute on function private.owns_purse(public.purses) from public, anon, authenticated;

-- A purse coin can be sent to: the Party stash, or an approved character's or hireling's (never a draft or one waiting);
-- an archived character's only by the GM.
create function private.may_receive_coin(p public.purses) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.location_id is not null or exists (
    select 1 from public.actors a
    where a.id = p.actor_id and a.approval = 'approved'
      and (a.status <> 'archived' or private.is_gm(p.campaign_id))
  );
$$;
revoke execute on function private.may_receive_coin(public.purses) from public, anon, authenticated;

-- The other side of a move, kept as each line's reason so a line can name it (pu-7): "with:<character id>", or
-- "with:stash". Only an id and the word stash: never an amount, nothing the reader couldn't see on the party list.
create function private.coin_counterpart(p public.purses) returns text
language sql immutable set search_path = '' as $$
  select 'with:' || coalesce(p.actor_id::text, 'stash');
$$;
revoke execute on function private.coin_counterpart(public.purses) from public, anon, authenticated;

-- Changes a purse by an amount (`sign` 1 adds, -1 takes away), coin by coin. The amount is one or more coins, each a
-- whole number of 1 or more. A coin that would go below zero refuses the whole change, naming what the purse has
-- ("Wren has 30 heron.", code GR422; detail: the purse's name, the coin and what it has, for the app's own words); one
-- that would go over 999,999,999 refuses it too ("Wren can't hold more than 999,999,999 heron.", code GR423; detail:
-- the name, the coin and the most). The Party stash is named "The stash" (the lead, 2026-11-13). A coin that reaches
-- zero leaves the map (a coin that isn't there counts 0). Only called after the rights checks, on a locked purse read
-- again (private.purse_now).
create function private.change_purse(p public.purses, amount jsonb, sign integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  held_coins jsonb := p.coins;
  coin record;
  held bigint;
  left_over bigint;
  whose text := coalesce(
    (select a.name from public.actors a where a.id = p.actor_id),
    case when p.location_id is not null then 'The stash' end,
    'That purse'
  );
begin
  -- In two steps, so a coin is read as a number only once the shape is known to be whole numbers.
  if amount is null or not private.is_coin_map(amount) or amount = '{}'::jsonb then
    raise exception 'Say how many: a whole number, 1 or more.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(amount) c where (c.value #>> '{}')::bigint < 1) then
    raise exception 'Say how many: a whole number, 1 or more.' using errcode = '22023';
  end if;
  for coin in select c.key, (c.value #>> '{}')::bigint as n from jsonb_each(amount) c order by c.key loop
    held := coalesce((held_coins ->> coin.key)::bigint, 0);
    left_over := held + sign * coin.n;
    if left_over < 0 then
      raise exception '% has % %.', whose, held, coin.key using
        errcode = 'GR422',
        detail = jsonb_build_object('name', whose, 'coin', coin.key, 'has', held)::text;
    end if;
    if left_over > 999999999 then
      raise exception '% can''t hold more than 999,999,999 %.', whose, coin.key using
        errcode = 'GR423',
        detail = jsonb_build_object('name', whose, 'coin', coin.key, 'most', 999999999)::text;
    end if;
    held_coins := case when left_over = 0 then held_coins - coin.key else held_coins || jsonb_build_object(coin.key, left_over) end;
  end loop;
  update public.purses t set coins = held_coins where t.id = p.id;
end;
$$;
revoke execute on function private.change_purse(public.purses, jsonb, integer) from public, anon, authenticated;

-- 3. The commands --------------------------------------------------------------------------------------------------------------
-- Each: find the purses (unlocked), check who is asking, then the request id and the line's name, then lock and read
-- again, then change. The same request sent again changes nothing.

-- The GM gives coin (from outside play) to a character's purse or the Party stash. Never to another person's draft.
create function public.purse_add(campaign uuid, actor uuid, location uuid, coins jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.purses := private.purse_of(campaign, actor, location);
begin
  if p.id is null or not private.is_gm(p.campaign_id) or (p.actor_id is not null and private.is_others_draft(p.actor_id)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.begin_coin_action('purse.add');
  -- Locked before the repeat check, so a retry arriving while its original is still at work waits and then reads as a
  -- repeat. (A retry whose own transaction began first can still apply twice, a window of milliseconds; that doubled
  -- action is then refused to Undo by the two-line rule.)
  perform private.lock_purses(array[p.id]);
  if not private.repeated_request('purses', p.id) then
    perform private.change_purse(private.purse_now(p.id), coins, 1);
  end if;
  perform private.end_coin_action();
end;
$$;
revoke execute on function public.purse_add(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.purse_add(uuid, uuid, uuid, jsonb) to authenticated, service_role;

-- The GM takes coin out of play, from a character's purse or the Party stash.
create function public.purse_remove(campaign uuid, actor uuid, location uuid, coins jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.purses := private.purse_of(campaign, actor, location);
begin
  if p.id is null or not private.is_gm(p.campaign_id) or (p.actor_id is not null and private.is_others_draft(p.actor_id)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.begin_coin_action('purse.remove');
  -- Locked before the repeat check, so a retry arriving while its original is still at work waits and then reads as a
  -- repeat. (A retry whose own transaction began first can still apply twice, a window of milliseconds; that doubled
  -- action is then refused to Undo by the two-line rule.)
  perform private.lock_purses(array[p.id]);
  if not private.repeated_request('purses', p.id) then
    perform private.change_purse(private.purse_now(p.id), coins, -1);
  end if;
  perform private.end_coin_action();
end;
$$;
revoke execute on function public.purse_remove(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.purse_remove(uuid, uuid, uuid, jsonb) to authenticated, service_role;

-- A player spends from their own character's purse: the coin leaves play. `what_for` is optional, kept in the line.
create function public.purse_spend(campaign uuid, actor uuid, coins jsonb, what_for text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.purses := private.purse_of(campaign, actor, null);
begin
  if p.id is null or not private.owns_purse(p) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.begin_coin_action('purse.spend');
  -- Locked before the repeat check, so a retry arriving while its original is still at work waits and then reads as a
  -- repeat. (A retry whose own transaction began first can still apply twice, a window of milliseconds; that doubled
  -- action is then refused to Undo by the two-line rule.)
  perform private.lock_purses(array[p.id]);
  if not private.repeated_request('purses', p.id) then
    perform set_config('grimoire.event_reason', coalesce(left(trim(what_for), 500), ''), true);
    perform private.change_purse(private.purse_now(p.id), coins, -1);
  end if;
  perform private.end_coin_action();
end;
$$;
revoke execute on function public.purse_spend(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.purse_spend(uuid, uuid, jsonb, text) to authenticated, service_role;

-- A player gives from their own character's purse to another character's (approved) or to the Party stash. The giver
-- doesn't read the purse it reaches: nothing here says what it holds.
create function public.purse_give(campaign uuid, from_actor uuid, to_actor uuid, to_location uuid, coins jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  giver public.purses := private.purse_of(campaign, from_actor, null);
  receiver public.purses := private.purse_of(campaign, to_actor, to_location);
begin
  if giver.id is null or receiver.id is null or giver.id = receiver.id
    or not private.owns_purse(giver) or not private.may_receive_coin(receiver) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.begin_coin_action('purse.give');
  -- A repeat on either purse is a repeat: never the giving half again without the receiving half.
  perform private.lock_purses(array[giver.id, receiver.id]);
  if not (private.repeated_request('purses', giver.id) or private.repeated_request('purses', receiver.id)) then
    -- Each side's line names the other purse (its character, or the stash), so both read "Wren gave Moss 5 herons"
    -- (pu-7) without either reading the other's purse.
    perform set_config('grimoire.event_reason', private.coin_counterpart(receiver), true);
    perform private.change_purse(private.purse_now(giver.id), coins, -1);
    perform set_config('grimoire.event_reason', private.coin_counterpart(giver), true);
    begin
      perform private.change_purse(private.purse_now(receiver.id), coins, 1);
    exception when sqlstate 'GR423' then
      -- The receiver's purse would pass the cap. To a giver who can't read it, the refusal says nothing of it and names
      -- no one (the lead, 2026-11-13); where the giver can read it (the stash, their own, the GM), pu-8's words.
      if not private.may_read_purse(receiver.campaign_id, receiver.actor_id, receiver.location_id) then
        raise exception 'That give didn''t go through. Nothing changed.' using errcode = 'GR424';
      end if;
      raise;
    end;
  end if;
  perform private.end_coin_action();
end;
$$;
revoke execute on function public.purse_give(uuid, uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.purse_give(uuid, uuid, uuid, uuid, jsonb) to authenticated, service_role;

-- A player takes coin into their own character's purse (approved): from the Party stash, or from a character's purse
-- while that character is Down or dead (ruled 2026-10-29; private.is_down_or_dead, as the read rule has it). The GM
-- takes from any purse of the campaign into any approved character's.
create function public.purse_take(campaign uuid, from_actor uuid, from_location uuid, to_actor uuid, coins jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  source public.purses := private.purse_of(campaign, from_actor, from_location);
  taker public.purses := private.purse_of(campaign, to_actor, null);
  as_gm boolean := private.is_gm(campaign);
begin
  if source.id is null or taker.id is null or source.id = taker.id or not private.may_receive_coin(taker)
    or not (
      (as_gm and not (source.actor_id is not null and private.is_others_draft(source.actor_id)))
      or (
        private.owns_purse(taker)
        and (source.location_id is not null or private.is_down_or_dead(source.actor_id))
      )
    ) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.begin_coin_action('purse.take');
  perform private.lock_purses(array[source.id, taker.id]);
  if not (private.repeated_request('purses', source.id) or private.repeated_request('purses', taker.id)) then
    perform set_config('grimoire.event_reason', private.coin_counterpart(taker), true);
    perform private.change_purse(private.purse_now(source.id), coins, -1);
    perform set_config('grimoire.event_reason', private.coin_counterpart(source), true);
    perform private.change_purse(private.purse_now(taker.id), coins, 1);
  end if;
  perform private.end_coin_action();
end;
$$;
revoke execute on function public.purse_take(uuid, uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.purse_take(uuid, uuid, uuid, uuid, jsonb) to authenticated, service_role;

-- 4. Undo -------------------------------------------------------------------------------------------------------------------------

insert into public.undoable_tables (name) values ('purses');

-- Which way a purse line moved coin: -1 when it took coin out, 1 when it put coin in, 0 when neither (a line moves one
-- way only: the functions take from one purse and put into another).
create function private.coin_line_way(before_values jsonb, after_values jsonb) returns integer
language sql immutable set search_path = '' as $$
  select coalesce(sign(sum(
    coalesce((after_values -> 'coins' ->> k.coin)::bigint, 0) - coalesce((before_values -> 'coins' ->> k.coin)::bigint, 0)
  ))::integer, 0)
  from (
    select jsonb_object_keys(coalesce(after_values -> 'coins', '{}'::jsonb)) as coin
    union
    select jsonb_object_keys(coalesce(before_values -> 'coins', '{}'::jsonb))
  ) k;
$$;
revoke execute on function private.coin_line_way(jsonb, jsonb) from public, anon, authenticated;

-- The coin action an Undo is asked for, checked to be exactly what the purse functions make, before anything is put
-- back; its lines' ids are returned for private.undo_coin_checked to hold Undo to. The action is the picked line's
-- request id and author, as private.undo_body reads it. Refused (42501) unless:
--   the picked line is a purse function's own line (its type, on a purse) with its request id (a reversal is refused
--   first, in plain words: an Undo of coin can't be undone);
--   no line of the action is a reversal (a reversal's request id is the database's own, private.undo_coin_checked,
--   but older or forged ones are refused all the same), and every line is on a purse and of the picked line's type;
--   a spend, an add or a remove is its one line; a give or a take is exactly two lines on two purses, balancing coin
--   by coin (each move takes from one purse what it puts in the other). Two moves under one id are refused: Undo puts
--   each purse back to its oldest line's value, which would wipe another action's change in between. So Undo never
--   makes or loses coin.
-- For a player, also as the purses are now, not as the line was written (refused with "That's changed since. Undo the
-- later change first."): the purse they spent or gave from is still their own and in play (private.owns_purse), a
-- give's receiver may still be given to (private.may_receive_coin), a take's purse is still their own and the purse it
-- came from still open to them (the stash; a character still Down or dead) and still open to coin (not archived since;
-- the Fable check, 2026-11-13). So a player's Undo never writes into an
-- archived purse, one they no longer play, or one closed to them, except the receiving side of their own give (pu-9).
create function private.coin_action_lines(picked public.events, as_gm boolean) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  ids uuid[];
  lines integer;
  purses_touched integer;
  odd_lines integer;
  reversals integer;
  unbalanced integer;
begin
  -- An Undo of a coin line can't itself be undone (the lead, 2026-11-13): the GM moves the coin again instead, and the
  -- log shows both lines. Plain words, as an ordinary refusal toast.
  if picked.id is not null and picked.reverts_event_id is not null and picked.target_table = 'purses' then
    raise exception 'An Undo of coin can''t be undone. Move the coin again instead.';
  end if;
  if picked.id is null or picked.request_id is null or picked.reverts_event_id is not null
    or picked.target_table <> 'purses'
    or picked.type not in ('purse.add', 'purse.remove', 'purse.spend', 'purse.give', 'purse.take') then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select coalesce(array_agg(e.id), '{}'), count(*), count(distinct e.target_id),
         count(*) filter (where e.target_table <> 'purses' or e.type <> picked.type),
         count(*) filter (where e.reverts_event_id is not null)
    into ids, lines, purses_touched, odd_lines, reversals
  from public.events e
  where e.campaign_id = picked.campaign_id and e.request_id = picked.request_id
    and e.actor_user_id is not distinct from picked.actor_user_id;
  select count(*) into unbalanced from (
    select k.coin
    from public.events e
    cross join lateral (
      select jsonb_object_keys(coalesce(e.after -> 'coins', '{}'::jsonb)) as coin
      union
      select jsonb_object_keys(coalesce(e.before -> 'coins', '{}'::jsonb))
    ) k
    where e.id = any (ids)
    group by k.coin
    having sum(coalesce((e.after -> 'coins' ->> k.coin)::bigint, 0) - coalesce((e.before -> 'coins' ->> k.coin)::bigint, 0)) <> 0
  ) moved;
  if reversals > 0 or odd_lines > 0
    or (picked.type in ('purse.add', 'purse.remove', 'purse.spend') and lines <> 1)
    or (picked.type in ('purse.give', 'purse.take') and (lines <> 2 or purses_touched <> 2 or unbalanced > 0)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if not as_gm and exists (
    select 1
    from public.events e
    join public.purses p on p.id = e.target_id
    where e.id = any (ids)
      and (
        (picked.type in ('purse.spend', 'purse.give') and private.coin_line_way(e.before, e.after) < 0 and not private.owns_purse(p))
        or (picked.type = 'purse.give' and private.coin_line_way(e.before, e.after) > 0 and not private.may_receive_coin(p))
        or (picked.type = 'purse.take' and private.coin_line_way(e.before, e.after) > 0 and not private.owns_purse(p))
        or (picked.type = 'purse.take' and private.coin_line_way(e.before, e.after) < 0
            and (not private.may_read_purse(p.campaign_id, p.actor_id, p.location_id) or not private.may_receive_coin(p)))
      )
  ) then
    raise exception 'That''s changed since. Undo the later change first.';
  end if;
  return ids;
end;
$$;
revoke execute on function private.coin_action_lines(public.events, boolean) from public, anon, authenticated;

-- Undoes a checked coin action: its purses locked first, in one order (so two Undos can't wait on each other), its
-- reversal lines filed under an id of the database's own (log_change reads grimoire.request_id), then private.undo_body
-- as usual; and afterwards, the lines this Undo reversed must be exactly the lines checked, or nothing stands.
create function private.undo_coin_checked(event_id uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  own_request uuid := gen_random_uuid();
  reversed uuid[];
begin
  perform private.lock_purses(array(select e.target_id from public.events e where e.id = any (ids)));
  perform set_config('grimoire.request_id', own_request::text, true);
  perform set_config('grimoire.event_type', 'event.undo', true);
  perform private.undo_body(event_id);
  perform set_config('grimoire.request_id', '', true);
  perform set_config('grimoire.event_type', '', true);
  select coalesce(array_agg(e.reverts_event_id), '{}') into reversed
  from public.events e where e.request_id = own_request;
  if not (reversed @> ids and ids @> reversed and cardinality(reversed) = cardinality(ids)) then
    raise exception 'That can''t be undone.';
  end if;
end;
$$;
revoke execute on function private.undo_coin_checked(uuid, uuid[]) from public, anon, authenticated;

-- A player's Undo of their own purse.spend, purse.give or purse.take, run as the database (like the GM's,
-- private.undo_as_gm): the receiving purse and its log line may be ones the player can't read. Only the player's own
-- line that they can see, and only an action private.coin_action_lines finds exactly as the functions made it.
create function private.undo_coin_as_author(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  picked public.events;
begin
  select * into picked from public.events e where e.id = event_id;
  if picked.id is null
    or picked.type not in ('purse.spend', 'purse.give', 'purse.take')
    or not private.is_member(picked.campaign_id)
    or picked.actor_user_id is distinct from (select auth.uid())
    or picked.reveal_at <> 'now'
    or not (picked.audience = 'all' or (picked.audience = 'owner' and picked.owner_user_id = (select auth.uid()))) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  perform private.undo_coin_checked(event_id, private.coin_action_lines(picked, false));
end;
$$;
revoke execute on function private.undo_coin_as_author(uuid) from public, anon;
grant execute on function private.undo_coin_as_author(uuid) to authenticated, service_role;

-- As in 20261021160000_m2_undo_as_caller.sql, plus (the lead, 2026-11-13): when the picked line, or any line of its
-- action, is on a purse, the GM's Undo is held to the same shape check as a player's (the ownership checks aside: the
-- GM changes every purse), so a forged action can't be put back through the GM either. Everything else is untouched.
create or replace function private.undo_as_gm(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  picked public.events;
begin
  if not exists (select 1 from public.events e where e.id = event_id and private.is_gm(e.campaign_id)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  select * into picked from public.events e where e.id = event_id;
  if picked.target_table = 'purses' or exists (
    select 1 from public.events e
    where e.campaign_id = picked.campaign_id and picked.request_id is not null and e.request_id = picked.request_id
      and e.actor_user_id is not distinct from picked.actor_user_id and e.target_table = 'purses'
  ) then
    perform private.undo_coin_checked(event_id, private.coin_action_lines(picked, true));
    return;
  end if;
  perform private.undo_body(event_id);
end;
$$;

-- As in 20261021160000_m2_undo_as_caller.sql, plus: a player's own coin line goes through private.undo_coin_as_author.
create or replace function public.undo_request(event_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  campaign uuid;
  picked_type text;
  picked_table text;
begin
  -- Only an entry this person can see (the events reading rule applies here).
  select e.campaign_id, e.type, e.target_table into campaign, picked_type, picked_table
  from public.events e where e.id = event_id;
  if campaign is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if private.is_gm(campaign) then
    perform private.undo_as_gm(event_id);
  elsif picked_table = 'purses' and picked_type in ('purse.spend', 'purse.give', 'purse.take') then
    perform private.undo_coin_as_author(event_id);
  else
    perform private.undo_body(event_id);
  end if;
end;
$$;

-- 5. The logged commands -------------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('purse.add', 'simple', true),
  ('purse.remove', 'simple', true),
  ('purse.spend', 'simple', false),
  ('purse.give', 'simple', false),
  ('purse.take', 'simple', false);
