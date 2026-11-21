-- M1 characters: removing, split by whether the character ever entered play.
-- Never approved (waiting or sent back): its owner or the GM deletes it for good.
-- Approved: its owner or the GM archives it (status 'archived': kept, not active); only the GM restores it,
-- or deletes an archived character permanently (a testing aid; revisit once the event log exists).

create policy "actors: delete unapproved, or archived by the GM" on public.actors
  for delete to authenticated
  using (
    (approval <> 'approved' and (
      private.is_gm(campaign_id)
      or (owner_type = 'user' and owner_user_id = (select auth.uid()))
    ))
    or (status = 'archived' and private.is_gm(campaign_id))
  );

-- Players may archive their own characters, but not set any other status or un-archive.
create or replace function private.guard_actor_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id then
    raise exception 'A character can''t move to another campaign.' using errcode = '42501';
  end if;
  if private.is_gm(old.campaign_id) then
    return new;
  end if;
  if new.owner_type is distinct from old.owner_type
    or new.owner_user_id is distinct from old.owner_user_id
    or new.kind is distinct from old.kind
    or new.company_id is distinct from old.company_id then
    raise exception 'Only the GM can change a character''s owner, kind or company.' using errcode = '42501';
  end if;
  if new.review_note is distinct from old.review_note then
    raise exception 'Only the GM can write a review note.' using errcode = '42501';
  end if;
  if new.level is distinct from old.level and old.approval = 'approved' then
    raise exception 'Only the GM can change an approved character''s level.' using errcode = '42501';
  end if;
  if new.approval is distinct from old.approval
    and not (old.approval = 'rejected' and new.approval = 'pending') then
    raise exception 'Only the GM can approve or reject characters.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
    and not (new.status = 'archived' and old.status <> 'archived' and old.approval = 'approved') then
    raise exception 'Players can only remove (archive) an approved character; the GM restores it.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- The active character must be one of the member's own approved characters that isn't archived.
create or replace function private.guard_member_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.campaign_id is distinct from old.campaign_id
    or new.user_id is distinct from old.user_id
    or new.base_role is distinct from old.base_role
    or new.joined_at is distinct from old.joined_at then
    raise exception 'Only the active character can be changed here.' using errcode = '42501';
  end if;
  if new.active_actor_id is not null and new.active_actor_id is distinct from old.active_actor_id
    and not exists (
      select 1 from public.actors a
      where a.id = new.active_actor_id and a.campaign_id = new.campaign_id
        and a.owner_type = 'user' and a.owner_user_id = new.user_id
        and a.approval = 'approved' and a.status <> 'archived'
    ) then
    raise exception 'You can only switch to one of your own approved characters.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Archiving the active character leaves its player with no active one (they pick another).
create function private.clear_archived_active() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'archived' and old.status is distinct from 'archived' then
    update public.members set active_actor_id = null where active_actor_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function private.clear_archived_active() from public, anon, authenticated;

create trigger clear_archived_active after update on public.actors
  for each row execute function private.clear_archived_active();
