-- M5 step 12, fix forward on 20261101090000_m5_requests.sql: public.ask_requests named its `kind` parameter where the
-- characters table has a `kind` column too, so Postgres refused the insert as ambiguous. The parameters are now
-- written out in full. Replaces public.ask_requests (newest copy: 20261101090000_m5_requests.sql). Drops nothing.

create or replace function public.ask_requests(campaign uuid, kind text, who text, prompt jsonb default '{}'::jsonb, body text default '')
returns setof public.requests
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('requests');
  trip uuid;
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
    order by a.created_at, a.id
    returning *;
  if not found then
    raise exception 'Nobody to ask: no character is in play.';
  end if;
end;
$$;
