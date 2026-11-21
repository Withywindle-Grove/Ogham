-- The GM's time-left stepper (plan m5b-creation-retest-3 F, R3-6; Francis's ruling on #560, 2026-11-08: a follow-up
-- pull request with its migration). In the status sheet the GM steps a timed status's time left up or down; each step
-- is its own command, status.setTime, acting at once with Undo (logged; Undo puts the time back).
--   1. public.set_status_time(status, seconds_left, seen_version): the status's time left from the clock's now. The
--      GM's only (security definer, checking the caller is the campaign's GM; a player or an outsider is refused).
--      A secret timer is set in status_secrets, so the time never reaches a player's device; any other timer on the
--      status itself. Its whole length grows with it when the time left goes past it, so the ring stays full rather
--      than reading "8 of 6". At least 1 second left: ending it is End it now (remove_status). Refused for a status
--      with no timer, one that has ended, and from an old copy (seen_version); a repeat changes nothing.
--   2. Its logged_commands row: status.setTime, Simple, the GM's only. Undo needs nothing new: private.undo_body puts
--      back changed values on character_statuses and status_secrets, both undoable tables already.
-- Adds one function and one row. Replaces no function. Drops, renames and deletes no data.

create function public.set_status_time(status uuid, seconds_left bigint, seen_version integer default null) returns public.character_statuses
language plpgsql security definer set search_path = '' as $$
declare
  st public.character_statuses;
  now_at bigint;
  changed integer;
begin
  select * into st from public.character_statuses s where s.id = status;
  if st.id is null or not private.is_gm(st.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if private.repeated_request('character_statuses', st.id) or private.repeated_request('status_secrets', st.id) then
    return st;
  end if;
  if st.undone or st.ended_at is not null then
    raise exception 'That status has already ended.';
  end if;
  if seconds_left is null or seconds_left < 1 then
    raise exception 'It needs some time left. To end it, use End it now.';
  end if;
  if seen_version is not null and seen_version <> st.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  now_at := private.clock_now(st.campaign_id);
  perform set_config('grimoire.status_command', 'on', true);
  if st.secret then
    update public.status_secrets x
    set ends_at = now_at + seconds_left, total_seconds = greatest(x.total_seconds, seconds_left)
    where x.id = st.id;
    get diagnostics changed = row_count;
    if changed = 0 then
      perform set_config('grimoire.status_command', '', true);
      raise exception 'That status has no timer.';
    end if;
  else
    if st.ends_at is null then
      perform set_config('grimoire.status_command', '', true);
      raise exception 'That status has no timer.';
    end if;
    update public.character_statuses s
    set ends_at = now_at + seconds_left, total_seconds = greatest(coalesce(s.total_seconds, seconds_left), seconds_left)
    where s.id = st.id
    returning * into st;
  end if;
  perform set_config('grimoire.status_command', '', true);
  return st;
end;
$$;
revoke execute on function public.set_status_time(uuid, bigint, integer) from public, anon;
grant execute on function public.set_status_time(uuid, bigint, integer) to authenticated, service_role;

insert into public.logged_commands (name, level, gm_only) values ('status.setTime', 'simple', true);
