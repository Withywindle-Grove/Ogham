-- M5b step 4, follow-up: a forced march's rest falls due in camp's Sleep step (ruled 2026-11-03 by Francis, SC-4-3 A;
-- docs/plans/m5b-4-camp.md, Departures; docs/05 "Force march"). Until now force_march opened the group's shared rest
-- flow at once (a called rest, m5b-1's workaround). Now it only adds the points and pays what's owed: the app opens the
-- group's rest flow when the group is in camp that evening (today's travel row counts a forced march and the group's
-- camp for that day is open), and camp's Sleep step and the rest prompt say "Rest due (forced march)". Next day applies
-- the answers as before (advance_clock's `rest`, unchanged). Undoing the march takes the forced count back, so the
-- flow closes again.
-- Replaces one function, public.force_march, from its newest (and only) definition, 20261103110000_m5b_1_travel.sql,
-- without the rest call; its grants stay (create or replace). Drops nothing; no rows are removed, renamed or changed.

-- Force march (travel.forceMarch, D4): the players' choice, applied at once. `added` is what the pack gives (the
-- device works it out: factor or add, stacked as the pack says; 0 when it stacks once and today has one). It pays
-- what's owed first (the group may arrive now). Rest is due that evening, in camp's Sleep step (the app reads the
-- forced count). Any member of the group, or the GM. Runs as the database: a player can't write the row themselves.
create or replace function public.force_march(campaign uuid, group_no integer, added integer, seen_version integer default null)
returns public.travel_groups
language plpgsql security definer set search_path = '' as $$
declare
  done uuid[] := private.request_targets('travel_groups');
  row_now public.travel_groups;
begin
  if cardinality(done) > 0 then
    select * into row_now from public.travel_groups t where t.id = done[1];
    return row_now;
  end if;
  if not (private.is_gm(campaign) or private.in_my_group(campaign, group_no)) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if added is null or added < 0 or added > 100000 then
    raise exception 'A whole number of points, 0 or more, is needed.';
  end if;
  row_now := private.travel_row(campaign, group_no);
  update public.travel_groups t
  set total = t.total + added, forced = t.forced + 1, version = coalesce(seen_version, t.version)
  where t.id = row_now.id returning * into row_now;
  row_now := private.pay_owed(row_now, added);
  return row_now;
end;
$$;
