-- M5b, the full sheet revised, CI on #567 (fix forward on 20261108200000_m5b_sheet_changes.sql): a player's Undo of
-- their own ask (sheet.requestChange, in public.undoable_makings) failed with "You don't have permission to do that."
-- The log's undo runs as the person undoing (private.undo_body, security invoker): it locks the record it marks undone
-- (select … for update, private.undo_check_made) and then marks it, and both need the UPDATE right on the table, which
-- `authenticated` didn't have on sheet_changes (only SELECT; the three functions write as the database).
--   1. `authenticated` may update sheet_changes, under a policy that lets only the GM and the change's player touch a
--      row (the same people who read it), as for public.requests.
--   2. Nobody writes a row straight from the app: private.sheet_changes_by_functions refuses an insert or update made as
--      `authenticated` (a direct write through the API) unless it is an undo putting things back (grimoire.reverting).
--      The three functions run as the database (security definer), so their writes pass; private.sheet_change_rules
--      still checks what they change.
-- Grants one right and adds one policy, one function and one trigger. Drops, renames and deletes nothing.

grant update on public.sheet_changes to authenticated;

create policy "sheet changes: an undo by the GM or the change's player" on public.sheet_changes
  for update to authenticated
  using (private.is_gm(campaign_id) or (private.is_member(campaign_id) and requester_id = (select auth.uid())))
  with check (private.is_gm(campaign_id) or (private.is_member(campaign_id) and requester_id = (select auth.uid())));

-- Security invoker on purpose: current_user is the role making the write (`authenticated` for a direct write through
-- the API; the functions' owner inside request_sheet_change, take_back_sheet_change and answer_sheet_change).
create function private.sheet_changes_by_functions() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and nullif(current_setting('grimoire.reverting', true), '') is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger sheet_changes_by_functions before insert or update on public.sheet_changes
  for each row execute function private.sheet_changes_by_functions();
