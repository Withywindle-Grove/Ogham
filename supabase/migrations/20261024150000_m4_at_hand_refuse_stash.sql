-- M4 At hand fix: hiding something in the Party stash from At hand is refused plainly (permission error), like
-- pinning it, so the app hears "not allowed" instead of a broken rule. Replaces one trigger function; drops nothing.

create or replace function private.unpin_when_handed_on() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.location_id is distinct from old.location_id then
    new.pinned := false;
    new.at_hand_hidden := false;
  end if;
  if new.pinned and new.actor_id is null then
    raise exception 'Only a character''s items can be pinned.' using errcode = '42501';
  end if;
  if new.at_hand_hidden and new.actor_id is null then
    raise exception 'Only a character''s items are in At hand.' using errcode = '42501';
  end if;
  return new;
end;
$$;
