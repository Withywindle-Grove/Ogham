-- M5b, the full sheet revised, CI on #567 (fix forward on 20261108210000_m5b_sheet_changes_guard.sql, already on the
-- test project): private.guard_rules_figures runs as the person updating a character (security invoker, like
-- private.guard_class_race), and it calls private.score_keys, whose execute was revoked from `authenticated`. So any
-- player's update of an approved character's fields failed with "permission denied for function score_keys", not only
-- a change to a score. score_keys gives back only the names of the pack's scores (the rules set's own words, which
-- every member reads in the setting anyway), so members may run it, as private.alignment_visible_to_all.
-- Grants one function. Drops, renames and deletes nothing; no rows change.

grant execute on function private.score_keys(uuid) to authenticated, service_role;
