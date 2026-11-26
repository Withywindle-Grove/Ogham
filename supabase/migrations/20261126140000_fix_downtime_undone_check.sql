-- Going into Downtime with an undone secret check result (fix-downtime-undone-check). Fix forward of
-- 20261029180000_m5_reminders.sql.
--   private.reveal_check_results (its only definition, 20261029180000_m5_reminders.sql) revealed every unrevealed
--   result of the campaign, undone ones included; but private.check_result_rules (newest in
--   20261029200000_m5_check_reveal.sql) refuses any change to an undone result, so one secret result the GM had
--   undone made the move into Downtime fail with "That result was undone."
--   Now an undone result is left as it is (unrevealed, as the GM's reveal by hand already leaves it,
--   public.reveal_check). Everything else is as before: security definer, the empty search path, the
--   grimoire.revealing setting, the trigger and the revoke. Nothing is dropped, renamed or deleted.
create or replace function private.reveal_check_results() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('grimoire.revealing', 'on', true);
  update public.check_results r set revealed = true where r.campaign_id = new.id and not r.revealed and not r.undone;
  perform set_config('grimoire.revealing', '', true);
  return null;
end;
$$;
revoke execute on function private.reveal_check_results() from public, anon, authenticated;
