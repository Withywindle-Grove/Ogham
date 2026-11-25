-- Deleting an account keeps the calls sent and their seen marks (Francis, 2026-11-24, "Approve": deleting an account
-- must work after a call was sent to their character, and must erase nothing; hard rule 4; widened the same day, "yes"
-- to the pull request's ⚑ 3: a GM's account too, and any account whose sends or marks are in a retired campaign, on the
-- same principle: the row stays, only its link to the deleted account is emptied). Fix forward of
-- 20261113210000_dec_12b_calls_to_adventure.sql and 20261124120000_p7_calls_seen.sql.
--   0. private.only_gone_accounts_cleared(before, after, links): true when the one change between two versions of a row
--      is one or more of the named links to public.profiles going from an account to empty, each because that account
--      is gone (no profile any more), every other column as it was (updated_at and version aside, which the tables'
--      own triggers stamp). This is what a foreign key's `on delete set null` writes; nothing else can (a link to an
--      account that still stands can't be emptied this way, even with the secret key).
--   1. public.hook_sends: player_user_id and created_by are already `on delete set null`, but private.hook_send_rules
--      refused every change to them, so deleting the player or the GM failed. It now lets exactly that change through.
--      Every other change is refused as before.
--   2. public.calls_seen: player_user_id was `not null ... on delete cascade`, so a seen mark went with the account. It
--      is now nullable and `on delete set null`: the mark stays, with no player. Its read rule already gives a mark
--      with no player to the GM alone (player_user_id = auth.uid() is never true for an empty one), and its log lines
--      to the GM alone (private.log_audience_calls_seen). mark_call_seen never meets one (it reads the caller's own).
--      A new guard keeps a mark as it was written, the same change aside. No one signed in writes the table at all:
--      p7 meant to grant them nothing but select, but the schema's default grants gave them insert, update and delete
--      (row-level security still let no row through, so a write quietly matched nothing); those grants are revoked, so
--      a write is refused outright. mark_call_seen (security definer) and the database are untouched by this.
--   3. private.refuse_when_retired: in a retired campaign, on hook_sends and calls_seen only, it lets the same change
--      through (an account deleted while its sends or marks are in a retired campaign); everything else in a retired
--      campaign is refused as before. Built on its newest definition, 20261022200000_m3_cleanup.sql.
--   4. private.undo_check_made: the database's own log line for that change (no person, only those links emptied) is
--      not a later change that blocks the Undo of the send itself, so the GM can still undo a call sent to a character
--      whose player's account was deleted. Built on its newest definition, 20261029180000_m5_reminders.sql.
-- Replaces three functions (private.hook_send_rules, whose only definition is in 20261113210000;
-- private.refuse_when_retired; private.undo_check_made) and one foreign key; makes one column nullable; adds two
-- functions and one trigger; revokes write grants on calls_seen from anon and authenticated. Drops, renames and deletes
-- no data; no row changes.

-- 0. The one change a deleted account may make to a row -----------------------------------------------------------

create function private.only_gone_accounts_cleared(before_row jsonb, after_row jsonb, links text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select (after_row - links - 'updated_at' - 'version') = (before_row - links - 'updated_at' - 'version')
    and exists (select 1 from unnest(links) as u(k) where before_row ->> k is not null and after_row ->> k is null)
    and not exists (
      select 1 from unnest(links) as u(k)
      where (after_row -> k) is distinct from (before_row -> k)
        and (before_row ->> k is null or after_row ->> k is not null
          or exists (select 1 from public.profiles p where p.id::text = before_row ->> k))
    );
$$;
revoke execute on function private.only_gone_accounts_cleared(jsonb, jsonb, text[]) from public, anon, authenticated;

-- 1. A send keeps everything, its player and its sender aside when their account is deleted ----------------------

create or replace function private.hook_send_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  -- The player's or the GM's account was deleted (its foreign key empties the link): the send stays, with no player
  -- or no sender. Only those columns change, and only once the account is gone.
  if private.only_gone_accounts_cleared(to_jsonb(old), to_jsonb(new), array['player_user_id', 'created_by']) then
    new.updated_at := now();
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.pack_id is distinct from old.pack_id
    or new.hook_key is distinct from old.hook_key or new.actor_id is distinct from old.actor_id
    or new.player_user_id is distinct from old.player_user_id or new.name is distinct from old.name
    or new.body is distinct from old.body or new.pays is distinct from old.pays
    or new.clock_seconds is distinct from old.clock_seconds or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  if not reverting and new.undone <> old.undone then
    raise exception 'That can''t be changed.';
  end if;
  return new;
end;
$$;
revoke execute on function private.hook_send_rules() from public, anon, authenticated;

-- 2. A seen mark stays when its player's account is deleted ---------------------------------------------------------

alter table public.calls_seen alter column player_user_id drop not null;
alter table public.calls_seen drop constraint calls_seen_player_user_id_fkey;
alter table public.calls_seen add constraint calls_seen_player_user_id_fkey
  foreign key (player_user_id) references public.profiles (id) on delete set null;

-- No one signed in writes a mark through the table (p7's intent; the schema's default grants had given them more).
revoke insert, update, delete, truncate on public.calls_seen from anon, authenticated;

-- A mark is never changed, but for its player's link emptying when their account is deleted.
create function private.call_seen_kept() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if private.only_gone_accounts_cleared(to_jsonb(old), to_jsonb(new), array['player_user_id']) then
    new.updated_at := now();
    return new;
  end if;
  raise exception 'That can''t be changed.';
end;
$$;
revoke execute on function private.call_seen_kept() from public, anon, authenticated;

create trigger call_seen_kept before update on public.calls_seen
  for each row execute function private.call_seen_kept();

-- 3. The retired guard: as in 20261022200000_m3_cleanup.sql, plus the deleted account's link on hook_sends and
-- calls_seen ---------------------------------------------------------------------------------------------------------

create or replace function private.refuse_when_retired() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  this_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  campaign uuid;
begin
  if tg_table_name = 'campaigns' then
    if tg_op = 'UPDATE' then
      if old.retired_at is null then
        -- Retiring: the database stamps the time.
        if new.retired_at is not null then
          new.retired_at := now();
        end if;
        return new;
      end if;
      -- Retired: only bringing it back, with nothing else changed.
      if new.retired_at is null
        and (to_jsonb(new) - 'retired_at' - 'updated_at') = (to_jsonb(old) - 'retired_at' - 'updated_at') then
        return new;
      end if;
      raise exception 'This campaign is retired, so nothing in it can change.';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Deletes that follow from another change (a cascade) go through.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  -- An account deleted while its calls or seen marks are in a retired campaign: the row stays, its link emptied
  -- (Francis, 2026-11-24). Nothing else.
  if tg_op = 'UPDATE' and tg_table_name in ('hook_sends', 'calls_seen')
    and private.only_gone_accounts_cleared(to_jsonb(old), to_jsonb(new),
      case when tg_table_name = 'hook_sends' then array['player_user_id', 'created_by'] else array['player_user_id'] end) then
    return new;
  end if;
  if tg_table_name = 'actor_secrets' then
    select a.campaign_id into campaign from public.actors a where a.id = (this_row ->> 'actor_id')::uuid;
  elsif tg_table_name in ('library_entries', 'library_entry_secrets') then
    select p.campaign_id into campaign from public.packs p where p.id = (this_row ->> 'pack_id')::uuid;
  else
    campaign := (this_row ->> 'campaign_id')::uuid;
  end if;
  if private.campaign_is_retired(campaign) then
    raise exception 'This campaign is retired, so nothing in it can change.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function private.refuse_when_retired() from public, anon, authenticated;

-- 4. Undo of a send whose player's account was deleted ------------------------------------------------------------

-- The database's own log line for emptying a deleted account's link on a send or a mark: written by no one, and only
-- those links, each now empty, each to an account that is gone.
create function private.is_gone_account_line(line public.events) returns boolean
language sql stable security definer set search_path = '' as $$
  select line.actor_user_id is null and line.target_table in ('hook_sends', 'calls_seen')
    and line.before is not null and line.after is not null and line.after <> '{}'::jsonb
    and not exists (
      select 1 from jsonb_each(line.after) a
      where a.key not in ('player_user_id', 'created_by') or a.value <> 'null'::jsonb
    )
    and not exists (
      select 1 from jsonb_each_text(line.before) b join public.profiles p on p.id::text = b.value
    );
$$;
revoke execute on function private.is_gone_account_line(public.events) from public, anon;
grant execute on function private.is_gone_account_line(public.events) to authenticated, service_role;

-- As in 20261029180000_m5_reminders.sql, plus: a line private.is_gone_account_line names is not a later change.
create or replace function private.undo_check_made(change public.events) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  current_row jsonb;
begin
  if exists (select 1 from public.events r where r.reverts_event_id = change.id) then
    raise exception 'That was already undone.';
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1 for update', change.target_table)
    into current_row using change.target_id;
  if current_row is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if (current_row ->> 'undone')::boolean then
    raise exception 'That was already undone.';
  end if;
  if current_row ->> 'ended_at' is not null then
    raise exception 'That''s changed since. Undo the later change first.';
  end if;
  if exists (
    select 1 from public.events l
    where l.campaign_id = change.campaign_id and l.target_table = change.target_table and l.target_id = change.target_id
      and l.seq > change.seq and l.reverts_event_id is null
      and (change.request_id is null or l.request_id is distinct from change.request_id)
      and not exists (select 1 from public.events r where r.reverts_event_id = l.id)
      and not private.is_gone_account_line(l)
  ) then
    raise exception 'That''s changed since. Undo the later change first.';
  end if;
end;
$$;
