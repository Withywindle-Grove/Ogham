-- M1 characters: starting level and the GM's review note, set by the GM only;
-- a player's first approved character becomes their active one; waiting characters are never active.

alter table public.actors
  add column level integer not null default 1 check (level >= 1),
  add column review_note text not null default '';

-- Players create their own characters and companions: pending, level 1, no review note, outside any company.
drop policy "actors: GM or player creates" on public.actors;
create policy "actors: GM or player creates" on public.actors
  for insert to authenticated
  with check (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and owner_type = 'user' and owner_user_id = (select auth.uid())
      and approval = 'pending'
      and level = 1 and review_note = ''
      and kind in ('pc', 'hireling', 'animal', 'vehicle')
      and company_id is null
    )
  );

-- Players edit their own characters; only the GM approves them, sets the level or the review note,
-- or changes owner, kind or company. A player may resubmit a rejected character (rejected -> pending).
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
  if new.level is distinct from old.level or new.review_note is distinct from old.review_note then
    raise exception 'Only the GM can set a character''s level or review note.' using errcode = '42501';
  end if;
  if new.approval is distinct from old.approval
    and not (old.approval = 'rejected' and new.approval = 'pending') then
    raise exception 'Only the GM can approve or reject characters.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- The active character must be one of the member's own, approved characters.
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
        and a.approval = 'approved'
    ) then
    raise exception 'You can only switch to one of your own approved characters.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- When the GM approves a player's character and the player has no active one yet, it becomes active.
-- Runs with the database's own rights: the GM can't otherwise change a player's member row.
create function private.activate_first_approved() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.approval = 'approved' and old.approval is distinct from 'approved'
    and new.kind = 'pc' and new.owner_type = 'user' then
    update public.members
    set active_actor_id = new.id
    where campaign_id = new.campaign_id and user_id = new.owner_user_id and active_actor_id is null;
  end if;
  return new;
end;
$$;
revoke execute on function private.activate_first_approved() from public, anon, authenticated;

create trigger activate_first_approved after update on public.actors
  for each row execute function private.activate_first_approved();
