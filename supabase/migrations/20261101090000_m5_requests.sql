-- M5 step 12: Requests (docs/05 "Requests", "Something else…", "Leave the dungeon"; docs/03 the Requests and Escape
-- rolls rows; ruled 2026-10-31 Q6 and Q3, 2026-10-30 DG17 and DG18, and Francis's answer of 2026-11-01 (⚑1: in M5 a
-- Describe… answer is a cost in turns and a note only).
--   One `requests` row for every "a player asks, the GM answers" flow: who asks (the requester: the member whose
--   request it is, and their character), what (text, and the cost as text), a kind, a direction (the player asks, or
--   the GM asks: an escape roll), a status (waiting · answered · withdrawn), the answer kind and the answer. The GM's
--   prompt (an escape roll's save, switches and depth) sits in `prompt`; the player's entry (their roll and the switches
--   on) in `entry`. A row asked of the whole party (`who: party`) has no requester and no character: every member reads
--   it and may enter its roll.
--   Hidden means hidden: a request is read by the GM and its requester (and by every member when it's the party's);
--   no other player reads it. The GM's preview of an outcome lives on the GM's device until Send: nothing reaches a
--   player's device before the answer is written. The log lines are the requester's own (or everyone's for the
--   party's row), so the answer reaches their log; the GM reads every line.
--   Answering (request.answer) may move the clock (a Describe… answered Yes with a cost in turns): one advance in the
--   same request, so Undo of the answer puts both back (and, like a time move, any light the advance burnt out:
--   public.undoable_deletions). Sending and asking make rows: Undo marks them undone (public.undoable_makings).
-- Adds a table, its rules, policies, functions and rows. Replaces nothing. Drops nothing; no rows are removed.

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  -- The expedition under way when it was made (null between expeditions).
  expedition_id uuid references public.expeditions (id) on delete set null,
  group_number integer,
  -- Whose request it is: the player who asks, or the player the GM asks. Null: asked of the whole party.
  requester_id uuid references public.profiles (id) on delete set null,
  actor_id uuid references public.actors (id) on delete cascade,
  kind text not null check (kind in ('describe', 'escapeRoll', 'secretActivity', 'buy', 'sell', 'lodging', 'askGm')),
  direction text not null check (direction in ('playerAsks', 'gmAsks')),
  text text not null default '' check (length(text) <= 2000),
  cost_text text not null default '' check (length(cost_text) <= 200),
  -- What's asked for, in the asker's terms (an escape roll: the roll, its switches, the depth worked out).
  prompt jsonb not null default '{}'::jsonb,
  -- The player's entry while it waits (an escape roll: their roll and the switches on).
  entry jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'answered', 'withdrawn')),
  answer_kind text not null default 'yesNo' check (answer_kind in ('yesNo', 'hitMissChoice', 'offer')),
  answer jsonb,
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'answered') = (answer is not null)),
  check (direction = 'gmAsks' or requester_id is not null)
);
create index requests_campaign on public.requests (campaign_id, created_at desc) where not undone;
create index requests_requester on public.requests (requester_id, campaign_id) where not undone;

-- May the reader read this request: the GM; its requester; everyone in the campaign when it's the party's.
create function private.request_for_me(campaign uuid, requester uuid, direction text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_gm(campaign)
    or (private.is_member(campaign) and (requester = (select auth.uid()) or (requester is null and direction = 'gmAsks')));
$$;
revoke execute on function private.request_for_me(uuid, uuid, text) from public, anon, authenticated;

alter table public.requests enable row level security;
grant select, insert, update on public.requests to authenticated;
grant select, insert, update, delete on public.requests to service_role;

create policy "requests: the GM, the requester, and everyone for the party's" on public.requests
  for select to authenticated using (private.request_for_me(campaign_id, requester_id, direction));
create policy "requests: a player sends their own, the GM asks" on public.requests
  for insert to authenticated with check (
    (direction = 'gmAsks' and private.is_gm(campaign_id))
    or (direction = 'playerAsks' and requester_id = (select auth.uid()) and private.is_member(campaign_id))
  );
create policy "requests: the GM answers, the requester withdraws or enters" on public.requests
  for update to authenticated
  using (private.request_for_me(campaign_id, requester_id, direction))
  with check (private.request_for_me(campaign_id, requester_id, direction));

-- A request: a player's names their own approved, active character (the GM's names any character of the campaign,
-- or none for the party). A change: the GM answers it (waiting → answered, with the answer; the cost's words may
-- change with it); its requester withdraws it (waiting → withdrawn) or enters their part (entry, while waiting);
-- undo's mark. Undo puts any of it back (grimoire.reverting is set).
create function private.request_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  as_gm boolean := private.is_gm(new.campaign_id);
  owner uuid;
  state text;
begin
  if tg_op = 'INSERT' then
    new.text := trim(coalesce(new.text, ''));
    new.cost_text := trim(coalesce(new.cost_text, ''));
    new.status := 'waiting';
    new.answer := null;
    new.answered_by := null;
    new.answered_at := null;
    new.undone := false;
    new.created_by := (select auth.uid());
    if new.expedition_id is not null and not exists (select 1 from public.expeditions x where x.id = new.expedition_id and x.campaign_id = new.campaign_id) then
      raise exception 'That expedition isn''t in this campaign.';
    end if;
    if new.actor_id is not null then
      select a.owner_user_id, a.approval || '/' || a.status into owner, state
      from public.actors a where a.id = new.actor_id and a.campaign_id = new.campaign_id and a.owner_type = 'user';
      if owner is null then
        raise exception 'That character isn''t in this campaign.';
      end if;
      if new.direction = 'playerAsks' and (owner <> new.requester_id or state <> 'approved/active') then
        raise exception 'Only a character in play can ask.';
      end if;
      if new.direction = 'gmAsks' and new.requester_id is distinct from owner then
        raise exception 'That character''s player is who the GM asks.';
      end if;
    elsif new.direction = 'playerAsks' then
      raise exception 'Pick which character asks.';
    end if;
    return new;
  end if;
  if old.undone and not reverting then
    raise exception 'That request was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.expedition_id is distinct from old.expedition_id
    or new.group_number is distinct from old.group_number or new.requester_id is distinct from old.requester_id
    or new.actor_id is distinct from old.actor_id or new.kind is distinct from old.kind or new.direction is distinct from old.direction
    or new.text is distinct from old.text or new.prompt is distinct from old.prompt or new.answer_kind is distinct from old.answer_kind
    or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  if reverting then
    return new;
  end if;
  if new.undone <> old.undone then
    raise exception 'That can''t be changed.';
  end if;
  if old.status <> 'waiting' then
    raise exception 'That request was already %.', old.status;
  end if;
  if as_gm and new.status = 'answered' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    new.answered_by := (select auth.uid());
    new.answered_at := now();
    new.cost_text := trim(coalesce(new.cost_text, ''));
    return new;
  end if;
  if new.cost_text is distinct from old.cost_text or new.answer is distinct from old.answer
    or new.answered_by is distinct from old.answered_by or new.answered_at is distinct from old.answered_at then
    raise exception 'Only the GM answers.';
  end if;
  if new.status = 'withdrawn' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    if old.direction <> 'playerAsks' then
      raise exception 'Only the GM takes back what the GM asked.';
    end if;
    return new;
  end if;
  if new.status = 'waiting' then
    return new;
  end if;
  raise exception 'That can''t be changed.';
end;
$$;
revoke execute on function private.request_rules() from public, anon, authenticated;

create trigger check_copy_version before insert or update on public.requests
  for each row execute function private.check_copy_version();
create trigger request_rules before insert or update on public.requests
  for each row execute function private.request_rules();
create trigger refuse_when_retired before insert or update or delete on public.requests
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.requests
  for each row execute function private.log_change();

-- A request's lines are its requester's own (the GM reads every line); the party's are everyone's.
create function private.log_audience_requests(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
begin
  owner := (this_row ->> 'requester_id')::uuid;
  who_sees := case when owner is null then 'all' else 'owner' end;
end;
$$;
revoke execute on function private.log_audience_requests(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('requests');

-- The expedition under way in a campaign, or null.
create function private.expedition_under_way(campaign uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select x.id from public.expeditions x where x.campaign_id = campaign and x.ended_at is null and not x.undone limit 1;
$$;
revoke execute on function private.expedition_under_way(uuid) from public, anon, authenticated;

-- Send to the GM (request.send): a player asks for one of their characters. A repeat changes nothing.
create function public.send_request(campaign uuid, actor uuid, kind text, body text, cost_text text default '', prompt jsonb default '{}'::jsonb)
returns public.requests
language plpgsql security invoker set search_path = '' as $$
declare
  made uuid := private.made_by_request('requests');
  request public.requests;
begin
  if made is not null then
    select * into request from public.requests r where r.id = made;
    return request;
  end if;
  if not private.is_member(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if body is null or length(trim(body)) = 0 then
    raise exception 'Write what you want to do.';
  end if;
  if length(trim(body)) > 2000 then
    raise exception 'A request is at most 2000 characters.';
  end if;
  insert into public.requests (campaign_id, expedition_id, group_number, requester_id, actor_id, kind, direction, text, cost_text, prompt)
  values (
    campaign, private.expedition_under_way(campaign),
    (select m.group_number from public.party_group_members m where m.campaign_id = campaign and m.actor_id = actor limit 1),
    (select auth.uid()), actor, kind, 'playerAsks', body, coalesce(cost_text, ''), coalesce(prompt, '{}'::jsonb))
  returning * into request;
  return request;
end;
$$;
revoke execute on function public.send_request(uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.send_request(uuid, uuid, text, text, text, jsonb) to authenticated, service_role;

-- Leave the dungeon (request.ask): the GM asks each player character in play (`who` = 'each': one row per character,
-- its player the requester) or the party as one (`who` = 'party': one row, no requester). During an expedition. A
-- repeat changes nothing.
create function public.ask_requests(campaign uuid, kind text, who text, prompt jsonb default '{}'::jsonb, body text default '')
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
  if not private.is_gm(campaign) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  trip := private.expedition_under_way(campaign);
  if trip is null then
    raise exception 'Start an expedition first.';
  end if;
  if who = 'party' then
    return query insert into public.requests (campaign_id, expedition_id, kind, direction, text, prompt)
      values (campaign, trip, kind, 'gmAsks', coalesce(body, ''), coalesce(prompt, '{}'::jsonb)) returning *;
    return;
  end if;
  if who <> 'each' then
    raise exception 'Ask each character, or the party.';
  end if;
  return query insert into public.requests (campaign_id, expedition_id, group_number, requester_id, actor_id, kind, direction, text, prompt)
    select campaign, trip, (select m.group_number from public.party_group_members m where m.campaign_id = campaign and m.actor_id = a.id limit 1),
      a.owner_user_id, a.id, kind, 'gmAsks', coalesce(body, ''), coalesce(prompt, '{}'::jsonb)
    from public.actors a
    where a.campaign_id = campaign and a.kind = 'pc' and a.approval = 'approved' and a.status = 'active'
      and a.owner_type = 'user' and a.owner_user_id is not null
    order by a.created_at, a.id
    returning *;
  if not found then
    raise exception 'Nobody to ask: no character is in play.';
  end if;
end;
$$;
revoke execute on function public.ask_requests(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.ask_requests(uuid, text, text, jsonb, text) to authenticated, service_role;

-- Cancel (request.withdraw): the requester takes it back while it waits. A repeat changes nothing.
create function public.withdraw_request(request uuid, seen_version integer default null) returns public.requests
language plpgsql security invoker set search_path = '' as $$
declare
  found public.requests;
begin
  select * into found from public.requests r where r.id = request;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.status = 'withdrawn' then
    return found;
  end if;
  if found.status <> 'waiting' then
    raise exception 'The GM has answered it already.';
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  update public.requests r set status = 'withdrawn' where r.id = request returning * into found;
  return found;
end;
$$;
revoke execute on function public.withdraw_request(uuid, integer) from public, anon;
grant execute on function public.withdraw_request(uuid, integer) to authenticated, service_role;

-- Enter roll (request.enter): the player's part of what the GM asked, while it waits (the roll and the switches on).
create function public.enter_request(request uuid, entry jsonb, seen_version integer default null) returns public.requests
language plpgsql security invoker set search_path = '' as $$
declare
  found public.requests;
begin
  select * into found from public.requests r where r.id = request;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.status <> 'waiting' then
    raise exception 'That request was already %.', found.status;
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  update public.requests r set entry = enter_request.entry where r.id = request returning * into found;
  return found;
end;
$$;
revoke execute on function public.enter_request(uuid, jsonb, integer) from public, anon;
grant execute on function public.enter_request(uuid, jsonb, integer) to authenticated, service_role;

-- The GM's answer (request.answer; Send for an escape roll): the answer, the cost's words, and with `cost_seconds` the
-- clock moves on by that much in the same request (a Describe… answered Yes with a cost in turns), so Undo puts both
-- back. The GM. A repeat changes nothing.
create function public.answer_request(request uuid, answer jsonb, cost_text text default null, cost_seconds bigint default null, seen_version integer default null)
returns public.requests
language plpgsql security invoker set search_path = '' as $$
declare
  found public.requests;
begin
  select * into found from public.requests r where r.id = request;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.status = 'answered' and private.repeated_request('requests', found.id) then
    return found;
  end if;
  if found.status <> 'waiting' then
    raise exception 'That request was already %.', found.status;
  end if;
  if answer is null then
    raise exception 'Give an answer.';
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  update public.requests r
  set status = 'answered', answer = answer_request.answer, cost_text = coalesce(answer_request.cost_text, r.cost_text)
  where r.id = request returning * into found;
  if cost_seconds is not null and cost_seconds > 0 then
    perform public.advance_clock(found.campaign_id, cost_seconds, null);
  end if;
  return found;
end;
$$;
revoke execute on function public.answer_request(uuid, jsonb, text, bigint, integer) from public, anon;
grant execute on function public.answer_request(uuid, jsonb, text, bigint, integer) to authenticated, service_role;

-- Logged-command rows and undo ------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('request.send', 'simple', false),
  ('request.withdraw', 'simple', false),
  ('request.enter', 'verbose', false),
  ('request.answer', 'simple', true),
  ('request.ask', 'simple', true);
-- Sending and asking make rows: Undo marks them undone.
insert into public.undoable_makings (name) values ('request.send'), ('request.ask');
-- An answer may move the clock, which may burn a light out: Undo brings it back, as for a time move.
insert into public.undoable_deletions (name) values ('request.answer');
