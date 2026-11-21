-- M5 step 11 (fix): the access rules of places, group_places and gm_messages call private helpers as the reader, so
-- signed-in people need to be able to run them (20261031170000_m5_places_messages.sql revoked that by mistake). They
-- only answer yes or no about the reader. Grants only; nothing else changes.
grant execute on function private.in_my_group(uuid, integer) to authenticated;
grant execute on function private.place_shown_to_me(uuid) to authenticated;
grant execute on function private.message_for_me(uuid) to authenticated;
