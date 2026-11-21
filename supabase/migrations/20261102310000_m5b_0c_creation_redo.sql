-- M5b step 0c, follow-up C (ruled 2026-11-02, cf-7: design/rulings/m5b-0c-creation-followups-2026-11-02.md).
-- creation.redo: Change › on Scores, Race or Class after the draft exists. The command rewrites the draft's class,
-- race, scores and creation record and, on a race or class change, deletes the kit, shop and trait gear's lines
-- (the money refunded on the record) in the same request, so the log's Undo puts the row and the lines back at once.
--   1. Its row in the app's command list (public.logged_commands; supabase/tests/m3-health.test.ts matches the lists).
--   2. Its name among the deletions Undo can put back (public.undoable_deletions; src/core/undo.ts keeps the same
--      list and supabase/tests/m4b-undo-drop.test.ts matches them): the lines it deletes are a draft's starting gear,
--      kept in full by the log like a drop (ruled 2026-10-25).
-- No new table, column, policy or trigger: the actor guard already lets an owner change these columns before
-- approval, and the spell-book and weapon-skills guards let the owner clear them while the character isn't approved.
-- Drops, renames and deletes no data.

insert into public.logged_commands (name, level, gm_only) values ('creation.redo', 'simple', false);

insert into public.undoable_deletions (name) values ('creation.redo');
