-- M4b step 1c: charges after the M4 gate run (rulings 2026-10-24; docs/05, 07 "Charges"). Adds a trigger and a
-- logged command. Drops nothing.
--   Hidden charges are discovered in play: using the last charge looks normal; using the item again with none left
--   tells the holder ("Nothing happens…") by setting spent_shown in the same change, and the log says so.
--   The GM's Reveal shows the count to whoever holds it from then on, like visible charges (inventory.revealCharges:
--   the line's charges become visible, with what's left).
-- The trigger runs after guard_charges (by name; see 20261024230000_m4_review_fixes.sql), so the player's change is
-- checked first and only then marked.

create function private.note_fizzle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.charges_hidden and not new.spent_shown and new.charges_used > old.charges_used
    and exists (select 1 from public.inventory_line_secrets s where s.id = new.id and s.spent) then
    new.spent_shown := true;
  end if;
  return new;
end;
$$;
create trigger note_fizzle before update on public.inventory_lines
  for each row execute function private.note_fizzle();

insert into public.logged_commands (name, level, gm_only) values
  ('inventory.revealCharges', 'simple', true);
