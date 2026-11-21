-- M4b, character creation step 6: equip warnings (docs/05 "Gentle warnings", 07 "Rule hooks"; ruled 2026-10-21).
-- Drops nothing.
--   inventory.equipAnyway: putting an item on despite a warning, logged under its own name ("… despite a
--     warning"), so the override shows in the log. The change itself is the same as inventory.equip.
--   rule.skipped: "A rule couldn't be checked: <hook id>", for the GM only (07: a hook that can't run is skipped,
--     never guessed). Written by note_rule_skipped from a member's device; the same hook at most once a minute.

insert into public.logged_commands (name, level, gm_only) values ('inventory.equipAnyway', 'simple', false);

create function public.note_rule_skipped(campaign uuid, hook text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if hook is null or char_length(trim(hook)) not between 1 and 100 then
    raise exception 'Which rule?';
  end if;
  if exists (
    select 1 from public.events e
    where e.campaign_id = campaign and e.type = 'rule.skipped' and e.after ->> 'hook' = trim(hook)
      and e.created_at > clock_timestamp() - interval '1 minute'
  ) then
    return;
  end if;
  insert into public.events (campaign_id, type, level, actor_user_id, target_table, target_id, after, audience)
  values (campaign, 'rule.skipped', 'simple', (select auth.uid()), 'campaigns', campaign, jsonb_build_object('hook', trim(hook)), 'gm');
end;
$$;
revoke execute on function public.note_rule_skipped(uuid, text) from public, anon;
grant execute on function public.note_rule_skipped(uuid, text) to authenticated, service_role;
