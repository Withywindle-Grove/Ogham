-- M5 step 12, fix forward on 20261101090000_m5_requests.sql (applied to the test project before this was caught):
-- the rules trigger let the GM take back or enter a player's request, and refused the GM's own send with a plain
-- error. Now: only the requester (never the GM) withdraws or enters; a send that names someone else's character is
-- refused as not allowed (code 42501), so the app's can() and the database agree (src/testing/permissionCases.ts).
-- Replaces private.request_rules() (newest copy: 20261101090000_m5_requests.sql). Drops nothing; no rows are removed.

create or replace function private.request_rules() returns trigger
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
  -- From here: the requester's own changes (Cancel, Enter roll); the GM has no part in them.
  if as_gm then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
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
