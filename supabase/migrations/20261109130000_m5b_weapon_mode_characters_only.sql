-- At hand actions, fix forward for 20261109120000_m5b_at_hand_weapon_mode.sql (CI on #569): a weapon's chosen mode
-- belongs to a weapon a character carries, as the app's permission rule says (item.setMode needs a character). The
-- database let a mode be set on a Party stash line. Now, like a pin or At hand's hide:
--   * setting a mode on a line no character carries is refused plainly (permission error), and
--   * a weapon handed on to somewhere that isn't a character (the Party stash) loses its mode, so the move itself
--     isn't refused. Handed to another character, the mode stays (the new holder's stacks decide whether it's engaged).
-- Replaces one trigger function, starting from its newest definition (20261024150000_m4_at_hand_refuse_stash.sql),
-- with the two lines added. Drops, renames and deletes no data.

create or replace function private.unpin_when_handed_on() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.location_id is distinct from old.location_id then
    new.pinned := false;
    new.at_hand_hidden := false;
    if new.actor_id is null then
      new.mode_id := null;
    end if;
  end if;
  if new.pinned and new.actor_id is null then
    raise exception 'Only a character''s items can be pinned.' using errcode = '42501';
  end if;
  if new.at_hand_hidden and new.actor_id is null then
    raise exception 'Only a character''s items are in At hand.' using errcode = '42501';
  end if;
  if new.mode_id is not null and new.actor_id is null then
    raise exception 'Only a character''s weapons have a mode.' using errcode = '42501';
  end if;
  return new;
end;
$$;
