-- M5b step g1, fix forward on 20261101140000_m5b_g1_status_gm_only.sql: its "only the GM inserts a status row" also
-- refused rows written with no signed-in user (the service role: test fixtures and maintenance), which no person can
-- be. Replaces private.status_rules (newest copy: 20261101140000_m5b_g1_status_gm_only.sql); the one line changed is
-- marked. A signed-in player is still refused; nothing is dropped, renamed or deleted; no rows change.

-- As in 20261101140000_m5b_g1_status_gm_only.sql, but the C1 refusal applies to a signed-in person only.
create or replace function private.status_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  as_gm boolean := private.is_gm(new.campaign_id);
  by_command boolean := nullif(current_setting('grimoire.status_command', true), '') is not null
    or nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'UPDATE' and (new.actor_id is distinct from old.actor_id or new.campaign_id is distinct from old.campaign_id) then
    raise exception 'That can''t be changed.';
  end if;
  -- The changed line: a signed-in person who isn't the GM (the service role has no user, and is never a player).
  if tg_op = 'INSERT' and not as_gm and (select auth.uid()) is not null and nullif(current_setting('grimoire.reverting', true), '') is null then
    raise exception 'Only the GM gives a status.' using errcode = '42501';
  end if;
  if not as_gm and (
    (new.secret and (tg_op = 'INSERT' or not old.secret))
    or (new.source = 'rest' and (tg_op = 'INSERT' or old.source <> 'rest'))
  ) then
    raise exception 'Only the GM can do that.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and not as_gm and not by_command and (
    new.undone is distinct from old.undone or new.ended_at is distinct from old.ended_at
    or new.end_reason is distinct from old.end_reason or new.ends_at is distinct from old.ends_at
    or new.total_seconds is distinct from old.total_seconds or new.secret is distinct from old.secret
    or new.name is distinct from old.name or new.stacks is distinct from old.stacks
  ) then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
