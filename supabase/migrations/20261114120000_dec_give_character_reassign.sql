-- December: the GM gives a character to a player (docs/plans/dec-give-a-character-to-a-player.md, gp-1 to gp-6).
-- The command character.reassign is a plain update of the character's owner (owner_type and owner_user_id together),
-- which only the GM may make (private.guard_actor_update, 20261026130000_m4b_draft.sql). This migration adds what
-- follows from a new owner, in the same request, so the log keeps it and Undo puts it back:
--   1. The new owner must be a player of this campaign, or the GM himself (owner kind 'gm', no owner). Anything else is
--      refused, also on Undo (a player who has left the campaign doesn't get a character back).
--   2. Whoever had it in play (members.active_actor_id) no longer does (written before the character's own line).
--   3. The new player has it in play only if they have none (gp-3; written after the character's own line).
--   4. The character's alignment row keeps a copy of its owner (character_alignments.owner_user_id,
--      20261102200000_m5b_0c_creation_data.sql, kept by private.split_alignment only when fields change): it follows.
-- During an Undo (grimoire.reverting set) 2 to 4 are left to the Undo, which puts back each line the give wrote, newest
-- first, and moves the owner only (gp-6: what the receiver changed on the character meanwhile stays).
-- Adds two functions, two triggers and one logged command. Replaces, drops, renames and deletes nothing; no access
-- rule and no reading function changes (the purse, the pack and the log already follow the owner as they read it).

-- 1 and 2: before the owner changes.
create function private.reassign_owner_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_type is not distinct from old.owner_type and new.owner_user_id is not distinct from old.owner_user_id then
    return new;
  end if;
  -- The database's own writes (seeds, the service role) are not checked.
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.owner_type = 'user' and not exists (
    select 1 from public.members m
    where m.campaign_id = new.campaign_id and m.user_id = new.owner_user_id and m.base_role = 'player'
  ) then
    raise exception 'A character can only be given to a player of this campaign.' using errcode = '42501';
  end if;
  if new.owner_type not in ('user', 'gm') then
    raise exception 'A character can only be given to a player of this campaign.' using errcode = '42501';
  end if;
  if nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  update public.members m set active_actor_id = null
  where m.campaign_id = new.campaign_id and m.active_actor_id = new.id
    and (new.owner_type <> 'user' or m.user_id <> new.owner_user_id);
  return new;
end;
$$;
revoke execute on function private.reassign_owner_rules() from public, anon, authenticated;

-- Named to run after the guard (triggers of a kind run in name order), which lets only the GM change the owner.
create trigger reassign_owner_rules before update of owner_type, owner_user_id on public.actors
  for each row execute function private.reassign_owner_rules();

-- 3 and 4: after the owner changed (named after log_change, so these lines follow the character's own).
create function private.reassign_follow_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_type is not distinct from old.owner_type and new.owner_user_id is not distinct from old.owner_user_id then
    return null;
  end if;
  if nullif(current_setting('grimoire.reverting', true), '') is not null then
    return null;
  end if;
  update public.character_alignments c
  set owner_user_id = case when new.owner_type = 'user' then new.owner_user_id end
  where c.actor_id = new.id
    and c.owner_user_id is distinct from (case when new.owner_type = 'user' then new.owner_user_id end);
  if new.owner_type = 'user' and new.kind = 'pc' and new.approval = 'approved' and new.status <> 'archived' then
    update public.members m set active_actor_id = new.id
    where m.campaign_id = new.campaign_id and m.user_id = new.owner_user_id and m.active_actor_id is null;
  end if;
  return null;
end;
$$;
revoke execute on function private.reassign_follow_owner() from public, anon, authenticated;

create trigger reassign_follow_owner after update of owner_type, owner_user_id on public.actors
  for each row execute function private.reassign_follow_owner();

-- The command's log name: the GM's alone.
insert into public.logged_commands (name, level, gm_only) values ('character.reassign', 'simple', true);
