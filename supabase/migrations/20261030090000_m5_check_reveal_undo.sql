-- M5 step 6, fix forward: 20261029200000_m5_check_reveal.sql gave a secret result's lines reveal_at 'now' once the
-- result was revealed, so the GM's reveal line stayed with players after Undo (ruled: undo hides it again). Caught by
-- m5-reminders.test.ts.
--
-- What it changes, plainly. Replaces private.log_reveal_check_results: an open result's lines (secret false) show
-- now; a secret result's lines wait, and show while the result is revealed (private.check_result_revealed, already in
-- the read rule) or after the next Downtime. Lines already written keep theirs. Drops nothing; no rows change.

create or replace function private.log_reveal_check_results(old_row jsonb, new_row jsonb) returns text
language sql stable set search_path = '' as $$
  select case when not coalesce((coalesce(new_row, old_row) ->> 'secret')::boolean, true) then 'now' else 'downtime' end;
$$;
