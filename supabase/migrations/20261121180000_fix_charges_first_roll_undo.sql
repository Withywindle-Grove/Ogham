-- fix-charges-first-roll-undo: a player cannot undo a first roll of charges; only the GM can (Francis, 2026-11-21:
-- "A"). Replaces one function; adds, drops, renames and deletes nothing, and changes no read rule.
-- builds on: private.guard_charges from 20261024230000_m4_review_fixes.sql (its newest definition; no later migration
-- redefines it: 20261025090000_m4b_charges.sql only adds private.note_fizzle, which runs after it).
-- The guard let every Undo (grimoire.reverting) through unchecked. A player sets an item's visible charges once, from
-- the roll (the count goes from empty to a number); their own Undo of that roll put the count back to empty, and the
-- guard then let them roll again: a re-roll. Now, inside a player's Undo, a change that empties a count that had a
-- number is refused (42501). Everything else an Undo writes passes as before: a used charge given back (the count up
-- by one, or the uses down by one), a line put back where a move, give, drop or merge took it, and anything the GM
-- undoes, the first roll included. The rule outside an Undo is unchanged.
-- The trigger guard_charges (before insert or update on public.inventory_lines) calls this function and stays as made.
create or replace function private.guard_charges() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.is_gm(new.campaign_id) then
    return new;
  end if;
  if nullif(current_setting('grimoire.reverting', true), '') is not null then
    if tg_op = 'UPDATE' and old.charges_left is not null and new.charges_left is null then
      raise exception 'Only the GM can undo a first roll of charges.' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.charges_left is not null or new.charges_used <> 0 or new.spent_shown or new.last_roll is not null then
      raise exception 'Only the GM sets charges that way.' using errcode = '42501';
    end if;
    new.charges_hidden := private.charges_hidden_for(new.campaign_id, new.category, new.item_data);
    return new;
  end if;
  if (new.charges_left is distinct from old.charges_left
        and (new.charges_hidden or not coalesce(old.charges_left is null or new.charges_left = old.charges_left - 1, false)))
    or (new.charges_used <> old.charges_used and new.charges_used <> old.charges_used + 1)
    or new.charges_hidden is distinct from old.charges_hidden
    or new.spent_shown is distinct from old.spent_shown
    or (new.last_roll is distinct from old.last_roll and old.charges_left is not null) then
    raise exception 'Only the GM changes charges that way.' using errcode = '42501';
  end if;
  return new;
end;
$$;
