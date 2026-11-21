-- M5 step 11 (fix, 2): Where now? (public.set_group_place, which runs as the GM) looks up the group's current place
-- with private.current_group_place, so signed-in people need to be able to run it too (the private schema isn't
-- reachable from the app; only functions and access rules call it). Grants only.
grant execute on function private.current_group_place(uuid, integer) to authenticated;
