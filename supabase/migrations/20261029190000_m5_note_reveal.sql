-- M5 step 6, fix forward (review of #154): a note added to a log line kept for Downtime (a check result's) is
-- hidden like that line. Until now a note took only its entry's audience, so a GM's note on a check line ("all")
-- reached players before the campaign went into Downtime (hidden means hidden).
--   * notes.reveal_at: copied from the entry it's added to ('now' or 'downtime'), never changed after.
--   * Members read a 'downtime' note only once its entry is revealed (the campaign has gone into Downtime after it);
--     the GM always reads it. The note's own log lines follow the same rule.
--
-- What it changes, plainly. Adds one column to notes (default 'now', so every existing note stays as it is) and two
-- small functions. Replaces private.prepare_note and private.guard_note_update (the same, plus reveal_at) and the
-- rule "notes: read what you may see" (the same, plus the Downtime rule). Drops nothing; no rows are removed.

alter table public.notes add column reveal_at text not null default 'now' check (reveal_at in ('now', 'downtime'));

-- Whether a log line has reached members: written for now, or kept for Downtime and the campaign has gone into
-- Downtime since.
create function private.event_revealed(event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select e.reveal_at = 'now' or private.revealed_by_downtime(e.campaign_id, e.seq)
    from public.events e where e.id = event
  ), true);
$$;
revoke execute on function private.event_revealed(uuid) from public, anon;
grant execute on function private.event_revealed(uuid) to authenticated, service_role;

-- As in 20261021120000_m2_notes.sql, plus: a note on an entry also takes when that entry reaches players.
create or replace function private.prepare_note() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  entry public.events;
begin
  if new.about_actor_id is not null
    and not exists (select 1 from public.actors a where a.id = new.about_actor_id and a.campaign_id = new.campaign_id) then
    raise exception 'That character isn''t in this campaign.' using errcode = '42501';
  end if;
  new.audience := 'all';
  new.owner_user_id := null;
  new.reveal_at := 'now';
  if new.annotates_event_id is not null then
    select * into entry from public.events e where e.id = new.annotates_event_id;
    if entry.id is null or entry.campaign_id <> new.campaign_id then
      raise exception 'That log entry isn''t in this campaign.' using errcode = '42501';
    end if;
    new.audience := entry.audience;
    new.owner_user_id := entry.owner_user_id;
    new.reveal_at := entry.reveal_at;
  end if;
  return new;
end;
$$;

-- As in 20261021120000_m2_notes.sql, plus reveal_at: only a note's text changes.
create or replace function private.guard_note_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.campaign_id is distinct from old.campaign_id
    or new.about_actor_id is distinct from old.about_actor_id
    or new.annotates_event_id is distinct from old.annotates_event_id
    or new.audience is distinct from old.audience
    or new.owner_user_id is distinct from old.owner_user_id
    or new.reveal_at is distinct from old.reveal_at then
    raise exception 'Only a note''s text can change.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- As in 20261021120000_m2_notes.sql, plus: a note kept for Downtime once its entry is revealed.
drop policy "notes: read what you may see" on public.notes;
create policy "notes: read what you may see" on public.notes
  for select to authenticated
  using (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and (audience = 'all' or (audience = 'owner' and owner_user_id = (select auth.uid())))
      and (reveal_at = 'now' or private.event_revealed(annotates_event_id))
    )
  );

-- A note's log lines reach players when the note does: kept for Downtime while its entry is.
create function private.log_reveal_notes(old_row jsonb, new_row jsonb) returns text
language sql stable set search_path = '' as $$
  select case
    when coalesce(new_row, old_row) ->> 'reveal_at' = 'downtime'
      and not private.event_revealed((coalesce(new_row, old_row) ->> 'annotates_event_id')::uuid) then 'downtime'
    else 'now'
  end;
$$;
revoke execute on function private.log_reveal_notes(jsonb, jsonb) from public, anon, authenticated;
