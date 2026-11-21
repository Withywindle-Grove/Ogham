-- M5b step 6e: buying, selling and lodging as player requests the GM answers (docs/plans/m5b-6-settlements.md
-- "Step 6e"; ruled 2026-10-30, ST5–ST8; dt-11 and st-3: only "Somewhere else…" needs the GM's yes). One request
-- system (M5 step 12's public.requests), no second one:
--   1. Two columns on public.requests: `reply` (accept · decline) and `replied_at`. Buying and selling are the
--      two-turn answer kinds 05 names (Hit / Miss then a choice; Offer → Accept / Decline): the GM answers with a price,
--      then the requester replies once (Buy it or Leave it; Accept or Decline). Undo of a reply puts it back.
--   2. private.request_rules (newest copy: 20261102202000_m5b_0c_no_ask_allow.sql), with three changes, marked:
--      a. a buy request's answer kind is hitMissChoice and a sell request's is offer, set by the database;
--      b. a listed lodging (kind lodging, prompt.listed true) is answered at once, with no GM: it must name a lodging
--         the GM shows, open, in the asker's group's town (places.town, which only the GM reads, so the check runs
--         here); "Somewhere else…" waits for the GM's Yes or No as any request;
--      c. the reply: the requester's alone, once, on an answered buy or sell whose answer carries a price; nothing else
--         changes with it.
--   3. public.reply_request (request.reply): the requester's reply. The app sends the item into or out of the pack in
--      the same request (inventory.add as bought, with the price as text; inventory.remove for a sale), so one Undo
--      puts both back: request.reply joins public.undoable_deletions.
--   4. logged_commands rows: request.reply (Simple, the player's) and town.stay (Simple, the player's: a listed
--      lodging picked, its cost in words); town.stay joins public.undoable_makings (Undo marks the pick undone).
-- Hidden means hidden: a request is read by the GM and its requester only (unchanged); the stay check reads the GM's
-- places row inside the rules function and returns nothing of it. Costs stay text until purses (M7b).
-- Adds two columns, one function, and rows of the app's command lists; replaces one function. Drops, renames and
-- deletes nothing.

-- 1. ---------------------------------------------------------------------------------------------------------------

alter table public.requests
  add column reply text check (reply is null or reply in ('accept', 'decline')),
  add column replied_at timestamptz;

comment on column public.requests.reply is
  'The requester''s reply to a priced answer (ST5 buy it or leave it, ST6 accept or decline the offer); null until then.';

-- 2. ---------------------------------------------------------------------------------------------------------------

-- As in 20261102202000_m5b_0c_no_ask_allow.sql, with the three changes marked (6e a, b, c).
create or replace function private.request_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
  as_gm boolean := private.is_gm(new.campaign_id);
  owner uuid;
  state text;
  offered jsonb;
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
    -- 6e (a): the two-turn kinds' answers (05 Requests).
    new.reply := null;
    new.replied_at := null;
    if new.kind = 'buy' then
      new.answer_kind := 'hitMissChoice';
    elsif new.kind = 'sell' then
      new.answer_kind := 'offer';
    end if;
    if new.expedition_id is not null and not exists (select 1 from public.expeditions x where x.id = new.expedition_id and x.campaign_id = new.campaign_id) then
      raise exception 'That expedition isn''t in this campaign.';
    end if;
    if new.actor_id is not null then
      select a.owner_user_id, a.approval || '/' || a.status into owner, state
      from public.actors a where a.id = new.actor_id and a.campaign_id = new.campaign_id and a.owner_type = 'user';
      if owner is null then
        raise exception 'That character isn''t in this campaign.';
      end if;
      if new.direction = 'playerAsks' and owner <> new.requester_id then
        raise exception 'You don''t have permission to do that.' using errcode = '42501';
      end if;
      if new.direction = 'playerAsks' and state <> 'approved/active' then
        raise exception 'Only a character in play can ask.';
      end if;
      if new.direction = 'gmAsks' and new.requester_id is distinct from owner then
        raise exception 'That character''s player is who the GM asks.';
      end if;
    elsif new.direction = 'playerAsks' then
      raise exception 'Pick which character asks.';
    end if;
    -- 6e (b): a lodging from the town's list needs no GM (dt-11, st-3), but only one the GM shows, open, where the
    -- asker's group is.
    if new.kind = 'lodging' and new.direction = 'playerAsks' and coalesce(new.prompt ->> 'listed', '') = 'true' then
      select p.town -> (new.prompt ->> 'key') into offered
      from private.town_visit(new.campaign_id, coalesce(new.group_number, 1)) v
      join public.places p on p.id = v.place_id and not p.undone and p.safety is not null;
      if offered is null or left(coalesce(new.prompt ->> 'key', ''), 8) <> 'lodging:'
        or (offered ->> 'shown') is distinct from 'true' or (offered ->> 'open') is distinct from 'true' then
        raise exception 'That lodging isn''t offered here.';
      end if;
      new.status := 'answered';
      new.answer := jsonb_build_object('kind', 'stay', 'listed', true);
      new.answered_at := now();
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
  -- 6e (c): the reply to a priced answer: the requester's alone, once; nothing else changes with it.
  if new.reply is distinct from old.reply or new.replied_at is distinct from old.replied_at then
    if old.requester_id is distinct from (select auth.uid()) or old.direction <> 'playerAsks' then
      raise exception 'You don''t have permission to do that.' using errcode = '42501';
    end if;
    if old.status <> 'answered' or old.answer_kind not in ('hitMissChoice', 'offer')
      or length(trim(coalesce(old.answer ->> 'price', ''))) = 0 then
      raise exception 'There''s nothing to answer yet.';
    end if;
    if old.reply is not null then
      raise exception 'You''ve answered it already.';
    end if;
    if new.reply is null or new.status is distinct from old.status or new.answer is distinct from old.answer
      or new.cost_text is distinct from old.cost_text or new.entry is distinct from old.entry
      or new.answered_by is distinct from old.answered_by or new.answered_at is distinct from old.answered_at then
      raise exception 'That can''t be changed.';
    end if;
    new.replied_at := now();
    return new;
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
  -- The GM takes back what the GM asked (an escape roll), while it waits.
  if as_gm and new.status = 'withdrawn' and old.direction = 'gmAsks' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    return new;
  end if;
  -- C7: the GM enters the roll for a player without a device, on what the GM asked, while it waits.
  if as_gm and new.status = 'waiting' and old.direction = 'gmAsks' then
    return new;
  end if;
  -- From here: the requester's own changes (Cancel, Enter roll); the GM has no part in them.
  if as_gm then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if new.status = 'withdrawn' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
    if old.direction <> 'playerAsks' then
      raise exception 'Only the GM takes back what the GM asked.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status = 'waiting' then
    return new;
  end if;
  raise exception 'That can''t be changed.';
end;
$$;

-- 3. ---------------------------------------------------------------------------------------------------------------

-- The requester's reply (request.reply): Buy it / Leave it on a priced buy answer, Accept / Decline on an offer.
-- A repeat changes nothing.
create function public.reply_request(request uuid, accept boolean, seen_version integer default null)
returns public.requests
language plpgsql security invoker set search_path = '' as $$
declare
  found public.requests;
begin
  select * into found from public.requests r where r.id = request;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.reply is not null and private.repeated_request('requests', found.id) then
    return found;
  end if;
  if accept is null then
    raise exception 'Say yes or no.';
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  update public.requests r set reply = case when accept then 'accept' else 'decline' end
  where r.id = request returning * into found;
  return found;
end;
$$;
revoke execute on function public.reply_request(uuid, boolean, integer) from public, anon;
grant execute on function public.reply_request(uuid, boolean, integer) to authenticated, service_role;

-- 4. ---------------------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('request.reply', 'simple', false),
  ('town.stay', 'simple', false);
-- A listed lodging picked makes a request row: Undo marks it undone.
insert into public.undoable_makings (name) values ('town.stay');
-- A sale accepted takes the item out of the pack in the same request: Undo puts it back.
insert into public.undoable_deletions (name) values ('request.reply');
