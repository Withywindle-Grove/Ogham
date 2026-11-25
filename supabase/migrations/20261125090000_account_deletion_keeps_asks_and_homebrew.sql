-- Deleting an account keeps a player's requests, the messages sent to them and the campaign's own homebrew pack
-- (Francis, 2026-11-25, "2 a, 3 as recommended", on #84's ⚑ 1 and ⚑ 2). Fix forward of
-- 20261124160000_account_deletion_keeps_rows.sql (applied on TEST), on its principle: the row stays, only its link to
-- the deleted account is emptied (hard rule 4).
--   1. requests: a request a player asked keeps its row; its asker (requester_id, already `on delete set null`)
--      empties. The table's check `direction = 'gmAsks' or requester_id is not null` (20261101090000_m5_requests.sql)
--      can't see the row as it was, so it becomes a trigger that can: a request a player asks still needs its asker,
--      except when the asker's account is gone (private.account_gone). It runs after the row's other triggers, as the
--      check did. A standing account's asker still can't be emptied by hand (request_rules refuses, as before).
--   2. messages.player_user_id and message_recipients.user_id (the messages sent to that player): `on delete cascade`
--      becomes `on delete set null`, the column may be empty. message_rules already lets exactly that change through
--      (its WHEN reads the table's links from the catalogue); message_recipient_rules gets the same WHEN, its insert
--      half a trigger of its own, `message_recipient_rules_on_insert`, as in 20261124160000.
--   3. packs.owner_user_id: `on delete cascade` becomes `on delete set null`, the column may be empty, and
--      guard_pack_update gets the same WHEN. A pack with a campaign_id is that campaign's own homebrew pack (kind
--      homebrew, one per campaign, packs_campaign_pack_is_homebrew and packs_one_homebrew_per_campaign): it stays,
--      with what hangs on it (its entries, hidden fields, its link to the campaign), its owner emptied. A pack with
--      no campaign_id is in its owner's own library (attached to a campaign or not): it still goes with the account,
--      as before, now by a trigger on public.profiles that deletes it just before the account's profile goes.
-- Still let go, as ruled: the account's memberships (members.user_id, `on delete cascade`, untouched) and its
-- personal library packs (above). Drops, renames and deletes no data: it changes three foreign keys, one check and
-- three triggers, and keeps more rows than before. No row changes.

-- 1. A request a player asked keeps its row; its asker empties once the account is gone ---------------------------

alter table public.requests drop constraint requests_check1;

create function private.request_asker_kept() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.direction = 'playerAsks' and new.requester_id is null
    and not (tg_op = 'UPDATE' and old.direction = 'playerAsks'
      and (old.requester_id is null or private.account_gone(old.requester_id))) then
    raise exception 'A request a player asks needs who asked it.' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke execute on function private.request_asker_kept() from public, anon, authenticated;

-- After the row's other triggers, so it reads the row as it is written (as the check did).
create trigger request_asker_kept after insert or update on public.requests for each row
  execute function private.request_asker_kept();

-- 2. The messages sent to that player stay, with no player ---------------------------------------------------------

alter table public.messages alter column player_user_id drop not null;
alter table public.messages drop constraint messages_player_user_id_fkey;
alter table public.messages add constraint messages_player_user_id_fkey
  foreign key (player_user_id) references public.profiles(id) on delete set null;

alter table public.message_recipients alter column user_id drop not null;
alter table public.message_recipients drop constraint message_recipients_user_id_fkey;
alter table public.message_recipients add constraint message_recipients_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

drop trigger message_recipient_rules on public.message_recipients;
create trigger message_recipient_rules before update on public.message_recipients for each row
  when (not private.gone_account_cleared('public.message_recipients', to_jsonb(old), to_jsonb(new))) execute function private.message_recipient_rules();
create trigger message_recipient_rules_on_insert before insert on public.message_recipients for each row execute function private.message_recipient_rules();

-- 3. The campaign's own homebrew pack stays, with no owner; a library pack goes with its owner -------------------

alter table public.packs alter column owner_user_id drop not null;
alter table public.packs drop constraint packs_owner_user_id_fkey;
alter table public.packs add constraint packs_owner_user_id_fkey
  foreign key (owner_user_id) references public.profiles(id) on delete set null;

drop trigger guard_pack_update on public.packs;
create trigger guard_pack_update before update on public.packs for each row
  when (not private.gone_account_cleared('public.packs', to_jsonb(old), to_jsonb(new))) execute function private.guard_pack_update();

-- The account's own library packs (no campaign_id) go with it, as the cascade took them before; its entries, hidden
-- fields and links to campaigns go with each pack (their own `on delete cascade`).
create function private.account_library_goes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.packs p where p.owner_user_id = old.id and p.campaign_id is null;
  return old;
end;
$$;
revoke execute on function private.account_library_goes() from public, anon, authenticated;

create trigger account_library_goes before delete on public.profiles for each row
  execute function private.account_library_goes();
