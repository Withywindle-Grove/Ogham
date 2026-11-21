-- M5 review fixes, item 4 follow-up: a player taking back what the GM asked (an escape roll) was refused with a
-- plain error; the app's can() refuses it as not allowed, so the database says the same (code 42501, as
-- src/testing/permissionCases.ts checks). Replaces private.request_rules (newest copy:
-- 20261101120000_m5_review_fixes.sql); the one line changed is marked. Drops nothing; no rows are removed.

-- As in 20261101120000_m5_review_fixes.sql, but a player's take-back of a GM ask is refused as not allowed.
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
  -- The GM takes back what the GM asked (an escape roll), while it waits.
  if as_gm and new.status = 'withdrawn' and old.direction = 'gmAsks' then
    if new.entry is distinct from old.entry then
      raise exception 'That can''t be changed.';
    end if;
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
      -- Changed: not allowed, as the app says.
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
