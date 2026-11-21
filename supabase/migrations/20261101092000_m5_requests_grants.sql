-- M5 step 12, fix forward on 20261101090000_m5_requests.sql: let signed-in people run the two helper checks the
-- requests access rules and functions call (as 20261031171000_m5_places_grants.sql did for places). Without the
-- grants every read and write of a request was refused as "permission denied". Grants only; nothing else changes.

grant execute on function private.request_for_me(uuid, uuid, text) to authenticated, service_role;
grant execute on function private.expedition_under_way(uuid) to authenticated, service_role;
