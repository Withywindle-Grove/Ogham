-- M4b, character creation step 5: starting gear (ruled 2026-10-25; docs/05 "Starting money"). Replaces one function.
-- Drops nothing.
--   What the starting gear cost is kept on the character's creation record (spentBase, in the setting's base coin,
--   and moneyCoin, the coin the starting money is counted in). Its player adds them once, right after making it,
--   even when it joined at once (approval off): only those two keys, and only while they aren't there yet.
--   Otherwise, as in 20261025180000_m4b_creation_record.sql: the player's while it waits, then only the GM's.

create or replace function private.guard_creation_record() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(old.campaign_id) then
    return new;
  end if;
  if old.approval = 'approved' and new.creation is distinct from old.creation
    and not (
      not (old.creation ? 'spentBase')
      and (new.creation - 'spentBase' - 'moneyCoin') = (old.creation - 'moneyCoin')
      and jsonb_typeof(new.creation -> 'spentBase') = 'number'
    ) then
    raise exception 'Only the GM can change how an approved character was made.' using errcode = '42501';
  end if;
  return new;
end;
$$;
