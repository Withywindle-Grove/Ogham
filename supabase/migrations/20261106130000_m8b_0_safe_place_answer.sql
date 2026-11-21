-- In a safe place? (m8b-0 delivery 5, ruled 2026-11-06, docs/plans/m8b-0-places-from-packs.md): safety is no longer
-- a property of a place but one question on End expedition's summary, "In a safe place?" · Yes · No. The answer is
-- kept with the expedition's end, so the summary's offer (Start downtime · Not yet, after Yes) reads it back.
--   1. expeditions.ended_safe: null (not answered), true (Yes) or false (No). Who reads and writes it: the
--      expedition's own rules, unchanged ("expeditions: members read", "expeditions: the GM changes one").
--   2. private.expedition_rules (newest copy: 20261029170000_m5_clock.sql): as there, plus an expedition that isn't
--      ended has no answer. So Undo of End expedition (which puts ended_at back to null) forgets the answer in the
--      same reversing change, and a new expedition starts unanswered.
--   3. public.answer_safe_place(expedition, safe): the GM's; only on an ended expedition that wasn't undone; the
--      answer can be changed while the summary is up (the other button). The same answer again changes nothing and
--      writes no line.
--   4. The command's logged_commands row: expedition.safePlace, Verbose, the GM's (the Simple log folds a Yes into
--      End expedition's own line when it's read: "ended the expedition in a safe place").
-- Adds one column (null by default), one function and one logged_commands row; replaces one function. Drops nothing;
-- no rows are removed, renamed or changed (every expedition so far reads as not answered). places.safety stays,
-- unwritten by the app.

-- 1. The answer --------------------------------------------------------------------------------------------------------

alter table public.expeditions add column ended_safe boolean;

comment on column public.expeditions.ended_safe is 'In a safe place? (m8b-0 delivery 5): the GM''s answer on End expedition''s summary; null until answered, and while the expedition is under way. Logged as expedition.safePlace.';

-- 2. The expedition's rules -------------------------------------------------------------------------------------------

-- As in 20261029170000_m5_clock.sql, plus: not ended, not answered (a new expedition, or an End undone).
create or replace function private.expedition_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select c.seconds into new.started_at from public.campaign_clocks c where c.campaign_id = new.campaign_id;
    new.started_at := coalesce(new.started_at, 0);
    new.ended_at := null;
    new.summary := null;
    new.ended_safe := null;
    new.undone := false;
    new.started_by := (select auth.uid());
    select s.id into new.session_id from public.sessions s
    where s.campaign_id = new.campaign_id and s.ended_at is null and not s.undone;
    select coalesce(array_agg(a.id order by a.created_at, a.id), '{}') into new.who_went from public.actors a
    where a.campaign_id = new.campaign_id and a.kind = 'pc' and a.approval = 'approved' and a.status = 'active';
    return new;
  end if;
  if old.undone then
    raise exception 'That expedition was undone.';
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.started_at is distinct from old.started_at
    or new.who_went is distinct from old.who_went or new.session_id is distinct from old.session_id
    or new.started_by is distinct from old.started_by then
    raise exception 'That can''t be changed.';
  end if;
  -- An expedition under way has no answer: Undo of End forgets it with the same change.
  if new.ended_at is null then
    new.ended_safe := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.expedition_rules() from public, anon, authenticated;

-- 3. Answer In a safe place? -------------------------------------------------------------------------------------------

create function public.answer_safe_place(expedition uuid, safe boolean) returns public.expeditions
language plpgsql security invoker set search_path = '' as $$
declare
  found public.expeditions;
begin
  select * into found from public.expeditions x where x.id = expedition;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.undone then
    raise exception 'That expedition was undone.';
  end if;
  if found.ended_at is null then
    raise exception 'End the expedition first.';
  end if;
  if safe is null then
    raise exception 'Answer Yes or No.';
  end if;
  -- The same answer again (or the same request sent again): nothing changes, no second line.
  if found.ended_safe is not distinct from safe then
    return found;
  end if;
  update public.expeditions x set ended_safe = safe where x.id = expedition returning * into found;
  if found.id is null then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  return found;
end;
$$;
revoke execute on function public.answer_safe_place(uuid, boolean) from public, anon;
grant execute on function public.answer_safe_place(uuid, boolean) to authenticated, service_role;

-- 4. The command -------------------------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values ('expedition.safePlace', 'verbose', true);
