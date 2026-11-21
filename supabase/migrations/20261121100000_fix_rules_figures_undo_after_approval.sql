-- fix-rules-figures-undo-after-approval: an Undo can't change Max HP or a score once approved (the same flaw fixed for
-- expertise in 20261120100000_g208_expertise.sql and for the spell book in fix-spellbook-undo-after-approval).
-- Replaces one function; adds, drops, renames and deletes nothing, and changes no read rule.
-- Built from the newest (and only) definition of private.guard_rules_figures, 20261108210000_m5b_sheet_changes_guard.sql,
-- with one line removed: it let every Undo (grimoire.reverting) through, and no older guard on hp_max or the pack's
-- scores stands behind it (unlike class and race, whose first guard, private.guard_race_and_classes, has no such
-- opening). So once the GM had approved a character, its owner could undo a Max HP or a score set while it waited, and
-- clear or change a figure a player may no longer write onto an approved character (that migration's header, point 2:
-- Max HP from none too; ruling 3, Set max waits for the GM).
-- The rule itself is unchanged: the database itself (no auth.uid()), the GM, or a character not yet approved; anyone
-- else changing hp_max or a score key is refused (42501). An Undo is now held to that same rule, like any other change:
-- the owner's Undo of their own change goes through while the character waits; after approval only the GM's. The
-- owner has no after-approval right to these figures (a change goes through public.request_sheet_change, answered by
-- the GM, whose answer runs as the GM), so no look at the log is needed.
-- The trigger guard_rules_figures (before update of hp_max, fields on public.actors) calls this function and stays as
-- made; private.score_keys keeps the execute right granted in 20261108220000_m5b_score_keys_grant.sql.
create or replace function private.guard_rules_figures() returns trigger
language plpgsql set search_path = '' as $$
declare
  scores text[];
  key text;
begin
  if (select auth.uid()) is null
    or private.is_gm(old.campaign_id)
    or old.approval <> 'approved' then
    return new;
  end if;
  if new.hp_max is distinct from old.hp_max then
    raise exception 'Your GM approves a change to Max HP: send it from Edit.' using errcode = '42501';
  end if;
  if new.fields is not distinct from old.fields then
    return new;
  end if;
  scores := private.score_keys(old.campaign_id);
  foreach key in array scores loop
    if (coalesce(new.fields, '{}'::jsonb) -> key) is distinct from (coalesce(old.fields, '{}'::jsonb) -> key) then
      raise exception 'Your GM approves a change to a score: send it from Edit.' using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function private.guard_rules_figures() from public, anon, authenticated;
