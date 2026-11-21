-- M5b step 6.0, the town switches (docs/plans/m5b-6-settlements.md; ruled 2026-11-03, sw-1 … sw-4,
-- docs/design/rulings/m5b-settlement-switches-2026-11-03.md; 05 Settlements, ST4). Out and about today and Active
-- tonight are kept with the campaign; a check with onlyWhen "outDay" / "activeNight" comes due only while its switch is
-- on (the app reads them; nothing here runs a check).
--   1. campaigns.out_day and campaigns.active_night (both off by default). Who reads and writes them: the campaign's
--      own rules, unchanged ("campaigns: members read", "campaigns: GM edits"): every member reads them (players see
--      their state, sw-4), only the GM changes them (sw-1).
--   2. Start downtime turns both off (sw-3): a campaign going into Downtime (today End expedition does it,
--      public.end_expedition) has them switched off in the same change, so that change's log line and its Undo carry
--      the reset too. The morning's reset is the app's own command (town.reset).
--   3. The three commands' logged_commands rows, all the GM's, in the Simple log.
-- Adds two columns (with defaults), one trigger function and its trigger, and three logged_commands rows. Replaces no
-- function. Drops no data; no rows are removed, renamed or changed (every campaign starts with both switches off).

-- 1. The two switches ------------------------------------------------------------------------------------------------

alter table public.campaigns
  add column out_day boolean not null default false,
  add column active_night boolean not null default false;

comment on column public.campaigns.out_day is 'Out and about today (sw-1): the GM''s town switch; checks with onlyWhen "outDay" run only while it is on.';
comment on column public.campaigns.active_night is 'Active tonight (sw-1): the GM''s town switch; checks with onlyWhen "activeNight" run only while it is on.';

-- 2. Start downtime turns them off -------------------------------------------------------------------------------------

create function private.town_switches_off_in_downtime() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.mode = 'downtime' and old.mode is distinct from 'downtime' then
    new.out_day := false;
    new.active_night := false;
  end if;
  return new;
end;
$$;
revoke execute on function private.town_switches_off_in_downtime() from public, anon, authenticated;

create trigger town_switches_off_in_downtime before update of mode on public.campaigns
  for each row execute function private.town_switches_off_in_downtime();

-- 3. The commands ----------------------------------------------------------------------------------------------------

-- town.outDay and town.activeNight flip one switch (on or off); town.reset turns both off at the next morning.
insert into public.logged_commands (name, level, gm_only) values
  ('town.outDay', 'simple', true),
  ('town.activeNight', 'simple', true),
  ('town.reset', 'simple', true);
