-- Deleting a player's account keeps the calls sent to their character and their seen marks (Francis, 2026-11-24,
-- "Approve": deleting an account must work after a call was sent to their character, and must erase nothing; hard
-- rule 4). Fix forward of 20261113210000_dec_12b_calls_to_adventure.sql and 20261124120000_p7_calls_seen.sql.
--   1. public.hook_sends: its player_user_id is already `on delete set null`, but private.hook_send_rules refused every
--      change to it, so deleting the account failed. The guard now lets exactly one change through: player_user_id
--      going from a player to empty, because that player's account is gone (no profile any more), with every other
--      column as it was (updated_at and version aside, which the table's own triggers stamp). Every other change is
--      refused as before; a player can't empty their own link while their account stands.
--   2. public.calls_seen: player_user_id was `not null ... on delete cascade`, so a seen mark went with the account. It
--      is now nullable and `on delete set null`: the mark stays, with no player. Its read rule already gives a mark
--      with no player to the GM alone (player_user_id = auth.uid() is never true for an empty one), and its log lines
--      to the GM alone (private.log_audience_calls_seen). mark_call_seen never meets one (it reads the caller's own).
--      A new guard keeps a mark as it was written, the same one change aside (no one writes the table but
--      mark_call_seen and the database; this holds for the secret key too).
-- Replaces one trigger function (private.hook_send_rules, whose only definition is in 20261113210000) and one foreign
-- key; makes one column nullable; adds one trigger and its function. Drops, renames and deletes no data; no row
-- changes. Still refused, as before: an account deletion while one of its sends or marks is in a retired campaign
-- (private.refuse_when_retired refuses every update there).

-- 1. A send keeps everything, its player aside when their account is deleted ---------------------------------------

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
  -- The player's account was deleted (its foreign key empties the link): the send stays, with no player. Only that
  -- column changes, and only once the account is gone.
  if old.player_user_id is not null and new.player_user_id is null
    and not exists (select 1 from public.profiles p where p.id = old.player_user_id)
    and (to_jsonb(new) - 'player_user_id' - 'updated_at' - 'version')
      = (to_jsonb(old) - 'player_user_id' - 'updated_at' - 'version') then
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

-- A mark is never changed, but for its player's link emptying when their account is deleted.
create function private.call_seen_kept() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.player_user_id is not null and new.player_user_id is null
    and not exists (select 1 from public.profiles p where p.id = old.player_user_id)
    and (to_jsonb(new) - 'player_user_id' - 'updated_at') = (to_jsonb(old) - 'player_user_id' - 'updated_at') then
    new.updated_at := now();
    return new;
  end if;
  raise exception 'That can''t be changed.';
end;
$$;
revoke execute on function private.call_seen_kept() from public, anon, authenticated;

create trigger call_seen_kept before update on public.calls_seen
  for each row execute function private.call_seen_kept();
