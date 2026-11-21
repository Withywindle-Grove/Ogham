-- M4 step 6 fix: pinning something in the Party stash is refused plainly (permission error), instead of being
-- quietly undone, so the app hears "not allowed". A pin still goes away by itself when its item is handed on.
-- Replaces one trigger function; drops nothing.

create or replace function private.unpin_when_handed_on() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.actor_id is distinct from old.actor_id or new.location_id is distinct from old.location_id then
    new.pinned := false;
  end if;
  if new.pinned and new.actor_id is null then
    raise exception 'Only a character''s items can be pinned.' using errcode = '42501';
  end if;
  return new;
end;
$$;
