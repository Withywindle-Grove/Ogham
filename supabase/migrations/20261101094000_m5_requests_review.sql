-- M5 step 12, review of #194 (fix forward on 20261101090000_m5_requests.sql and 20261101093000_m5_requests_ask.sql):
--   1. private.expedition_under_way ran as its definer with no membership check: it now runs as its caller, so the
--      expeditions access rules apply (a non-member reads nothing).
--   2. Leave the dungeon with `who: each` asked every approved, active player character in the campaign; now only
--      those who went on the expedition under way (its who_went snapshot). A character who stayed in town gets no
--      escape roll.
-- Replaces private.expedition_under_way (newest: 20261101090000) and public.ask_requests (newest: 20261101093000).
-- Drops nothing; no rows are removed.

create or replace function private.expedition_under_way(campaign uuid) returns uuid
language sql stable security invoker set search_path = '' as $$
  select x.id from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone limit 1;
$$;

create or replace function public.ask_requests(campaign uuid, kind text, who text, prompt jsonb default '{}'::jsonb, body text default '')
returns setof public.requests
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('requests');
  trip uuid;
  went uuid[];
  tag jsonb := private.request_tag();
begin
  if made is not null then
    return query select r.* from public.requests r
      where exists (
        select 1 from public.events e where e.target_table = 'requests' and e.target_id = r.id and e.before is null
          and e.request_id = (tag ->> 'requestId')::uuid and e.actor_user_id is not distinct from (select auth.uid())
      ) order by r.created_at, r.id;
    return;
  end if;
  if not private.is_gm(ask_requests.campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  trip := private.expedition_under_way(ask_requests.campaign);
  if trip is null then
    raise exception 'Start an expedition first.';
  end if;
  select x.who_went into went from public.expeditions x where x.id = trip;
  if ask_requests.who = 'party' then
    return query insert into public.requests (campaign_id, expedition_id, kind, direction, text, prompt)
      values (ask_requests.campaign, trip, ask_requests.kind, 'gmAsks', coalesce(ask_requests.body, ''), coalesce(ask_requests.prompt, '{}'::jsonb)) returning *;
    return;
  end if;
  if ask_requests.who <> 'each' then
    raise exception 'Ask each character, or the party.';
  end if;
  return query insert into public.requests (campaign_id, expedition_id, group_number, requester_id, actor_id, kind, direction, text, prompt)
    select ask_requests.campaign, trip,
      (select m.group_number from public.party_group_members m where m.campaign_id = ask_requests.campaign and m.actor_id = a.id limit 1),
      a.owner_user_id, a.id, ask_requests.kind, 'gmAsks', coalesce(ask_requests.body, ''), coalesce(ask_requests.prompt, '{}'::jsonb)
    from public.actors a
    where a.campaign_id = ask_requests.campaign and a.kind = 'pc' and a.approval = 'approved' and a.status = 'active'
      and a.owner_type = 'user' and a.owner_user_id is not null
      and a.id = any (coalesce(went, '{}'))
    order by a.created_at, a.id
    returning *;
  if not found then
    raise exception 'Nobody to ask: no character went on this expedition.';
  end if;
end;
$$;
