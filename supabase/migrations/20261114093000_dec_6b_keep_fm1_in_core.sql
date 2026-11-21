-- December step 6, piece (b), a fix forward on 20261114090000_dec_6b_purse_commands.sql (already applied on TEST).
-- Why it exists: that migration replaced private.log_change and public.undo_request starting from their newest
-- definitions on main (20261030161000_m5_light.sql and 20261021160000_m2_undo_as_caller.sql). But the newest of both
-- is in 20261111100000_fm1_group_log_audience.sql (pull request #628, not merged, yet applied on TEST and main), which
-- added a travel group's log audience (log_change: the group's number and its players, events_group_readers_check)
-- and a player's own Undo of a forced march (undo_request: private.undo_own_march). Applied after fm-1, 090000 put the
-- older bodies back and dropped both. On TEST that broke three things: travel commands (their group lines failed that
-- check), notes on a group's line (written with the group audience), and a player's Undo of their own forced march.
-- On any database, 090000 and 093000 are applied together in one push; never 090000 alone.
-- This migration puts both functions back as fm-1 has them, whole, with exactly 090000's purse additions merged in:
--   private.log_change: a coin Undo's reversal lines under the database's own request id (grimoire.request_id), and a
--     purse function's own words (grimoire.event_reason) winning over a ruling's reason;
--   public.undo_request: a player's own purse.spend, purse.give or purse.take line through private.undo_coin_as_author.
-- private.undo_as_gm (which fm-1 never touched) and private.undo_body (fm-1's, which 090000 never touched) stay as they
-- are. Replaces two functions; adds, drops, renames and deletes nothing; changes no row and no access rule.

-- As in 20261111100000_fm1_group_log_audience.sql, plus the two purse blocks of 20261114090000_dec_6b_purse_commands.sql.
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
  group_no integer;
  readers uuid[];
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
  -- A group's line: which group, and the players in it now, who alone read it with the GM.
  if who_sees = 'group' then
    select g.group_no, g.readers into group_no, readers from private.log_group(tg_table_name, old_row, new_row) g;
    if readers is null then
      who_sees := 'gm';
      group_no := null;
    end if;
  end if;
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
    fiat, reason, audience, owner_user_id, group_number, group_user_ids, reveal_at, request_id, request_part, reverts_event_id
  ) values (
    campaign, event_type, event_level, (select auth.uid()), tg_table_name,
    coalesce(this_row ->> 'id', this_row ->> 'actor_id')::uuid,
    before_values, after_values, is_fiat, why, who_sees, owner, group_no, readers, reveal, request, part, reverting
  );
  return null;
end;
$$;

-- As in 20261111100000_fm1_group_log_audience.sql, plus: a player's own coin line goes through
-- private.undo_coin_as_author (20261114090000_dec_6b_purse_commands.sql).
create or replace function public.undo_request(event_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  picked public.events;
begin
  -- Only an entry this person can see (the events reading rule applies here).
  select * into picked from public.events e where e.id = event_id;
  if picked.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if private.is_gm(picked.campaign_id) then
    perform private.undo_as_gm(event_id);
  elsif picked.type = 'travel.forceMarch' and picked.target_table = 'travel_groups' and picked.audience = 'group' then
    perform private.undo_own_march(event_id);
  elsif picked.target_table = 'purses' and picked.type in ('purse.spend', 'purse.give', 'purse.take') then
    perform private.undo_coin_as_author(event_id);
  else
    perform private.undo_body(event_id);
  end if;
end;
$$;
