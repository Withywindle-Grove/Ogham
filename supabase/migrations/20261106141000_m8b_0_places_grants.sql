-- M8b slice 0, fix forward on 20261106140000_m8b_0_places_from_packs.sql: private.group_goes_to_id is called by
-- public.travel_move, which runs as the caller (security invoker), so signed-in members need execute on it, as
-- private.group_goes_to got in 20261103111000_m5b_1_travel_grants.sql. The private schema isn't reachable through
-- the API, and travel_move checks who may. Grants only; nothing dropped, renamed, deleted or changed.

revoke execute on function private.group_goes_to_id(uuid, integer, uuid) from public, anon;
grant execute on function private.group_goes_to_id(uuid, integer, uuid) to authenticated, service_role;
