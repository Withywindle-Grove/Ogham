-- M5b step 1, fix forward on 20261103110000_m5b_1_travel.sql: the helpers its public functions call run as the caller
-- (travel_move, set_lost… are security invoker), so they need execute for signed-in members, as private.settle_encounter
-- has (20261103100000). The private schema isn't reachable through the API, and each public caller checks who may.
-- getting_lost_open is read by group_lost's read rule, so it needs the same. Grants only; nothing dropped, renamed,
-- deleted or changed.

do $$
declare
  f text;
begin
  foreach f in array array[
    'private.travel_row(uuid, integer)',
    'private.pay_owed(public.travel_groups, integer)',
    'private.group_goes_to(uuid, integer, text)',
    'private.getting_lost_open(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;
