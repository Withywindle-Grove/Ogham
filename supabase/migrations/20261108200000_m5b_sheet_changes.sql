-- M5b, the full sheet revised (docs/plans/m5b-sheet-revised.md, B; ruled 2026-11-08, evening: "Details don't need
-- approval"). A player's change to a score or to Max HP on an approved character goes to the GM as a request; the
-- sheet shows the old figure until the GM approves it.
--   1. sheet_changes: one row per change asked for: the character, its player (the requester), the field ('hpMax',
--      or the key of the campaign's number field that holds a score), its words ("Muscle"), the figure before and
--      the one asked for, and the answer: waiting, approved, refused (with the GM's reason) or withdrawn (Take back).
--      Hidden means hidden: the GM and the character's player read a character's changes; no other player does.
--      The log lines are the player's own (the GM reads every line).
--      Its own table, not public.requests: a request is a question for the table's time (Scene, Town) and its kind
--      list would have to be dropped and made again; a sheet change carries a field and two figures, and approving
--      it writes the character in the same change.
--   2. request_sheet_change (sheet.requestChange): the character's player, on an approved, active character. A change
--      to a field that already waits takes the waiting one back in the same change. A repeat changes nothing.
--   3. take_back_sheet_change (sheet.takeBackChange): its player, while it waits.
--   4. answer_sheet_change (sheet.approveChange, sheet.refuseChange): the GM. Approve writes the figure onto the
--      character (hp_max, or the field's value) in the same change, so one Undo puts both back; Refuse keeps the
--      GM's reason (optional) for the player's line.
--   5. logged_commands rows; the table joins public.undoable_tables, and sheet.requestChange public.undoable_makings
--      (Undo marks the request undone).
-- Adds one table with its rules, triggers and policy, three functions and rows in the app's command lists.
-- Replaces nothing. Drops, renames and deletes nothing.

-- 1. The changes -----------------------------------------------------------------------------------------------------

create table public.sheet_changes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  actor_id uuid not null references public.actors (id) on delete cascade,
  -- The character's player when it was asked (who reads it, with the GM).
  requester_id uuid references public.profiles (id) on delete set null,
  field text not null check (length(field) between 1 and 60),
  label text not null check (length(label) between 1 and 80),
  from_value integer check (from_value is null or from_value between -9999 and 9999),
  to_value integer not null check (to_value between 1 and 9999),
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'refused', 'withdrawn')),
  reason text not null default '' check (length(reason) <= 500),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  undone boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sheet_changes_actor on public.sheet_changes (actor_id, created_at desc) where not undone;
create index sheet_changes_waiting on public.sheet_changes (campaign_id) where status = 'waiting' and not undone;

alter table public.sheet_changes enable row level security;
grant select on public.sheet_changes to authenticated;
grant select, insert, update, delete on public.sheet_changes to service_role;

create policy "sheet changes: the GM and the character's player" on public.sheet_changes
  for select to authenticated using (
    private.is_gm(campaign_id) or (private.is_member(campaign_id) and requester_id = (select auth.uid()))
  );

-- Written only by the functions below (and put back by an undo): the row's place never changes; its answer once.
create function private.sheet_change_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reverting boolean := nullif(current_setting('grimoire.reverting', true), '') is not null;
begin
  if tg_op = 'INSERT' then
    new.status := 'waiting';
    new.reason := '';
    new.answered_by := null;
    new.answered_at := null;
    new.undone := false;
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id or new.actor_id is distinct from old.actor_id
    or new.requester_id is distinct from old.requester_id or new.field is distinct from old.field
    or new.label is distinct from old.label or new.from_value is distinct from old.from_value
    or new.to_value is distinct from old.to_value or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed.';
  end if;
  new.updated_at := now();
  if reverting then
    return new;
  end if;
  if old.undone then
    raise exception 'That change was undone.';
  end if;
  if new.undone <> old.undone then
    raise exception 'That can''t be changed.';
  end if;
  if old.status <> 'waiting' then
    raise exception 'That change was already %.', old.status;
  end if;
  return new;
end;
$$;
revoke execute on function private.sheet_change_rules() from public, anon, authenticated;

create trigger check_copy_version before insert or update on public.sheet_changes
  for each row execute function private.check_copy_version();
create trigger sheet_change_rules before insert or update on public.sheet_changes
  for each row execute function private.sheet_change_rules();
create trigger refuse_when_retired before insert or update or delete on public.sheet_changes
  for each row execute function private.refuse_when_retired();
create trigger log_change after insert or update on public.sheet_changes
  for each row execute function private.log_change();

-- A change's lines are its player's own (the GM reads every line).
create function private.log_audience_sheet_changes(old_row jsonb, new_row jsonb, out who_sees text, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_row jsonb := coalesce(new_row, old_row);
begin
  owner := (this_row ->> 'requester_id')::uuid;
  who_sees := case when owner is null then 'gm' else 'owner' end;
end;
$$;
revoke execute on function private.log_audience_sheet_changes(jsonb, jsonb) from public, anon, authenticated;

insert into public.undoable_tables (name) values ('sheet_changes');

-- 2. Asking ----------------------------------------------------------------------------------------------------------

-- sheet.requestChange: the character's player asks for a score or Max HP. `field` is 'hpMax' or the key of one of the
-- campaign's number fields; `label` its words. The figure before is read here, never sent.
create function public.request_sheet_change(actor uuid, field text, label text, to_value integer)
returns public.sheet_changes
language plpgsql security definer set search_path = '' as $$
declare
  made uuid := private.made_by_request('sheet_changes');
  change public.sheet_changes;
  who public.actors;
  before integer;
  raw jsonb;
begin
  if made is not null then
    select * into change from public.sheet_changes s where s.id = made;
    return change;
  end if;
  select * into who from public.actors a where a.id = actor;
  if who.id is null or who.owner_type <> 'user' or who.owner_user_id is distinct from (select auth.uid())
    or not private.is_member(who.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if who.approval <> 'approved' or who.status <> 'active' then
    raise exception 'Only a character in play asks the GM for a change.';
  end if;
  if to_value is null or to_value < 1 or to_value > 9999 then
    raise exception 'Ask for a whole number from 1 to 9999.';
  end if;
  if label is null or length(trim(label)) = 0 or length(trim(label)) > 80 then
    raise exception 'Say what the change is to.';
  end if;
  if request_sheet_change.field = 'hpMax' then
    before := who.hp_max;
  elsif request_sheet_change.field is not null and exists (
    select 1 from public.field_definitions f where f.campaign_id = who.campaign_id and f.key = request_sheet_change.field and f.type = 'number'
  ) then
    raw := who.fields -> request_sheet_change.field;
    before := case when jsonb_typeof(raw) = 'number' then (raw #>> '{}')::numeric::integer end;
  else
    raise exception 'That figure can''t be asked for.';
  end if;
  if before is not distinct from to_value then
    raise exception 'That''s the figure already.';
  end if;
  -- One change waits per figure: a new one takes the waiting one back, in the same change.
  update public.sheet_changes s set status = 'withdrawn'
  where s.actor_id = actor and s.field = request_sheet_change.field and s.status = 'waiting' and not s.undone;
  insert into public.sheet_changes (campaign_id, actor_id, requester_id, field, label, from_value, to_value)
  values (who.campaign_id, who.id, who.owner_user_id, request_sheet_change.field, trim(request_sheet_change.label), before, request_sheet_change.to_value)
  returning * into change;
  return change;
end;
$$;
revoke execute on function public.request_sheet_change(uuid, text, text, integer) from public, anon;
grant execute on function public.request_sheet_change(uuid, text, text, integer) to authenticated, service_role;

-- 3. Take back -------------------------------------------------------------------------------------------------------

-- sheet.takeBackChange: its player, while it waits. A repeat changes nothing.
create function public.take_back_sheet_change(change uuid, seen_version integer default null)
returns public.sheet_changes
language plpgsql security definer set search_path = '' as $$
declare
  found public.sheet_changes;
begin
  select * into found from public.sheet_changes s where s.id = change;
  if found.id is null or found.requester_id is distinct from (select auth.uid()) or not private.is_member(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.status = 'withdrawn' then
    return found;
  end if;
  if found.status <> 'waiting' or found.undone then
    raise exception 'Your GM has answered it already.';
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  update public.sheet_changes s set status = 'withdrawn' where s.id = change returning * into found;
  return found;
end;
$$;
revoke execute on function public.take_back_sheet_change(uuid, integer) from public, anon;
grant execute on function public.take_back_sheet_change(uuid, integer) to authenticated, service_role;

-- 4. The GM's answer -------------------------------------------------------------------------------------------------

-- sheet.approveChange (approve true) and sheet.refuseChange (approve false): the GM. Approving writes the figure onto
-- the character in the same change. A repeat changes nothing.
create function public.answer_sheet_change(change uuid, approve boolean, reason text default '', seen_version integer default null)
returns public.sheet_changes
language plpgsql security definer set search_path = '' as $$
declare
  found public.sheet_changes;
begin
  select * into found from public.sheet_changes s where s.id = change;
  if found.id is null or not private.is_gm(found.campaign_id) then
    raise exception 'You don''t have permission to do that.' using errcode = '42501';
  end if;
  if found.status in ('approved', 'refused') and private.repeated_request('sheet_changes', found.id) then
    return found;
  end if;
  if found.status = 'withdrawn' then
    raise exception 'Its player took it back.';
  end if;
  if found.status <> 'waiting' or found.undone then
    raise exception 'That change was already %.', found.status;
  end if;
  if seen_version is not null and seen_version <> found.version then
    raise exception 'That''s changed since. Here''s the latest.' using errcode = 'GR409';
  end if;
  if length(coalesce(reason, '')) > 500 then
    raise exception 'Keep the reason under 500 characters.';
  end if;
  if approve then
    if found.field = 'hpMax' then
      update public.actors a set hp_max = found.to_value where a.id = found.actor_id;
    else
      update public.actors a set fields = coalesce(a.fields, '{}'::jsonb) || jsonb_build_object(found.field, found.to_value)
      where a.id = found.actor_id;
    end if;
  end if;
  update public.sheet_changes s
  set status = case when approve then 'approved' else 'refused' end,
    reason = case when approve then '' else trim(coalesce(answer_sheet_change.reason, '')) end,
    answered_by = (select auth.uid()), answered_at = now()
  where s.id = change returning * into found;
  return found;
end;
$$;
revoke execute on function public.answer_sheet_change(uuid, boolean, text, integer) from public, anon;
grant execute on function public.answer_sheet_change(uuid, boolean, text, integer) to authenticated, service_role;

-- 5. Logged-command rows and undo ------------------------------------------------------------------------------------

insert into public.logged_commands (name, level, gm_only) values
  ('sheet.requestChange', 'simple', false),
  ('sheet.takeBackChange', 'simple', false),
  ('sheet.approveChange', 'simple', true),
  ('sheet.refuseChange', 'simple', true);
-- Asking makes a row: Undo marks it undone.
insert into public.undoable_makings (name) values ('sheet.requestChange');
