-- Pack review area 3, build order 12, fix forward over 20261104220000 (already applied to the test project).
-- The guard on actors.carrying_treasure refused a non-GM's change only when the value changed, so a player writing
-- the value it already held was let through (the permission check "a player can't switch Carrying treasure for
-- their own character" saw the database allow it). Only the GM switches it: now any write by someone signed in
-- that names the column is refused unless they are the GM, whatever the value. The trigger fires only when the
-- column is in the UPDATE's SET list (`before update of carrying_treasure`), and every other write to actors
-- (the app's patches, Undo's restore of changed values only) leaves it out, so nothing else is affected.
-- Replaces one function (its only definition, 20261104220000); same signature. Changes no rows; drops nothing.

create or replace function private.guard_carrying_treasure() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if not private.is_gm(old.campaign_id) then
    raise exception 'Only the GM can switch Carrying treasure.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_carrying_treasure() from public, anon, authenticated;
