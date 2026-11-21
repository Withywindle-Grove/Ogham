-- M4 step 5 follow-up (ruled 2026-10-23): every dice entry is logged the same way, so a charge count keeps the
-- roll behind it ("2d6 → 7"): on the line for visible charges, with the GM's hidden data for hidden ones (a hidden
-- recharge's roll never reaches players). The log line reads it. Adds two columns; replaces the charges guard
-- (a player may write the note only with the first setting of visible charges). Drops nothing.

alter table public.inventory_lines add column last_roll text check (char_length(last_roll) <= 60);
alter table public.inventory_line_secrets add column last_roll text check (char_length(last_roll) <= 60);

-- As in 20261023200000_m4_charges.sql, plus the roll note.
create or replace function private.guard_charges() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id)
    or nullif(current_setting('grimoire.reverting', true), '') is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.charges_left is not null or new.charges_used <> 0 or new.spent_shown or new.last_roll is not null then
      raise exception 'Only the GM sets charges that way.' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.charges_left is distinct from old.charges_left and not (old.charges_left is null or new.charges_left = old.charges_left - 1))
    or (new.charges_used <> old.charges_used and new.charges_used <> old.charges_used + 1)
    or new.charges_hidden is distinct from old.charges_hidden
    or new.spent_shown is distinct from old.spent_shown
    or (new.last_roll is distinct from old.last_roll and old.charges_left is not null) then
    raise exception 'Only the GM changes charges that way.' using errcode = '42501';
  end if;
  return new;
end;
$$;
