-- A request whose player's account was deleted stays hidden from the other players (#84's review, 2026-11-25:
-- hard rule 5, hidden means hidden). Fix forward of 20261124160000_account_deletion_keeps_rows.sql and
-- 20261125090000_account_deletion_keeps_asks_and_homebrew.sql (both applied on TEST), which let a request's
-- requester_id empty once that account is gone.
--   The party's request was read as "no requester and the GM asked" (20261101090000_m5_requests.sql). Once a deleted
--   player's requester empties, the GM's question to that one player (direction gmAsks, their character in actor_id)
--   looked the same, so every member could read it and enter its roll, and every line logged on a player's request
--   with no asker went to everyone. The party's request is now what its header says: asked of the whole party, it has
--   no requester and no character (`requester is null and direction = 'gmAsks' and actor is null`,
--   private.is_party_request). Every request the app asks of a player names their character (public.ask_requests,
--   newest definition 20261101094000_m5_requests_review.sql), and a character's deletion takes its requests with it
--   (actor_id `on delete cascade`), so a party's request is never mistaken for an orphaned one.
--   1. private.request_for_me (its only definition, 20261101090000_m5_requests.sql) takes the request's character too;
--      the read and update policies on public.requests use the new one, and the old three-argument one, which nothing
--      else calls, is dropped. An orphaned request is read and changed by the GM alone.
--   2. private.log_audience_requests (its only definition, 20261101090000_m5_requests.sql): a line is everyone's only
--      for the party's request; a request whose asker is gone is the GM's ('gm'), its asker's own while they stand.
-- Lines already logged keep the audience stored on them (public.events.audience); none is rewritten. Before this pull
-- request a requester could not be emptied (the deletion failed), so the only lines with the wrong audience are on
-- TEST, from test runs of 20261124160000 and 20261125090000.
-- Changes two functions and two policies, adds one, drops one function. Drops, renames and deletes no data.

create function private.is_party_request(requester uuid, direction text, actor uuid) returns boolean
language sql immutable set search_path = '' as $$
  select requester is null and direction = 'gmAsks' and actor is null;
$$;
revoke execute on function private.is_party_request(uuid, text, uuid) from public, anon;
grant execute on function private.is_party_request(uuid, text, uuid) to authenticated, service_role;

-- 1. Who reads a request: the GM; its requester; everyone in the campaign when it's the party's ---------------------

create function private.request_for_me(campaign uuid, requester uuid, direction text, actor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_gm(campaign)
    or (private.is_member(campaign) and (requester = (select auth.uid()) or private.is_party_request(requester, direction, actor)));
$$;
revoke execute on function private.request_for_me(uuid, uuid, text, uuid) from public, anon;
grant execute on function private.request_for_me(uuid, uuid, text, uuid) to authenticated, service_role;

drop policy "requests: the GM, the requester, and everyone for the party's" on public.requests;
create policy "requests: the GM, the requester, and everyone for the party's" on public.requests
  for select to authenticated using (private.request_for_me(campaign_id, requester_id, direction, actor_id));
drop policy "requests: the GM answers, the requester withdraws or enters" on public.requests;
create policy "requests: the GM answers, the requester withdraws or enters" on public.requests
  for update to authenticated
  using (private.request_for_me(campaign_id, requester_id, direction, actor_id))
  with check (private.request_for_me(campaign_id, requester_id, direction, actor_id));

drop function private.request_for_me(uuid, uuid, text);

-- 2. Who reads a request's lines: its requester (the GM reads every line); everyone for the party's; the GM alone
--    once the asker's account is gone ----------------------------------------------------------------------------

create or replace function private.log_audience_requests(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
begin
  owner := (this_row ->> 'requester_id')::uuid;
  who_sees := case
    when owner is not null then 'owner'
    when private.is_party_request(null, this_row ->> 'direction', (this_row ->> 'actor_id')::uuid) then 'all'
    else 'gm'
  end;
end;
$$;
revoke execute on function private.log_audience_requests(jsonb, jsonb) from public, anon, authenticated;
