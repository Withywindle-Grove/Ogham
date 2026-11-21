-- M4b step 1e: empty a container in one step (ruled 2026-10-24; docs/05 "Empty…"). Adds a logged command.
-- Drops nothing. What's inside moves (or is dropped) in one change, under the usual access rules for each line.
insert into public.logged_commands (name, level, gm_only) values
  ('inventory.empty', 'simple', false);
