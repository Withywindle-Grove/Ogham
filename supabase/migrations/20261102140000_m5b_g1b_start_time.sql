-- M5b step g1b: the first day's start time (M5 gate B13; g1's scope check, ruled 2026-11-01, option A).
--   The GM sets the start time in Rules for this campaign (default 06:00). While the clock hasn't moved (Day 1, no
--   expedition, no advances) the setting puts the clock at that time; the app sends it as one command,
--   `time.start`: the campaign's settings and, through public.set_clock, the clock. Once the clock has moved, the
--   start time only shows, and the time changes with Advance by… → To a time (`time.set`). No display offset.
--
-- What it changes, plainly. Adds two rows: `time.start` to the logged commands (Simple, the GM's), and to the
-- undoable deletions (like every move of the clock, a light used up as it moves comes back with its Undo). No
-- function or table changes; drops nothing; no rows are removed.

insert into public.logged_commands (name, level, gm_only) values ('time.start', 'simple', true);

insert into public.undoable_deletions (name) values ('time.start');
