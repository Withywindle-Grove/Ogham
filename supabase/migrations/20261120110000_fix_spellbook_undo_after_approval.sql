-- fix-spellbook-undo-after-approval: an Undo can't lower a spell book once approved (the same flaw fixed for expertise
-- in 20261120100000_g208_expertise.sql). Replaces one function; adds, drops, renames and deletes nothing, and changes no
-- read rule.
-- Built from the newest (and only) definition of private.guard_spell_book, 20261102200000_m5b_0c_creation_data.sql,
-- with one line removed: it let every Undo (grimoire.reverting) through, so once the GM had approved a character its
-- owner could undo a spell book change from before the approval and lower or empty a book only the GM may change now.
-- The rule itself is unchanged (cr-13; docs/04 PC extras): the GM always; the owner while the character isn't
-- approved, or while its creation record still lists "spells" to finish (Decide later on First spells). An Undo is
-- now held to that same rule, like any other change: the owner's Undo of their own change goes through while the
-- owner may still change the book (before approval, or with First spells still to finish); after that only the GM's.
-- Unlike expertise (add-only after approval, so the Undo of a point added after approval had to pass, ex-5), the
-- owner has no after-approval right here outside the To finish window, so no look at the log is needed.
-- The trigger guard_spell_book (before update of spell_book on public.actors) calls this function and stays as made.
create or replace function private.guard_spell_book() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.spell_book is not distinct from old.spell_book then
    return new;
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(new.spell_book) as spell
    where length(spell) not between 1 and 80
  ) or (
    select count(*) from jsonb_array_elements_text(new.spell_book)
  ) <> (
    select count(distinct spell) from jsonb_array_elements_text(new.spell_book) as spell
  ) then
    raise exception 'Each spell goes in the book once.' using errcode = '23514';
  end if;
  if (select auth.uid()) is null
    or private.is_gm(old.campaign_id)
    or old.approval <> 'approved'
    or (jsonb_typeof(old.creation -> 'toFinish') = 'array' and old.creation -> 'toFinish' ? 'spells') then
    return new;
  end if;
  raise exception 'Only the GM can change the spell book once the character is approved.' using errcode = '42501';
end;
$$;
