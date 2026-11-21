-- M1 characters: the player chooses the starting level (then rolls HP for it); the GM approves or sends back.
-- A player may set the level when creating a character and change it while it's waiting or sent back.
-- Once approved, only the GM changes it (until the level-up feature exists). The review note stays GM-only.

drop policy "actors: GM or player creates" on public.actors;
create policy "actors: GM or player creates" on public.actors
  for insert to authenticated
  with check (
    private.is_gm(campaign_id)
    or (
      private.is_member(campaign_id)
      and owner_type = 'user' and owner_user_id = (select auth.uid())
      and approval = 'pending'
      and review_note = ''
      and kind in ('pc', 'hireling', 'animal', 'vehicle')
      and company_id is null
    )
  );

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
  return new;
end;
$$;
